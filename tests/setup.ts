import { config } from "dotenv";
import { afterAll, beforeAll } from "vitest";

config({ quiet: true });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://catatduit:catatduit@localhost:5435/catatduit_test";
process.env.BETTER_AUTH_URL = "http://localhost:4100";
process.env.BETTER_AUTH_SECRET =
  "test-secret-0123456789abcdef0123456789abcdef";
process.env.BETTER_AUTH_RATE_LIMIT_ENABLED = "false";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.LOG_LEVEL = "silent";
process.env.EMAIL_TRANSPORT = "log";
process.env.ALLOW_INSECURE_EMAIL_LOG = "true";
process.env.SWAGGER_ENABLED = "true";
process.env.TRUST_PROXY = "false";
process.env.APP_TIMEZONE = "Asia/Jakarta";

if (!process.env.DATABASE_URL.includes("_test")) {
  throw new Error(
    "Tes menolak berjalan: DATABASE_URL harus menunjuk database yang mengandung '_test'.",
  );
}

beforeAll(async () => {
  const { runMigrations } = await import("../src/db/migrate.js");
  const { db, pool } = await import("../src/db/index.js");
  const { seedDefaultCategories } = await import("../src/db/seed.js");
  const { sql } = await import("drizzle-orm");

  await runMigrations();
  await db.execute(
    sql`truncate table transactions, budgets, categories, sessions, accounts, verifications, users restart identity cascade`,
  );
  await seedDefaultCategories();
  await pool.query("select 1");
});

afterAll(async () => {
  const { pool } = await import("../src/db/index.js");
  await pool.end();
});
