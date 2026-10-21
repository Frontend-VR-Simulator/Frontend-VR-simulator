import path from "node:path";

import supabase from "../config/supabaseConfig.js";
import { ROOMS, ROOM_IDS, assessResult, roomName } from "../config/rooms.js";
import { recordAudit } from "../utility/audit.js";

const RECORDING_BUCKET = process.env.RECORDING_BUCKET || "session-recordings";
const PLAYBACK_URL_TTL_SECONDS = 60 * 60;
const PAGE_SIZE = 1000;
const IN_CHUNK = 150;

const USER_COLUMNS = "id, name, email, role, employee_id, batch, trainer_id, created_at";
const SESSION_COLUMNS = "id, trainee_id, trainer_id, session_type, room_id, attempt, score, result, critical_errors, duration_minutes, started_at, completed_at, recording_status, recording_duration_seconds, reviewed_at, rooms";

class ValidationError extends Error {}

function fail(message) {
  throw new ValidationError(message);
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function numberField(value, label, { min, max, optional = false }) {
  if (value == null && optional) return null;
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) fail(`${label} must be a number from ${min} to ${max}.`);
  return number;
}

// Dates before 2000 are an engine's empty value (Unreal writes 0001-01-01), so an
// optional date with one is treated as missing.
const EARLIEST_DATE = Date.UTC(2000, 0, 1);

function dateField(value, label, optional = false) {
  if (value == null && optional) return null;
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (optional && Number.isFinite(time) && time < EARLIEST_DATE) return null;
  if (!Number.isFinite(time) || time < EARLIEST_DATE) fail(`${label} must be an ISO 8601 date-time.`);
  return new Date(time).toISOString();
}

const MAX_POINTS = 100000;
const roundTo2 = (value) => Math.round(value * 100) / 100;

function textField(value, maxLength) {
  return value == null || value === "" ? null : String(value).slice(0, maxLength);
}

function normalizeStep(step, position, label) {
  if (!isObject(step)) fail(`${label}.steps[${position}] must be an object.`);
  const index = step.index == null ? position : numberField(step.index, `${label}.steps[${position}].index`, { min: 0, max: 99 });
  if (!Number.isInteger(index)) fail(`${label}.steps[${position}].index must be a whole number.`);
  return {
    index,
    name: textField(step.name, 200),
    points: numberField(step.points, `${label}.steps[${position}].points`, { min: 0, max: MAX_POINTS, optional: true }),
    maxPoints: numberField(step.maxPoints, `${label}.steps[${position}].maxPoints`, { min: 0, max: MAX_POINTS, optional: true }),
    critical: step.critical === true,
    error: textField(step.error, 500),
    timestampSeconds: numberField(step.timestampSeconds, `${label}.steps[${position}].timestampSeconds`, { min: 0, max: 86400, optional: true }),
  };
}

