import { describe, expect, it } from "vitest";
import { api, signUpUser } from "./helpers.js";

describe("Produk & Inventaris", () => {
  it("dapat membuat, membaca, mengubah, restock, dan menghapus produk", async () => {
    const user = await signUpUser();

    // 1. Create product
    const created = await api()
      .post("/api/v1/products")
      .set(user.headers)
      .send({
        name: "Kaos Polos Cotton 30s",
        cost: 35_000,
        price: 65_000,
        stock: 50,
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "Kaos Polos Cotton 30s",
      cost: 35_000,
      price: 65_000,
      stock: 50,
      profitPerUnit: 30_000,
      marginPercent: 86,
    });

    const productId = created.body.data.id as string;

    // 2. Duplicate product name for the same user should return 409
    const duplicate = await api()
      .post("/api/v1/products")
      .set(user.headers)
      .send({
        name: "kaos polos cotton 30s",
        cost: 40_000,
        price: 70_000,
      });

    expect(duplicate.status).toBe(409);

    // 3. Different user can create product with the same name
    const otherUser = await signUpUser();
    const otherUserProduct = await api()
      .post("/api/v1/products")
      .set(otherUser.headers)
      .send({
        name: "Kaos Polos Cotton 30s",
        cost: 30_000,
        price: 60_000,
      });

    expect(otherUserProduct.status).toBe(201);

    // Other user cannot read user 1's product
    const forbiddenGet = await api()
      .get(`/api/v1/products/${productId}`)
      .set(otherUser.headers);
    expect(forbiddenGet.status).toBe(404);

    // 4. Detail product
    const detail = await api()
      .get(`/api/v1/products/${productId}`)
      .set(user.headers);

    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toBe("Kaos Polos Cotton 30s");
    expect(detail.body.data.stock).toBe(50);

    // 5. Update product
    const updated = await api()
      .patch(`/api/v1/products/${productId}`)
      .set(user.headers)
      .send({
        price: 70_000,
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe(70_000);
    expect(updated.body.data.profitPerUnit).toBe(35_000);

    // 6. Restock / adjust stock
    const restock = await api()
      .post(`/api/v1/products/${productId}/stock`)
      .set(user.headers)
      .send({
        delta: 20,
        cost: 32_000,
      });

    expect(restock.status).toBe(200);
    expect(restock.body.data.stock).toBe(70);
    expect(restock.body.data.cost).toBe(32_000);

    // Reduce stock below 0 should fail with 400
    const overDeduce = await api()
      .post(`/api/v1/products/${productId}/stock`)
      .set(user.headers)
      .send({
        delta: -100,
      });

    expect(overDeduce.status).toBe(400);

    // 7. List products
    const list = await api()
      .get("/api/v1/products?search=cotton")
      .set(user.headers);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.total).toBe(1);

    // 8. Delete product
    const deleted = await api()
      .delete(`/api/v1/products/${productId}`)
      .set(user.headers);

    expect(deleted.status).toBe(204);

    const afterDelete = await api()
      .get(`/api/v1/products/${productId}`)
      .set(user.headers);

    expect(afterDelete.status).toBe(404);
  });

  it("menolak data produk dengan harga atau modal negatif", async () => {
    const user = await signUpUser();

    const invalid = await api()
      .post("/api/v1/products")
      .set(user.headers)
      .send({
        name: "Barang Cacat",
        cost: -10_000,
        price: 0,
      });

    expect(invalid.status).toBe(422);
  });
});
