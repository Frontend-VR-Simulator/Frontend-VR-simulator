// Regression tests for the VR results hand-off (src/main/results.ts).
// A local HTTP server stands in for the backend with the same contract as
// backend/src/controller/vrController.js: idempotent on sessionId, 401 for an
// unknown token, 403 when results belong to another user, signed upload URLs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createResultsSync } from "../src/main/results.ts";

const LEARNER_A = { userId: "user-a", accessToken: "token-a" };
const LEARNER_B = { userId: "user-b", accessToken: "token-b" };
const TIMING = { settleMs: 50, pollMs: 200, retryMs: 300, parseRetryMs: 50, recordingSettleMs: 50 };

function startBackend() {
  const tokens = new Map([[LEARNER_A.accessToken, LEARNER_A.userId], [LEARNER_B.accessToken, LEARNER_B.userId]]);
  const state = { sessions: new Map(), posts: [], uploads: new Map(), unavailableAfter: 0, failResults: 0 };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    const url = new URL(req.url, "http://localhost");

    if (req.method === "PUT" && url.pathname.startsWith("/storage/")) {
      state.uploads.set(url.pathname.slice("/storage/".length), body);
      return send(200, {});
    }
    const user = tokens.get((req.headers.authorization || "").replace("Bearer ", ""));
    if (!user) return send(401, { message: "Invalid or expired authentication token." });

    if (req.method === "POST" && url.pathname === "/vr/results") {
      const payload = JSON.parse(body.toString());
      state.posts.push({ sessionId: payload.sessionId, user });
      if (state.failResults > 0) { state.failResults -= 1; return send(500, { message: "Could not save training results." }); }
      if (payload.userId !== user) return send(403, { message: "These results belong to a different user than the signed-in session." });
      const existing = [...state.sessions.values()].find((s) => s.sessionId === payload.sessionId);
      if (existing) {
        if (existing.owner !== user) return send(409, { message: "This session id is already used by another user." });
        return send(200, { duplicate: true, session: { id: existing.id, recordingStatus: existing.recordingStatus } });
      }
      const session = { id: randomUUID(), sessionId: payload.sessionId, owner: user, recordingStatus: payload.recording ? "Processing" : "Unavailable" };
      state.sessions.set(session.id, session);
      return send(201, { duplicate: false, session: { id: session.id, recordingStatus: session.recordingStatus } });
    }
    const match = url.pathname.match(/^\/vr\/sessions\/([^/]+)\/recording\/(upload-url|complete|unavailable)$/);
    if (req.method === "POST" && match) {
      const session = state.sessions.get(match[1]);
      if (!session || session.owner !== user) return send(404, { message: "Session not found." });
      if (match[2] === "upload-url") return send(200, { uploadUrl: `${state.base}/storage/${session.id}` });
      if (match[2] === "complete") {
        if (!state.uploads.has(session.id)) return send(409, { message: "The uploaded recording could not be found in storage." });
        session.recordingStatus = "Ready";
        return send(200, { recordingStatus: "Ready" });
      }
      session.recordingStatus = "Unavailable";
      return send(200, { recordingStatus: "Unavailable" });
    }
    return send(404, { message: "Route not found" });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    state.base = `http://127.0.0.1:${server.address().port}`;
    resolve({ state, server, apiUrl: `${state.base}/vr`, created: (sessionId) => [...state.sessions.values()].filter((s) => s.sessionId === sessionId) });
  }));
}

const backend = await startBackend();
after(() => backend.server.close());

async function setup(t, { credentials = LEARNER_A } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "vr-results-"));
  const ctx = {
    root,
    resultsDir: path.join(root, "results"),
    dataDir: path.join(root, "data"),
    credentials,
    authExpired: 0,
    instances: [],
  };
  await mkdir(ctx.resultsDir, { recursive: true });
  // Same call as desktop/src/main/index.ts, with the -ResultsPath default layout.
  ctx.launch = async (apiUrl = backend.apiUrl) => {
    const sync = createResultsSync({
      resultsPath: () => path.join(ctx.resultsDir, "results.json"),
      dataDir: () => ctx.dataDir,
      apiUrl,
      getCredentials: () => ctx.credentials,
      onStatus: () => undefined,
      onAuthExpired: () => { ctx.authExpired += 1; ctx.credentials = null; },
      timing: TIMING,
    });
    ctx.instances.push(sync);
    await sync.start();
    return sync;
  };
  t.after(async () => {
    for (const sync of ctx.instances) sync.stop();
    await rm(root, { recursive: true, force: true });
  });
  return ctx;
}

