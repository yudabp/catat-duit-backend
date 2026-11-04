import { describe, expect, it } from "vitest";
import {
  api,
  authHeaders,
  createTransactionFor,
  signUpUser,
} from "./helpers.js";

const protectedEndpoints: Array<[string, string]> = [
  ["get", "/api/v1/me"],
  ["patch", "/api/v1/me"],
  ["get", "/api/v1/categories"],
  ["post", "/api/v1/categories"],
  ["get", "/api/v1/transactions"],
  ["post", "/api/v1/transactions"],
  ["post", "/api/v1/transactions/sync"],
  ["get", "/api/v1/budgets"],
  ["post", "/api/v1/budgets"],
  ["get", "/api/v1/analytics/summary"],
  ["get", "/api/v1/analytics/categories"],
  ["get", "/api/v1/analytics/trend"],
  ["get", "/api/v1/analytics/months"],
  ["get", "/api/v1/export/transactions.csv"],
];

describe("Keamanan & perilaku HTTP", () => {
  it("semua endpoint data menolak request tanpa sesi", async () => {
    for (const [method, path] of protectedEndpoints) {
      const response = await api()[method as "get"](path).send({});
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("mengembalikan error format konsisten untuk input tidak valid", async () => {
    const user = await signUpUser();

    const invalidUuid = await api()
      .get("/api/v1/transactions/bukan-uuid")
      .set(user.headers);
    expect(invalidUuid.status).toBe(422);
    expect(invalidUuid.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(invalidUuid.body.error.details)).toBe(true);

    const invalidBoolean = await api()
      .get("/api/v1/categories?includeArchived=yes")
      .set(user.headers);
    expect(invalidBoolean.status).toBe(422);

    const invalidJson = await api()
      .post("/api/v1/transactions")
      .set(user.headers)
      .set("Content-Type", "application/json")
      .send("{bukan json");
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.error.code).toBe("BAD_REQUEST");
  });

  it("mengembalikan 404 JSON untuk endpoint yang tidak ada", async () => {
    const response = await api().get("/api/v1/tidak-ada");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("tidak memakai header X-Powered-By dan memasang header keamanan", async () => {
    const response = await api().get("/health");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeDefined();
  });

  it("CORS hanya mengizinkan origin terdaftar", async () => {
    const allowed = await api()
      .get("/health")
      .set("Origin", "http://localhost:8081");
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:8081",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const blocked = await api()
      .get("/health")
      .set("Origin", "https://situs-jahat.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("input pencarian tidak bisa dipakai untuk SQL injection", async () => {
    const user = await signUpUser();
    await createTransactionFor(user, { note: "Aman" });

    const response = await api()
      .get(
        "/api/v1/transactions?search=%27%20OR%201%3D1%3B%20--",
      )
      .set(user.headers);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(0);
  });

  it("daftar transaksi hanya berisi data milik pengguna", async () => {
    const owner = await signUpUser();
    const other = await signUpUser();
    await createTransactionFor(owner, { note: "Milik owner" });
    await createTransactionFor(other, { note: "Milik other" });

    const response = await api()
      .get("/api/v1/transactions")
      .set(other.headers);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].note).toBe("Milik other");
  });

  it("token bearer harus valid dan bukan sekadar string acak", async () => {
    const user = await signUpUser();
    const response = await api()
      .get("/api/v1/me")
      .set(authHeaders(`${user.token}x`));
    expect(response.status).toBe(401);
  });

  it("menyediakan OpenAPI JSON", async () => {
    const response = await api().get("/api/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/api/v1/transactions"]).toBeDefined();
    expect(
      response.body.components.securitySchemes.bearerAuth.type,
    ).toBe("http");
  });
});
