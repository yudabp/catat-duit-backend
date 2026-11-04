import { randomUUID } from "node:crypto";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { DEFAULT_CATEGORY_IDS } from "../src/db/default-categories.js";
import { todayInAppTimeZone } from "../src/lib/dates.js";

export const app = createApp();
export const api = () => supertest(app);

export type TestUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
  headers: { Authorization: string };
};

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function signUpUser(
  input: {
    name?: string;
    email?: string;
    password?: string;
  } = {},
): Promise<TestUser> {
  const email = input.email ?? uniqueEmail();
  const password = input.password ?? "password123";
  const name = input.name ?? "Pengguna Tes";

  const response = await api()
    .post("/api/auth/sign-up/email")
    .send({ name, email, password });

  if (response.status !== 200) {
    throw new Error(
      `Sign-up gagal (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }

  const header = response.headers["set-auth-token"];
  if (typeof header !== "string" || header.length === 0) {
    throw new Error("Response sign-up tidak mengandung set-auth-token");
  }

  return {
    id: response.body.user.id,
    name,
    email,
    password,
    token: header,
    headers: { Authorization: `Bearer ${header}` },
  };
}

export function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function today(): string {
  return todayInAppTimeZone();
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function transactionPayload(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: DEFAULT_CATEGORY_IDS.makan,
    type: "expense",
    amount: 25_000,
    note: "Makan siang",
    transactionDate: today(),
    clientId: randomUUID(),
    ...overrides,
  };
}

export async function createTransactionFor(
  user: TestUser,
  overrides: Record<string, unknown> = {},
) {
  return api()
    .post("/api/v1/transactions")
    .set(user.headers)
    .send(transactionPayload(overrides));
}

export async function createCategoryFor(
  user: TestUser,
  overrides: Record<string, unknown> = {},
) {
  return api()
    .post("/api/v1/categories")
    .set(user.headers)
    .send({
      name: `Kategori ${randomUUID().slice(0, 8)}`,
      type: "expense",
      icon: "tag",
      color: "#123456",
      ...overrides,
    });
}

export async function createBudgetFor(
  user: TestUser,
  overrides: Record<string, unknown> = {},
) {
  return api()
    .post("/api/v1/budgets")
    .set(user.headers)
    .send({
      period: "monthly",
      amount: 1_000_000,
      ...overrides,
    });
}
