
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

import pool from "../config/postgreesConfig.js";

const publicUserColumns =
  "id, name, email, role, employee_id, batch, trainer_id, created_at";

function employeeId(role) {
  const prefix =
    role === "admin"
      ? "ADM"
      : role === "head"
        ? "HED"
        : role === "trainer"
          ? "TRN"
          : "TRE";

  return `${prefix}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

async function sendInvitationEmail(invitation, inviteUrl) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return false;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: invitation.email,
    subject: "Join VR Simulation Suite",
    text: `Hello ${invitation.name},

You have been invited as a ${invitation.role}. Create your account here:
${inviteUrl}

This invitation expires in 72 hours.`,
  });

  return true;
}

export async function getDashboard(req, res) {
  try {
    // Get current logged-in user
    const meResult = await pool.query(
      `
        SELECT ${publicUserColumns}
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.user.userId]
    );

    const me = meResult.rows[0];

    if (!me) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Admin / Head dashboard
    if (["admin", "head"].includes(me.role)) {
      const visibleRoles =
        me.role === "admin"
          ? ["admin", "head", "trainer", "trainee"]
          : ["trainer", "trainee"];

      const usersResult = await pool.query(
        `
          SELECT ${publicUserColumns}
          FROM users
          WHERE role = ANY($1::text[])
          ORDER BY created_at DESC
        `,
        [visibleRoles]
      );

      return res.json({
        me,
        users: usersResult.rows,
      });
    }

    // Trainer dashboard
    if (me.role === "trainer") {
      const traineesResult = await pool.query(
        `
          SELECT ${publicUserColumns}
          FROM users
          WHERE role = 'trainee'
            AND trainer_id = $1
          ORDER BY name
        `,
        [me.id]
      );

      const trainees = traineesResult.rows;
      const ids = trainees.map((item) => item.id);

      let sessions = [];

      if (ids.length) {
        const sessionsResult = await pool.query(
          `
            SELECT
              id,
              trainee_id,
              score,
              duration_minutes,
              completed_at
            FROM training_sessions
            WHERE trainee_id = ANY($1::uuid[])
            ORDER BY completed_at
          `,
          [ids]
        );

        sessions = sessionsResult.rows;
      }

      return res.json({
        me,
        trainees,
        sessions,
      });
    }

    // Trainee dashboard
    const sessionsResult = await pool.query(
      `
        SELECT
          id,
          score,
          duration_minutes,
          completed_at
        FROM training_sessions
        WHERE trainee_id = $1
        ORDER BY completed_at
      `,
      [me.id]
    );

    return res.json({
      me,
      sessions: sessionsResult.rows,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);

    return res.status(500).json({
      message: "Could not load dashboard.",
    });
  }
}

