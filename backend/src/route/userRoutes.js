import express from "express";

import { login } from "../controller/loginController.js";
import { checkLogin } from "../controller/check-login.js";
import { createDesktopCode, exchangeDesktopToken } from "../controller/desktopAuthController.js";
import { acceptInvitation, createInvitation, createTrainingSession, getDashboard } from "../controller/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/login",login)
router.post("/check-login",checkLogin)
router.post("/desktop-code", createDesktopCode)
router.post("/desktop-token", exchangeDesktopToken)
router.get("/dashboard", requireAuth("admin", "head", "trainer", "trainee"), getDashboard)
router.post("/invitations", requireAuth("admin", "head"), createInvitation)
router.post("/invitations/accept", acceptInvitation)
router.post("/training-sessions", requireAuth("admin", "head", "trainer", "trainee"), createTrainingSession)

export default router;
