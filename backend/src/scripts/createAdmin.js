
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

import pool from "../config/postgreesConfig.js";

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || !email || !password || password.length < 8) {
  console.error(
    "Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 8 characters)."
  );
  process.exit(1);
}

try {
  // Check whether the email already exists
  const existingResult = await pool.query(
    "SELECT id, role FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  const existing = existingResult.rows[0];

  if (existing) {
    console.error(
      `A ${existing.role} account already exists for ${email}.`
    );
    process.exit(1);
  }

  // Create the admin
  const passwordHash = await bcrypt.hash(password, 12);

  const employeeId = `ADM-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

  const result = await pool.query(
    `
      INSERT INTO users (
        name,
        email,
        password,
        role,
        employee_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, employee_id
    `,
    [name, email, passwordHash, "admin", employeeId]
  );

  console.log("Site admin created:", result.rows[0]);
} catch (error) {
  console.error("Could not create site admin:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}