function normalizeRoom(room, position) {
  const label = `rooms[${position}]`;
  if (!isObject(room)) fail(`${label} must be an object.`);
  if (!ROOM_IDS.has(room.roomId)) fail(`${label}.roomId "${room.roomId}" is not a known room.`);
  if (room.steps != null && !Array.isArray(room.steps)) fail(`${label}.steps must be an array.`);
  if (room.competencies != null && !Array.isArray(room.competencies)) fail(`${label}.competencies must be an array.`);

  const durationSeconds = Math.round(numberField(room.durationSeconds, `${label}.durationSeconds`, { min: 0, max: 86400 }));
  const steps = (room.steps || []).slice(0, 100).map((step, index) => normalizeStep(step, index, label));

  // Each room has its own point total. The score is the points earned as a percentage
  // of the points available, so rooms with different totals can be compared.
  const scored = steps.filter((step) => step.maxPoints != null);
  let points;
  let maxPoints;
  if (scored.length) {
    points = roundTo2(scored.reduce((sum, step) => sum + (step.points ?? 0), 0));
    maxPoints = roundTo2(scored.reduce((sum, step) => sum + step.maxPoints, 0));
    if (points > maxPoints) fail(`${label} earned more points than its steps allow.`);
  } else if (room.maxPoints != null) {
    // Rooms without step results can send their own totals.
    maxPoints = numberField(room.maxPoints, `${label}.maxPoints`, { min: 0, max: MAX_POINTS });
    points = numberField(room.points, `${label}.points`, { min: 0, max: maxPoints });
  } else if (room.score != null) {
    // Older builds send only a score out of 100.
    points = numberField(room.score, `${label}.score`, { min: 0, max: 100 });
    maxPoints = 100;
  } else {
    fail(`${label} needs steps with points and maxPoints, or points and maxPoints for the room.`);
  }
  const score = maxPoints > 0 ? roundTo2((100 * points) / maxPoints) : 0;
  const criticalErrors = steps.length
    ? steps.filter((step) => step.error && step.critical).length
    : Math.round(numberField(room.criticalErrors ?? 0, `${label}.criticalErrors`, { min: 0, max: 1000 }));
  const competencies = (room.competencies || []).slice(0, 12).map((item, index) => {
    if (!isObject(item) || !textField(item.name, 80)) fail(`${label}.competencies[${index}] needs a name and score.`);
    return { name: textField(item.name, 80), score: numberField(item.score, `${label}.competencies[${index}].score`, { min: 0, max: 100 }) };
  });

  return {
    roomId: room.roomId,
    score,
    points,
    maxPoints,
    durationSeconds,
    minutes: Math.round(durationSeconds / 60),
    criticalErrors,
    result: assessResult(score, criticalErrors),
    recordingOffsetSeconds: numberField(room.recordingOffsetSeconds, `${label}.recordingOffsetSeconds`, { min: 0, max: 86400, optional: true }),
    steps,
    competencies,
  };
}

export const SCHEMA_VERSION = 2;

// Validates a results file and derives the stored session. Every session is a run
// through 1 to 11 rooms; each room in it is also counted as an attempt at that room.
export function normalizeResults(body) {
  if (!isObject(body)) fail("The results file must contain a JSON object.");
  if (typeof body.schemaVersion === "number" && body.schemaVersion > SCHEMA_VERSION) fail(`Unsupported schemaVersion. Expected ${SCHEMA_VERSION} or lower.`);
  if (typeof body.sessionId !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(body.sessionId)) {
    fail("sessionId must be 8-128 characters using letters, digits, '.', '_', ':' or '-'.");
  }
  if (typeof body.userId !== "string" || !body.userId) fail("userId is required.");
  if (!Array.isArray(body.rooms) || body.rooms.length === 0) fail("rooms must contain at least one room.");
  if (body.rooms.length > ROOMS.length) fail(`rooms can contain at most ${ROOMS.length} rooms.`);
  if (body.recording != null && !isObject(body.recording)) fail("recording must be an object or null.");

  const rooms = body.rooms.map(normalizeRoom);
  if (new Set(rooms.map((room) => room.roomId)).size !== rooms.length) fail("Each room may appear only once per session.");

  // The session score covers only the rooms played: all points earned out of all points available.
  const points = rooms.reduce((sum, room) => sum + room.points, 0);
  const maxPoints = rooms.reduce((sum, room) => sum + room.maxPoints, 0);
  const score = maxPoints > 0 ? roundTo2((100 * points) / maxPoints) : 0;
  const criticalErrors = rooms.reduce((sum, room) => sum + room.criticalErrors, 0);
  const durationSeconds = rooms.reduce((sum, room) => sum + room.durationSeconds, 0);

  return {
    sessionId: body.sessionId,
    userId: body.userId,
    type: "complete",
    roomId: rooms.length === 1 ? rooms[0].roomId : null,
    rooms,
    score,
    criticalErrors,
    durationMinutes: Math.round(durationSeconds / 60),
    result: assessResult(score, criticalErrors),
    startedAt: dateField(body.startedAt, "startedAt", true),
    completedAt: dateField(body.completedAt, "completedAt"),
    recording: body.recording
      ? { durationSeconds: numberField(body.recording.durationSeconds, "recording.durationSeconds", { min: 0, max: 86400, optional: true }) }
      : null,
  };
}

async function loadUser(id) {
  const { data } = await supabase.from("users").select(USER_COLUMNS).eq("id", id).maybeSingle();
  return data;
}

function sessionLabel(session) {
  return session.room_id ? roomName(session.room_id) : "Complete session";
}

