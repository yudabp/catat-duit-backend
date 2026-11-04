import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type AuthSession } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";

/**
 * Middleware sesi Better Auth.
 * Mendukung cookie sesi (web) maupun header `Authorization: Bearer <token>`
 * yang dipakai aplikasi mobile (plugin bearer).
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    throw unauthorized();
  }

  req.auth = session;
  next();
};

export function getAuth(req: Express.Request): AuthSession {
  if (!req.auth) {
    throw unauthorized();
  }
  return req.auth;
}

export function getUserId(req: Express.Request): string {
  return getAuth(req).user.id;
}
