import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationPath = path.join(
  __dirname,
  "../migration/userTableCreation.sql"
);

const sql = fs.readFileSync(migrationPath, "utf8");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  console.log("Connected to Supabase PostgreSQL.");

  await client.query(sql);

  console.log("Database schema created successfully.");
} catch (error) {
  console.error("Database setup failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}