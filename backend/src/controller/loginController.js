import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import supabase from "../config/supabaseConfig.js";
import ApiResponse from "../utility/ApiResponse.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "Email and Password are required",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 2. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find user
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password, role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("Login database error:", error);

      return res.status(500).json(
        new ApiResponse(
          500,
          "error",
          "Servers are down, try again later",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 4. User doesn't exist
    if (!user) {
      return res.status(401).json(
        new ApiResponse(
          401,
          "error",
          "Email or password is wrong",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 5. Compare password with bcrypt hash
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json(
        new ApiResponse(
          401,
          "error",
          "Email or password is wrong",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 6. Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "2h",
      }
    );

    // 7. Return JWT in response
    return res.status(200).json(
      new ApiResponse(
        200,
        "success",
        "Login successful",
        {
          userAllowed: true,
          role: user.role,
          token: token,
        }
      )
    );

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json(
      new ApiResponse(
        500,
        "error",
        "Servers are down, try again later",
        {
          userAllowed: false,
          role: null,
        }
      )
    );
  }
};