function publicSession(session) {
  return {
    id: session.id,
    attempt: session.attempt,
    score: Number(session.score),
    result: session.result,
    recordingStatus: session.recording_status,
  };
}

async function canViewSession(user, session) {
  if (user.role === "admin" || user.role === "head") return true;
  if (user.role === "trainee") return session.trainee_id === user.userId;
  if (user.role === "trainer") {
    const { data } = await supabase.from("users").select("id").eq("id", session.trainee_id).eq("trainer_id", user.userId).maybeSingle();
    return Boolean(data);
  }
  return false;
}

async function ownedSession(req) {
  const { data } = await supabase
    .from("training_sessions")
    .select("id, trainee_id, session_type, room_id, attempt, recording_status, recording_path")
    .eq("id", req.params.id)
    .eq("trainee_id", req.user.userId)
    .maybeSingle();
  return data;
}

export async function ingestResults(req, res) {
  const actor = await loadUser(req.user.userId);
  if (!actor) return res.status(401).json({ message: "User could not be authenticated." });

  let results;
  try {
    results = normalizeResults(req.body);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    await recordAudit({ event: `Assessment rejected · ${error.message}`, category: "ingestion", actorId: actor.id, actorLabel: actor.name, outcome: "Failed" });
    return res.status(400).json({ message: error.message });
  }

  if (results.userId !== actor.id) {
    await recordAudit({ event: `Session identity mismatch · results for another user (${results.sessionId})`, category: "identity", actorId: actor.id, actorLabel: actor.name, outcome: "Failed" });
    return res.status(403).json({ message: "These results belong to a different user than the signed-in session." });
  }

  // The VR session id makes ingestion idempotent: re-sending a file returns the stored session.
  const { data: existing } = await supabase.from("training_sessions").select("id, trainee_id, attempt, score, result, recording_status").eq("external_id", results.sessionId).maybeSingle();
  if (existing) {
    if (existing.trainee_id !== actor.id) return res.status(409).json({ message: "This session id is already used by another user." });
    return res.status(200).json({ duplicate: true, session: publicSession(existing) });
  }

  // Sessions are numbered per trainee by completion time. Results queued offline can
  // arrive after later sessions, so any later sessions move up by one.
  const { data: previous, error: previousError } = await supabase.from("training_sessions").select("id, attempt, completed_at").eq("trainee_id", actor.id);
  if (previousError) return res.status(500).json({ message: "Could not save training results." });
  const completedAt = Date.parse(results.completedAt);
  const earlier = previous.filter((item) => Date.parse(item.completed_at) <= completedAt).length;
  const later = previous.filter((item) => Date.parse(item.completed_at) > completedAt);

  const { data: session, error } = await supabase.from("training_sessions").insert({
    external_id: results.sessionId,
    trainee_id: actor.id,
    trainer_id: actor.trainer_id,
    session_type: results.type,
    room_id: results.roomId,
    attempt: earlier + 1,
    score: results.score,
    result: results.result,
    critical_errors: results.criticalErrors,
    duration_minutes: results.durationMinutes,
    rooms: results.rooms,
    started_at: results.startedAt,
    completed_at: results.completedAt,
    recording_status: results.recording ? "Processing" : "Unavailable",
    recording_duration_seconds: results.recording?.durationSeconds ?? null,
    raw_payload: req.body,
  }).select("id, trainee_id, session_type, room_id, attempt, score, result, recording_status").single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabase.from("training_sessions").select("id, attempt, score, result, recording_status").eq("external_id", results.sessionId).maybeSingle();
      if (raced) return res.status(200).json({ duplicate: true, session: publicSession(raced) });
    }
    console.error("Results ingestion failed:", error.message);
    return res.status(500).json({ message: "Could not save training results." });
  }

  for (const item of later) {
    await supabase.from("training_sessions").update({ attempt: item.attempt + 1 }).eq("id", item.id);
  }

  await recordAudit({
    event: `Assessment ingested · ${actor.name}, ${sessionLabel(session)} · attempt ${session.attempt} · ${session.result}`,
    category: "ingestion", actorId: actor.id, actorLabel: "VR integration",
  });
  return res.status(201).json({ duplicate: false, session: publicSession(session) });
}

