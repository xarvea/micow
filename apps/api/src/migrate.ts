import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });
const connectionString = process.env.DATABASE_URL ?? "postgresql://micow:micow@localhost:5432/micow";
const pool = new Pool({ connectionString, max: 1 });
try {
  const migration = await readFile(new URL("../../../packages/database/migrations/001_init.sql", import.meta.url), "utf8");
  await pool.query(migration);
  process.stdout.write("Database migrations applied.\n");
} finally {
  await pool.end();
}
