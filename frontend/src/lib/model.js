import { PASS_MARK, roomById, roomCardOrder, roomName, roomSteps, rooms } from "../content/catalog";
import { daysUntil, fmtClock, fmtDate, fmtDateTime } from "./format";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const SERIES_COLORS = ["blue", "yellow", "purple", "orange", "cyan", "mint"];

// Account roles from the API mapped to the design's workspaces.
export const ROLE_VIEW = { trainee: "learner", trainer: "trainer", head: "manager", admin: "admin" };
export const roleLabels = { learner: "Learner", trainer: "Trainer", manager: "Training Manager", admin: "System Administrator" };
export const accountRoleLabels = { trainee: "Trainee", trainer: "Trainer", head: "Organization head", admin: "Site admin" };

export const avg = (values) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

export function isPendingReview(session) {
  return !session.reviewed && session.result !== "Pass";
}

// Every session is a run through one or more rooms. A one-room session is shown as
// that room's attempt; a longer run gets the combined view.
function normalizeSession(raw, userById) {
  const roomResults = (Array.isArray(raw.rooms) ? raw.rooms : []).map(withPoints);
  const single = roomResults.length === 1 ? roomResults[0] : null;
  const completedAt = new Date(raw.completed_at);
  return {
    id: raw.id,
    traineeId: raw.trainee_id,
    learner: userById.get(raw.trainee_id)?.name ?? "Former user",
    type: single ? "room" : "complete",
    module: single?.roomId ?? null,
    title: single ? roomName(single.roomId) : "Complete session",
    label: null,
    attempt: 1,
    run: 1,
    completedAt,
    date: fmtDate(completedAt),
    time: fmtClock(completedAt),
    minutes: raw.duration_minutes ?? 0,
    score: Math.round(Number(raw.score)),
    result: raw.result || "Review",
    errors: raw.critical_errors ?? 0,
    recording: raw.recording_status || "Unavailable",
    recordingSeconds: raw.recording_duration_seconds,
    reviewed: Boolean(raw.reviewed_at),
    issues: single ? stepIssues(single) : {},
    rooms: roomResults,
    href: `session/${raw.id}`,
  };
}

// Rooms stored before scores were derived from points were scored out of 100.
function withPoints(room) {
  const legacy = room.maxPoints == null;
  return { ...room, points: legacy ? room.score : room.points, maxPoints: legacy ? 100 : room.maxPoints };
}

function stepIssues(room) {
  const issues = {};
  for (const step of room.steps || []) if (step.error) issues[step.index] = step.error;
  return issues;
}

// One room taken out of a session, shaped like a session so room views can list it.
function roomVisit(session, room, attempt) {
  return {
    ...session,
    type: "room",
    module: room.roomId,
    title: roomName(room.roomId),
    label: null,
    attempt,
    score: Math.round(room.score),
    result: room.result || session.result,
    errors: room.criticalErrors ?? 0,
    minutes: room.minutes ?? Math.round((room.durationSeconds || 0) / 60),
    issues: stepIssues(room),
    rooms: [room],
    session,
    href: session.rooms.length === 1 ? session.href : `session/${session.id}?room=${room.roomId}`,
  };
}

function weeklyTrend(entries) {
  const now = Date.now();
  const trend = [];
  for (let week = 5; week >= 0; week -= 1) {
    const start = now - (week + 1) * WEEK_MS;
    const end = now - week * WEEK_MS;
    const inWeek = entries.filter((entry) => entry.at >= start && entry.at < end);
    if (inWeek.length) trend.push(avg(inWeek.map((entry) => entry.score)));
  }
  return trend.length ? trend : [avg(entries.map((entry) => entry.score))];
}

function stepErrorRates(roomId, entries) {
  const withSteps = entries.filter((entry) => entry.steps?.length);
  if (!withSteps.length) return null;
  return roomSteps(roomById[roomId]).map((_, index) => Math.round((100 * withSteps.filter((entry) => entry.steps.some((step) => step.index === index && step.error)).length) / withSteps.length));
}

