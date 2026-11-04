import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_IDS } from "../src/db/default-categories.js";
import { currentMonth } from "../src/lib/dates.js";
import {
  api,
  createBudgetFor,
  createTransactionFor,
  signUpUser,
} from "./helpers.js";

async function seedMay(user: Awaited<ReturnType<typeof signUpUser>>) {
  const rows = [
    {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "income",
      amount: 5_000_000,
      note: "Gaji Mei",
      transactionDate: "2026-05-01",
    },
    {
      categoryId: DEFAULT_CATEGORY_IDS.makan,
      type: "expense",
      amount: 1_000_000,
      note: "Makan",
      transactionDate: "2026-05-02",
    },
    {
      categoryId: DEFAULT_CATEGORY_IDS.transport,
      type: "expense",
      amount: 500_000,
      note: "Transport",
      transactionDate: "2026-05-02",
    },
    {
      categoryId: DEFAULT_CATEGORY_IDS.makan,
      type: "expense",
      amount: 200_000,
      note: "Makan akhir bulan",
      transactionDate: "2026-05-31",
    },
  ];

  for (const row of rows) {
    const response = await createTransactionFor(user, row);
    expect(response.status).toBe(201);
  }
}

describe("Analitik", () => {
  it("rekap bulanan menghitung total dan status aman", async () => {
    const user = await signUpUser();
    await seedMay(user);

    const response = await api()
      .get("/api/v1/analytics/summary?month=2026-05")
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      month: "2026-05",
      label: "Mei 2026",
      income: 5_000_000,
      expense: 1_700_000,
      balance: 3_300_000,
      transactionCount: 4,
      incomeCount: 1,
      expenseCount: 3,
    });
    expect(response.body.data.warning.level).toBe("safe");
    expect(response.body.data.warning.ratioPercent).toBe(34);
    expect(response.body.data.budgets).toEqual([]);
    expect(response.body.data.budgetWarning.level).toBe("none");
  });

  it("bulan tanpa data tetap mengembalikan nol", async () => {
    const user = await signUpUser();

    const response = await api()
      .get("/api/v1/analytics/summary?month=2026-01")
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.body.data.income).toBe(0);
    expect(response.body.data.expense).toBe(0);
    expect(response.body.data.balance).toBe(0);
    expect(response.body.data.warning.level).toBe("safe");
  });

  it("menaikkan peringatan boncos pada 80% dan melewati 100%", async () => {
    const user = await signUpUser();

    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "income",
      amount: 1_000_000,
      transactionDate: "2026-03-01",
    });
    await createTransactionFor(user, {
      amount: 800_000,
      transactionDate: "2026-03-02",
    });

    const warning = await api()
      .get("/api/v1/analytics/summary?month=2026-03")
      .set(user.headers);
    expect(warning.body.data.warning.level).toBe("warning");
    expect(warning.body.data.warning.ratioPercent).toBe(80);

    await createTransactionFor(user, {
      amount: 300_000,
      transactionDate: "2026-03-03",
    });

    const over = await api()
      .get("/api/v1/analytics/summary?month=2026-03")
      .set(user.headers);
    expect(over.body.data.warning.level).toBe("over");
    expect(over.body.data.warning.ratioPercent).toBe(110);
    expect(over.body.data.balance).toBe(-100_000);
  });

  it("pengeluaran tanpa pemasukan dianggap over", async () => {
    const user = await signUpUser();
    await createTransactionFor(user, {
      amount: 100_000,
      transactionDate: "2026-02-01",
    });

    const response = await api()
      .get("/api/v1/analytics/summary?month=2026-02")
      .set(user.headers);

    expect(response.body.data.warning.level).toBe("over");
    expect(response.body.data.warning.ratioPercent).toBeNull();
  });

  it("komposisi kategori menghitung total, persentase, dan urutan", async () => {
    const user = await signUpUser();
    await seedMay(user);

    const expenses = await api()
      .get("/api/v1/analytics/categories?month=2026-05&type=expense")
      .set(user.headers);

    expect(expenses.status).toBe(200);
    expect(expenses.body.data.total).toBe(1_700_000);
    expect(expenses.body.data.categories).toHaveLength(2);
    expect(expenses.body.data.categories[0]).toMatchObject({
      name: "Makan",
      total: 1_200_000,
      count: 2,
      percentage: 70.59,
    });
    expect(expenses.body.data.categories[1]).toMatchObject({
      name: "Transport",
      total: 500_000,
      count: 1,
      percentage: 29.41,
    });

    const income = await api()
      .get("/api/v1/analytics/categories?month=2026-05&type=income")
      .set(user.headers);
    expect(income.body.data.total).toBe(5_000_000);
    expect(income.body.data.categories[0].percentage).toBe(100);
  });

  it("tren harian mengisi semua tanggal termasuk hari tanpa transaksi", async () => {
    const user = await signUpUser();
    await seedMay(user);

    const response = await api()
      .get("/api/v1/analytics/trend?month=2026-05")
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.body.data.days).toHaveLength(31);
    expect(response.body.data.totalIncome).toBe(5_000_000);
    expect(response.body.data.totalExpense).toBe(1_700_000);
    expect(response.body.data.averageDailyExpense).toBe(54_838.71);
    expect(response.body.data.highestExpenseDay).toEqual({
      date: "2026-05-02",
      amount: 1_500_000,
    });
    expect(response.body.data.days[0]).toEqual({
      date: "2026-05-01",
      income: 5_000_000,
      expense: 0,
      net: 5_000_000,
    });
    expect(response.body.data.days[2]).toMatchObject({
      date: "2026-05-03",
      income: 0,
      expense: 0,
    });
  });

  it("daftar bulan menyertakan bulan berjalan dan data historis", async () => {
    const user = await signUpUser();
    await seedMay(user);
    await createTransactionFor(user, {
      amount: 200_000,
      transactionDate: "2026-06-01",
    });

    const response = await api()
      .get("/api/v1/analytics/months")
      .set(user.headers);

    expect(response.status).toBe(200);
    const thisMonth = currentMonth();
    const months = response.body.data.map((item: { month: string }) => item.month);
    expect(months).toContain("2026-05");
    expect(months).toContain("2026-06");
    expect(months).toContain(thisMonth);

    const may = response.body.data.find(
      (item: { month: string }) => item.month === "2026-05",
    );
    expect(may).toMatchObject({
      income: 5_000_000,
      expense: 1_700_000,
      balance: 3_300_000,
      transactionCount: 4,
    });

    const limited = await api()
      .get("/api/v1/analytics/months?limit=1")
      .set(user.headers);
    expect(limited.body.data).toHaveLength(1);
    expect(limited.body.data[0].month).toBe(months[0]);
  });

  it("memakai batas bulanan yang berlaku di rekap", async () => {
    const user = await signUpUser();
    await seedMay(user);

    const budget = await createBudgetFor(user, {
      period: "monthly",
      amount: 2_000_000,
      month: "2026-05",
    });
    expect(budget.status).toBe(201);

    const response = await api()
      .get("/api/v1/analytics/summary?month=2026-05")
      .set(user.headers);

    expect(response.body.data.budgets).toHaveLength(1);
    expect(response.body.data.budgets[0]).toMatchObject({
      id: budget.body.data.id,
      period: "monthly",
      amount: 2_000_000,
      used: 1_700_000,
      remaining: 300_000,
      usagePercent: 85,
      status: "warning",
    });
    expect(response.body.data.budgetWarning.level).toBe("warning");

    // Bulan lain tidak terpengaruh batas khusus Mei.
    const june = await api()
      .get("/api/v1/analytics/summary?month=2026-06")
      .set(user.headers);
    expect(june.body.data.budgets).toEqual([]);
  });

  it("mengisolasi analitik antar pengguna", async () => {
    const owner = await signUpUser();
    const other = await signUpUser();
    await seedMay(owner);

    const summary = await api()
      .get("/api/v1/analytics/summary?month=2026-05")
      .set(other.headers);
    expect(summary.body.data.expense).toBe(0);

    const breakdown = await api()
      .get("/api/v1/analytics/categories?month=2026-05")
      .set(other.headers);
    expect(breakdown.body.data.categories).toEqual([]);
  });

  it("menolak format bulan yang tidak valid", async () => {
    const user = await signUpUser();

    for (const url of [
      "/api/v1/analytics/summary?month=2026-13",
      "/api/v1/analytics/categories?month=2026-1",
      "/api/v1/analytics/trend?month=mei",
    ]) {
      const response = await api().get(url).set(user.headers);
      expect(response.status).toBe(422);
    }
  });
});
