import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  application_name: "catat-duit-api",
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Kesalahan tak terduga pada koneksi PostgreSQL");
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };
