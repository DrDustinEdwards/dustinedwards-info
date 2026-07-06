import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { getDb } from "~/db";
import * as authSchema from "~/db/auth-schema";

/**
 * Build a request-scoped Better Auth instance. Bindings and secrets are per request
 * on Workers, so the instance is created from env rather than a module singleton.
 *
 * Sessions live in KV (secondaryStorage); durable user, account and verification
 * records live in D1 through the Drizzle adapter. A single administrator is allowed:
 * the user.create.before hook rejects any sign-in whose email is not ADMIN_EMAIL.
 */
export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(env), {
      provider: "sqlite",
      schema: {
        user: authSchema.user,
        session: authSchema.session,
        account: authSchema.account,
        verification: authSchema.verification,
      },
    }),
    secondaryStorage: {
      get: (key) => env.APP_KV.get(key),
      set: async (key, value, ttl) => {
        // KV requires a TTL of at least 60 seconds.
        await env.APP_KV.put(
          key,
          value,
          ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined,
        );
      },
      delete: (key) => env.APP_KV.delete(key),
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (user.email !== env.ADMIN_EMAIL) {
              throw new APIError("FORBIDDEN", {
                message: "This site allows a single administrator.",
              });
            }
            return { data: user };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
