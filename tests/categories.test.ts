import { describe, expect, it } from "vitest";
import {
  api,
  createCategoryFor,
  createTransactionFor,
  signUpUser,
} from "./helpers.js";

describe("Kategori", () => {
  it("menampilkan 13 kategori bawaan dan mendukung filter jenis", async () => {
    const user = await signUpUser();

    const all = await api().get("/api/v1/categories").set(user.headers);
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(13);
    expect(all.body.data.every((item: { isDefault: boolean }) => item.isDefault)).toBe(true);
    expect(all.body.data.every((item: { userId?: string }) => item.userId === undefined)).toBe(true);

    const expense = await api()
      .get("/api/v1/categories?type=expense")
      .set(user.headers);
    expect(expense.status).toBe(200);
    expect(expense.body.data).toHaveLength(9);

    const income = await api()
      .get("/api/v1/categories?type=income")
      .set(user.headers);
    expect(income.body.data).toHaveLength(5);
  });

  it("membuat kategori sendiri, menolak duplikat, dan mengubahnya", async () => {
    const user = await signUpUser();

    const created = await createCategoryFor(user, {
      name: "Kopi",
      color: "#ABCDEF",
      icon: "coffee",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Kopi");
    expect(created.body.data.isDefault).toBe(false);
    expect(created.body.data.usageCount).toBe(0);

    const duplicate = await createCategoryFor(user, {
      name: "kopi",
      color: "#111111",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("CONFLICT");

    const duplicateDefault = await createCategoryFor(user, {
      name: "Makan",
      color: "#111111",
    });
    expect(duplicateDefault.status).toBe(409);

    const categoryId = created.body.data.id as string;
    const updated = await api()
      .patch(`/api/v1/categories/${categoryId}`)
      .set(user.headers)
      .send({ name: "Kopi Susu", color: "#FEDCBA" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Kopi Susu");
    expect(updated.body.data.color).toBe("#FEDCBA");
  });

  it("kategori bawaan tidak bisa diubah atau dihapus", async () => {
    const user = await signUpUser();
    const all = await api().get("/api/v1/categories").set(user.headers);
    const defaultId = all.body.data[0].id as string;

    const update = await api()
      .patch(`/api/v1/categories/${defaultId}`)
      .set(user.headers)
      .send({ name: "Diubah" });
    expect(update.status).toBe(403);

    const remove = await api()
      .delete(`/api/v1/categories/${defaultId}`)
      .set(user.headers);
    expect(remove.status).toBe(403);
  });

  it("mengarsipkan kategori menyembunyikannya dari daftar default", async () => {
    const user = await signUpUser();
    const created = await createCategoryFor(user, { name: "Hobi" });
    const categoryId = created.body.data.id as string;

    const archive = await api()
      .patch(`/api/v1/categories/${categoryId}`)
      .set(user.headers)
      .send({ isArchived: true });
    expect(archive.status).toBe(200);
    expect(archive.body.data.isArchived).toBe(true);

    const normal = await api().get("/api/v1/categories").set(user.headers);
    expect(
      normal.body.data.some((item: { id: string }) => item.id === categoryId),
    ).toBe(false);

    const withArchived = await api()
      .get("/api/v1/categories?includeArchived=true")
      .set(user.headers);
    expect(
      withArchived.body.data.some(
        (item: { id: string }) => item.id === categoryId,
      ),
    ).toBe(true);

    const unarchive = await api()
      .patch(`/api/v1/categories/${categoryId}`)
      .set(user.headers)
      .send({ isArchived: false });
    expect(unarchive.status).toBe(200);
    expect(unarchive.body.data.isArchived).toBe(false);
  });

  it("menghapus kategori yang belum dipakai dan menolak kategori terpakai", async () => {
    const user = await signUpUser();

    const unused = await createCategoryFor(user, { name: "Sementara" });
    const deleteUnused = await api()
      .delete(`/api/v1/categories/${unused.body.data.id}`)
      .set(user.headers);
    expect(deleteUnused.status).toBe(204);

    const used = await createCategoryFor(user, { name: "Langganan" });
    const categoryId = used.body.data.id as string;

    const transaction = await createTransactionFor(user, {
      categoryId,
      amount: 50_000,
    });
    expect(transaction.status).toBe(201);

    const deleteUsed = await api()
      .delete(`/api/v1/categories/${categoryId}`)
      .set(user.headers);
    expect(deleteUsed.status).toBe(409);
    expect(deleteUsed.body.error.details.usageCount).toBe(1);

    const detail = await api()
      .get(`/api/v1/categories/${categoryId}`)
      .set(user.headers);
    expect(detail.body.data.usageCount).toBe(1);

    const archive = await api()
      .patch(`/api/v1/categories/${categoryId}`)
      .set(user.headers)
      .send({ isArchived: true });
    expect(archive.status).toBe(200);

    const createWithArchived = await createTransactionFor(user, {
      categoryId,
      amount: 10_000,
    });
    expect(createWithArchived.status).toBe(409);

    const deleteTransaction = await api()
      .delete(`/api/v1/transactions/${transaction.body.data.id}`)
      .set(user.headers);
    expect(deleteTransaction.status).toBe(204);

    const deleteAfter = await api()
      .delete(`/api/v1/categories/${categoryId}`)
      .set(user.headers);
    expect(deleteAfter.status).toBe(204);
  });

  it("tidak membocorkan atau mengizinkan perubahan kategori milik user lain", async () => {
    const owner = await signUpUser();
    const other = await signUpUser();
    const created = await createCategoryFor(owner, { name: "Rahasia" });
    const categoryId = created.body.data.id as string;

    const read = await api()
      .get(`/api/v1/categories/${categoryId}`)
      .set(other.headers);
    expect(read.status).toBe(404);

    const update = await api()
      .patch(`/api/v1/categories/${categoryId}`)
      .set(other.headers)
      .send({ name: "Dibajak" });
    expect(update.status).toBe(404);

    const remove = await api()
      .delete(`/api/v1/categories/${categoryId}`)
      .set(other.headers);
    expect(remove.status).toBe(404);
  });

  it("memvalidasi input kategori", async () => {
    const user = await signUpUser();

    const badColor = await createCategoryFor(user, { color: "merah" });
    expect(badColor.status).toBe(422);

    const emptyName = await createCategoryFor(user, { name: "   " });
    expect(emptyName.status).toBe(422);

    const emptyPatch = await api()
      .patch("/api/v1/categories/00000000-0000-4000-8000-000000000000")
      .set(user.headers)
      .send({});
    expect(emptyPatch.status).toBe(422);
  });
});
