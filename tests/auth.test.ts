import { like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/index.js";
import { verifications } from "../src/db/schema.js";
import {
  api,
  authHeaders,
  signUpUser,
  uniqueEmail,
} from "./helpers.js";

describe("Health & autentikasi", () => {
  it("health check mengembalikan status database", async () => {
    const response = await api().get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("up");
  });

  it("root endpoint memberi info API", async () => {
    const response = await api().get("/");
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Catat Duit");
    expect(response.body.documentation).toBe("/api/docs");
  });

  it("sign-up membuat user UUID dan token bearer yang bisa dipakai", async () => {
    const user = await signUpUser({ name: "Siti" });

    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(user.token.length).toBeGreaterThan(20);

    const me = await api().get("/api/v1/me").set(user.headers);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(user.email);
    expect(me.body.data.name).toBe("Siti");
    expect(me.body.data.emailVerified).toBe(false);
  });

  it("menolak request tanpa token dan token palsu", async () => {
    const noToken = await api().get("/api/v1/me");
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe("UNAUTHORIZED");

    const fake = await api()
      .get("/api/v1/me")
      .set(authHeaders("token-palsu-yang-tidak-valid"));
    expect(fake.status).toBe(401);
  });

  it("login salah ditolak, login benar mengembalikan token", async () => {
    const user = await signUpUser();

    const wrong = await api()
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: "salah-password" });
    expect(wrong.status).toBe(401);

    const correct = await api()
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password });
    expect(correct.status).toBe(200);
    expect(typeof correct.headers["set-auth-token"]).toBe("string");
  });

  it("logout mencabut sesi bearer", async () => {
    const user = await signUpUser();

    const before = await api().get("/api/v1/me").set(user.headers);
    expect(before.status).toBe(200);

    const logout = await api()
      .post("/api/auth/sign-out")
      .set(user.headers)
      .send({});
    expect(logout.status).toBe(200);

    const after = await api().get("/api/v1/me").set(user.headers);
    expect(after.status).toBe(401);
  });

  it("reset password memakai token email dan mencabut sesi lama", async () => {
    const user = await signUpUser();

    const requestReset = await api()
      .post("/api/auth/request-password-reset")
      .send({ email: user.email });
    expect(requestReset.status).toBe(200);

    const rows = await db
      .select()
      .from(verifications)
      .where(like(verifications.identifier, "reset-password:%"));

    expect(rows.length).toBeGreaterThan(0);
    const resetRow = rows[rows.length - 1]!;
    const token = resetRow.identifier.replace("reset-password:", "");

    const reset = await api()
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "password-baru-123" });
    expect(reset.status).toBe(200);

    const oldLogin = await api()
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api()
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: "password-baru-123" });
    expect(newLogin.status).toBe(200);

    const oldToken = await api().get("/api/v1/me").set(user.headers);
    expect(oldToken.status).toBe(401);
  });

  it("request reset untuk email tidak terdaftar tidak membocorkan akun", async () => {
    const response = await api()
      .post("/api/auth/request-password-reset")
      .send({ email: uniqueEmail("tidak-ada") });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("reset-password:");
  });

  it("patch profil mengubah nama dan mengembalikan data terbaru", async () => {
    const user = await signUpUser({ name: "Nama Lama" });

    const update = await api()
      .patch("/api/v1/me")
      .set(user.headers)
      .send({ name: "Nama Baru" });

    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe("Nama Baru");

    const me = await api().get("/api/v1/me").set(user.headers);
    expect(me.body.data.name).toBe("Nama Baru");
  });

  it("perubahan email tidak langsung aktif sebelum verifikasi", async () => {
    const user = await signUpUser();
    const newEmail = uniqueEmail("email-baru");

    const response = await api()
      .post("/api/v1/me/email")
      .set(user.headers)
      .send({ newEmail });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(true);

    const me = await api().get("/api/v1/me").set(user.headers);
    expect(me.body.data.email).toBe(user.email);
  });

  it("menolak perubahan email bila sama dengan email saat ini", async () => {
    const user = await signUpUser();

    const response = await api()
      .post("/api/v1/me/email")
      .set(user.headers)
      .send({ newEmail: user.email.toUpperCase() });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });
});
