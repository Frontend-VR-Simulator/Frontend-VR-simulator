
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import pool from "../config/postgreesConfig.js";
import ApiResponse from "../utility/ApiResponse.js";

const CODE_TTL_MS = 60_000;

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

function readBearerToken(req) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

export const createDesktopCode = async (req, res) => {
  try {
    const token = readBearerToken(req);

    if (!token) {
      return res.status(401).json(
        new ApiResponse(
          401,
          "error",
          "Authentication token is required"
        )
      );
    }

    // Verify the web user's JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY
    );

    // Find the user in PostgreSQL
    const userResult = await pool.query(
      `
        SELECT id, email
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [decoded.userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json(
        new ApiResponse(
          401,
          "error",
          "User could not be authenticated"
        )
      );
    }

    // Generate temporary desktop/VR code
    const code = crypto
      .randomBytes(32)
      .toString("base64url");

    // Store only the hash of the code
    await pool.query(
      `
        INSERT INTO desktop_auth_codes (
          code_hash,
          user_id,
          email,
          access_token,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        hashCode(code),
        user.id,
        user.email,
        token,
        new Date(Date.now() + CODE_TTL_MS),
      ]
    );

    // Return the actual code to the web client
    return res.status(200).json({
      code,
    });
  } catch (error) {
    console.error(
      "Create desktop code error:",
      error
    );

    return res.status(401).json(
      new ApiResponse(
        401,
        "error",
        "Invalid or expired token"
      )
    );
  }
};

export const exchangeDesktopToken = async (req, res) => {
  try {
    const { code } = req.body ?? {};

    if (typeof code !== "string" || !code) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "A desktop code is required"
        )
      );
    }

    const codeHash = hashCode(code);

    /*
      Delete the code and return its information
      in ONE PostgreSQL statement.

      This keeps the code single-use.
    */
    const result = await pool.query(
      `
        DELETE FROM desktop_auth_codes
        WHERE code_hash = $1
        RETURNING
          user_id,
          email,
          access_token,
          expires_at
      `,
      [codeHash]
    );

    const session = result.rows[0];

    if (
      !session ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "Desktop code is unknown, used, or expired"
        )
      );
    }

    return res.status(200).json({
      userId: session.user_id,
      email: session.email,
      accessToken: session.access_token,
    });
  } catch (error) {
    console.error(
      "Exchange desktop token error:",
      error
    );

    return res.status(500).json(
      new ApiResponse(
        500,
        "error",
        "Could not exchange desktop code"
      )
    );
  }
};

