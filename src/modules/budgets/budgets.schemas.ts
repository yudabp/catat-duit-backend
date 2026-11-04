import { z } from "zod";
import { amountSchema, budgetPeriodSchema, queryBoolean } from "../../lib/schemas.js";
import { monthSchema } from "../../lib/dates.js";

export const createBudgetSchema = z
  .object({
    period: budgetPeriodSchema,
    amount: amountSchema,
    month: monthSchema.nullish().transform((value) => value ?? null),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateBudgetSchema = z
  .object({
    amount: amountSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Minimal satu field harus diisi",
  );

export const listBudgetsQuerySchema = z.object({
  period: budgetPeriodSchema.optional(),
  month: monthSchema.optional(),
  activeOnly: queryBoolean("false"),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
