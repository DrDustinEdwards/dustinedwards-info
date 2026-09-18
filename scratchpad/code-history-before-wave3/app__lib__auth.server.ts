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
   * Optional collector. Absent on every request that did not ask for timing,
   * which is all of them but the ones being diagnosed.
   *
   * SPLIT INTO TWO MARKS ON PURPOSE. `createAuth` and `getSession` are one
   * line together and two completely different costs: the first is CPU
   * building an auth instance and a Drizzle adapter from scratch on every
   * request, the second is IO against KV. A single `auth_total` would have
   * left the next session guessing which, and guessing is what the instrument
   * exists to replace.
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
 * Set by the admin middleware after the gate passes, so loaders under /admin
 * read the session without a second KV round trip.
 *
 * **SET FOR THE HUMAN ADMIN ONLY.** The read-only smoke credential has no
 * Better Auth session and never will, so anything reading this context is
 * asserting a human is present. That is the right failure mode for the one
 * remaining reader on a write path (`admin.posts.$slug.edit.tsx` stamps
 * `createdBy` with the signed-in address): if it were ever reached by a machine
 * actor it would throw rather than attribute a revision to nobody. It cannot be
 * reached, because the middleware refuses the method first, and a second
 * guarantee at the point of use costs nothing.
 *
 * Anything that only needs to know WHO IS ASKING reads `adminActorContext`.
 */
export const adminSessionContext = createContext<AdminSession>();

/**
 * WHO IS ASKING, for the whole `/admin` subtree. Always set once the gate passes.
 *
 * Split from `adminSessionContext` on 2026-08-24 with the smoke credential.
 * The distinction is not decorative: one of these is a Better Auth session and
 * the other is an identity, the plane now has two kinds of caller, and only one
 * of them has a session. Collapsing them would have meant either synthesising a
 * fake `AdminSession` for the machine, which is the stub this repo refuses on
 * the grounds that it authenticates through a path production does not have, or
 * teaching every reader to handle a null session it can never see.
 *
 * `email` is present for both kinds and is the same address for both, which is
 * deliberate and is part of the stated residue: the smoke render has to be the
 * page Dustin sees, down to the topbar's widest unbreakable token, or the
 * layout numbers taken through it are numbers about a different page.
 */
export type AdminActor =
  | { kind: "admin"; email: string }
  | { kind: "smoke"; id: string; email: string };

export const adminActorContext = createContext<AdminActor>();
