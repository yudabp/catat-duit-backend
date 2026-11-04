import { z } from "zod";
import { amountSchema, limitSchema, pageSchema } from "../../lib/schemas.js";

export const createProductSchema = z
  .object({
    name: z
      .string({ error: "Nama produk wajib diisi" })
      .trim()
      .min(1, "Nama produk minimal 1 karakter")
      .max(100, "Nama produk maksimal 100 karakter"),
    cost: amountSchema,
    price: amountSchema,
    stock: z
      .number({ error: "Stok harus berupa angka" })
      .int("Stok harus berupa bilangan bulat")
      .min(0, "Stok tidak boleh negatif")
      .default(0),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nama produk minimal 1 karakter")
      .max(100, "Nama produk maksimal 100 karakter")
      .optional(),
    cost: amountSchema.optional(),
    price: amountSchema.optional(),
    stock: z
      .number()
      .int("Stok harus berupa bilangan bulat")
      .min(0, "Stok tidak boleh negatif")
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Minimal satu field harus diisi",
  );

export const adjustStockSchema = z
  .object({
    delta: z
      .number({ error: "Jumlah perubahan stok harus berupa angka" })
      .int("Jumlah perubahan stok harus berupa bilangan bulat")
      .refine((v) => v !== 0, "Perubahan stok tidak boleh 0"),
    cost: amountSchema.optional(),
  })
  .strict();

export const listProductsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  sort: z
    .enum(["name_asc", "name_desc", "stock_asc", "stock_desc", "created_desc"])
    .default("name_asc"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