export async function createRecordingUpload(req, res) {
  const session = await ownedSession(req);
  if (!session) return res.status(404).json({ message: "Session not found." });
  if (session.recording_status === "Ready") return res.status(409).json({ message: "The recording for this session is already uploaded." });

  const extension = String(req.body?.extension || "mp4").toLowerCase();
  if (!/^[a-z0-9]{2,5}$/.test(extension)) return res.status(400).json({ message: "Invalid recording file extension." });
  const objectPath = `${session.trainee_id}/${session.id}.${extension}`;

  const { data, error } = await supabase.storage.from(RECORDING_BUCKET).createSignedUploadUrl(objectPath, { upsert: true });
  if (error) {
    console.error("Signed upload URL failed:", error.message);
    return res.status(500).json({ message: "Could not prepare the recording upload." });
  }
  await supabase.from("training_sessions").update({ recording_path: objectPath, recording_status: "Processing" }).eq("id", session.id);
  await recordAudit({ event: `Recording upload started · session ${session.id.slice(0, 8)}, ${sessionLabel(session)}`, category: "recording", actorId: req.user.userId, actorLabel: "VR launcher", outcome: "In progress" });
  // The signed URL authorizes the upload; the publishable key satisfies the API gateway.
  return res.status(200).json({ uploadUrl: data.signedUrl, path: objectPath, apiKey: process.env.SUPABASE_PUBLISHABLE_KEY || null });
}

export async function completeRecordingUpload(req, res) {
  const session = await ownedSession(req);
  if (!session) return res.status(404).json({ message: "Session not found." });
  if (!session.recording_path) return res.status(409).json({ message: "No recording upload was started for this session." });

  const folder = path.posix.dirname(session.recording_path);
  const fileName = path.posix.basename(session.recording_path);
  const { data: objects, error } = await supabase.storage.from(RECORDING_BUCKET).list(folder, { search: fileName, limit: 10 });
  const object = objects?.find((item) => item.name === fileName);
  if (error || !object) return res.status(409).json({ message: "The uploaded recording could not be found in storage." });

  const durationSeconds = Number(req.body?.durationSeconds);
  await supabase.from("training_sessions").update({
    recording_status: "Ready",
    recording_bytes: Number(object.metadata?.size) || null,
    ...(Number.isFinite(durationSeconds) && durationSeconds > 0 ? { recording_duration_seconds: Math.round(durationSeconds) } : {}),
  }).eq("id", session.id);
  await recordAudit({ event: `Recording ready · session ${session.id.slice(0, 8)}, ${sessionLabel(session)}`, category: "recording", actorId: req.user.userId, actorLabel: "Media worker" });
  return res.status(200).json({ recordingStatus: "Ready" });
}

export async function markRecordingUnavailable(req, res) {
  const session = await ownedSession(req);
  if (!session) return res.status(404).json({ message: "Session not found." });
  if (session.recording_status === "Ready") return res.status(409).json({ message: "The recording for this session is already uploaded." });
  const reason = textField(req.body?.reason, 200) || "recording file missing";
  await supabase.from("training_sessions").update({ recording_status: "Unavailable" }).eq("id", session.id);
  await recordAudit({ event: `Recording unavailable · session ${session.id.slice(0, 8)}, ${reason}`, category: "recording", actorId: req.user.userId, actorLabel: "VR launcher", outcome: "Failed" });
  return res.status(200).json({ recordingStatus: "Unavailable" });
}

export async function getRecordingUrl(req, res) {
  const { data: session } = await supabase.from("training_sessions").select("id, trainee_id, recording_status, recording_path").eq("id", req.params.id).maybeSingle();
  if (!session || !(await canViewSession(req.user, session))) return res.status(404).json({ message: "Session not found." });
  if (session.recording_status !== "Ready" || !session.recording_path) return res.status(409).json({ message: "The recording is not available yet." });
  const { data, error } = await supabase.storage.from(RECORDING_BUCKET).createSignedUrl(session.recording_path, PLAYBACK_URL_TTL_SECONDS);
  if (error) return res.status(500).json({ message: "Could not open the recording." });
  return res.status(200).json({ url: data.signedUrl, expiresIn: PLAYBACK_URL_TTL_SECONDS });
}

