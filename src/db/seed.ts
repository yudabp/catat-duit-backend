import { pathToFileURL } from "node:url";
import { db, pool } from "./index.js";
import { DEFAULT_CATEGORIES } from "./default-categories.js";
import { categories } from "./schema.js";

export async function seedDefaultCategories(): Promise<void> {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES)
    .onConflictDoNothing();
}

async function main(): Promise<void> {
  try {
    await seedDefaultCategories();
    console.log(
      `Seed selesai: ${DEFAULT_CATEGORIES.length} kategori bawaan tersedia.`,
    );
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  });
}
