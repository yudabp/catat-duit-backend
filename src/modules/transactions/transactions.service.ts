import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  categories,
  transactions,
  type NewTransaction,
  type TransactionType,
} from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { AppError, notFound } from "../../lib/errors.js";
import { toAmountString, toRupiah } from "../../lib/money.js";
import { monthRange } from "../../lib/dates.js";
import { getUsableCategory } from "../categories/categories.service.js";
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type ListTransactionsQuery,
  type TransactionSort,
  type UpdateTransactionInput,
} from "./transactions.schemas.js";

const joinedSelection = {
  id: transactions.id,
  userId: transactions.userId,
  categoryId: transactions.categoryId,
  type: transactions.type,
  amount: transactions.amount,
  note: transactions.note,
  transactionDate: transactions.transactionDate,
  clientId: transactions.clientId,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  categoryName: categories.name,
  categoryIcon: categories.icon,
  categoryColor: categories.color,
  categoryType: categories.type,
  categoryIsDefault: categories.isDefault,
} as const;

export type TransactionRow = {
  id: string;
  userId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  note: string | null;
  transactionDate: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  categoryType: "expense" | "income" | "both";
  categoryIsDefault: boolean;
};

export type TransactionResponse = {
  id: string;
  type: TransactionType;
  amount: number;
  note: string | null;
  transactionDate: string;
  clientId: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: "expense" | "income" | "both";
    isDefault: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export function serializeTransaction(row: TransactionRow): TransactionResponse {
  return {
    id: row.id,
    type: row.type,
    amount: toRupiah(row.amount),
    note: row.note,
    transactionDate: row.transactionDate,
    clientId: row.clientId,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      icon: row.categoryIcon,
      color: row.categoryColor,
      type: row.categoryType,
      isDefault: row.categoryIsDefault,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function joinCategories() {
  return db
    .select(joinedSelection)
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id));
}

async function findRow(
  userId: string,
  transactionId: string,
): Promise<TransactionRow | null> {
  const [row] = await joinCategories()
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function findRowByClientId(
  userId: string,
  clientId: string,
): Promise<TransactionRow | null> {
  const [row] = await joinCategories()
    .where(
      and(
        eq(transactions.clientId, clientId),
        eq(transactions.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  const row = await findRow(userId, transactionId);
  if (!row) throw notFound("Transaksi tidak ditemukan");
  return serializeTransaction(row);
}

export type CreateTransactionResult = {
  transaction: TransactionResponse;
  replay: boolean;
};

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<CreateTransactionResult> {
  const existing = await findRowByClientId(userId, input.clientId);
  if (existing) {
    return {
      transaction: serializeTransaction(existing),
      replay: true,
    };
  }

  await getUsableCategory(userId, input.categoryId, input.type);

  const values: NewTransaction = {
    userId,
    categoryId: input.categoryId,
    type: input.type,
    amount: toAmountString(input.amount),
    note: input.note ?? null,
    transactionDate: input.transactionDate,
    clientId: input.clientId,
  };

  try {
    const [inserted] = await db
      .insert(transactions)
      .values(values)
      .returning({ id: transactions.id });

    const row = await findRow(userId, inserted!.id);
    if (!row) {
      throw new Error("Transaksi berhasil dibuat tetapi gagal dibaca kembali");
    }

    return { transaction: serializeTransaction(row), replay: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await findRowByClientId(userId, input.clientId);
      if (duplicate) {
        return {
          transaction: serializeTransaction(duplicate),
          replay: true,
        };
      }
    }
    throw error;
  }
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponse> {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw notFound("Transaksi tidak ditemukan");
  }

  const nextType = input.type ?? existing.type;
  const nextCategoryId = input.categoryId ?? existing.categoryId;

  if (
    input.type !== undefined ||
    input.categoryId !== undefined
  ) {
    await getUsableCategory(userId, nextCategoryId, nextType);
  }

  const updates: Partial<NewTransaction> = { updatedAt: new Date() };
  if (input.type !== undefined) updates.type = input.type;
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  if (input.amount !== undefined) {
    updates.amount = toAmountString(input.amount);
  }
  if (input.note !== undefined) updates.note = input.note;
  if (input.transactionDate !== undefined) {
    updates.transactionDate = input.transactionDate;
  }

  await db
    .update(transactions)
    .set(updates)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
      ),
    );

  const row = await findRow(userId, transactionId);
  if (!row) {
    throw notFound("Transaksi tidak ditemukan");
  }
  return serializeTransaction(row);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<void> {
  const deleted = await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
      ),
    )
    .returning({ id: transactions.id });

  if (deleted.length === 0) {
    throw notFound("Transaksi tidak ditemukan");
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildFilters(
  userId: string,
  query: ListTransactionsQuery,
): SQL[] {
  const filters: SQL[] = [eq(transactions.userId, userId)];

  if (query.type) {
    filters.push(eq(transactions.type, query.type));
  }

  if (query.categoryId) {
    filters.push(eq(transactions.categoryId, query.categoryId));
  }

  const range = query.month ? monthRange(query.month) : null;
  const from = query.from ?? range?.start;
  const to = query.to ?? range?.end;

  if (from) filters.push(gte(transactions.transactionDate, from));
  if (to) filters.push(lte(transactions.transactionDate, to));

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    const searchFilter = or(
      ilike(transactions.note, pattern),
      ilike(categories.name, pattern),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  return filters;
}

function orderByFor(sort: TransactionSort): SQL[] {
  switch (sort) {
    case "date_asc":
      return [
        asc(transactions.transactionDate),
        asc(transactions.createdAt),
        asc(transactions.id),
      ];
    case "amount_desc":
      return [
        desc(transactions.amount),
        desc(transactions.transactionDate),
        desc(transactions.createdAt),
      ];
    case "amount_asc":
      return [
        asc(transactions.amount),
        desc(transactions.transactionDate),
        desc(transactions.createdAt),
      ];
    case "date_desc":
    default:
      return [
        desc(transactions.transactionDate),
        desc(transactions.createdAt),
        desc(transactions.id),
      ];
  }
}

export type PaginatedTransactions = {
  data: TransactionResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export async function listTransactions(
  userId: string,
  query: ListTransactionsQuery,
): Promise<PaginatedTransactions> {
  const filters = buildFilters(userId, query);
  const where = and(...filters);
  const offset = (query.page - 1) * query.limit;

  const [rows, countRows] = await Promise.all([
    joinCategories()
      .where(where)
      .orderBy(...orderByFor(query.sort))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(where),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return {
    data: rows.map(serializeTransaction),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: offset + rows.length < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

export type SyncItemResult =
  | {
      index: number;
      status: "created" | "replayed";
      transaction: TransactionResponse;
    }
  | {
      index: number;
      status: "failed";
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

export type SyncResult = {
  results: SyncItemResult[];
  summary: {
    total: number;
    created: number;
    replayed: number;
    failed: number;
  };
};

export async function syncTransactions(
  userId: string,
  rawTransactions: unknown[],
): Promise<SyncResult> {
  const results: SyncItemResult[] = [];
  let created = 0;
  let replayed = 0;
  let failed = 0;

  for (const [index, raw] of rawTransactions.entries()) {
    const parsed = createTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      failed += 1;
      results.push({
        index,
        status: "failed",
        error: {
          code: "VALIDATION_ERROR",
          message: "Transaksi tidak valid",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      continue;
    }

    try {
      const result = await createTransaction(userId, parsed.data);
      if (result.replay) {
        replayed += 1;
        results.push({
          index,
          status: "replayed",
          transaction: result.transaction,
        });
      } else {
        created += 1;
        results.push({
          index,
          status: "created",
          transaction: result.transaction,
        });
      }
    } catch (error) {
      failed += 1;
      const message =
        error instanceof AppError
          ? error.message
          : "Transaksi gagal disimpan";
      results.push({
        index,
        status: "failed",
        error: {
          code: error instanceof AppError ? error.code : "TRANSACTION_REJECTED",
          message,
          ...(error instanceof AppError && error.details !== undefined
            ? { details: error.details }
            : {}),
        },
      });
    }
  }

  return {
    results,
    summary: {
      total: rawTransactions.length,
      created,
      replayed,
      failed,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                       Query khusus ekspor CSV                              */
/* -------------------------------------------------------------------------- */

export type ExportRow = {
  transactionDate: string;
  type: TransactionType;
  categoryName: string;
  amount: string;
  note: string | null;
  id: string;
};

export async function listTransactionsForExport(
  userId: string,
  filtersInput: {
    from: string;
    to: string;
    type?: "expense" | "income";
    categoryId?: string;
  },
  limit: number,
  offset: number,
): Promise<ExportRow[]> {
  const filters: SQL[] = [
    eq(transactions.userId, userId),
    gte(transactions.transactionDate, filtersInput.from),
    lte(transactions.transactionDate, filtersInput.to),
  ];

  if (filtersInput.type) {
    filters.push(eq(transactions.type, filtersInput.type));
  }
  if (filtersInput.categoryId) {
    filters.push(eq(transactions.categoryId, filtersInput.categoryId));
  }

  return db
    .select({
      transactionDate: transactions.transactionDate,
      type: transactions.type,
      categoryName: categories.name,
      amount: transactions.amount,
      note: transactions.note,
      id: transactions.id,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...filters))
    .orderBy(
      asc(transactions.transactionDate),
      asc(transactions.createdAt),
      asc(transactions.id),
    )
    .limit(limit)
    .offset(offset);
}