export async function addFeedback(req, res) {
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const visibility = req.body?.visibility === "private" ? "private" : "learner";
  if (!body || body.length > 4000) return res.status(400).json({ message: "Feedback must be between 1 and 4000 characters." });

  const { data: session } = await supabase.from("training_sessions").select("id, trainee_id, session_type, room_id, attempt, reviewed_at").eq("id", req.params.id).maybeSingle();
  if (!session || !(await canViewSession(req.user, session))) return res.status(404).json({ message: "Session not found." });

  const author = await loadUser(req.user.userId);
  const { data: feedback, error } = await supabase.from("session_feedback").insert({
    session_id: session.id, author_id: author.id, body, visibility,
  }).select("id, session_id, author_id, body, visibility, created_at").single();
  if (error) return res.status(500).json({ message: "Could not save feedback." });

  if (!session.reviewed_at) {
    await supabase.from("training_sessions").update({ reviewed_at: new Date().toISOString(), reviewed_by: author.id }).eq("id", session.id);
  }
  await recordAudit({ event: `Feedback added · session ${session.id.slice(0, 8)}, ${sessionLabel(session)}`, category: "review", actorId: author.id, actorLabel: author.name });
  return res.status(201).json({ feedback: { ...feedback, author_name: author.name, author_role: author.role } });
}

export async function createProgram(req, res) {
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 90) : "";
  const batch = typeof req.body?.batch === "string" ? req.body.batch.trim().slice(0, 70) : "";
  const roomIds = Array.isArray(req.body?.roomIds) ? [...new Set(req.body.roomIds)].filter((id) => ROOM_IDS.has(id)) : [];
  const dueDate = req.body?.dueDate || null;
  if (!title || !batch || roomIds.length === 0) return res.status(400).json({ message: "Program name, cohort, and at least one room are required." });
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)))) {
    return res.status(400).json({ message: "Deadline must be a valid date." });
  }

  const author = await loadUser(req.user.userId);
  const ordered = ROOMS.map((room) => room.id).filter((id) => roomIds.includes(id));
  const { data, error } = await supabase.from("programs").insert({ title, batch, room_ids: ordered, due_date: dueDate, created_by: author.id }).select().single();
  if (error) return res.status(500).json({ message: "Could not create the program." });
  await recordAudit({ event: `Assignment updated · ${title}, ${batch}`, category: "assignment", actorId: author.id, actorLabel: author.name });
  return res.status(201).json({ program: data });
}

// Supabase caps a select at 1000 rows, so large tables are read page by page.
async function selectAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function selectIn(table, columns, column, values, decorate = (query) => query) {
  const rows = [];
  for (let index = 0; index < values.length; index += IN_CHUNK) {
    rows.push(...await selectAll(() => decorate(supabase.from(table).select(columns).in(column, values.slice(index, index + IN_CHUNK)))));
  }
  return rows;
}

function healthOf(successes, total) {
  return total ? Math.round((successes / total) * 100) : 100;
}

async function integrationStatus() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [events, recordings] = await Promise.all([
    selectAll(() => supabase.from("audit_events").select("category, outcome, created_at").in("category", ["ingestion", "identity", "recording"]).gte("created_at", since).order("created_at", { ascending: false })),
    selectAll(() => supabase.from("training_sessions").select("recording_status, recording_path, recording_bytes, completed_at").neq("recording_status", "Unavailable")),
  ]);
  const ingest = events.filter((event) => event.category === "ingestion");
  const identityFailures = events.filter((event) => event.category === "identity").length;
  const lastAt = (category) => events.find((event) => event.category === category)?.created_at ?? null;
  const recent = recordings.filter((item) => item.completed_at >= since);
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const ready = recent.filter((item) => item.recording_status === "Ready").length;
  const stuck = recent.filter((item) => item.recording_status === "Processing" && item.completed_at < staleBefore).length;
  const attempts = ingest.length + identityFailures;

  const services = [
    { name: "VR assessment ingestion", health: healthOf(ingest.filter((event) => event.outcome === "Successful").length, ingest.length), lastEventAt: lastAt("ingestion"), detail: `${ingest.length} results files in the last 7 days` },
    { name: "Session identity mapping", health: healthOf(attempts - identityFailures, attempts), lastEventAt: lastAt("identity") ?? lastAt("ingestion"), detail: `${identityFailures} identity mismatches in the last 7 days` },
    { name: "Recording metadata ingestion", health: healthOf(recent.filter((item) => item.recording_path).length, recent.length), lastEventAt: lastAt("recording"), detail: `${recent.length} recordings expected in the last 7 days` },
    { name: "Recording media processing", health: healthOf(ready, ready + stuck), lastEventAt: lastAt("recording"), detail: stuck ? `${stuck} uploads waiting longer than 30 minutes` : "No delayed uploads" },
  ];
  const quotaBytes = (Number(process.env.RECORDING_STORAGE_QUOTA_GB) || 100) * 1024 ** 3;
  const usedBytes = recordings.reduce((sum, item) => sum + (Number(item.recording_bytes) || 0), 0);
  return { services, storage: { usedBytes, quotaBytes } };
}