export async function createInvitation(req, res) {
  try {
    const { name, email, role, batch, trainerId } = req.body ?? {};

    const allowedRoles =
      req.user.role === "admin"
        ? ["admin", "head"]
        : ["trainer", "trainee"];

    if (
      !name?.trim() ||
      !email?.trim() ||
      !allowedRoles.includes(role)
    ) {
      return res.status(400).json({
        message: "Name, email, and a valid role are required.",
      });
    }

    if (
      role === "trainee" &&
      (!batch?.trim() || !trainerId)
    ) {
      return res.status(400).json({
        message: "Batch and trainer are required for a trainee.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingResult = await pool.query(
      `
        SELECT id
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existingResult.rows[0]) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    const invitation = {
      token: crypto.randomBytes(32).toString("base64url"),
      name: name.trim(),
      email: normalizedEmail,
      role,
      employee_id: employeeId(role),
      batch: role === "trainee" ? batch.trim() : null,
      trainer_id: role === "trainee" ? trainerId : null,
      expires_at: new Date(
        Date.now() + 72 * 60 * 60 * 1000
      ),
    };

    const result = await pool.query(
      `
        INSERT INTO invitations (
          token,
          name,
          email,
          role,
          employee_id,
          batch,
          trainer_id,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        invitation.token,
        invitation.name,
        invitation.email,
        invitation.role,
        invitation.employee_id,
        invitation.batch,
        invitation.trainer_id,
        invitation.expires_at,
      ]
    );

    const data = result.rows[0];

    const webUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5173";

    const inviteUrl =
      `${webUrl}/?invite=${encodeURIComponent(data.token)}`;

    let emailSent = false;

    try {
      emailSent = await sendInvitationEmail(
        data,
        inviteUrl
      );
    } catch (error) {
      console.error(
        "Invitation email failed:",
        error.message
      );
    }

    return res.status(201).json({
      invitation: data,
      inviteUrl,
      emailSent,
    });
  } catch (error) {
    console.error("Create invitation error:", error);

    return res.status(500).json({
      message: "Could not create invitation.",
    });
  }
}

export async function acceptInvitation(req, res) {
  try {
    const { token, password } = req.body ?? {};

    if (
      !token ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          "A valid invitation and password of at least 8 characters are required.",
      });
    }

    // Find valid, unused invitation
    const invitationResult = await pool.query(
      `
        SELECT *
        FROM invitations
        WHERE token = $1
          AND accepted_at IS NULL
        LIMIT 1
      `,
      [token]
    );

    const invitation = invitationResult.rows[0];

    if (
      !invitation ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "This invitation is invalid or expired.",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // Create user
    await pool.query(
      `
        INSERT INTO users (
          name,
          email,
          password,
          role,
          employee_id,
          batch,
          trainer_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        invitation.name,
        invitation.email,
        passwordHash,
        invitation.role,
        invitation.employee_id,
        invitation.batch,
        invitation.trainer_id,
      ]
    );

    // Mark invitation as accepted
    await pool.query(
      `
        UPDATE invitations
        SET accepted_at = NOW()
        WHERE id = $1
      `,
      [invitation.id]
    );

    return res.status(201).json({
      message: "Account created. You can now sign in.",
    });
  } catch (error) {
    console.error("Accept invitation error:", error);

    return res.status(409).json({
      message:
        "This invitation could not be accepted.",
    });
  }
}

export async function createTrainingSession(req, res) {
  try {
    const {
      traineeId,
      score,
      durationMinutes,
    } = req.body ?? {};

    const numericScore = Number(score);
    const numericDuration = Number(durationMinutes);

    const targetTrainee =
      req.user.role === "trainee"
        ? req.user.userId
        : traineeId;

    if (
      !targetTrainee ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 100 ||
      !Number.isInteger(numericDuration) ||
      numericDuration < 0
    ) {
      return res.status(400).json({
        message:
          "Trainee, score from 0 to 100, and duration are required.",
      });
    }

    let trainerId = null;

    // Trainer creating session for their assigned trainee
    if (req.user.role === "trainer") {
      const assignedResult = await pool.query(
        `
          SELECT id
          FROM users
          WHERE id = $1
            AND trainer_id = $2
            AND role = 'trainee'
          LIMIT 1
        `,
        [targetTrainee, req.user.userId]
      );

      if (!assignedResult.rows[0]) {
        return res.status(403).json({
          message:
            "This trainee is not assigned to you.",
        });
      }

      trainerId = req.user.userId;
    } else {
      // Admin / Head / Trainee
      const traineeResult = await pool.query(
        `
          SELECT trainer_id
          FROM users
          WHERE id = $1
            AND role = 'trainee'
          LIMIT 1
        `,
        [targetTrainee]
      );

      const trainee = traineeResult.rows[0];

      if (!trainee) {
        return res.status(404).json({
          message: "Trainee not found.",
        });
      }

      trainerId = trainee.trainer_id;
    }

    const result = await pool.query(
      `
        INSERT INTO training_sessions (
          trainee_id,
          trainer_id,
          score,
          duration_minutes
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        targetTrainee,
        trainerId,
        numericScore,
        numericDuration,
      ]
    );

    return res.status(201).json({
      session: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Create training session error:",
      error
    );

    return res.status(500).json({
      message: "Could not save training results.",
    });
  }
}

