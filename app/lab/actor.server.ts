import { createContext } from "react-router";
import { normalizeEmail, resolveActor, type Actor } from "@dustinedwards/site-runtime/members";

import { getMember } from "~/db/members";

import { LAB_CATALOG } from "./titles.mjs";

/**
 * Who is asking in /lab-bench, set by the workspace layout's middleware once Access and the person's row have both said yes.
 * Handlers ask `can(actor, PERMISSION.x)` of it and nothing else.
 */
export const labActorContext = createContext<Actor>();

/** Whether the Primary Owner is configured; without it /lab-bench admits nobody, the Primary Owner included. */
export function primaryOwnerSet(env: Env): boolean {
  return !!env.PRIMARY_OWNER_EMAIL?.trim();
}

/** The lab's catalog and Primary Owner, as site-runtime's rules take them. */
export function labRules(env: Env, nowMs: number) {
  return { catalog: LAB_CATALOG, primaryOwnerEmail: env.PRIMARY_OWNER_EMAIL ?? "", nowMs };
}

/**
 * The person's row, read now and uncached, through site-runtime's `resolveActor`: the Primary Owner from
 * PRIMARY_OWNER_EMAIL, anyone else by an active, unexpired row. Null is "no access".
 */
export async function loadLabActor(env: Env, email: string, nowMs: number): Promise<Actor | null> {
  const who = normalizeEmail(email);
  const row = await getMember(env, who);
  return resolveActor(who, row, labRules(env, nowMs));
}
