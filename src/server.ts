import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { seedDefaultCategories } from "./db/seed.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await seedDefaultCategories();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        environment: env.NODE_ENV,
        docs: env.SWAGGER_ENABLED
          ? `${env.betterAuthUrl}/api/docs`
          : undefined,
      },
      "Catat Duit API berjalan",
    );
  });

  server.on("error", (error) => {
    logger.fatal({ err: error, port: env.PORT }, "Server gagal listen");
    void pool.end().finally(() => process.exit(1));
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Menerima sinyal shutdown, menutup server");
    server.close(() => {
      void pool.end().finally(() => {
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error("Shutdown paksa setelah 10 detik");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.fatal({ err: error }, "Server gagal dijalankan");
  void pool.end().finally(() => process.exit(1));
});
