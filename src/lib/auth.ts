import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { env } from "../config/env.js";
import { db, schema } from "../db/index.js";
import {
  sendEmailChangeConfirmation,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "./mailer.js";

export const auth = betterAuth({
  appName: env.APP_NAME,
  baseURL: env.betterAuthUrl,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.isProduction
    ? env.betterAuthTrustedOrigins
    : [
        ...env.betterAuthTrustedOrigins,
        "http://localhost:*",
        "http://127.0.0.1:*",
      ],
  logger: {
    disabled: env.isTest,
    level: env.isProduction ? "warn" : "info",
    disableColors: !env.isProduction,
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      sendResetPasswordEmail({
        to: user.email,
        name: user.name,
        token,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      sendVerificationEmail({
        to: user.email,
        name: user.name,
        url,
      });
    },
  },

  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendEmailChangeConfirmation({
          to: user.email,
          name: user.name,
          newEmail,
          url,
        });
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: env.BETTER_AUTH_RATE_LIMIT_ENABLED && !env.isTest,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 300, max: 10 },
      "/request-password-reset": { window: 300, max: 5 },
      "/reset-password": { window: 300, max: 10 },
      "/change-email": { window: 300, max: 5 },
    },
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
    useSecureCookies: env.isProduction,
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
      secure: env.isProduction,
      path: "/",
    },
  },

  plugins: [bearer()],
});

export type Auth = typeof auth;
export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;