const results = (sessionId, extra = {}) => ({
  schemaVersion: 1, sessionId, userId: LEARNER_A.userId, type: "room", completedAt: new Date().toISOString(),
  rooms: [{ roomId: "granulation", score: 80, durationSeconds: 60 }], recording: null, ...extra,
});
// How Unreal is asked to write: a temporary name, then a rename to results-<sessionId>.json.
async function writeResults(ctx, payload, name = `results-${payload.sessionId.replace(/:/g, "_")}.json`) {
  const target = path.join(ctx.resultsDir, name);
  await writeFile(`${target}.tmp`, JSON.stringify(payload));
  await rename(`${target}.tmp`, target);
  return target;
}
const list = async (dir) => { try { return (await readdir(dir)).sort(); } catch { return []; } };
const sent = (ctx) => list(path.join(ctx.dataDir, "results-sent"));
const outbox = (ctx) => list(path.join(ctx.dataDir, "results-outbox"));
const rejected = (ctx) => list(path.join(ctx.dataDir, "results-rejected"));
async function waitFor(check, label, timeoutMs = 8_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) assert.fail(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
const id = (label) => `VR-${label}-${randomUUID().slice(0, 8)}`;

test("several sessions written in quick succession each upload exactly once", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const ids = Array.from({ length: 5 }, (_, i) => id(`burst${i}`));
  await Promise.all(ids.map((sessionId) => writeResults(ctx, results(sessionId))));
  await waitFor(async () => (await sent(ctx)).length === 5, "5 sent entries");
  for (const sessionId of ids) assert.equal(backend.created(sessionId).length, 1, sessionId);
  assert.deepEqual(await list(ctx.resultsDir), [], "hand-off folder is emptied");
});

test("sessions finished while the launcher was closed are all picked up on start", async (t) => {
  const ctx = await setup(t);
  const ids = [id("offline1"), id("offline2"), id("offline3")];
  for (const sessionId of ids) await writeResults(ctx, results(sessionId));
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 3, "3 sent entries");
  for (const sessionId of ids) assert.equal(backend.created(sessionId).length, 1);
});

test("the legacy fixed results.json name is still accepted", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const sessionId = id("legacy");
  await writeResults(ctx, results(sessionId), "results.json");
  await waitFor(async () => backend.created(sessionId).length === 1, "legacy upload");
});

test("a file without a sessionId gets one from its contents and is stored once", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const payload = results("", { note: randomUUID() });
  delete payload.sessionId;
  await writeResults(ctx, payload, "result.json");
  await waitFor(async () => (await sent(ctx)).length === 1, "generated-id upload");
  const [sessionId] = (await sent(ctx)).map((name) => decodeURIComponent(name.replace(/\.json$/, "")));
  assert.match(sessionId, /^VR-[0-9a-f]{32}$/);
  assert.equal(backend.created(sessionId).length, 1);

  // The same file written again maps to the same id, so it is not uploaded twice.
  await writeResults(ctx, payload, "result.json");
  await waitFor(async () => (await list(ctx.resultsDir)).length === 0, "repeat file removed");
  assert.equal(backend.created(sessionId).length, 1);
  assert.deepEqual(await sent(ctx), [`${sessionId}.json`]);
});

test("files with a UTF-8 or UTF-16 byte-order mark (PowerShell, Unreal) are accepted", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const encodings = {
    utf8bom: (text) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]),
    utf16le: (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
    utf16be: (text) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, "utf16le").swap16()]),
  };
  const ids = [];
  for (const [label, encode] of Object.entries(encodings)) {
    const sessionId = id(label);
    ids.push(sessionId);
    const target = path.join(ctx.resultsDir, `results-${sessionId}.json`);
    await writeFile(`${target}.tmp`, encode(JSON.stringify(results(sessionId))));
    await rename(`${target}.tmp`, target);
  }
  await waitFor(async () => ids.every((sessionId) => backend.created(sessionId).length === 1), "BOM uploads");
  assert.deepEqual(await rejected(ctx), []);
});

test("a file still being written under a .tmp name is ignored until it is renamed", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const sessionId = id("tmp");
  const tmp = path.join(ctx.resultsDir, `results-${sessionId}.json.tmp`);
  await writeFile(tmp, JSON.stringify(results(sessionId)));
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(backend.created(sessionId).length, 0);
  assert.deepEqual(await outbox(ctx), []);
  await rename(tmp, path.join(ctx.resultsDir, `results-${sessionId}.json`));
  await waitFor(async () => backend.created(sessionId).length === 1, "upload after rename");
});

