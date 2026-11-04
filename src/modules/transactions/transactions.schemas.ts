import { z } from "zod";
import {
  amountSchema,
  clientIdSchema,
  limitSchema,
  optionalNoteSchema,
  pageSchema,
  transactionTypeSchema,
  uuidSchema,
} from "../../lib/schemas.js";
import { dateSchema, todayInAppTimeZone } from "../../lib/dates.js";

export const createTransactionSchema = z
  .object({
    categoryId: uuidSchema,
    type: transactionTypeSchema,
    amount: amountSchema,
    note: optionalNoteSchema,
    transactionDate: dateSchema.default(() => todayInAppTimeZone()),
    clientId: clientIdSchema,
  })
  .strict();

export const updateTransactionSchema = z
  .object({
    categoryId: uuidSchema.optional(),
    type: transactionTypeSchema.optional(),
    amount: amountSchema.optional(),
    note: optionalNoteSchema,
    transactionDate: dateSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Minimal satu field harus diisi",
  );

export const transactionSortSchema = z.enum([
  "date_desc",
  "date_asc",
  "amount_desc",
  "amount_asc",
]);

export const listTransactionsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    type: transactionTypeSchema.optional(),
    categoryId: uuidSchema.optional(),
    search: z.string().trim().max(100).optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM")
      .optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    sort: transactionSortSchema.default("date_desc"),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Tanggal awal tidak boleh melebihi tanggal akhir",
  );

export const syncTransactionsSchema = z
  .object({
    transactions: z
      .array(z.unknown())
      .min(1, "Minimal 1 transaksi")
      .max(100, "Maksimal 100 transaksi per batch"),
  })
  .strict();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionSort = z.infer<typeof transactionSortSchema>;
