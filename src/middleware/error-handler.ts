import type { ErrorRequestHandler, Request, Response } from "express";
import { isAPIError } from "better-auth/api";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError, type ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

type PostgresError = Error & {
  code?: string;
  detail?: string;
  constraint?: string;
};

type BodyParserError = Error & {
  type?: string;
  status?: number;
  statusCode?: number;
};

function zodDetails(error: ZodError): Array<Record<string, unknown>> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

function mapStatusToCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    default:
      return statusCode >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
  }
}

function mapDatabaseError(error: PostgresError): AppError | null {
  switch (error.code) {
    case "23505":
      return new AppError(
        409,
        "CONFLICT",
        "Data sudah ada. Gunakan data yang berbeda.",
        env.isProduction ? undefined : { constraint: error.constraint },
      );
    case "23503":
      return new AppError(
        409,
        "CONFLICT",
        "Data masih dipakai oleh data lain sehingga tidak bisa dihapus.",
        env.isProduction ? undefined : { constraint: error.constraint },
      );
    case "23514":
      return new AppError(
        422,
        "VALIDATION_ERROR",
        "Data melanggar aturan validasi database.",
        env.isProduction ? undefined : { constraint: error.constraint },
      );
    case "22P02":
      return new AppError(400, "BAD_REQUEST", "Format data tidak valid.");
    case "22001":
      return new AppError(
        422,
        "VALIDATION_ERROR",
        "Panjang data melebihi batas yang diizinkan.",
      );
    default:
      return null;
  }
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = (req as Express.Request & { id?: string }).id;
  let statusCode = 500;
  let code: ErrorCode = "INTERNAL_ERROR";
  let message = "Terjadi kesalahan pada server";
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 422;
    code = "VALIDATION_ERROR";
    message = "Data yang dikirim tidak valid";
    details = zodDetails(error);
  } else if (isAPIError(error)) {
    statusCode = error.statusCode;
    code = mapStatusToCode(error.statusCode);
    const body = error.body as
      | { message?: string; code?: string }
      | undefined;
    message =
      body?.message ||
      (error.statusCode >= 500
        ? "Terjadi kesalahan pada server"
        : "Permintaan ditolak");
    details = body?.code ? { authCode: body.code } : undefined;
  } else if ((error as BodyParserError).type === "entity.parse.failed") {
    statusCode = 400;
    code = "BAD_REQUEST";
    message = "Body request bukan JSON yang valid";
  } else if ((error as BodyParserError).type === "entity.too.large") {
    statusCode = 413;
    code = "BAD_REQUEST";
    message = "Body request terlalu besar (maksimal 1 MB)";
  } else {
    const databaseError = mapDatabaseError(error as PostgresError);
    if (databaseError) {
      statusCode = databaseError.statusCode;
      code = databaseError.code;
      message = databaseError.message;
      details = databaseError.details;
    }
  }

  if (statusCode >= 500) {
    logger.error({ err: error, requestId }, "Request gagal");
  } else {
    logger.debug({ err: error, requestId }, "Request ditolak");
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
): void => {
  const requestId = (req as Request & { id?: string }).id;
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Endpoint tidak ditemukan",
      ...(requestId ? { requestId } : {}),
    },
  });
};
