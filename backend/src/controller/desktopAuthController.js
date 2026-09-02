import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import supabase from "../config/supabaseConfig.js";
import ApiResponse from "../utility/ApiResponse.js";

const CODE_TTL_MS = 60_000;
const desktopCodes = new Map();

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export const createDesktopCode = async (req, res) => {
  try {
    for (const [code, value] of desktopCodes) {
      if (value.expiresAt <= Date.now()) desktopCodes.delete(code);
    }
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
    desktopCodes.set(code, {
      userId: user.id,
      email: user.email,
      accessToken: token,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    return res.status(200).json({ code });
  } catch (error) {
    return res.status(401).json(new ApiResponse(401, "error", "Invalid or expired token"));
  }
};

export const exchangeDesktopToken = (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code) {
    return res.status(400).json(new ApiResponse(400, "error", "A desktop code is required"));
  }

  // Delete before validation so every presented code is single-use.
  const session = desktopCodes.get(code);
  desktopCodes.delete(code);

  if (!session || session.expiresAt <= Date.now()) {
    return res.status(400).json(new ApiResponse(400, "error", "Desktop code is unknown, used, or expired"));
  }

  return res.status(200).json({
    userId: session.userId,
    email: session.email,
    accessToken: session.accessToken,
  });
};
