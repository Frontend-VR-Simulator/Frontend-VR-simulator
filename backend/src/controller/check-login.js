import jwt from "jsonwebtoken";
import ApiResponse from "../utility/ApiResponse.js";

export const checkLogin = async (req, res) => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(
        new ApiResponse(
          401,
          "error",
          "Authentication token is required",
          {
            isLogin: false,
            role: null,
          }
        )
      );
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY
    );

    // Token is valid
    return res.status(200).json(
      new ApiResponse(
        200,
        "success",
        "User is logged in",
        {
          isLogin: true,
          role: decoded.role,
        }
      )
    );

  } catch (error) {
    console.error("Check login error:", error);

    // Token expired or invalid
    return res.status(401).json(
      new ApiResponse(
        401,
        "error",
        "Invalid or expired token",
        {
          isLogin: false,
          role: null,
        }
      )
    );
  }
};