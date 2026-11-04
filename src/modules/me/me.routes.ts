import { eq } from "drizzle-orm";
import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { users, type User } from "../../db/schema.js";
import { auth } from "../../lib/auth.js";
import { conflict, notFound } from "../../lib/errors.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import { changeEmailSchema, updateProfileSchema } from "./me.schemas.js";

export const meRouter = Router();

meRouter.use(requireAuth);

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function getUserById(userId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw notFound("Pengguna tidak ditemukan");
  return user;
}

meRouter.get("/", async (req, res) => {
  const user = await getUserById(getUserId(req));
  res.json({ data: serializeUser(user) });
});

meRouter.patch("/", async (req, res) => {
  const input = updateProfileSchema.parse(req.body);

  await auth.api.updateUser({
    headers: fromNodeHeaders(req.headers),
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
    },
  });

  const user = await getUserById(getUserId(req));
  res.json({ data: serializeUser(user) });
});

meRouter.post("/email", async (req, res) => {
  const input = changeEmailSchema.parse(req.body);
  const userId = getUserId(req);
  const current = await getUserById(userId);

  if (current.email.toLowerCase() === input.newEmail) {
    throw conflict("Email baru sama dengan email yang sedang dipakai");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.newEmail))
    .limit(1);

  if (existing) {
    throw conflict("Email tersebut sudah dipakai akun lain");
  }

  await auth.api.changeEmail({
    headers: fromNodeHeaders(req.headers),
    body: {
      newEmail: input.newEmail,
      callbackURL: env.APP_EMAIL_VERIFICATION_CALLBACK_URL,
    },
  });

  res.json({
    data: {
      status: true,
      message:
        "Tautan verifikasi telah dikirim. Email baru aktif setelah tautan diverifikasi.",
    },
  });
});
