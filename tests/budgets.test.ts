import { describe, expect, it } from "vitest";
import {
  api,
  createBudgetFor,
  createTransactionFor,
  monthOf,
  signUpUser,
  today,
} from "./helpers.js";

describe("Batas pengeluaran", () => {
  it("membuat, membaca, mengubah, dan menghapus batas", async () => {
    const user = await signUpUser();

    const created = await createBudgetFor(user, {
      period: "monthly",
      amount: 1_500_000,
      month: "2026-05",
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      period: "monthly",
      amount: 1_500_000,
      month: "2026-05",
      isActive: true,
    });

    const duplicate = await createBudgetFor(user, {
      period: "monthly",
      amount: 2_000_000,
      month: "2026-05",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details.budgetId).toBe(created.body.data.id);

    const id = created.body.data.id as string;
    const detail = await api()
      .get(`/api/v1/budgets/${id}`)
      .set(user.headers);
    expect(detail.status).toBe(200);
    expect(detail.body.data.amount).toBe(1_500_000);

    const list = await api().get("/api/v1/budgets").set(user.headers);
    expect(list.body.data).toHaveLength(1);

    const updated = await api()
      .patch(`/api/v1/budgets/${id}`)
      .set(user.headers)
      .send({ amount: 1_750_000, isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.amount).toBe(1_750_000);
    expect(updated.body.data.isActive).toBe(false);

    const activeOnly = await api()
      .get("/api/v1/budgets?activeOnly=true")
      .set(user.headers);
    expect(activeOnly.body.data).toHaveLength(0);

    const deleted = await api()
      .delete(`/api/v1/budgets/${id}`)
      .set(user.headers);
    expect(deleted.status).toBe(204);

    const afterDelete = await api()
      .get(`/api/v1/budgets/${id}`)
      .set(user.headers);
    expect(afterDelete.status).toBe(404);
  });

  it("membedakan batas berulang, bulan tertentu, dan periode harian", async () => {
    const user = await signUpUser();

    expect(
      (
        await createBudgetFor(user, {
          period: "monthly",
          amount: 1_000_000,
        })
      ).status,
    ).toBe(201);

    const duplicateRecurring = await createBudgetFor(user, {
      period: "monthly",
      amount: 1_000_000,
    });
    expect(duplicateRecurring.status).toBe(409);

    expect(
      (
        await createBudgetFor(user, {
          period: "daily",
          amount: 100_000,
        })
      ).status,
    ).toBe(201);

    expect(
      (
        await createBudgetFor(user, {
          period: "monthly",
          amount: 2_000_000,
          month: "2026-11",
        })
      ).status,
    ).toBe(201);

    const all = await api().get("/api/v1/budgets").set(user.headers);
    expect(all.body.data).toHaveLength(3);

    const monthly = await api()
      .get("/api/v1/budgets?period=monthly")
      .set(user.headers);
    expect(monthly.body.data).toHaveLength(2);

    const november = await api()
      .get("/api/v1/budgets?month=2026-11")
      .set(user.headers);
    expect(november.body.data).toHaveLength(3);
  });

  it("rekap bulan berjalan mengevaluasi batas harian dan bulanan", async () => {
    const user = await signUpUser();
    const currentMonth = monthOf(today());

    await createTransactionFor(user, { amount: 90_000 });
    await createBudgetFor(user, { period: "monthly", amount: 1_000_000 });
    await createBudgetFor(user, { period: "daily", amount: 100_000 });

    const summary = await api()
      .get(`/api/v1/analytics/summary?month=${currentMonth}`)
      .set(user.headers);

    expect(summary.status).toBe(200);
    expect(summary.body.data.budgets).toHaveLength(2);

    const monthly = summary.body.data.budgets.find(
      (item: { period: string }) => item.period === "monthly",
    );
    expect(monthly).toMatchObject({
      used: 90_000,
      amount: 1_000_000,
      status: "safe",
      usagePercent: 9,
    });

    const daily = summary.body.data.budgets.find(
      (item: { period: string }) => item.period === "daily",
    );
    expect(daily).toMatchObject({
      used: 90_000,
      amount: 100_000,
      status: "warning",
      usagePercent: 90,
      remaining: 10_000,
    });
    expect(summary.body.data.budgetWarning.level).toBe("warning");

    await createTransactionFor(user, { amount: 20_000 });

    const over = await api()
      .get(`/api/v1/analytics/summary?month=${currentMonth}`)
      .set(user.headers);
    const dailyOver = over.body.data.budgets.find(
      (item: { period: string }) => item.period === "daily",
    );
    expect(dailyOver.status).toBe("over");
    expect(dailyOver.usagePercent).toBe(110);
    expect(dailyOver.remaining).toBe(-10_000);
    expect(over.body.data.budgetWarning.level).toBe("over");
  });

  it("batas harian tidak dievaluasi untuk rekap bulan lampau", async () => {
    const user = await signUpUser();
    await createTransactionFor(user, {
      amount: 100_000,
      transactionDate: "2026-01-02",
    });
    await createBudgetFor(user, { period: "daily", amount: 50_000 });
    await createBudgetFor(user, {
      period: "monthly",
      amount: 500_000,
      month: "2026-01",
    });

    const summary = await api()
      .get("/api/v1/analytics/summary?month=2026-01")
      .set(user.headers);

    expect(summary.body.data.budgets).toHaveLength(1);
    expect(summary.body.data.budgets[0].period).toBe("monthly");
    expect(summary.body.data.budgets[0].status).toBe("safe");
  });

  it("batas khusus bulan diprioritaskan di atas batas berulang", async () => {
    const user = await signUpUser();
    await createBudgetFor(user, { period: "monthly", amount: 1_000_000 });
    await createBudgetFor(user, {
      period: "monthly",
      amount: 2_000_000,
      month: "2026-05",
    });

    const may = await api()
      .get("/api/v1/analytics/summary?month=2026-05")
      .set(user.headers);
    expect(may.body.data.budgets).toHaveLength(1);
    expect(may.body.data.budgets[0].amount).toBe(2_000_000);

    const june = await api()
      .get("/api/v1/analytics/summary?month=2026-06")
      .set(user.headers);
    expect(june.body.data.budgets).toHaveLength(1);
    expect(june.body.data.budgets[0].amount).toBe(1_000_000);
  });

  it("mengisolasi batas antar pengguna", async () => {
    const owner = await signUpUser();
    const other = await signUpUser();
    const created = await createBudgetFor(owner);
    const id = created.body.data.id as string;

    const read = await api()
      .get(`/api/v1/budgets/${id}`)
      .set(other.headers);
    expect(read.status).toBe(404);

    const update = await api()
      .patch(`/api/v1/budgets/${id}`)
      .set(other.headers)
      .send({ amount: 1 });
    expect(update.status).toBe(404);

    const remove = await api()
      .delete(`/api/v1/budgets/${id}`)
      .set(other.headers);
    expect(remove.status).toBe(404);
  });

  it("memvalidasi input batas", async () => {
    const user = await signUpUser();

    const zero = await createBudgetFor(user, { amount: 0 });
    expect(zero.status).toBe(422);

    const badMonth = await createBudgetFor(user, { month: "2026-13" });
    expect(badMonth.status).toBe(422);

    const emptyPatch = await api()
      .patch("/api/v1/budgets/00000000-0000-4000-8000-000000000000")
      .set(user.headers)
      .send({});
    expect(emptyPatch.status).toBe(422);
  });
});
