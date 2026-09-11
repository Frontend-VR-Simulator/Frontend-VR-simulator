
import "dotenv/config";

import express from "express";
import cors from "cors";

import pool from "./src/config/postgreesConfig.js";
import userRoute from "./src/route/userRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Trust Render/proxy
app.set("trust proxy", 1);

// Middleware
const allowedOrigins = new Set([
  "http://localhost:5173",

  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null,

  process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}`
    : null,

  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null,
].filter(Boolean));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      console.error("Blocked CORS origin:", origin);
      console.error("Allowed origins:", [...allowedOrigins]);

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// API routes
app.use("/api/v1/user", userRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// PostgreSQL connection test
async function testPostgreSQLConnection() {
  try {
    const result = await pool.query(
      "SELECT id FROM users LIMIT 1"
    );

    console.log("✅ PostgreSQL connected successfully!");
    console.log(`Users table accessible. Rows checked: ${result.rows.length}`);

    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:");
    console.error(error.message);
    return false;
  }
}

// Start server
const startServer = async () => {
  try {
    const connected = await testPostgreSQLConnection();

    if (!connected) {
      console.error("❌ Server startup stopped because PostgreSQL is unavailable.");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

if (!process.env.VERCEL) startServer();

export default app;

