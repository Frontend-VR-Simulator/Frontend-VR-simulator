import "dotenv/config";

import express from "express";
import cors from "cors";

import supabase from "./src/config/supabaseConfig.js";
import userRoute from "./src/route/userRoutes.js";
import vrRoute from "./src/route/vrRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Trust Render/proxy
app.set("trust proxy", 1);

// Middleware
// Vercel sets these per deployment, so preview and production URLs work without extra config.
const allowedOrigins = new Set([
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL || "").split(",").map((value) => value.trim()).filter(Boolean),
  ...["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"]
    .map((name) => process.env[name])
    .filter(Boolean)
    .map((host) => `https://${host}`),
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));

// A complete-run results file with step detail for every room stays well under 1 MB.
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// Reachable through the /api rewrite on Vercel. Reports configuration presence and a
// database status category only — never values or raw error messages.
app.get("/api/v1/health", async (req, res) => {
  const config = {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    supabasePublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
    jwtSecret: Boolean(process.env.JWT_SECRET_KEY),
    frontendUrl: Boolean(process.env.FRONTEND_URL),
  };
  let database = "connected";
  let code = null;
  try {
    // The columns login and the workspaces read, so an outdated schema shows up too.
    const { error, status } = await supabase.from("users").select("id, name, email, password, role, employee_id, batch, trainer_id").limit(1);
    if (error) {
      code = error.code || (status ? String(status) : null);
      if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(error.message || "")) database = "unreachable";
      else if (status === 401 || /invalid api key|jwt/i.test(error.message || "")) database = "invalid_key";
      else if (["42P01", "PGRST205"].includes(error.code)) database = "schema_missing";
      else if (["42703", "PGRST204"].includes(error.code)) database = "schema_outdated";
      else database = "error";
    }
  } catch {
    database = "unreachable";
  }
  const ok = database === "connected" && config.jwtSecret;
  res.status(ok ? 200 : 503).json({
    ok,
    database,
    code,
    config,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
});

// API routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/vr", vrRoute);

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

// Supabase connection test
async function testSupabaseConnection() {
  try {
    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Supabase connection failed:");
      console.error(error.message);
      return false;
    }

    console.log("✅ Supabase connected successfully!");
    return true;
  } catch (error) {
    console.error("❌ Supabase connection failed:");
    console.error(error.message);
    return false;
  }
}

// Start server
const startServer = async () => {
  try {
    await testSupabaseConnection();

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
