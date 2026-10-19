// The results.json contract between the VR application and the LMS (schemaVersion 1).
// Full field reference: desktop/README.md, "VR results hand-off".
export const resultsExample = {
  schemaVersion: 1,
  sessionId: "VR-2026-10-19-0001",
  userId: "<userId from ue-session.json>",
  type: "room",
  startedAt: "2026-10-19T09:12:00Z",
  completedAt: "2026-10-19T09:46:00Z",
  rooms: [{
    roomId: "granulation",
    score: 74,
    durationSeconds: 2040,
    steps: [
      { index: 0, points: 10, maxPoints: 10, critical: false, error: null, timestampSeconds: 35 },
      { index: 1, points: 0, maxPoints: 15, critical: true, error: "Binder added with the impeller stopped", timestampSeconds: 410 },
    ],
    competencies: [{ name: "Equipment handling", score: 80 }],
  }],
  recording: { path: "recordings/VR-2026-10-19-0001.mp4", durationSeconds: 2040 },
};

export const resultsMapping = [
  ["userId", "Identify the learner (from ue-session.json)"],
  ["sessionId", "Uniquely identify each VR attempt"],
  ["type", "Single room or complete run"],
  ["rooms[].roomId", "Match the production-suite room"],
  ["rooms[].score", "Room assessment result"],
  ["rooms[].steps[]", "Step-by-step results and errors"],
  ["recording.path", "Session video, uploaded by the launcher"],
];
