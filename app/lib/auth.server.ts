import { createContext } from "react-router";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { getDb } from "~/db";
import { timed, timedSync, type Timings } from "~/lib/timing";
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

/**
 * Resolve the current session and confirm it belongs to the single admin.
 * Returns null otherwise. Used by the admin middleware (one gate for the whole
 * /admin subtree) and by the login screen to bounce a signed-in admin home.
 */
export async function getAdminSession(
  env: Env,
  request: Request,
  /**
   * Optional collector. Absent on every request that did not ask for timing.
   *
   * SPLIT INTO TWO MARKS ON PURPOSE. `createAuth` and `getSession` are one line together and two
   * completely different costs: CPU building an auth instance and a Drizzle adapter from scratch, then
   * IO against KV. A single `auth_total` would leave the next session guessing which, and guessing is
   * what the instrument exists to replace.
   */
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
 * Set by the admin middleware after the gate passes, so loaders under /admin read the session
 * without a second KV round trip.
 *
 * **SET FOR THE HUMAN ADMIN ONLY.** The read-only smoke credential has no Better Auth session and
 * never will, so anything reading this context is asserting a human is present. That is the right
 * failure mode for the one remaining reader on a write path: if it were ever reached by a machine
 * actor it would throw rather than attribute a revision to nobody.
 *
 * Anything that only needs to know WHO IS ASKING reads `adminActorContext`.
 */
export const adminSessionContext = createContext<AdminSession>();

/**
 * WHO IS ASKING, for the whole `/admin` subtree. Always set once the gate passes.
 *
 * Separate from `adminSessionContext` because one is a Better Auth SESSION and the other an
 * IDENTITY, and only one kind of caller has a session. Collapsing them means synthesising a fake
 * `AdminSession` for the machine, the stub this repo refuses because it authenticates through a
 * path production does not have.
 *
 * `email` is the SAME address for both kinds, deliberately: the smoke render has to be the page
 * Dustin sees, down to the topbar's widest unbreakable token, or the layout numbers taken through it
 * describe a different page.
 */
export type AdminActor =
  | { kind: "admin"; email: string }
  | { kind: "smoke"; id: string; email: string };

export const adminActorContext = createContext<AdminActor>();
