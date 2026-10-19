import express from "express";

import {
  addFeedback,
  completeRecordingUpload,
  createProgram,
  createRecordingUpload,
  getRecordingUrl,
  getWorkspace,
  ingestResults,
  markRecordingUnavailable,
} from "../controller/vrController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const anyRole = requireAuth("admin", "head", "trainer", "trainee");

router.get("/workspace", anyRole, getWorkspace)

// Called by the desktop launcher when the VR application writes results.json.
router.post("/results", anyRole, ingestResults)
router.post("/sessions/:id/recording/upload-url", anyRole, createRecordingUpload)
router.post("/sessions/:id/recording/complete", anyRole, completeRecordingUpload)
router.post("/sessions/:id/recording/unavailable", anyRole, markRecordingUnavailable)

router.get("/sessions/:id/recording", anyRole, getRecordingUrl)
router.post("/sessions/:id/feedback", requireAuth("admin", "head", "trainer"), addFeedback)
router.post("/programs", requireAuth("admin", "head"), createProgram)

export default router;
