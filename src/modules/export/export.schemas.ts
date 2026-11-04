import { z } from "zod";
import { dateSchema } from "../../lib/dates.js";
import { transactionTypeSchema, uuidSchema } from "../../lib/schemas.js";

export const exportQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    type: transactionTypeSchema.optional(),
    categoryId: uuidSchema.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Tanggal awal tidak boleh melebihi tanggal akhir",
  );

export type ExportQuery = z.infer<typeof exportQuerySchema>;
