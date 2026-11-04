import { z } from "zod";
import { MAX_AMOUNT, isValidRupiahAmount } from "./money.js";

export const uuidSchema = z.uuid("ID harus berupa UUID yang valid");

export const amountSchema = z
  .number({ error: "Nominal harus berupa angka" })
  .positive("Nominal harus lebih dari 0")
  .max(MAX_AMOUNT, `Nominal maksimal ${MAX_AMOUNT}`)
  .refine(
    isValidRupiahAmount,
    "Nominal maksimal memiliki 2 angka di belakang koma",
  );

export const optionalNoteSchema = z
  .union([z.string().trim().max(500, "Catatan maksimal 500 karakter"), z.null()])
  .optional()
  .transform((value) => (value === "" ? null : value));

export const queryBoolean = (defaultValue: "true" | "false" = "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

export const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(1_000_000)
  .default(1);
export const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20);

export const clientIdSchema = z
  .string()
  .trim()
  .min(8, "clientId minimal 8 karakter")
  .max(128, "clientId maksimal 128 karakter");

export const categoryTypeSchema = z.enum(["expense", "income", "both"]);
export const transactionTypeSchema = z.enum(["expense", "income"]);
export const budgetPeriodSchema = z.enum(["daily", "monthly"]);
