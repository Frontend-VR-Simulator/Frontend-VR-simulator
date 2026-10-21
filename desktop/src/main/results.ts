import { createHash } from "node:crypto";
import { createReadStream, watch, type FSWatcher } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

// The VR application writes one results file per finished session into the folder
// of -ResultsPath, named results-<anything>.json (results.json and result.json are
// read too). A file without a sessionId gets one from the launcher. The launcher moves each file into a durable outbox
// keyed by sessionId, uploads the results, then the recording, and retries anything
// that fails until it succeeds or the server rejects it.

type RecordingInfo = { path?: string; durationSeconds?: number; contentType?: string };
type ResultsPayload = { sessionId: string; userId: string; recording?: RecordingInfo | null; [key: string]: unknown };

type OutboxEntry = {
  payload: ResultsPayload;
  resultsDir: string;
  receivedAt: string;
  sourceFile?: string;
  // Who was signed in to the launcher when the file was picked up; diagnostic only.
  signedInUserId?: string | null;
  serverSessionId?: string;
  recordingDone?: boolean;
  recordingMissingChecks?: number;
  lastError?: string;
};

export type SyncStatus = { pending: number; syncing: boolean; lastUploadedAt: string | null; error?: string };
type Credentials = { userId: string; accessToken: string };

type Options = {
  resultsPath: () => string;
  dataDir: () => string;
  apiUrl: string;
  getCredentials: () => Credentials | null;
  onStatus: (status: SyncStatus) => void;
  onAuthExpired: () => void;
  // Tests shorten these; the launcher uses the defaults.
  timing?: Partial<Timing>;
};

type Timing = { retryMs: number; pollMs: number; settleMs: number; parseRetryMs: number; recordingSettleMs: number };
const DEFAULT_TIMING: Timing = { retryMs: 60_000, pollMs: 5_000, settleMs: 750, parseRetryMs: 1_000, recordingSettleMs: 2_000 };

const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const RESULTS_FILE_PATTERN = /^results?(-.+)?\.json$/i;
const PARSE_RETRIES = 10;
// Recording files can be finalised after results.json; give up after ~10 minutes of retries.
const RECORDING_MISSING_LIMIT = 10;
const RECORDING_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", avi: "video/x-msvideo" };

class AuthExpiredError extends Error {}
class RejectedError extends Error {}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// sessionId may contain ":", which Windows does not allow in file names (NTFS would
// write an alternate data stream instead), so outbox names are percent-encoded.
// Ids without ":" keep the same name as before.
const entryName = (sessionId: string) => `${encodeURIComponent(sessionId)}.json`;

// Windows tools often add a byte-order mark: PowerShell 5.1 writes UTF-8 with a BOM and
// Unreal's FFileHelper::SaveStringToFile writes UTF-16 for non-ASCII text. JSON.parse
// rejects both, so decode by BOM first.
async function readJsonFile(file: string): Promise<unknown> {
  const bytes = await readFile(file);
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = bytes.subarray(2).toString("utf16le");
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = Buffer.from(bytes.subarray(2)).swap16().toString("utf16le");
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) text = bytes.subarray(3).toString("utf8");
  else text = bytes.toString("utf8");
  return JSON.parse(text);
}

