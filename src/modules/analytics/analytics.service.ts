import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories, transactions } from "../../db/schema.js";
import {
  currentMonth,
  daysInMonth,
  monthLabel,
  monthRange,
  todayInAppTimeZone,
} from "../../lib/dates.js";
import {
  centsToRupiah,
  formatRupiah,
  percentage,
  toCents,
  toRupiah,
} from "../../lib/money.js";
import { findEffectiveBudgets } from "../budgets/budgets.service.js";
import type {
  CategoryBreakdownQuery,
  MonthsQuery,
  SummaryQuery,
  TrendQuery,
} from "./analytics.schemas.js";

export type AlertLevel = "safe" | "warning" | "over";

export type BoncosWarning = {
  level: AlertLevel;
  thresholdPercent: number;
  ratioPercent: number | null;
  message: string;
};

export type BudgetAlert = {
  id: string;
  period: "daily" | "monthly";
  amount: number;
  month: string | null;
  used: number;
  remaining: number;
  usagePercent: number;
  status: AlertLevel;
  message: string;
};

export type MonthlySummary = {
  month: string;
  label: string;
  period: { start: string; end: string };
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  warning: BoncosWarning;
  budgets: BudgetAlert[];
  budgetWarning: {
    level: AlertLevel | "none";
    message: string;
  };
};

function levelFromUsage(usagePercent: number): AlertLevel {
  if (usagePercent >= 100) return "over";
  if (usagePercent >= 80) return "warning";
  return "safe";
}

function buildBoncosWarning(
  income: number,
  expense: number,
): BoncosWarning {
  const thresholdPercent = 80;

  if (expense === 0) {
    return {
      level: "safe",
      thresholdPercent,
      ratioPercent: 0,
      message: "Belum ada pengeluaran bulan ini.",
    };
  }

  if (income <= 0) {
    return {
      level: "over",
      thresholdPercent,
      ratioPercent: null,
      message: `Belum ada pemasukan bulan ini, tetapi pengeluaran sudah ${formatRupiah(expense)}.`,
    };
  }

  const ratioPercent = percentage(expense, income);

  if (ratioPercent >= 100) {
    return {
      level: "over",
      thresholdPercent,
      ratioPercent,
      message:
        ratioPercent === 100
          ? `Pengeluaran sudah menghabiskan seluruh pemasukan bulan ini (${formatRupiah(income)}).`
          : `Pengeluaran (${formatRupiah(expense)}) sudah melebihi pemasukan bulan ini (${formatRupiah(income)}).`,
    };
  }

  if (ratioPercent >= thresholdPercent) {
    return {
      level: "warning",
      thresholdPercent,
      ratioPercent,
      message: `Pengeluaran sudah ${ratioPercent}% dari pemasukan bulan ini. Waspada boncos.`,
    };
  }

  return {
    level: "safe",
    thresholdPercent,
    ratioPercent,
    message: `Pengeluaran masih ${ratioPercent}% dari pemasukan bulan ini.`,
  };
}

function buildBudgetAlerts(
  effectiveBudgets: Awaited<ReturnType<typeof findEffectiveBudgets>>,
  monthExpense: number,
  todayExpense: number,
  isCurrentMonth: boolean,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  for (const budget of effectiveBudgets) {
    if (budget.period === "daily" && !isCurrentMonth) {
      continue;
    }

    const used =
      budget.period === "daily" ? todayExpense : monthExpense;
    const limit = toRupiah(budget.amount);
    const usagePercent =
      limit > 0 ? Math.round((used / limit) * 10_000) / 100 : 0;
    const status = levelFromUsage(usagePercent);
    const remaining = centsToRupiah(toCents(limit) - toCents(used));

    const label = budget.period === "daily" ? "harian" : "bulanan";
    const message =
      status === "over"
        ? remaining < 0
          ? `Batas ${label} ${formatRupiah(limit)} sudah terlampaui sebesar ${formatRupiah(Math.abs(remaining))}.`
          : `Batas ${label} ${formatRupiah(limit)} sudah tercapai.`
        : status === "warning"
          ? `Pengeluaran sudah ${usagePercent}% dari batas ${label} ${formatRupiah(limit)}.`
          : `Sisa batas ${label}: ${formatRupiah(remaining)}.`;

    alerts.push({
      id: budget.id,
      period: budget.period,
      amount: limit,
      month: budget.month,
      used,
      remaining,
      usagePercent,
      status,
      message,
    });
  }

  return alerts;
}

function summarizeBudgetWarnings(alerts: BudgetAlert[]): {
  level: AlertLevel | "none";
  message: string;
} {
  const over = alerts.find((alert) => alert.status === "over");
  if (over) {
    return { level: "over", message: over.message };
  }

  const warning = alerts.find((alert) => alert.status === "warning");
  if (warning) {
    return { level: "warning", message: warning.message };
  }

  if (alerts.length > 0) {
    return {
      level: "safe",
      message: "Semua pengeluaran masih di bawah batas yang kamu tentukan.",
    };
  }

  return {
    level: "none",
    message: "Belum ada batas pengeluaran yang aktif.",
  };
}

