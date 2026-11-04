import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nama wajib diisi")
      .max(80, "Nama maksimal 80 karakter")
      .optional(),
    image: z
      .union([z.url("URL foto tidak valid"), z.null()])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Minimal satu field harus diisi",
  );

export const changeEmailSchema = z
  .object({
    newEmail: z.email("Format email tidak valid").max(254).transform((value) => value.toLowerCase()),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
