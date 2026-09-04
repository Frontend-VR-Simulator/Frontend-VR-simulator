import crypto from "node:crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

import supabase from "../config/supabaseConfig.js";

const publicUserColumns = "id, name, email, role, employee_id, batch, trainer_id, created_at";

function employeeId(role) {
  const prefix = role === "admin" ? "ADM" : role === "head" ? "HED" : role === "trainer" ? "TRN" : "TRE";
  return `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function sendInvitationEmail(invitation, inviteUrl) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: invitation.email,
    subject: "Join VR Simulation Suite",
    text: `Hello ${invitation.name},\n\nYou have been invited as a ${invitation.role}. Create your account here:\n${inviteUrl}\n\nThis invitation expires in 72 hours.`,
  });
  return true;
}

export async function getDashboard(req, res) {
  const { data: me, error: meError } = await supabase.from("users").select(publicUserColumns).eq("id", req.user.userId).single();
  if (meError || !me) return res.status(404).json({ message: "User not found." });

  if (["admin", "head"].includes(me.role)) {
    const visibleRoles = me.role === "admin" ? ["admin", "head", "trainer", "trainee"] : ["trainer", "trainee"];
    const { data: users, error } = await supabase.from("users").select(publicUserColumns).in("role", visibleRoles).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: "Could not load directory." });
    return res.json({ me, users });
  }

  if (me.role === "trainer") {
    const { data: trainees, error } = await supabase.from("users").select(publicUserColumns).eq("role", "trainee").eq("trainer_id", me.id).order("name");
    if (error) return res.status(500).json({ message: "Could not load trainees." });
    const ids = trainees.map((item) => item.id);
    const { data: sessions } = ids.length
      ? await supabase.from("training_sessions").select("id, trainee_id, score, duration_minutes, completed_at").in("trainee_id", ids).order("completed_at")
      : { data: [] };
    return res.json({ me, trainees, sessions: sessions || [] });
  }

  const { data: sessions, error } = await supabase.from("training_sessions").select("id, score, duration_minutes, completed_at").eq("trainee_id", me.id).order("completed_at");
  if (error) return res.status(500).json({ message: "Could not load training progress." });
  return res.json({ me, sessions: sessions || [] });
}

export async function createInvitation(req, res) {
  const { name, email, role, batch, trainerId } = req.body ?? {};
  const allowedRoles = req.user.role === "admin" ? ["admin", "head"] : ["trainer", "trainee"];
  if (!name?.trim() || !email?.trim() || !allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Name, email, and a valid role are required." });
  }
  if (role === "trainee" && (!batch?.trim() || !trainerId)) {
    return res.status(400).json({ message: "Batch and trainer are required for a trainee." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { data: existing } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle();
  if (existing) return res.status(409).json({ message: "This email is already registered." });

  const invitation = {
    token: crypto.randomBytes(32).toString("base64url"),
    name: name.trim(), email: normalizedEmail, role,
    employee_id: employeeId(role),
    batch: role === "trainee" ? batch.trim() : null,
    trainer_id: role === "trainee" ? trainerId : null,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  };
  const { data, error } = await supabase.from("invitations").insert(invitation).select().single();
  if (error) return res.status(500).json({ message: "Could not create invitation." });
  const webUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const inviteUrl = `${webUrl}/?invite=${encodeURIComponent(data.token)}`;
  let emailSent = false;
  try { emailSent = await sendInvitationEmail(data, inviteUrl); }
  catch (error) { console.error("Invitation email failed:", error.message); }
  return res.status(201).json({ invitation: data, inviteUrl, emailSent });
}

export async function acceptInvitation(req, res) {
  const { token, password } = req.body ?? {};
  if (!token || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "A valid invitation and password of at least 8 characters are required." });
  }
  const { data: invitation } = await supabase.from("invitations").select("*").eq("token", token).is("accepted_at", null).maybeSingle();
  if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
    return res.status(400).json({ message: "This invitation is invalid or expired." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const { error } = await supabase.from("users").insert({
    name: invitation.name, email: invitation.email, password: passwordHash,
    role: invitation.role, employee_id: invitation.employee_id,
    batch: invitation.batch, trainer_id: invitation.trainer_id,
  });
  if (error) return res.status(409).json({ message: "This invitation could not be accepted." });
  await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);
  return res.status(201).json({ message: "Account created. You can now sign in." });
}

export async function createTrainingSession(req, res) {
  const { traineeId, score, durationMinutes } = req.body ?? {};
  const numericScore = Number(score);
  const numericDuration = Number(durationMinutes);
  const targetTrainee = req.user.role === "trainee" ? req.user.userId : traineeId;
  if (!targetTrainee || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100 || !Number.isInteger(numericDuration) || numericDuration < 0) {
    return res.status(400).json({ message: "Trainee, score from 0 to 100, and duration are required." });
  }
  let trainerId = null;
  if (req.user.role === "trainer") {
    const { data: assigned } = await supabase.from("users").select("id").eq("id", targetTrainee).eq("trainer_id", req.user.userId).maybeSingle();
    if (!assigned) return res.status(403).json({ message: "This trainee is not assigned to you." });
    trainerId = req.user.userId;
  } else {
    const { data: trainee } = await supabase.from("users").select("trainer_id").eq("id", targetTrainee).eq("role", "trainee").maybeSingle();
    if (!trainee) return res.status(404).json({ message: "Trainee not found." });
    trainerId = trainee.trainer_id;
  }
  const { data, error } = await supabase.from("training_sessions").insert({
    trainee_id: targetTrainee,
    trainer_id: trainerId,
    score: numericScore,
    duration_minutes: numericDuration,
  }).select().single();
  if (error) return res.status(500).json({ message: "Could not save training results." });
  return res.status(201).json({ session: data });
}
