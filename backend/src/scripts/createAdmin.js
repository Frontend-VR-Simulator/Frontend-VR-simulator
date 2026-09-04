import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

import supabase from "../config/supabaseConfig.js";

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || !email || !password || password.length < 8) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 8 characters).");
  process.exit(1);
}

const { data: existing, error: lookupError } = await supabase.from("users").select("id, role").eq("email", email).maybeSingle();
if (lookupError) {
  console.error("Could not check existing admin:", lookupError.message);
  process.exit(1);
}
if (existing) {
  console.error(`A ${existing.role} account already exists for ${email}.`);
  process.exit(1);
}

const { data, error } = await supabase.from("users").insert({
  name,
  email,
  password: await bcrypt.hash(password, 12),
  role: "admin",
  employee_id: `ADM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
}).select("id, name, email, role, employee_id").single();

if (error) {
  console.error("Could not create site admin:", error.message);
  process.exit(1);
}

console.log("Site admin created:", data);
