import { allowList } from "@dustinedwards/site-runtime/members";

import { latestAuditId, listMembers, pendingAfter, recordSync, unsyncedRemovals } from "~/db/members";

import { LAB_CATALOG } from "./titles.mjs";

/**
 * Asks Capsid to make the lab's Cloudflare Access group (`lab-people`) hold exactly the people /lab/members says may
 * sign in (capsid docs/design/design-identity-roles.md, "The Cloudflare sync"; Dustin's ruling of 2026-10-09: Capsid
 * is the only holder of the Cloudflare token, and apps ask it). Capsid's POST /ops/access-sync takes this namespace's
 * whole list, writes the group it pinned for the namespace (never one this site names), frees the seats of the people
 * listed as removed and audits the call. Every change on the members page ends here.
 *
 * The answer is written onto every member_audit row still waiting: one sync carries the whole list, so it settles
 * every earlier change too. Nothing here ever throws away a change: a refusal leaves the rows `failed` with the
 * reason, the page shows it beside each person, and Retry runs this again.
 */

export const ACCESS_SYNC_URL = "https://mcp.dustinedwards.info/ops/access-sync";
const ACCESS_SYNC_NAMESPACE = "dustinedwards";
const TIMEOUT_MS = 15_000;

/** What the page says while the site holds no key: the change is recorded and Access is untouched. */
export const SYNC_NOT_SET_UP =
  "Access sync is not set up yet: this site has no CAPSID_ACCESS_SYNC_KEY (Dustin's step). The change is recorded here and nothing was changed in Cloudflare Access.";

/** The same, as the reason kept on each audit row and shown beside each person, where a sentence does not fit. */
export const SYNC_NOT_SET_UP_REASON = "Access sync is not set up yet (no CAPSID_ACCESS_SYNC_KEY). Access is unchanged.";

export type SyncOutcome = { ok: true } | { ok: false; error: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Capsid's refusal in its own words: JSON `refusal` on a 409 or 502, plain text otherwise. */
async function refusalText(response: Response): Promise<string> {
  const text = (await response.text()).slice(0, 600);
  try {
    const body = JSON.parse(text) as { refusal?: unknown };
    if (typeof body.refusal === "string" && body.refusal) return `Cloudflare refused: ${body.refusal}`;
  } catch {
    // Plain text: Capsid's own refusals (401, 403, 409 with no pin, 503 with no token) are words already.
  }
  const notSetUp = /CF_ACCESS_SYNC_TOKEN is not set/.test(text) ? " Access sync is not set up yet at Capsid (Dustin's step), so nothing was changed in Cloudflare Access." : "";
  return `Capsid answered ${response.status}: ${text.trim() || response.statusText}.${notSetUp}`;
}

/**
 * Two managers' changes can sync at once and finish in either order. So a sync settles only the audit rows that existed
 * when it read the list, and when a newer change is still pending after it, it sends the list again: the last write to
 * the group is always a list read after the last change.
 */
const MAX_ROUNDS = 3;

export async function syncAccess(env: Env, nowMs: number, fetchImpl: FetchLike = (input, init) => fetch(input, init)): Promise<SyncOutcome> {
  let outcome: SyncOutcome = { ok: true };
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const upto = await latestAuditId(env);
    outcome = await callCapsid(env, nowMs, fetchImpl);
    await recordSync(env, outcome.ok ? "accepted" : "failed", outcome.ok ? null : outcome.error, upto);
    if (!outcome.ok || !(await pendingAfter(env, upto))) break;
  }
  return outcome;
}

async function callCapsid(env: Env, nowMs: number, fetchImpl: FetchLike): Promise<SyncOutcome> {
  const key = env.CAPSID_ACCESS_SYNC_KEY?.trim();
  if (!key) return { ok: false, error: SYNC_NOT_SET_UP_REASON };

  const rows = await listMembers(env);
  const body = { namespace: ACCESS_SYNC_NAMESPACE, members: allowList(rows, nowMs, LAB_CATALOG), removed: await unsyncedRemovals(env) };
  let response: Response;
  try {
    response = await fetchImpl(ACCESS_SYNC_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, error: `Capsid could not be reached: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (response.ok) return { ok: true };
  return { ok: false, error: await refusalText(response) };
}
