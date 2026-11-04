import { sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../db/index.js";
import { logger } from "../../lib/logger.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const startedAt = process.uptime();

  try {
    await db.execute(sql`select 1`);
    res.json({
      status: "ok",
      database: "up",
      uptimeSeconds: Math.round(startedAt),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Health check database gagal");
    res.status(503).json({
      status: "unavailable",
      database: "down",
      uptimeSeconds: Math.round(startedAt),
      timestamp: new Date().toISOString(),
    });
  }
});
