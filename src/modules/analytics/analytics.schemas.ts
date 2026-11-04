import { z } from "zod";
import { monthSchema } from "../../lib/dates.js";
import { transactionTypeSchema } from "../../lib/schemas.js";

export const summaryQuerySchema = z.object({
  month: monthSchema.optional(),
});

export const categoryBreakdownQuerySchema = z.object({
  month: monthSchema.optional(),
  type: transactionTypeSchema.default("expense"),
});

export const trendQuerySchema = z.object({
  month: monthSchema.optional(),
});

export const monthsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(120).default(24),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type CategoryBreakdownQuery = z.infer<
  typeof categoryBreakdownQuerySchema
>;
export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type MonthsQuery = z.infer<typeof monthsQuerySchema>;
