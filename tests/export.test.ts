import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_IDS } from "../src/db/default-categories.js";
import {
  api,
  createTransactionFor,
  signUpUser,
  today,
} from "./helpers.js";

describe("Ekspor CSV", () => {
  it("mengekspor transaksi dengan header, BOM, dan escaping CSV", async () => {
    const user = await signUpUser();

    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.makan,
      amount: 25_000,
      note: 'Nasi, "enak"',
      transactionDate: "2026-05-02",
    });
    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "income",
      amount: 5_000_000,
      note: "=SUM(A1)",
      transactionDate: "2026-05-01",
    });
    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.transport,
      amount: 50_000,
      note: "Bensin\nPertalite",
      transactionDate: "2026-05-03",
    });

    const response = await api()
      .get("/api/v1/export/transactions.csv?from=2026-05-01&to=2026-05-31")
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'filename="transaksi-2026-05-01_sampai_2026-05-31.csv"',
    );

    const body = response.text;
    expect(body.startsWith("\uFEFF")).toBe(true);
    expect(body).toContain(
      "Tanggal,Jenis,Kategori,Nominal,Catatan,ID Transaksi",
    );
    expect(body).toContain("2026-05-02,Pengeluaran,Makan,25000,");
    expect(body).toContain('"Nasi, ""enak"""');
    expect(body).toContain("'=SUM(A1)");
    expect(body).toContain('"Bensin\nPertalite"');

    const rows = body
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(rows).toHaveLength(4);
  });

  it("memfilter ekspor berdasarkan jenis dan kategori", async () => {
    const user = await signUpUser();

    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.makan,
      amount: 10_000,
      note: "Sarapan",
      transactionDate: "2026-08-01",
    });
    await createTransactionFor(user, {
      categoryId: DEFAULT_CATEGORY_IDS.gaji,
      type: "income",
      amount: 1_000_000,
      note: "Gaji Agustus",
      transactionDate: "2026-08-01",
    });

    const expenseOnly = await api()
      .get(
        "/api/v1/export/transactions.csv?from=2026-08-01&to=2026-08-31&type=expense",
      )
      .set(user.headers);
    expect(expenseOnly.status).toBe(200);
    expect(expenseOnly.text).not.toContain("Pemasukan");
    expect(expenseOnly.text).toContain("Pengeluaran");

    const byCategory = await api()
      .get(
        `/api/v1/export/transactions.csv?from=2026-08-01&to=2026-08-31&categoryId=${DEFAULT_CATEGORY_IDS.gaji}`,
      )
      .set(user.headers);
    expect(byCategory.text).toContain("Pemasukan");
    expect(byCategory.text).not.toContain("Makan");
  });

  it("default ekspor adalah bulan berjalan", async () => {
    const user = await signUpUser();
    await createTransactionFor(user, {
      amount: 12_345,
      note: "Transaksi bulan ini",
      transactionDate: today(),
    });

    const response = await api()
      .get("/api/v1/export/transactions.csv")
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.text).toContain("Transaksi bulan ini");
  });

  it("menolak ekspor tanpa sesi dan rentang tanggal terbalik", async () => {
    const unauthorized = await api().get("/api/v1/export/transactions.csv");
    expect(unauthorized.status).toBe(401);

    const user = await signUpUser();
    const invalid = await api()
      .get(
        "/api/v1/export/transactions.csv?from=2026-09-01&to=2026-08-01",
      )
      .set(user.headers);
    expect(invalid.status).toBe(422);
  });
});