test("the same sessionId in two files is uploaded once", async (t) => {
  const ctx = await setup(t);
  const sessionId = id("dup");
  await writeResults(ctx, results(sessionId), `results-${sessionId}.json`);
  await writeResults(ctx, results(sessionId), `results-${sessionId}-copy.json`);
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 1 && (await list(ctx.resultsDir)).length === 0, "one sent entry");
  assert.equal(backend.created(sessionId).length, 1);
});

test("a session queued while the server is unreachable uploads after a launcher restart", async (t) => {
  const ctx = await setup(t);
  const first = await ctx.launch("http://127.0.0.1:9/vr");
  const sessionId = id("restart");
  await writeResults(ctx, results(sessionId));
  await waitFor(async () => (await outbox(ctx)).length === 1 && (await list(ctx.resultsDir)).length === 0, "queued in outbox");
  first.stop();
  assert.equal(backend.created(sessionId).length, 0);
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 1, "sent after restart");
  assert.equal(backend.created(sessionId).length, 1);
});

test("a crash after the server stored the session but before the launcher recorded it does not duplicate it", async (t) => {
  const ctx = await setup(t);
  const sessionId = id("crash");
  // First launch uploads; then the local state is rolled back to "never sent", as if
  // the launcher died between the server's reply and writing the outbox entry.
  await ctx.launch();
  await writeResults(ctx, results(sessionId));
  await waitFor(async () => (await sent(ctx)).length === 1, "first upload");
  ctx.instances[0].stop();
  const entry = JSON.parse(await readFile(path.join(ctx.dataDir, "results-sent", `${sessionId}.json`), "utf8"));
  delete entry.serverSessionId;
  await rm(path.join(ctx.dataDir, "results-sent"), { recursive: true });
  await writeFile(path.join(ctx.dataDir, "results-outbox", `${sessionId}.json`), JSON.stringify(entry));
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 1, "re-sent after crash");
  assert.equal(backend.created(sessionId).length, 1, "server still holds one session");
  assert.equal(backend.state.posts.filter((p) => p.sessionId === sessionId).length, 2, "the re-send was answered as a duplicate");
});

test("a crash between queueing a file and deleting it leaves no duplicate", async (t) => {
  const ctx = await setup(t);
  const sessionId = id("halfway");
  const payload = results(sessionId);
  await mkdir(path.join(ctx.dataDir, "results-outbox"), { recursive: true });
  await writeFile(path.join(ctx.dataDir, "results-outbox", `${sessionId}.json`), JSON.stringify({ payload, resultsDir: ctx.resultsDir, receivedAt: new Date().toISOString() }));
  await writeResults(ctx, payload);
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 1 && (await list(ctx.resultsDir)).length === 0, "one upload, hand-off cleared");
  assert.equal(backend.state.posts.filter((p) => p.sessionId === sessionId).length, 1);
});

test("a session that was already sent is not uploaded again if its file reappears", async (t) => {
  const ctx = await setup(t);
  const sessionId = id("resent");
  await ctx.launch();
  await writeResults(ctx, results(sessionId));
  await waitFor(async () => (await sent(ctx)).length === 1, "first upload");
  ctx.instances[0].stop();
  await writeResults(ctx, results(sessionId));
  await ctx.launch();
  await waitFor(async () => (await list(ctx.resultsDir)).length === 0, "file cleared");
  assert.equal(backend.state.posts.filter((p) => p.sessionId === sessionId).length, 1);
});

test("results wait for their own learner and upload under that learner's sign-in", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const mine = id("mine");
  const theirs = id("theirs");
  await writeResults(ctx, results(mine));
  await writeResults(ctx, results(theirs, { userId: LEARNER_B.userId }));
  await waitFor(async () => backend.created(mine).length === 1, "learner A upload");
  await ctx.instances[0].flush();
  assert.equal(backend.state.posts.filter((p) => p.sessionId === theirs).length, 0, "never sent with learner A's token");
  assert.deepEqual(await outbox(ctx), [`${theirs}.json`]);
  const queued = JSON.parse(await readFile(path.join(ctx.dataDir, "results-outbox", `${theirs}.json`), "utf8"));
  assert.equal(queued.signedInUserId, LEARNER_A.userId, "records who was signed in at pick-up");

  ctx.credentials = LEARNER_B;
  await ctx.instances[0].flush();
  await waitFor(async () => backend.created(theirs).length === 1, "learner B upload");
  assert.equal(backend.created(theirs)[0].owner, LEARNER_B.userId);
  assert.equal(backend.created(mine)[0].owner, LEARNER_A.userId);
});

