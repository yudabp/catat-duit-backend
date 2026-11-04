import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_IDS } from "../src/db/default-categories.js";
import {
  api,
  createTransactionFor,
  signUpUser,
  today,
  transactionPayload,
} from "./helpers.js";

describe("Transaksi", () => {
  it("membuat transaksi pengeluaran dan pemasukan", async () => {
    const user = await signUpUser();

    const expense = await createTransactionFor(user, {
      amount: 75_500,
      note: "Makan malam",
      transactionDate: "2026-05-10",
    });
    expect(expense.status).toBe(201);
    expect(expense.body.data.amount).toBe(75_500);
    expect(expense.body.data.type).toBe("expense");
    expect(expense.body.data.note).toBe("Makan malam");
    expect(expense.body.data.transactionDate).toBe("2026-05-10");
    expect(expense.body.data.category.name).toBe("Makan");
    expect(expense.body.data.category.isDefault).toBe(true);
    expect(expense.body.meta.replay).toBe(false);

    const income = await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "income",
      amount: 5_000_000,
      note: "Gaji Mei",
      transactionDate: "2026-05-01",
    });
    expect(income.status).toBe(201);
    expect(income.body.data.type).toBe("income");
    expect(income.body.data.category.name).toBe("Gaji");
  });

  it("clientId membuat POST transaksi idempotent", async () => {
    const user = await signUpUser();
    const payload = transactionPayload({ amount: 30_000 });

    const first = await api()
      .post("/api/v1/transactions")
      .set(user.headers)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await api()
      .post("/api/v1/transactions")
      .set(user.headers)
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.headers["idempotent-replay"]).toBe("true");
    expect(second.body.meta.replay).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);

    const list = await api().get("/api/v1/transactions").set(user.headers);
    expect(list.body.meta.total).toBe(1);
  });

  it("memakai tanggal hari ini bila transactionDate tidak dikirim", async () => {
    const user = await signUpUser();
    const payload = transactionPayload();
    delete (payload as { transactionDate?: string }).transactionDate;

    const response = await api()
      .post("/api/v1/transactions")
      .set(user.headers)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data.transactionDate).toBe(today());
  });

  it("memvalidasi nominal, kategori, dan field wajib", async () => {
    const user = await signUpUser();

    const zero = await createTransactionFor(user, { amount: 0 });
    expect(zero.status).toBe(422);

    const tooManyDecimals = await createTransactionFor(user, {
      amount: 10.999,
    });
    expect(tooManyDecimals.status).toBe(422);

    const mismatch = await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "expense",
    });
    expect(mismatch.status).toBe(409);

    const missingClient = await createTransactionFor(user, {
      clientId: undefined,
    });
    expect(missingClient.status).toBe(422);

    const invalidDate = await createTransactionFor(user, {
      transactionDate: "2026-02-30",
    });
    expect(invalidDate.status).toBe(422);

    const unknownCategory = await createTransactionFor(user, {
      categoryId: "00000000-0000-4000-8000-000000000000",
    });
    expect(unknownCategory.status).toBe(404);
  });

  it("mendukung daftar, pencarian, filter, sorting, dan pagination", async () => {
    const user = await signUpUser();
    const clientIds = Array.from({ length: 4 }, () => randomUUID());

    const transactions = [
      {
        categoryId: DEFAULT_CATEGORY_IDS.makan,
        type: "expense",
        amount: 100_000,
        note: "Nasi goreng",
        transactionDate: "2026-05-01",
        clientId: clientIds[0],
      },
      {
        categoryId: DEFAULT_CATEGORY_IDS.transport,
        type: "expense",
        amount: 50_000,
        note: "Bensin",
        transactionDate: "2026-05-02",
        clientId: clientIds[1],
      },
      {
        categoryId: DEFAULT_CATEGORY_IDS.gaji,
        type: "income",
        amount: 5_000_000,
        note: "Gaji Mei",
        transactionDate: "2026-05-01",
        clientId: clientIds[2],
      },
      {
        categoryId: DEFAULT_CATEGORY_IDS.belanja,
        type: "expense",
        amount: 200_000,
        note: "Sepatu",
        transactionDate: "2026-06-01",
        clientId: clientIds[3],
      },
    ];

    for (const payload of transactions) {
      const response = await api()
        .post("/api/v1/transactions")
        .set(user.headers)
        .send(payload);
      expect(response.status).toBe(201);
    }

    const all = await api()
      .get("/api/v1/transactions?limit=10")
      .set(user.headers);
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(4);
    expect(all.body.data[0].note).toBe("Sepatu");

    const expenses = await api()
      .get("/api/v1/transactions?type=expense")
      .set(user.headers);
    expect(expenses.body.meta.total).toBe(3);

    const transport = await api()
      .get(`/api/v1/transactions?categoryId=${DEFAULT_CATEGORY_IDS.transport}`)
      .set(user.headers);
    expect(transport.body.meta.total).toBe(1);
    expect(transport.body.data[0].note).toBe("Bensin");

    const searchNote = await api()
      .get("/api/v1/transactions?search=nasi")
      .set(user.headers);
    expect(searchNote.body.meta.total).toBe(1);

    const searchCategory = await api()
      .get("/api/v1/transactions?search=Transport")
      .set(user.headers);
    expect(searchCategory.body.meta.total).toBe(1);

    const may = await api()
      .get("/api/v1/transactions?month=2026-05")
      .set(user.headers);
    expect(may.body.meta.total).toBe(3);

    const range = await api()
      .get("/api/v1/transactions?from=2026-05-02&to=2026-05-02")
      .set(user.headers);
    expect(range.body.meta.total).toBe(1);
    expect(range.body.data[0].note).toBe("Bensin");

    const page1 = await api()
      .get("/api/v1/transactions?page=1&limit=2")
      .set(user.headers);
    expect(page1.body.meta.totalPages).toBe(2);
    expect(page1.body.meta.hasNextPage).toBe(true);
    expect(page1.body.data).toHaveLength(2);

    const page2 = await api()
      .get("/api/v1/transactions?page=2&limit=2")
      .set(user.headers);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.meta.hasPreviousPage).toBe(true);

    const sorted = await api()
      .get("/api/v1/transactions?sort=amount_desc")
      .set(user.headers);
    expect(sorted.body.data[0].amount).toBe(5_000_000);

    const invalidRange = await api()
      .get("/api/v1/transactions?from=2026-06-01&to=2026-05-01")
      .set(user.headers);
    expect(invalidRange.status).toBe(422);
  });

  it("mengedit dan menghapus transaksi", async () => {
    const user = await signUpUser();
    const created = await createTransactionFor(user, {
      amount: 20_000,
      note: "Awal",
      transactionDate: "2026-04-01",
    });
    const id = created.body.data.id as string;

    const updated = await api()
      .patch(`/api/v1/transactions/${id}`)
      .set(user.headers)
      .send({
        amount: 35_000,
        note: "",
        transactionDate: "2026-04-02",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.amount).toBe(35_000);
    expect(updated.body.data.note).toBeNull();
    expect(updated.body.data.transactionDate).toBe("2026-04-02");

    const toIncome = await api()
      .patch(`/api/v1/transactions/${id}`)
      .set(user.headers)
      .send({
        type: "income",
        categoryId: DEFAULT_CATEGORY_IDS.gaji,
      });
    expect(toIncome.status).toBe(200);
    expect(toIncome.body.data.type).toBe("income");
    expect(toIncome.body.data.category.name).toBe("Gaji");

    const detail = await api()
      .get(`/api/v1/transactions/${id}`)
      .set(user.headers);
    expect(detail.status).toBe(200);
    expect(detail.body.data.amount).toBe(35_000);

    const deleted = await api()
      .delete(`/api/v1/transactions/${id}`)
      .set(user.headers);
    expect(deleted.status).toBe(204);

    const afterDelete = await api()
      .get(`/api/v1/transactions/${id}`)
      .set(user.headers);
    expect(afterDelete.status).toBe(404);
  });

  it("mengisolasi transaksi antar pengguna", async () => {
    const owner = await signUpUser();
    const other = await signUpUser();
    const payload = transactionPayload();
    const created = await api()
      .post("/api/v1/transactions")
      .set(owner.headers)
      .send(payload);

    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const read = await api()
      .get(`/api/v1/transactions/${id}`)
      .set(other.headers);
    expect(read.status).toBe(404);

    const update = await api()
      .patch(`/api/v1/transactions/${id}`)
      .set(other.headers)
      .send({ amount: 1 });
    expect(update.status).toBe(404);

    const remove = await api()
      .delete(`/api/v1/transactions/${id}`)
      .set(other.headers);
    expect(remove.status).toBe(404);

    // clientId yang sama boleh dipakai user berbeda (unik per user).
    const sameClient = await api()
      .post("/api/v1/transactions")
      .set(other.headers)
      .send(payload);
    expect(sameClient.status).toBe(201);
    expect(sameClient.body.data.id).not.toBe(id);
  });

  it("sinkronisasi batch memproses item sukses, replay, dan gagal secara terpisah", async () => {
    const user = await signUpUser();
    const clientId = randomUUID();

    const valid = transactionPayload({
      clientId,
      amount: 40_000,
      transactionDate: "2026-07-01",
    });
    const duplicate = { ...valid };
    const invalid = transactionPayload({ amount: 0 });

    const response = await api()
      .post("/api/v1/transactions/sync")
      .set(user.headers)
      .send({ transactions: [valid, duplicate, invalid] });

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      total: 3,
      created: 1,
      replayed: 1,
      failed: 1,
    });
    expect(response.body.data.results[0].status).toBe("created");
    expect(response.body.data.results[1].status).toBe("replayed");
    expect(response.body.data.results[2].status).toBe("failed");
    expect(response.body.data.results[1].transaction.id).toBe(
      response.body.data.results[0].transaction.id,
    );

    const list = await api()
      .get("/api/v1/transactions?month=2026-07")
      .set(user.headers);
    expect(list.body.meta.total).toBe(1);
  });
});
