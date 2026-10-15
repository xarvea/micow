import dotenv from "dotenv";
import { Pool } from "pg";
import { buildApp } from "./app.js";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://micow:micow@localhost:5432/micow",
  max: 10,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
});
const app = await buildApp(pool);
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}
const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
