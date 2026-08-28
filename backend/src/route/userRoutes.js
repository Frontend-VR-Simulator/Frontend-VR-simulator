import express from "express";

import { signup } from "../controller/signupController.js";
import { login } from "../controller/loginController.js";
import { checkLogin } from "../controller/check-login.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login",login)
router.post("/check-login",checkLogin)

export default router;