async function fileSize(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

async function moveFile(from: string, to: string) {
  try {
    await rename(from, to);
  } catch {
    // rename fails across drives (e.g. results on D:, launcher data on C:).
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

async function writeJson(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export function createResultsSync(options: Options) {
  const outboxDir = () => path.join(options.dataDir(), "results-outbox");
  const sentDir = () => path.join(options.dataDir(), "results-sent");
  const rejectedDir = () => path.join(options.dataDir(), "results-rejected");

  let watcher: FSWatcher | null = null;
  let settleTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let pollTimer: NodeJS.Timeout | null = null;
  let flushing: Promise<void> | null = null;
  let flushAgain = false;
  let intakeRunning = false;
  let intakeAgain = false;
  const timing: Timing = { ...DEFAULT_TIMING, ...options.timing };
  const resultsDir = () => path.dirname(options.resultsPath());
  const isResultsFile = (name: string) => name === path.basename(options.resultsPath()) || RESULTS_FILE_PATTERN.test(name);
  let status: SyncStatus = { pending: 0, syncing: false, lastUploadedAt: null };

  function setStatus(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch };
    options.onStatus(status);
  }

  async function pendingFiles() {
    try {
      return (await readdir(outboxDir())).filter((name) => name.endsWith(".json")).sort();
    } catch {
      return [];
    }
  }

  async function refreshPending() {
    setStatus({ pending: (await pendingFiles()).length });
  }

  async function request(method: string, route: string, body?: unknown) {
    const credentials = options.getCredentials();
    if (!credentials) throw new AuthExpiredError("Not signed in.");
    const response = await fetch(`${options.apiUrl}${route}`, {
      method,
      headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.status === 401) throw new AuthExpiredError("Your sign-in has expired.");
    return { status: response.status, ok: response.ok, data };
  }

  async function resultsFiles() {
    try {
      return (await readdir(resultsDir())).filter(isResultsFile).sort();
    } catch {
      return [];
    }
  }

  // The outbox entry is written before the source file is removed, so a crash in
  // between only leaves a file that is recognised as already queued on restart.
  async function intakeFile(resultsFile: string) {
    let payload: ResultsPayload | null = null;
    for (let attempt = 0; attempt < PARSE_RETRIES; attempt += 1) {
      if (await fileSize(resultsFile) === null) return;
      try {
        payload = await readJsonFile(resultsFile) as ResultsPayload;
        break;
      } catch {
        // The VR application may still be writing the file.
        await delay(timing.parseRetryMs);
      }
    }

    // The sessionId stops a session being saved twice when an upload is retried. When the
    // VR app leaves it out, it is derived from the file's contents, so the same file
    // always gets the same id, even if the launcher stops before the file is removed.
    if (payload && typeof payload === "object" && (payload.sessionId == null || payload.sessionId === "")) {
      payload.sessionId = `VR-${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32)}`;
    }

    const valid = payload && typeof payload === "object"
      && typeof payload.sessionId === "string" && SESSION_ID_PATTERN.test(payload.sessionId)
      && typeof payload.userId === "string" && payload.userId.length > 0;
    if (!payload || !valid) {
      // Without a sessionId and userId the file can never be uploaded, so keep it aside.
      await mkdir(rejectedDir(), { recursive: true });
      await moveFile(resultsFile, path.join(rejectedDir(), `invalid-${Date.now()}-${path.basename(resultsFile)}`));
      setStatus({ error: "The VR application wrote a results file that could not be read." });
      return;
    }

    const name = entryName(payload.sessionId);
    const target = path.join(outboxDir(), name);
    const alreadyQueued = await fileSize(target) !== null || await fileSize(path.join(sentDir(), name)) !== null;
    if (!alreadyQueued) {
      const entry: OutboxEntry = {
        payload,
        resultsDir: path.dirname(resultsFile),
        receivedAt: new Date().toISOString(),
        sourceFile: path.basename(resultsFile),
        signedInUserId: options.getCredentials()?.userId ?? null,
      };
      await writeJson(target, entry);
    }
    await rm(resultsFile, { force: true });
  }

  async function intakeResultsFiles() {
    if (intakeRunning) {
      intakeAgain = true;
      return;
    }
    intakeRunning = true;
    try {
      await mkdir(outboxDir(), { recursive: true });
      do {
        intakeAgain = false;
        for (const name of await resultsFiles()) {
          try {
            await intakeFile(path.join(resultsDir(), name));
          } catch (error) {
            // One unreadable file must not hold up the others; it is retried on the next scan.
            setStatus({ error: error instanceof Error ? `Could not read VR results: ${error.message}` : "Could not read VR results." });
          }
        }
      } while (intakeAgain);
    } finally {
      intakeRunning = false;
    }
    await refreshPending();
    void flush();
  }

  function resolveRecording(entry: OutboxEntry) {
    const recordingPath = entry.payload.recording?.path;
    if (!recordingPath) return null;
    return path.isAbsolute(recordingPath) ? recordingPath : path.join(entry.resultsDir, recordingPath);
  }

  async function uploadRecording(entry: OutboxEntry, sessionId: string) {
    const filePath = resolveRecording(entry);
    const size = filePath ? await fileSize(filePath) : null;
    if (!filePath || size === null || size === 0) {
      entry.recordingMissingChecks = (entry.recordingMissingChecks ?? 0) + 1;
      if (entry.recordingMissingChecks < RECORDING_MISSING_LIMIT) return false;
      await request("POST", `/sessions/${sessionId}/recording/unavailable`, { reason: "recording file not found on this computer" });
      return true;
    }

    // Wait until the VR application has finished writing the video.
    await delay(timing.recordingSettleMs);
    if (await fileSize(filePath) !== size) return false;

    const extension = path.extname(filePath).slice(1).toLowerCase() || "mp4";
    const prepared = await request("POST", `/sessions/${sessionId}/recording/upload-url`, { extension });
    if (prepared.status === 409) return true;
    if (!prepared.ok || typeof prepared.data?.uploadUrl !== "string") throw new Error(String(prepared.data?.message ?? "Could not prepare the recording upload."));

    const headers: Record<string, string> = {
      "Content-Type": entry.payload.recording?.contentType || RECORDING_TYPES[extension] || "application/octet-stream",
      "Content-Length": String(size),
      "x-upsert": "true",
    };
    if (typeof prepared.data.apiKey === "string") headers.apikey = prepared.data.apiKey;
    const upload = await fetch(prepared.data.uploadUrl, {
      method: "PUT",
      headers,
      body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!upload.ok) throw new Error(`Recording upload failed (${upload.status}).`);

    const completed = await request("POST", `/sessions/${sessionId}/recording/complete`, { durationSeconds: entry.payload.recording?.durationSeconds });
    if (!completed.ok) throw new Error(String(completed.data?.message ?? "Could not confirm the recording upload."));
    return true;
  }

  async function processEntry(fileName: string, credentials: Credentials) {
    const entryPath = path.join(outboxDir(), fileName);
    let entry: OutboxEntry;
    try {
      entry = JSON.parse(await readFile(entryPath, "utf8")) as OutboxEntry;
    } catch {
      // Entries are written atomically, so this only follows outside interference;
      // set it aside instead of blocking every entry queued after it.
      await mkdir(rejectedDir(), { recursive: true });
      await moveFile(entryPath, path.join(rejectedDir(), `unreadable-${Date.now()}-${fileName}`));
      return;
    }
    // Results stay queued until the user they belong to signs in.
    if (entry.payload.userId !== credentials.userId) return;

    try {
      if (!entry.serverSessionId) {
        const sent = await request("POST", "/results", entry.payload);
        if ([400, 403, 409].includes(sent.status)) throw new RejectedError(String(sent.data?.message ?? "The server rejected these results."));
        const session = sent.data?.session as { id?: string; recordingStatus?: string } | undefined;
        if (!sent.ok || !session?.id) throw new Error(String(sent.data?.message ?? "Could not upload VR results."));
        entry.serverSessionId = session.id;
        entry.recordingDone = !entry.payload.recording || session.recordingStatus !== "Processing";
        await writeJson(entryPath, entry);
      }
      if (!entry.recordingDone) {
        entry.recordingDone = await uploadRecording(entry, entry.serverSessionId);
        entry.lastError = undefined;
        await writeJson(entryPath, entry);
        if (!entry.recordingDone) return;
      }
      await mkdir(sentDir(), { recursive: true });
      await moveFile(entryPath, path.join(sentDir(), fileName));
      setStatus({ lastUploadedAt: new Date().toISOString(), error: undefined });
    } catch (error) {
      if (error instanceof AuthExpiredError) throw error;
      if (error instanceof RejectedError) {
        await mkdir(rejectedDir(), { recursive: true });
        await writeJson(path.join(rejectedDir(), fileName), { ...entry, lastError: error.message });
        await rm(entryPath, { force: true });
        setStatus({ error: `VR results were rejected: ${error.message}` });
        return;
      }
      entry.lastError = error instanceof Error ? error.message : String(error);
      await writeJson(entryPath, entry);
      setStatus({ error: `Upload pending, will retry: ${entry.lastError}` });
    }
  }

  async function runFlush() {
    const credentials = options.getCredentials();
    if (!credentials) return;
    setStatus({ syncing: true });
    try {
      for (const fileName of await pendingFiles()) {
        await processEntry(fileName, credentials);
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        setStatus({ error: "Sign in again to upload pending VR results." });
        options.onAuthExpired();
      } else {
        setStatus({ error: error instanceof Error ? error.message : "VR results sync failed." });
      }
    } finally {
      await refreshPending();
      setStatus({ syncing: false });
    }
  }

  function flush(): Promise<void> {
    if (flushing) {
      flushAgain = true;
      return flushing;
    }
    flushing = runFlush().finally(() => {
      flushing = null;
      if (flushAgain) {
        flushAgain = false;
        void flush();
      }
    });
    return flushing;
  }

  function scheduleIntake() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => void intakeResultsFiles(), timing.settleMs);
  }

  async function start() {
    await mkdir(resultsDir(), { recursive: true });
    await mkdir(outboxDir(), { recursive: true });
    watcher?.close();
    watcher = watch(resultsDir(), (_event, fileName) => {
      if (!fileName || isResultsFile(fileName.toString())) scheduleIntake();
    });
    watcher.on("error", () => undefined);
    // fs.watch can miss events on some drives; a cheap directory listing covers that.
    pollTimer = setInterval(() => {
      void resultsFiles().then((names) => { if (names.length) scheduleIntake(); });
    }, timing.pollMs);
    retryTimer = setInterval(() => void flush(), timing.retryMs);
    await refreshPending();
    // Files written while the launcher was closed are picked up here.
    await intakeResultsFiles();
  }

  function stop() {
    watcher?.close();
    watcher = null;
    for (const timer of [settleTimer, pollTimer, retryTimer]) if (timer) clearTimeout(timer);
    settleTimer = pollTimer = retryTimer = null;
  }

  return { start, stop, flush, getStatus: () => status };
}
