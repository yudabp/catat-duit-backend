export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Sesi tidak valid atau sudah berakhir") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Anda tidak memiliki akses ke data ini") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Data tidak ditemukan") =>
  new AppError(404, "NOT_FOUND", message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "CONFLICT", message, details);

export const internalError = (message = "Terjadi kesalahan pada server") =>
  new AppError(500, "INTERNAL_ERROR", message);
