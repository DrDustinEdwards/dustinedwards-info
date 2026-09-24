import { createContext } from "react-router";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { getDb } from "~/db";
import { timed, timedSync, type Timings } from "~/lib/timing";
import * as authSchema from "~/db/auth-schema";

// Per request, not a module singleton: bindings and secrets are per request on Workers.
export function createAuth(env: Env) {
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
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
            if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
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

export type AdminSession = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;

export async function getAdminSession(
  env: Env,
  request: Request,
  // Two marks because they are different costs: CPU building the instance, then KV IO.
  timings?: Timings,
): Promise<AdminSession | null> {
  const auth = timedSync(timings, "auth_create", () => createAuth(env));
  const session = await timed(timings, "auth_getsession", () =>
    auth.api.getSession({
      headers: request.headers,
    }),
  );
  if (!session) return null;
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || session.user.email?.toLowerCase() !== adminEmail) {
    return null;
  }
  return session;
}

/**
 * Set for the human admin only: the smoke credential has no session, so reading this asserts a
 * human is present, and a write path reached by a machine throws rather than attributing to nobody.
 * Code that only needs to know who is asking reads `adminActorContext`.
 */
export const adminSessionContext = createContext<AdminSession>();

/**
 * `email` is the admin's address for the smoke actor too, so the smoke render is the exact page
 * Dustin sees and layout numbers measured through it are true.
 */
export type AdminActor =
  | { kind: "admin"; email: string }
  | { kind: "smoke"; id: string; email: string };

export const adminActorContext = createContext<AdminActor>();