export async function getMonthlySummary(
  userId: string,
  query: SummaryQuery,
): Promise<MonthlySummary> {
  const month = query.month ?? currentMonth();
  const range = monthRange(month);
  const isCurrentMonth = month === currentMonth();
  const today = todayInAppTimeZone();

  const [totals] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      transactionCount: sql<number>`count(*)::int`,
      incomeCount: sql<number>`count(*) filter (where ${transactions.type} = 'income')::int`,
      expenseCount: sql<number>`count(*) filter (where ${transactions.type} = 'expense')::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, range.start),
        lte(transactions.transactionDate, range.end),
      ),
    );

  const income = toRupiah(totals?.income);
  const expense = toRupiah(totals?.expense);

  let todayExpense = 0;
  if (isCurrentMonth) {
    const [todayRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          eq(transactions.transactionDate, today),
        ),
      );
    todayExpense = toRupiah(todayRow?.total);
  }

  const effectiveBudgets = await findEffectiveBudgets(userId, month);
  const budgetAlerts = buildBudgetAlerts(
    effectiveBudgets,
    expense,
    todayExpense,
    isCurrentMonth,
  );

  return {
    month,
    label: monthLabel(month),
    period: range,
    income,
    expense,
    balance: centsToRupiah(toCents(income) - toCents(expense)),
    transactionCount: totals?.transactionCount ?? 0,
    incomeCount: totals?.incomeCount ?? 0,
    expenseCount: totals?.expenseCount ?? 0,
    warning: buildBoncosWarning(income, expense),
    budgets: budgetAlerts,
    budgetWarning: summarizeBudgetWarnings(budgetAlerts),
  };
}

export type CategoryBreakdown = {
  month: string;
  label: string;
  type: "expense" | "income";
  total: number;
  categories: Array<{
    categoryId: string;
    name: string;
    icon: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
  }>;
};

export async function getCategoryBreakdown(
  userId: string,
  query: CategoryBreakdownQuery,
): Promise<CategoryBreakdown> {
  const month = query.month ?? currentMonth();
  const range = monthRange(month);

  const filters: SQL[] = [
    eq(transactions.userId, userId),
    eq(transactions.type, query.type),
    gte(transactions.transactionDate, range.start),
    lte(transactions.transactionDate, range.end),
  ];

  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...filters))
    .groupBy(categories.id, categories.name, categories.icon, categories.color)
    .orderBy(sql`sum(${transactions.amount}) desc`);

  const categoriesWithAmounts = rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    icon: row.icon,
    color: row.color,
    total: toRupiah(row.total),
    count: row.count,
  }));

  const total = centsToRupiah(
    categoriesWithAmounts.reduce(
      (sum, row) => sum + toCents(row.total),
      0,
    ),
  );

  return {
    month,
    label: monthLabel(month),
    type: query.type,
    total,
    categories: categoriesWithAmounts.map((row) => ({
      ...row,
      percentage: percentage(row.total, total),
    })),
  };
}

export type DailyTrend = {
  month: string;
  label: string;
  days: Array<{
    date: string;
    income: number;
    expense: number;
    net: number;
  }>;
  totalIncome: number;
  totalExpense: number;
  averageDailyExpense: number;
  highestExpenseDay: { date: string; amount: number } | null;
};

export async function getDailyTrend(
  userId: string,
  query: TrendQuery,
): Promise<DailyTrend> {
  const month = query.month ?? currentMonth();
  const range = monthRange(month);
  const today = todayInAppTimeZone();

  const rows = await db
    .select({
      date: transactions.transactionDate,
      type: transactions.type,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, range.start),
        lte(transactions.transactionDate, range.end),
      ),
    )
    .groupBy(transactions.transactionDate, transactions.type);

  const byDate = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const existing = byDate.get(row.date) ?? { income: 0, expense: 0 };
    existing[row.type] = toRupiah(row.total);
    byDate.set(row.date, existing);
  }

  const days = daysInMonth(month).map((date) => {
    const totals = byDate.get(date) ?? { income: 0, expense: 0 };
    return {
      date,
      income: totals.income,
      expense: totals.expense,
      net: centsToRupiah(toCents(totals.income) - toCents(totals.expense)),
    };
  });

  const totalIncome = centsToRupiah(
    days.reduce((sum, day) => sum + toCents(day.income), 0),
  );
  const totalExpense = centsToRupiah(
    days.reduce((sum, day) => sum + toCents(day.expense), 0),
  );

  const denominator =
    month === currentMonth() && today.startsWith(month)
      ? Number(today.slice(8, 10))
      : days.length;
  const averageDailyExpense =
    denominator > 0 ? Math.round((totalExpense / denominator) * 100) / 100 : 0;

  const highest = days.reduce<{ date: string; amount: number } | null>(
    (best, day) => {
      if (day.expense <= 0) return best;
      if (!best || day.expense > best.amount) {
        return { date: day.date, amount: day.expense };
      }
      return best;
    },
    null,
  );

  return {
    month,
    label: monthLabel(month),
    days,
    totalIncome,
    totalExpense,
    averageDailyExpense,
    highestExpenseDay: highest,
  };
}

export type MonthItem = {
  month: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
};

export async function getAvailableMonths(
  userId: string,
  query: MonthsQuery,
): Promise<MonthItem[]> {
  const monthExpression = sql<string>`to_char(${transactions.transactionDate}, 'YYYY-MM')`;

  const rows = await db
    .select({
      month: monthExpression,
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(monthExpression)
    .orderBy(sql`${monthExpression} desc`)
    .limit(query.limit);

  const items: MonthItem[] = rows.map((row) => {
    const income = toRupiah(row.income);
    const expense = toRupiah(row.expense);
    return {
      month: row.month,
      label: monthLabel(row.month),
      income,
      expense,
      balance: centsToRupiah(toCents(income) - toCents(expense)),
      transactionCount: row.transactionCount,
    };
  });

  const thisMonth = currentMonth();
  if (!items.some((item) => item.month === thisMonth)) {
    items.unshift({
      month: thisMonth,
      label: monthLabel(thisMonth),
      income: 0,
      expense: 0,
      balance: 0,
      transactionCount: 0,
    });
  }

  items.sort((a, b) => b.month.localeCompare(a.month));
  return items.slice(0, query.limit);
}
