import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import supabase from "../config/supabaseConfig.js";
import ApiResponse from "../utility/ApiResponse.js";

const CODE_TTL_MS = 60_000;

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export const createDesktopCode = async (req, res) => {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json(new ApiResponse(401, "error", "Authentication token is required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", decoded.userId)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json(new ApiResponse(401, "error", "User could not be authenticated"));
    }

    const code = crypto.randomBytes(32).toString("base64url");
    const { error: codeError } = await supabase.from("desktop_auth_codes").insert({
      code_hash: hashCode(code),
      user_id: user.id,
      email: user.email,
      access_token: token,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (codeError) {
      console.error("Desktop code storage failed:", codeError.message);
      return res.status(500).json(new ApiResponse(500, "error", "Could not start desktop sign-in"));
    }

    return res.status(200).json({ code });
  } catch (error) {
    return res.status(401).json(new ApiResponse(401, "error", "Invalid or expired token"));
  }
};

export const exchangeDesktopToken = async (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code) {
    return res.status(400).json(new ApiResponse(400, "error", "A desktop code is required"));
  }

  // Atomic delete-and-return keeps the code single-use across serverless instances.
  const { data: session, error } = await supabase
    .from("desktop_auth_codes")
    .delete()
    .eq("code_hash", hashCode(code))
    .select("user_id, email, access_token, expires_at")
    .maybeSingle();

  if (error || !session || new Date(session.expires_at).getTime() <= Date.now()) {
    return res.status(400).json(new ApiResponse(400, "error", "Desktop code is unknown, used, or expired"));
  }

  return res.status(200).json({
    userId: session.user_id,
    email: session.email,
    accessToken: session.access_token,
  });
};
