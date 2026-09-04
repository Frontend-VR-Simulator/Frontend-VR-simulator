import "dotenv/config";

import express from "express";
import cors from "cors";

import supabase from "./src/config/supabaseConfig.js";
import userRoute from "./src/route/userRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Trust Render/proxy
app.set("trust proxy", 1);

// Middleware
const allowedOrigins = new Set([
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));

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
