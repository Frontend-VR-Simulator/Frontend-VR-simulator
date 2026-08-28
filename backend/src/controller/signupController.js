import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import supabase from "../config/supabaseConfig.js";
import ApiResponse from "../utility/ApiResponse.js";

const userRoles = ["admin", "head", "employee"];

export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    

    // 1. Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "All fields are required",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 2. Validate password
    if (password.length < 8) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "Password must be at least 8 characters long",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 3. Validate role
    if (!userRoles.includes(role?.toLowerCase())) {
      return res.status(400).json(
        new ApiResponse(
          400,
          "error",
          "Role is not allowed",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 4. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 5. Check if user already exists
    const {
      data: existingUser,
      error: existingUserError,
    } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUserError) {
      console.error("Check user error:", existingUserError);

      return res.status(500).json(
        new ApiResponse(
          500,
          "error",
          "Failed to check existing user",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 6. User already exists
    if (existingUser) {
      return res.status(409).json(
        new ApiResponse(
          409,
          "error",
          "Email is already registered",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 7. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 8. Create user
    const {
      data: user,
      error: createUserError,
    } = await supabase
      .from("users")
      .insert({
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
        role: role.toLowerCase(),
      })
      .select("id, name, email, role, created_at")
      .single();

    if (createUserError) {
      console.error("Create user error:", createUserError);

      return res.status(500).json(
        new ApiResponse(
          500,
          "error",
          "User cannot be created",
          {
            userAllowed: false,
            role: null,
          }
        )
      );
    }

    // 9. Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1h",
      }
    );

    // 10. Return JWT directly
    return res.status(201).json(
      new ApiResponse(
        201,
        "success",
        "User created successfully",
        {
          userAllowed: true,
          role: user.role,
          token,
        }
      )
    );

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json(
      new ApiResponse(
        500,
        "error",
        "Internal server error, try again later",
        {
          userAllowed: false,
          role: null,
        }
      )
    );
  }
};