import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const booleanFromString = (defaultValue: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    DB_SSL: booleanFromString("false"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET minimal 32 karakter"),
    BETTER_AUTH_RATE_LIMIT_ENABLED: booleanFromString("true"),

    APP_NAME: z.string().min(1).default("Catat Duit"),
    APP_TIMEZONE: z.string().min(1).default("Asia/Jakarta"),
    ALLOWED_ORIGINS: z
      .string()
      .default(
        "http://localhost:3000,http://localhost:8081,http://localhost:19006",
      ),
    TRUST_PROXY: z
      .string()
      .default("false")
      .transform((value, ctx) => {
        if (value === "true") return true;
        if (value === "false") return false;
        const hops = Number(value);
        if (Number.isInteger(hops) && hops >= 0) return hops;
        ctx.addIssue({
          code: "custom",
          message: "TRUST_PROXY harus 'true', 'false', atau jumlah hop (0-10)",
        });
        return z.NEVER;
      }),

    RATE_LIMIT_ENABLED: booleanFromString("true"),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    EMAIL_TRANSPORT: z.enum(["log", "resend"]).default("log"),
    ALLOW_INSECURE_EMAIL_LOG: booleanFromString("false"),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).default("Catat Duit <no-reply@catatduit.app>"),
    APP_RESET_PASSWORD_URL: z
      .url("APP_RESET_PASSWORD_URL harus berupa URL/deep link yang valid")
      .default("catatduit://auth/reset-password"),
    APP_EMAIL_VERIFICATION_CALLBACK_URL: z
      .url(
        "APP_EMAIL_VERIFICATION_CALLBACK_URL harus berupa URL/deep link yang valid",
      )
      .default("catatduit://auth/email-verified"),

    SWAGGER_ENABLED: booleanFromString("true"),
  })
  .superRefine((value, ctx) => {
    if (!isValidTimeZone(value.APP_TIMEZONE)) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_TIMEZONE"],
        message: `Zona waktu "${value.APP_TIMEZONE}" tidak valid`,
      });
    }

    if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY wajib diisi bila EMAIL_TRANSPORT=resend",
      });
    }

    if (
      value.NODE_ENV === "production" &&
      value.EMAIL_TRANSPORT === "log" &&
      !value.ALLOW_INSECURE_EMAIL_LOG
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message:
          "Di production, gunakan EMAIL_TRANSPORT=resend atau set ALLOW_INSECURE_EMAIL_LOG=true secara sadar",
      });
    }
  });

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Konfigurasi environment tidak valid:\n${details}`);
}

const raw = parsed.data;

const allowedOrigins = raw.ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  betterAuthUrl: raw.BETTER_AUTH_URL.replace(/\/$/, ""),
  allowedOrigins,
  betterAuthTrustedOrigins: Array.from(
    new Set([
      raw.BETTER_AUTH_URL.replace(/\/$/, ""),
      "catatduit://",
      ...allowedOrigins,
    ]),
  ),
} as const;

export type Env = typeof env;
