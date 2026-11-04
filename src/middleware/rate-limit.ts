import type { Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

function limitHandler(
  _req: Request,
  res: Response,
): void {
  res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
    },
  });
}

const shared = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  skip: (req: Request) =>
    !env.RATE_LIMIT_ENABLED || req.method === "OPTIONS",
  handler: limitHandler,
};

export const globalLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

export const authLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
});

export const passwordResetLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 5,
});
