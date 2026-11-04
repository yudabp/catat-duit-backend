import { z } from "zod";
import {
  categoryTypeSchema,
  queryBoolean,
} from "../../lib/schemas.js";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Nama kategori wajib diisi")
  .max(50, "Nama kategori maksimal 50 karakter");

const iconSchema = z
  .string()
  .trim()
  .min(1, "Ikon wajib diisi")
  .max(50, "Nama ikon maksimal 50 karakter");

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus berupa kode hex, misalnya #16A34A");

export const createCategorySchema = z
  .object({
    name: nameSchema,
    type: categoryTypeSchema,
    icon: iconSchema,
    color: colorSchema,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: nameSchema.optional(),
    type: categoryTypeSchema.optional(),
    icon: iconSchema.optional(),
    color: colorSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Minimal satu field harus diisi",
  );

export const listCategoriesQuerySchema = z.object({
  type: categoryTypeSchema.optional(),
  includeArchived: queryBoolean("false"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
