import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { auth } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import {
  authLimiter,
  globalLimiter,
  passwordResetLimiter,
} from "./middleware/rate-limit.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { budgetsRouter } from "./modules/budgets/budgets.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { exportRouter } from "./modules/export/export.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { meRouter } from "./modules/me/me.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { transactionsRouter } from "./modules/transactions/transactions.routes.js";

function isAllowedOrigin(origin: string): boolean {
  if (env.allowedOrigins.includes(origin)) return true;

  if (!env.isProduction) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }

  return false;
}

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY !== false) {
    app.set("trust proxy", env.TRUST_PROXY);
  }

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id =
          typeof incoming === "string" && incoming.length <= 128
            ? incoming
            : randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      autoLogging: {
        ignore: (req) =>
          req.url === "/health" ||
          req.url === "/api/openapi.json" ||
          req.url?.startsWith("/api/docs") === true,
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req: (request) => {
          const typed = request as {
            id?: string;
            method?: string;
            url?: string;
            socket?: { remoteAddress?: string };
          };
          return {
            id: typed.id,
            method: typed.method,
            url: typed.url,
            remoteAddress: typed.socket?.remoteAddress,
          };
        },
        res: (response) => {
          const typed = response as { statusCode?: number };
          return { statusCode: typed.statusCode };
        },
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: env.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Aplikasi mobile native tidak mengirim header Origin.
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: [
        "set-auth-token",
        "Content-Disposition",
        "Idempotent-Replay",
        "X-Request-Id",
        "RateLimit",
        "RateLimit-Policy",
      ],
      maxAge: 86_400,
    }),
  );

  app.use(globalLimiter);

  // Rate limit khusus endpoint autentikasi yang sensitif.
  app.use("/api/auth/sign-in", authLimiter);
  app.use("/api/auth/sign-up", authLimiter);
  app.use("/api/auth/change-email", authLimiter);
  app.use("/api/auth/request-password-reset", passwordResetLimiter);
  app.use("/api/auth/reset-password", passwordResetLimiter);

  // Better Auth harus dipasang SEBELUM express.json() agar body stream tidak
  // dikonsumsi lebih dulu. Express 5 memakai sintaks wildcard bernama.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: env.APP_NAME,
      status: "ok",
      version: "1.0.0",
      documentation: env.SWAGGER_ENABLED ? "/api/docs" : null,
      health: "/health",
    });
  });

  app.use("/health", healthRouter);

  app.use("/api/v1/me", meRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/transactions", transactionsRouter);
  app.use("/api/v1/budgets", budgetsRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/export", exportRouter);

  if (env.SWAGGER_ENABLED) {
    app.get("/api/openapi.json", (_req, res) => {
      res.json(openApiDocument);
    });

    app.use(
      "/api/docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        customSiteTitle: "Catat Duit API",
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          validatorUrl: null,
          docExpansion: "none",
          filter: true,
        },
      }),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
