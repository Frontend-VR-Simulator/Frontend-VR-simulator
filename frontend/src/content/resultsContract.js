// The results file contract between the VR application and the LMS (schemaVersion 2).
// Full field reference: desktop/README.md, "VR results hand-off".
export const resultsExample = {
  schemaVersion: 2,
  userId: "<userId from ue-session.json>",
  startedAt: "2026-10-19T09:12:00Z",
  completedAt: "2026-10-19T09:46:00Z",
  rooms: [{
    roomId: "granulation",
    durationSeconds: 2040,
    steps: [
      { index: 0, points: 10, maxPoints: 10, critical: false, error: null, timestampSeconds: 35 },
      { index: 1, points: 0, maxPoints: 15, critical: true, error: "Binder added with the impeller stopped", timestampSeconds: 410 },
    ],
    competencies: [{ name: "Equipment handling", score: 80 }],
  }],
  recording: { path: "recordings/20261019-094600.mp4", durationSeconds: 2040 },
};

export const resultsMapping = [
  ["userId", "Identify the learner (from ue-session.json)"],
  ["sessionId", "Added by the launcher; stops a session being saved twice"],
  ["rooms[]", "The 1 to 11 rooms played in the session"],
  ["rooms[].roomId", "Match the production-suite room"],
  ["rooms[].steps[].points", "Points earned out of maxPoints; scores are derived from them"],
  ["rooms[].steps[]", "Step-by-step results and errors"],
  ["recording.path", "Session video, uploaded by the launcher"],
];