test("a file without a userId is set aside instead of waiting forever", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const sessionId = id("nouser");
  const { userId, ...payload } = results(sessionId);
  await writeResults(ctx, payload);
  await waitFor(async () => (await rejected(ctx)).some((name) => name.endsWith(`results-${sessionId}.json`)), "rejected file");
  assert.deepEqual(await outbox(ctx), []);
});

test("an unreadable file is set aside and the other sessions still upload", async (t) => {
  const ctx = await setup(t);
  const good = id("good");
  await writeFile(path.join(ctx.resultsDir, "results-broken.json"), "{ not json");
  await writeResults(ctx, results(good));
  await ctx.launch();
  await waitFor(async () => backend.created(good).length === 1, "good upload");
  await waitFor(async () => (await rejected(ctx)).some((name) => name.endsWith("results-broken.json")), "broken file set aside");
});

test("an expired sign-in keeps the results and uploads them after signing in again", async (t) => {
  const ctx = await setup(t, { credentials: { userId: LEARNER_A.userId, accessToken: "expired" } });
  await ctx.launch();
  const sessionId = id("expired");
  await writeResults(ctx, results(sessionId));
  await waitFor(() => ctx.authExpired > 0, "onAuthExpired");
  assert.deepEqual(await outbox(ctx), [`${sessionId}.json`]);
  ctx.credentials = LEARNER_A;
  await ctx.instances[0].flush();
  await waitFor(async () => backend.created(sessionId).length === 1, "upload after sign-in");
});

test("a temporary server error is retried and the session is still stored once", async (t) => {
  const ctx = await setup(t);
  backend.state.failResults = 2;
  await ctx.launch();
  const sessionId = id("flaky");
  await writeResults(ctx, results(sessionId));
  await waitFor(async () => (await sent(ctx)).length === 1, "upload after retries");
  assert.equal(backend.created(sessionId).length, 1);
  assert.equal(backend.state.posts.filter((p) => p.sessionId === sessionId).length, 3);
});

test("each session's recording is uploaded to its own session", async (t) => {
  const ctx = await setup(t);
  await mkdir(path.join(ctx.resultsDir, "recordings"), { recursive: true });
  const ids = [id("video1"), id("video2")];
  for (const [index, sessionId] of ids.entries()) {
    await writeFile(path.join(ctx.resultsDir, "recordings", `${sessionId}.mp4`), Buffer.alloc(1000 + index, index + 1));
    await writeResults(ctx, results(sessionId, { recording: { path: `recordings/${sessionId}.mp4`, durationSeconds: 60 } }));
  }
  await ctx.launch();
  await waitFor(async () => (await sent(ctx)).length === 2, "both sent");
  for (const [index, sessionId] of ids.entries()) {
    const [session] = backend.created(sessionId);
    assert.equal(session.recordingStatus, "Ready");
    assert.deepEqual(backend.state.uploads.get(session.id), Buffer.alloc(1000 + index, index + 1));
  }
});

test("a sessionId containing ':' is stored under a Windows-safe file name", async (t) => {
  const ctx = await setup(t);
  await ctx.launch();
  const sessionId = `VR:2026-10-19:${randomUUID().slice(0, 8)}`;
  await writeResults(ctx, results(sessionId));
  await waitFor(async () => (await sent(ctx)).length === 1, "upload");
  const [name] = await sent(ctx);
  assert.ok(!name.includes(":"), name);
  assert.equal(decodeURIComponent(name.replace(/\.json$/, "")), sessionId);
});

test("a corrupted outbox entry does not block the entries queued after it", async (t) => {
  const ctx = await setup(t);
  await mkdir(path.join(ctx.dataDir, "results-outbox"), { recursive: true });
  await writeFile(path.join(ctx.dataDir, "results-outbox", "AAA-corrupt.json"), "{ truncated");
  const sessionId = id("zzz");
  await writeResults(ctx, results(sessionId));
  await ctx.launch();
  await waitFor(async () => backend.created(sessionId).length === 1, "later entry uploads");
  assert.ok((await rejected(ctx)).some((name) => name.endsWith("AAA-corrupt.json")));
});
