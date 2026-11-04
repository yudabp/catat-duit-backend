import { pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle" });
}

async function main(): Promise<void> {
  try {
    await runMigrations();
    console.log("Migrasi database selesai.");
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("Migrasi gagal:", error);
    process.exitCode = 1;
  });
}
