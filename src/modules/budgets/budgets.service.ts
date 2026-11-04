import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { budgets, type Budget } from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { conflict, notFound } from "../../lib/errors.js";
import { toRupiah } from "../../lib/money.js";
import type {
  CreateBudgetInput,
  ListBudgetsQuery,
  UpdateBudgetInput,
} from "./budgets.schemas.js";

export type BudgetResponse = {
  id: string;
  period: "daily" | "monthly";
  amount: number;
  month: string | null;
  isActive: boolean;
  createdAt: string;
};

export function serializeBudget(row: Budget): BudgetResponse {
  return {
    id: row.id,
    period: row.period,
    amount: toRupiah(row.amount),
    month: row.month,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBudgets(
  userId: string,
  query: ListBudgetsQuery,
): Promise<BudgetResponse[]> {
  const filters: SQL[] = [eq(budgets.userId, userId)];

  if (query.period) {
    filters.push(eq(budgets.period, query.period));
  }
  if (query.activeOnly) {
    filters.push(eq(budgets.isActive, true));
  }
  if (query.month) {
    const monthFilter = or(
      isNull(budgets.month),
      eq(budgets.month, query.month),
    );
    if (monthFilter) filters.push(monthFilter);
  }

  const rows = await db
    .select()
    .from(budgets)
    .where(and(...filters))
    .orderBy(
      desc(budgets.isActive),
      desc(budgets.period),
      sql`${budgets.month} desc nulls last`,
      desc(budgets.createdAt),
    );

  return rows.map(serializeBudget);
}

export async function getBudget(
  userId: string,
  budgetId: string,
): Promise<BudgetResponse> {
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .limit(1);

  if (!row) throw notFound("Batas pengeluaran tidak ditemukan");
  return serializeBudget(row);
}

async function findExisting(
  userId: string,
  period: "daily" | "monthly",
  month: string | null,
): Promise<Budget | null> {
  const [row] = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.period, period),
        month === null ? isNull(budgets.month) : eq(budgets.month, month),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createBudget(
  userId: string,
  input: CreateBudgetInput,
): Promise<BudgetResponse> {
  const existing = await findExisting(userId, input.period, input.month);
  if (existing) {
    throw conflict(
      "Batas untuk periode dan bulan tersebut sudah ada. Ubah batas yang sudah ada.",
      { budgetId: existing.id },
    );
  }

  try {
    const [created] = await db
      .insert(budgets)
      .values({
        userId,
        period: input.period,
        amount: input.amount.toFixed(2),
        month: input.month,
        isActive: input.isActive,
      })
      .returning();

    return serializeBudget(created!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        "Batas untuk periode dan bulan tersebut sudah ada. Ubah batas yang sudah ada.",
      );
    }
    throw error;
  }
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
): Promise<BudgetResponse> {
  const updates: { amount?: string; isActive?: boolean } = {};
  if (input.amount !== undefined) updates.amount = input.amount.toFixed(2);
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [updated] = await db
    .update(budgets)
    .set(updates)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .returning();

  if (!updated) throw notFound("Batas pengeluaran tidak ditemukan");
  return serializeBudget(updated);
}

export async function deleteBudget(
  userId: string,
  budgetId: string,
): Promise<void> {
  const deleted = await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .returning({ id: budgets.id });

  if (deleted.length === 0) {
    throw notFound("Batas pengeluaran tidak ditemukan");
  }
}

/**
 * Mengambil maksimal satu batas aktif per periode yang berlaku untuk bulan
 * tertentu. Batas khusus bulan (month terisi) diprioritaskan di atas batas
 * berulang (month NULL).
 */
export async function findEffectiveBudgets(
  userId: string,
  month: string,
): Promise<Budget[]> {
  const rows = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.isActive, true),
        or(isNull(budgets.month), eq(budgets.month, month)),
      ),
    )
    .orderBy(
      sql`${budgets.month} desc nulls last`,
      desc(budgets.createdAt),
    );

  const selected = new Map<"daily" | "monthly", Budget>();
  for (const row of rows) {
    if (!selected.has(row.period)) {
      selected.set(row.period, row);
    }
  }

  return [...selected.values()];
}