function topErrors(entries) {
  const counts = new Map();
  for (const entry of entries) for (const step of entry.steps || []) if (step.error) counts.set(step.error, (counts.get(step.error) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

// Cohort analytics for one room, from every session that included it.
function cohortStats(roomId, entries) {
  if (!entries.length) return { sessions: 0 };
  const firstByLearner = new Map();
  for (const entry of entries) if (!firstByLearner.has(entry.traineeId)) firstByLearner.set(entry.traineeId, entry);
  const firsts = [...firstByLearner.values()];
  const sixWeeksAgo = Date.now() - 6 * WEEK_MS;
  return {
    sessions: entries.length,
    learners: firstByLearner.size,
    minutes: avg(entries.map((entry) => entry.minutes)),
    score: avg(entries.map((entry) => entry.score)),
    pass: Math.round((100 * firsts.filter((entry) => entry.result === "Pass").length) / firsts.length),
    errors: entries.filter((entry) => entry.at >= sixWeeksAgo).reduce((sum, entry) => sum + entry.criticalErrors, 0),
    trend: weeklyTrend(entries),
    stepErr: stepErrorRates(roomId, entries),
    top: topErrors(entries),
  };
}

// One learner's results in a room: latest visit, first-attempt pass, and score per visit.
function learnerStats(roomId, entries) {
  if (!entries.length) return { sessions: 0 };
  const last = entries.at(-1);
  return {
    sessions: entries.length,
    learners: 1,
    minutes: last.minutes,
    score: Math.round(last.score),
    pass: entries[0].result === "Pass" ? 100 : 0,
    firstPass: entries[0].result === "Pass",
    errors: last.criticalErrors,
    trend: entries.map((entry) => Math.round(entry.score)),
    stepErr: stepErrorRates(roomId, entries),
    top: topErrors(entries),
  };
}

// Completion of a room for one learner: passed rooms are complete; otherwise the
// steps finished without error in the latest attempt.
function roomProgress(roomId, entries) {
  const steps = roomSteps(roomById[roomId]);
  if (!entries.length) return { progress: 0, done: steps.map(() => false), passed: false, last: null };
  const passedEntry = entries.find((entry) => entry.result === "Pass");
  const last = entries.at(-1);
  if (passedEntry) return { progress: 100, done: steps.map(() => true), passed: true, passedAt: passedEntry.at, last };
  let done;
  if (last.steps?.length) {
    done = steps.map((_, index) => last.steps.some((step) => step.index === index && !step.error));
  } else {
    const count = Math.floor((Math.min(99, last.score) / 100) * steps.length);
    done = steps.map((_, index) => index < count);
  }
  const progress = steps.length ? Math.min(99, Math.round((100 * done.filter(Boolean).length) / steps.length)) : 0;
  return { progress, done, passed: false, last };
}

// Combined results of a session. Rooms keep their own point totals; the session
// score is all points earned out of the points available in the rooms played.
export function completeSummary(session) {
  const byRoom = new Map(session.rooms.map((room) => [room.roomId, room]));
  const rs = roomCardOrder.map((id) => {
    const room = byRoom.get(id);
    return { id, score: room ? Math.round(room.score) : 0, points: room?.points ?? 0, maxPoints: room?.maxPoints ?? 0, minutes: room ? room.minutes ?? Math.round(room.durationSeconds / 60) : 0, errors: room?.criticalErrors ?? 0, recorded: Boolean(room), offset: room?.recordingOffsetSeconds ?? null };
  });
  const played = rs.filter((room) => room.recorded);
  const round = (value) => Math.round(value * 100) / 100;
  const pts = round(played.reduce((sum, room) => sum + room.points, 0));
  const max = round(played.reduce((sum, room) => sum + room.maxPoints, 0));
  const minutes = rs.reduce((sum, room) => sum + room.minutes, 0);
  const errors = rs.reduce((sum, room) => sum + room.errors, 0);
  const passed = played.filter((room) => room.score >= PASS_MARK && !room.errors).length;
  return { rs, played: played.length, pts, max, score: session.score, minutes, errors, passed, result: session.result };
}

export function programStatus(program) {
  if (program.completion >= 100) return ["Complete", "mint"];
  if (program.dueIn != null && program.dueIn < 0) return ["Overdue", "red"];
  if (program.completion < 75) return ["Needs attention", "orange"];
  return ["On track", "mint"];
}

export function buildModel(workspace) {
  const { me, users = [], feedback = [], programs: rawPrograms = [] } = workspace;
  const userById = new Map(users.map((user) => [user.id, user]));
  const sessions = (workspace.sessions || []).map((raw) => normalizeSession(raw, userById)).sort((a, b) => a.completedAt - b.completedAt);

  // Sessions are numbered per learner; room attempts are numbered per learner and room,
  // counting every session the room appeared in.
  const runCount = new Map();
  const visitCount = new Map();
  const visits = [];
  for (const session of sessions) {
    session.run = (runCount.get(session.traineeId) || 0) + 1;
    runCount.set(session.traineeId, session.run);
    session.label = session.type === "complete" ? `Session ${session.run}` : null;
    for (const room of session.rooms) {
      const key = `${session.traineeId}/${room.roomId}`;
      const attempt = (visitCount.get(key) || 0) + 1;
      visitCount.set(key, attempt);
      visits.push(roomVisit(session, room, attempt));
    }
    if (session.type === "room") session.attempt = visits.at(-1).attempt;
  }
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const trainees = users.filter((user) => user.role === "trainee");
  const trainer = me.role === "trainee" ? users.find((user) => user.id === me.trainer_id) : null;

  const entries = sessions.flatMap((session) => session.rooms.map((room) => ({
    ...room,
    minutes: room.minutes ?? Math.round((room.durationSeconds || 0) / 60),
    traineeId: session.traineeId,
    session,
    at: session.completedAt.getTime(),
  })));
  const entriesFor = (roomId, traineeId) => entries.filter((entry) => entry.roomId === roomId && (!traineeId || entry.traineeId === traineeId));

  const passedRooms = new Map();
  for (const entry of entries) {
    if (entry.result !== "Pass") continue;
    if (!passedRooms.has(entry.traineeId)) passedRooms.set(entry.traineeId, new Set());
    passedRooms.get(entry.traineeId).add(entry.roomId);
  }
  const passedSet = (traineeId) => passedRooms.get(traineeId) || new Set();

  const notesBySession = new Map();
  for (const item of feedback) {
    const note = {
      id: item.id,
      sessionId: item.session_id,
      text: item.body,
      author: item.author_name,
      authorRole: item.author_role,
      createdAt: new Date(item.created_at),
      date: fmtDateTime(item.created_at),
      visibility: item.visibility === "private" ? "Private trainer note" : "Visible to learner",
    };
    if (!notesBySession.has(note.sessionId)) notesBySession.set(note.sessionId, []);
    notesBySession.get(note.sessionId).push(note);
  }

  const learnerRows = trainees.map((user, index) => {
    const mine = sessions.filter((session) => session.traineeId === user.id);
    const score = mine.length ? avg(mine.map((session) => session.score)) : null;
    const status = !mine.length ? "Not started" : score < 65 ? "At risk" : mine.some(isPendingReview) ? "Needs review" : "On track";
    return {
      ...user,
      progress: Math.round((100 * passedSet(user.id).size) / roomCardOrder.length),
      score,
      sessions: mine.length,
      status,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    };
  });

  const programs = rawPrograms.map((program) => {
    const cohort = trainees.filter((user) => user.batch === program.batch);
    const learnerIds = me.role === "trainee" ? [me.id] : cohort.map((user) => user.id);
    const completion = learnerIds.length
      ? avg(learnerIds.map((id) => (100 * program.room_ids.filter((roomId) => passedSet(id).has(roomId)).length) / program.room_ids.length))
      : 0;
    const shaped = { ...program, cohort: program.batch, learners: cohort.length, completion, dueIn: daysUntil(program.due_date) };
    const [status, tone] = programStatus(shaped);
    return { ...shaped, status, tone };
  });

  const roomAverages = rooms
    .map((room, index) => ({ room, list: entriesFor(room.id) , color: SERIES_COLORS[index % SERIES_COLORS.length] }))
    .filter(({ list }) => list.length)
    .map(({ room, list, color }) => [room.name, avg(list.map((entry) => entry.score)), color]);

  return {
    me,
    users,
    trainer,
    trainees,
    sessions,
    sessionById,
    learnerRows,
    programs,
    roomAverages,
    audit: workspace.audit || [],
    integration: workspace.integration || null,
    invitations: workspace.invitations || [],
    notes: (sessionId) => notesBySession.get(sessionId) || [],
    allNotes: () => [...notesBySession.values()].flat().sort((a, b) => b.createdAt - a.createdAt),
    recentNotes: [...notesBySession.values()].flat().filter((note) => note.createdAt.getTime() >= Date.now() - WEEK_MS),
    pendingReviews: () => sessions.filter(isPendingReview),
    sessionsOf: (traineeId) => sessions.filter((session) => session.traineeId === traineeId),
    // Every attempt at a room, whether the session had that room alone or with others.
    roomSessions: (roomId, traineeId) => visits.filter((visit) => visit.module === roomId && (!traineeId || visit.traineeId === traineeId)),
    roomVisitsOf: (traineeId) => visits.filter((visit) => visit.traineeId === traineeId),
    roomVisit: (session, roomId) => visits.find((visit) => visit.session.id === session.id && visit.module === roomId) || null,
    completeSessions: (traineeId) => sessions.filter((session) => session.traineeId === traineeId),
    roomStats: (roomId, traineeId) => (traineeId ? learnerStats(roomId, entriesFor(roomId, traineeId)) : cohortStats(roomId, entriesFor(roomId))),
    roomProgress: (roomId, traineeId) => roomProgress(roomId, entriesFor(roomId, traineeId)),
    passedRooms: passedSet,
  };
}