// One role-scoped feed for the web workspace; analytics are derived client-side from it.
export async function getWorkspace(req, res) {
  const me = await loadUser(req.user.userId);
  if (!me) return res.status(404).json({ message: "User not found." });

  let users;
  let sessions;
  let programs;
  if (me.role === "admin" || me.role === "head") {
    const roles = me.role === "admin" ? ["admin", "head", "trainer", "trainee"] : ["head", "trainer", "trainee"];
    users = await selectAll(() => supabase.from("users").select(USER_COLUMNS).in("role", roles).order("name"));
    sessions = await selectAll(() => supabase.from("training_sessions").select(SESSION_COLUMNS).order("completed_at"));
    programs = await selectAll(() => supabase.from("programs").select("*").order("due_date", { ascending: true, nullsFirst: false }));
  } else if (me.role === "trainer") {
    const trainees = await selectAll(() => supabase.from("users").select(USER_COLUMNS).eq("role", "trainee").eq("trainer_id", me.id).order("name"));
    users = [me, ...trainees];
    sessions = await selectIn("training_sessions", SESSION_COLUMNS, "trainee_id", trainees.map((user) => user.id), (query) => query.order("completed_at"));
    const batches = [...new Set(trainees.map((user) => user.batch).filter(Boolean))];
    programs = batches.length ? await selectIn("programs", "*", "batch", batches) : [];
  } else {
    const trainer = me.trainer_id ? await loadUser(me.trainer_id) : null;
    users = [me, ...(trainer ? [{ id: trainer.id, name: trainer.name, role: trainer.role }] : [])];
    sessions = await selectAll(() => supabase.from("training_sessions").select(SESSION_COLUMNS).eq("trainee_id", me.id).order("completed_at"));
    programs = me.batch ? await selectAll(() => supabase.from("programs").select("*").eq("batch", me.batch)) : [];
  }

  const feedback = await selectIn("session_feedback", "id, session_id, author_id, body, visibility, created_at", "session_id", sessions.map((session) => session.id), (query) => {
    const ordered = query.order("created_at");
    return me.role === "trainee" ? ordered.eq("visibility", "learner") : ordered;
  });
  const authorIds = [...new Set(feedback.map((item) => item.author_id).filter(Boolean))];
  const authors = authorIds.length ? await selectIn("users", "id, name, role", "id", authorIds) : [];
  const authorById = new Map(authors.map((author) => [author.id, author]));

  const payload = {
    me,
    users,
    sessions: sessions.map((session) => ({ ...session, score: Number(session.score) })),
    feedback: feedback.map((item) => ({ ...item, author_name: authorById.get(item.author_id)?.name ?? "Former user", author_role: authorById.get(item.author_id)?.role ?? null })),
    programs,
  };

  if (me.role === "admin") {
    const [{ data: audit }, integration, { data: invitations }] = await Promise.all([
      supabase.from("audit_events").select("id, event, category, actor_label, outcome, created_at").order("created_at", { ascending: false }).range(0, 299),
      integrationStatus(),
      supabase.from("invitations").select("id, name, email, role, created_at, expires_at").is("accepted_at", null).order("created_at", { ascending: false }),
    ]);
    Object.assign(payload, { audit: audit || [], integration, invitations: invitations || [] });
  }
  return res.status(200).json(payload);
}
