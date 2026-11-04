import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { env } from "../config/env.js";
import { createBudgetSchema, updateBudgetSchema } from "../modules/budgets/budgets.schemas.js";
import {
  adjustStockSchema,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../modules/products/products.schemas.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../modules/categories/categories.schemas.js";
import {
  changeEmailSchema,
  updateProfileSchema,
} from "../modules/me/me.schemas.js";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  syncTransactionsSchema,
  updateTransactionSchema,
} from "../modules/transactions/transactions.schemas.js";
import {
  categoryBreakdownQuerySchema,
  monthsQuerySchema,
  summaryQuerySchema,
  trendQuerySchema,
} from "../modules/analytics/analytics.schemas.js";
import { exportQuerySchema } from "../modules/export/export.schemas.js";
import { uuidSchema } from "../lib/schemas.js";
import { monthSchema } from "../lib/dates.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description:
    "Session token Better Auth. Ambil dari response header `set-auth-token` saat sign-up/sign-in.",
});

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
  description:
    "Cookie sesi Better Auth untuk klien web. Aplikasi mobile sebaiknya memakai bearer token.",
});

const security: Array<Record<string, string[]>> = [
  { bearerAuth: [] },
  { cookieAuth: [] },
];

const ErrorResponse = registry.register(
  "ErrorResponse",
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
      requestId: z.string().optional(),
    }),
  }),
);

const BetterAuthError = registry.register(
  "BetterAuthError",
  z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
);

const AuthUser = registry.register(
  "AuthUser",
  z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const Category = registry.register(
  "Category",
  z.object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(["expense", "income", "both"]),
    icon: z.string(),
    color: z.string(),
    isDefault: z.boolean(),
    isArchived: z.boolean(),
    usageCount: z.number().int(),
    createdAt: z.string(),
  }),
);

const Transaction = registry.register(
  "Transaction",
  z.object({
    id: z.uuid(),
    type: z.enum(["expense", "income"]),
    amount: z.number(),
    note: z.string().nullable(),
    transactionDate: z.string(),
    clientId: z.string(),
    category: z.object({
      id: z.uuid(),
      name: z.string(),
      icon: z.string(),
      color: z.string(),
      type: z.enum(["expense", "income", "both"]),
      isDefault: z.boolean(),
    }),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const Budget = registry.register(
  "Budget",
  z.object({
    id: z.uuid(),
    period: z.enum(["daily", "monthly"]),
    amount: z.number(),
    month: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string(),
  }),
);

const BudgetAlert = registry.register(
  "BudgetAlert",
  z.object({
    id: z.uuid(),
    period: z.enum(["daily", "monthly"]),
    amount: z.number(),
    month: z.string().nullable(),
    used: z.number(),
    remaining: z.number(),
    usagePercent: z.number(),
    status: z.enum(["safe", "warning", "over"]),
    message: z.string(),
  }),
);

const Product = registry.register(
  "Product",
  z.object({
    id: z.uuid(),
    name: z.string(),
    cost: z.number(),
    price: z.number(),
    stock: z.number().int(),
    profitPerUnit: z.number(),
    marginPercent: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const BoncosWarning = registry.register(
  "BoncosWarning",
  z.object({
    level: z.enum(["safe", "warning", "over"]),
    thresholdPercent: z.number(),
    ratioPercent: z.number().nullable(),
    message: z.string(),
  }),
);

const MonthlySummary = registry.register(
  "MonthlySummary",
  z.object({
    month: z.string(),
    label: z.string(),
    period: z.object({ start: z.string(), end: z.string() }),
    income: z.number(),
    expense: z.number(),
    balance: z.number(),
    transactionCount: z.number().int(),
    incomeCount: z.number().int(),
    expenseCount: z.number().int(),
    warning: BoncosWarning,
    budgets: z.array(BudgetAlert),
    budgetWarning: z.object({
      level: z.enum(["safe", "warning", "over", "none"]),
      message: z.string(),
    }),
  }),
);

const CategoryBreakdown = registry.register(
  "CategoryBreakdown",
  z.object({
    month: z.string(),
    label: z.string(),
    type: z.enum(["expense", "income"]),
    total: z.number(),
    categories: z.array(
      z.object({
        categoryId: z.uuid(),
        name: z.string(),
        icon: z.string(),
        color: z.string(),
        total: z.number(),
        count: z.number().int(),
        percentage: z.number(),
      }),
    ),
  }),
);

const DailyTrend = registry.register(
  "DailyTrend",
  z.object({
    month: z.string(),
    label: z.string(),
    days: z.array(
      z.object({
        date: z.string(),
        income: z.number(),
        expense: z.number(),
        net: z.number(),
      }),
    ),
    totalIncome: z.number(),
    totalExpense: z.number(),
    averageDailyExpense: z.number(),
    highestExpenseDay: z
      .object({ date: z.string(), amount: z.number() })
      .nullable(),
  }),
);

const MonthItem = registry.register(
  "MonthItem",
  z.object({
    month: z.string(),
    label: z.string(),
    income: z.number(),
    expense: z.number(),
    balance: z.number(),
    transactionCount: z.number().int(),
  }),
);

const SyncResult = registry.register(
  "SyncResult",
  z.object({
    results: z.array(
      z.object({
        index: z.number().int(),
        status: z.enum(["created", "replayed", "failed"]),
        transaction: Transaction.optional(),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
            details: z.unknown().optional(),
          })
          .optional(),
      }),
    ),
    summary: z.object({
      total: z.number().int(),
      created: z.number().int(),
      replayed: z.number().int(),
      failed: z.number().int(),
    }),
  }),
);

const idParamsSchema = z.object({ id: uuidSchema });

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponse } },
});

const authErrorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: BetterAuthError } },
});

const jsonResponse = (description: string, schema: z.ZodType) => ({
  description,
  content: { "application/json": { schema } },
});

/* -------------------------------------------------------------------------- */
/*                                  Auth                                      */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "post",
  path: "/api/auth/sign-up/email",
  tags: ["Auth"],
  summary: "Daftar akun baru (email + kata sandi)",
  description:
    "Endpoint Better Auth. Setelah sukses, session token tersedia di response header `set-auth-token`. Simpan token tersebut dengan aman di perangkat.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).max(80),
            email: z.email(),
            password: z.string().min(8).max(128),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Akun berhasil dibuat", z.object({
      token: z.string().optional(),
      user: AuthUser,
    })),
    422: authErrorResponse("Email sudah dipakai atau data tidak valid"),
    429: errorResponse("Terlalu banyak percobaan (rate limit aplikasi)"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/sign-in/email",
  tags: ["Auth"],
  summary: "Masuk dengan email dan kata sandi",
  description:
    "Endpoint Better Auth. Ambil session token dari response header `set-auth-token` untuk dipakai sebagai `Authorization: Bearer <token>`.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email: z.email(),
            password: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Login berhasil", z.object({
      token: z.string().optional(),
      user: AuthUser,
    })),
    401: authErrorResponse("Email atau kata sandi salah"),
    429: errorResponse("Terlalu banyak percobaan (rate limit aplikasi)"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/sign-out",
  tags: ["Auth"],
  summary: "Logout dan hapus sesi aktif",
  security,
  responses: {
    200: jsonResponse("Logout berhasil", z.object({ success: z.boolean() })),
    401: authErrorResponse("Sesi tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/get-session",
  tags: ["Auth"],
  summary: "Ambil sesi dan profil pengguna yang sedang login",
  security,
  responses: {
    200: jsonResponse(
      "Sesi aktif, atau null bila belum login",
      z
        .object({
          session: z.record(z.string(), z.unknown()),
          user: AuthUser,
        })
        .nullable(),
    ),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/request-password-reset",
  tags: ["Auth"],
  summary: "Kirim tautan reset password ke email",
  description:
    "Respons selalu sama walaupun email tidak terdaftar (mencegah enumerasi akun). Email berisi deep link ke aplikasi mobile dengan token reset.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email: z.email(),
            redirectTo: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Permintaan diterima", z.object({
      status: z.boolean(),
      message: z.string(),
    })),
    429: errorResponse("Terlalu banyak permintaan (rate limit aplikasi)"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/reset-password",
  tags: ["Auth"],
  summary: "Simpan kata sandi baru dengan token reset",
  description:
    "Setelah reset, semua sesi lama dicabut. Pengguna perlu login kembali dengan kata sandi baru.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().min(1),
            newPassword: z.string().min(8).max(128),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Kata sandi berhasil diubah", z.object({ status: z.boolean() })),
    400: authErrorResponse("Token tidak valid atau kedaluwarsa"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Profile                                    */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/me",
  tags: ["Profile"],
  summary: "Ambil profil pengguna yang sedang login",
  security,
  responses: {
    200: jsonResponse("Profil pengguna", z.object({ data: AuthUser })),
    401: errorResponse("Sesi tidak valid"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/me",
  tags: ["Profile"],
  summary: "Ubah nama atau foto profil",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateProfileSchema } },
    },
  },
  responses: {
    200: jsonResponse("Profil diperbarui", z.object({ data: AuthUser })),
    401: errorResponse("Sesi tidak valid"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/me/email",
  tags: ["Profile"],
  summary: "Ajukan perubahan email (butuh verifikasi)",
  description:
    "Email baru baru aktif setelah pengguna mengklik tautan verifikasi yang dikirim ke email tersebut.",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: changeEmailSchema } },
    },
  },
  responses: {
    200: jsonResponse("Tautan verifikasi dikirim", z.object({
      data: z.object({ status: z.boolean(), message: z.string() }),
    })),
    401: errorResponse("Sesi tidak valid"),
    409: errorResponse("Email sama atau sudah dipakai akun lain"),
    422: errorResponse("Email tidak valid"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Categories                                 */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/categories",
  tags: ["Categories"],
  summary: "Daftar kategori bawaan + kategori milik pengguna",
  security,
  request: {
    query: z.object({
      type: z.enum(["expense", "income", "both"]).optional(),
      includeArchived: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: jsonResponse("Daftar kategori", z.object({ data: z.array(Category) })),
    401: errorResponse("Sesi tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/categories",
  tags: ["Categories"],
  summary: "Buat kategori sendiri",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCategorySchema } },
    },
  },
  responses: {
    201: jsonResponse("Kategori dibuat", z.object({ data: Category })),
    409: errorResponse("Nama dan jenis kategori sudah ada"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/categories/{id}",
  tags: ["Categories"],
  summary: "Detail kategori",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Detail kategori", z.object({ data: Category })),
    404: errorResponse("Kategori tidak ditemukan"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/categories/{id}",
  tags: ["Categories"],
  summary: "Ubah atau arsipkan kategori milik sendiri",
  security,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateCategorySchema } },
    },
  },
  responses: {
    200: jsonResponse("Kategori diperbarui", z.object({ data: Category })),
    403: errorResponse("Kategori bawaan tidak bisa diubah"),
    404: errorResponse("Kategori tidak ditemukan"),
    409: errorResponse("Konflik nama atau kategori sedang dipakai"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/categories/{id}",
  tags: ["Categories"],
  summary: "Hapus kategori yang belum dipakai transaksi",
  description:
    "Kategori yang sudah dipakai transaksi tidak bisa dihapus. Arsipkan lewat PATCH `isArchived: true`.",
  security,
  request: { params: idParamsSchema },
  responses: {
    204: { description: "Kategori dihapus" },
    403: errorResponse("Kategori bawaan tidak bisa dihapus"),
    404: errorResponse("Kategori tidak ditemukan"),
    409: errorResponse("Kategori masih dipakai transaksi"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                Transactions                                */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/transactions",
  tags: ["Transactions"],
  summary: "Riwayat transaksi dengan pencarian, filter, dan pagination",
  security,
  request: { query: listTransactionsQuerySchema },
  responses: {
    200: jsonResponse(
      "Daftar transaksi",
      z.object({
        data: z.array(Transaction),
        meta: z.object({
          page: z.number().int(),
          limit: z.number().int(),
          total: z.number().int(),
          totalPages: z.number().int(),
          hasNextPage: z.boolean(),
          hasPreviousPage: z.boolean(),
        }),
      }),
    ),
    401: errorResponse("Sesi tidak valid"),
    422: errorResponse("Parameter filter tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/transactions",
  tags: ["Transactions"],
  summary: "Catat transaksi baru (idempotent lewat clientId)",
  description:
    "Kirim `clientId` unik dari perangkat. Bila clientId sudah pernah tersimpan, server mengembalikan transaksi yang sama dengan status 200 (bukan duplikat).",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTransactionSchema } },
    },
  },
  responses: {
    201: jsonResponse("Transaksi dibuat", z.object({
      data: Transaction,
      meta: z.object({ replay: z.boolean() }),
    })),
    200: jsonResponse("Replay idempotent — transaksi sudah ada", z.object({
      data: Transaction,
      meta: z.object({ replay: z.boolean() }),
    })),
    409: errorResponse("Kategori tidak cocok atau sudah diarsipkan"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/transactions/sync",
  tags: ["Transactions"],
  summary: "Kirim antrian transaksi offline (maksimal 100)",
  description:
    "Setiap item divalidasi dan diproses terpisah. Item yang gagal tidak membatalkan item lain. Aman dikirim ulang karena memakai clientId.",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: syncTransactionsSchema } },
    },
  },
  responses: {
    200: jsonResponse("Hasil sinkronisasi per item", z.object({ data: SyncResult })),
    422: errorResponse("Format batch tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/transactions/{id}",
  tags: ["Transactions"],
  summary: "Detail transaksi",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Detail transaksi", z.object({ data: Transaction })),
    404: errorResponse("Transaksi tidak ditemukan"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/transactions/{id}",
  tags: ["Transactions"],
  summary: "Edit transaksi",
  security,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTransactionSchema } },
    },
  },
  responses: {
    200: jsonResponse("Transaksi diperbarui", z.object({ data: Transaction })),
    404: errorResponse("Transaksi tidak ditemukan"),
    409: errorResponse("Kategori tidak cocok"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/transactions/{id}",
  tags: ["Transactions"],
  summary: "Hapus transaksi",
  security,
  request: { params: idParamsSchema },
  responses: {
    204: { description: "Transaksi dihapus" },
    404: errorResponse("Transaksi tidak ditemukan"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                  Budgets                                   */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/budgets",
  tags: ["Budgets"],
  summary: "Daftar batas pengeluaran",
  security,
  request: {
    query: z.object({
      period: z.enum(["daily", "monthly"]).optional(),
      month: monthSchema.optional(),
      activeOnly: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: jsonResponse("Daftar batas", z.object({ data: z.array(Budget) })),
    401: errorResponse("Sesi tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/budgets",
  tags: ["Budgets"],
  summary: "Buat batas pengeluaran harian/bulanan",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createBudgetSchema } },
    },
  },
  responses: {
    201: jsonResponse("Batas dibuat", z.object({ data: Budget })),
    409: errorResponse("Batas untuk periode dan bulan tersebut sudah ada"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/budgets/{id}",
  tags: ["Budgets"],
  summary: "Detail batas pengeluaran",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Detail batas", z.object({ data: Budget })),
    404: errorResponse("Batas tidak ditemukan"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/budgets/{id}",
  tags: ["Budgets"],
  summary: "Ubah nominal atau status aktif batas",
  security,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateBudgetSchema } },
    },
  },
  responses: {
    200: jsonResponse("Batas diperbarui", z.object({ data: Budget })),
    404: errorResponse("Batas tidak ditemukan"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/budgets/{id}",
  tags: ["Budgets"],
  summary: "Hapus batas pengeluaran",
  security,
  request: { params: idParamsSchema },
  responses: {
    204: { description: "Batas dihapus" },
    404: errorResponse("Batas tidak ditemukan"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                  Products                                  */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/products",
  tags: ["Products"],
  summary: "Daftar produk inventaris & stok",
  security,
  request: { query: listProductsQuerySchema },
  responses: {
    200: jsonResponse(
      "Daftar produk",
      z.object({
        data: z.array(Product),
        meta: PaginationMeta,
      }),
    ),
    422: errorResponse("Query tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/products",
  tags: ["Products"],
  summary: "Tambah produk baru",
  security,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createProductSchema } },
    },
  },
  responses: {
    201: jsonResponse("Produk dibuat", z.object({ data: Product })),
    409: errorResponse("Nama produk sudah ada"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/products/{id}",
  tags: ["Products"],
  summary: "Detail produk",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Detail produk", z.object({ data: Product })),
    404: errorResponse("Produk tidak ditemukan"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/products/{id}",
  tags: ["Products"],
  summary: "Ubah data produk",
  security,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateProductSchema } },
    },
  },
  responses: {
    200: jsonResponse("Produk diperbarui", z.object({ data: Product })),
    404: errorResponse("Produk tidak ditemukan"),
    409: errorResponse("Nama produk sudah ada"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/products/{id}/stock",
  tags: ["Products"],
  summary: "Ubah / restock jumlah stok produk",
  security,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: adjustStockSchema } },
    },
  },
  responses: {
    200: jsonResponse("Stok produk diperbarui", z.object({ data: Product })),
    400: errorResponse("Stok tidak mencukupi"),
    404: errorResponse("Produk tidak ditemukan"),
    422: errorResponse("Data tidak valid"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/products/{id}",
  tags: ["Products"],
  summary: "Hapus produk",
  security,
  request: { params: idParamsSchema },
  responses: {
    204: { description: "Produk dihapus" },
    404: errorResponse("Produk tidak ditemukan"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Analytics                                  */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/summary",
  tags: ["Analytics"],
  summary: "Rekap bulanan + peringatan boncos dan batas pengeluaran",
  description:
    "Bila `month` tidak diisi, dipakai bulan berjalan menurut zona waktu aplikasi. Peringatan boncos muncul mulai 80% pemasukan dan berubah merah saat melewati 100%.",
  security,
  request: { query: summaryQuerySchema },
  responses: {
    200: jsonResponse("Rekap bulanan", z.object({ data: MonthlySummary })),
    422: errorResponse("Format bulan tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/categories",
  tags: ["Analytics"],
  summary: "Grafik pengeluaran/pemasukan per kategori",
  security,
  request: { query: categoryBreakdownQuerySchema },
  responses: {
    200: jsonResponse(
      "Komposisi per kategori",
      z.object({ data: CategoryBreakdown }),
    ),
    422: errorResponse("Parameter tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/trend",
  tags: ["Analytics"],
  summary: "Tren harian pemasukan vs pengeluaran selama satu bulan",
  security,
  request: { query: trendQuerySchema },
  responses: {
    200: jsonResponse("Tren harian", z.object({ data: DailyTrend })),
    422: errorResponse("Format bulan tidak valid"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/months",
  tags: ["Analytics"],
  summary: "Daftar bulan yang punya data (untuk pemilih bulan)",
  security,
  request: { query: monthsQuerySchema },
  responses: {
    200: jsonResponse("Daftar bulan", z.object({ data: z.array(MonthItem) })),
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Export                                     */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/api/v1/export/transactions.csv",
  tags: ["Export"],
  summary: "Unduh transaksi sebagai CSV",
  description:
    "Default mengekspor bulan berjalan. Filter tanggal memakai format YYYY-MM-DD. File memakai UTF-8 BOM agar karakter Indonesia tampil benar di Excel.",
  security,
  request: { query: exportQuerySchema },
  responses: {
    200: {
      description: "File CSV",
      content: {
        "text/csv": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
    422: errorResponse("Rentang tanggal tidak valid"),
  },
});

/* -------------------------------------------------------------------------- */
/*                                  Health                                    */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check API dan koneksi database",
  responses: {
    200: jsonResponse("API sehat", z.object({
      status: z.literal("ok"),
      database: z.literal("up"),
      uptimeSeconds: z.number(),
      timestamp: z.string(),
    })),
    503: jsonResponse("Database tidak tersedia", z.object({
      status: z.literal("unavailable"),
      database: z.literal("down"),
      uptimeSeconds: z.number(),
      timestamp: z.string(),
    })),
  },
});

export const openApiDocument = new OpenApiGeneratorV3(
  registry.definitions,
).generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Catat Duit API",
    version: "1.0.0",
    description: [
      "REST API untuk aplikasi pencatat keuangan pribadi Catat Duit.",
      "",
      "**Autentikasi mobile:** panggil `/api/auth/sign-in/email`, ambil nilai header `set-auth-token`, lalu kirim pada setiap request sebagai `Authorization: Bearer <token>`.",
      "",
      "**Idempotensi sinkronisasi:** setiap transaksi membawa `clientId` unik dari perangkat. Pengiriman ulang tidak membuat data ganda.",
    ].join("\n"),
    contact: { name: "Catat Duit" },
  },
  servers: [
    {
      url: env.betterAuthUrl,
      description: env.isProduction ? "Production" : "Development",
    },
  ],
  tags: [
    {
      name: "Auth",
      description:
        "Registrasi, login, logout, reset password (Better Auth). Respons error memakai format { message, code }.",
    },
    { name: "Profile", description: "Profil dan email pengguna" },
    { name: "Categories", description: "Kategori bawaan dan kategori sendiri" },
    { name: "Transactions", description: "CRUD, pencarian, filter, dan sinkronisasi" },
    { name: "Budgets", description: "Batas pengeluaran harian/bulanan" },
    { name: "Analytics", description: "Rekap, grafik, dan tren" },
    { name: "Export", description: "Ekspor data keuangan" },
    { name: "Health", description: "Status layanan" },
  ],
});
