import { stubAccess } from "@dustinedwards/devkit/access";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, MemberRow } from "@dustinedwards/site-runtime/members";

import { ACCESS_SYNC_URL, SYNC_NOT_SET_UP, SYNC_NOT_SET_UP_REASON } from "~/lab/access-sync.server";
import { labActorContext, loadLabActor } from "~/lab/actor.server";
import { membersAction, membersPage } from "~/lab/members.server";
import { SITE_ORIGIN } from "~/lib/seo";
import { middleware as adminMiddleware } from "~/routes/admin";
import { middleware as labMiddleware, noAccessText } from "~/routes/workspace";
import { loader as membersLoader } from "~/routes/workspace.members";

import { routeContext, throughMiddleware } from "./route-helpers";

/*
 * The /lab-bench workspace (docs/KNOWLEDGE-BASE.md step 5): its own Access application, a row in `members` for everyone
 * but the Primary Owner, and site-runtime's rules for every change. Each rule here was seen red once, by breaking
 * the code it names (see the pull request).
 */

const TEAM = "team.cloudflareaccess.com";
const ADMIN_AUD = "admin-app-tag";
const LAB_AUD = "lab-app-tag";
const PRIMARY = "dustin@example.org";
const MANAGER = "maya@example.org";
const MANAGER_2 = "lee@example.org";
const WORKER = "rosa@example.org";
const OWNER = "owner@example.org";
const VARS = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: ADMIN_AUD, ACCESS_LAB_AUD: LAB_AUD, PRIMARY_OWNER_EMAIL: PRIMARY };

const NOW = Date.UTC(2026, 9, 11, 12);
const TERMS = ["2026-12-18", "2027-05-14"];

const testEnv = { ...env, ...VARS } as unknown as Env;

/**
 * One signing key for the whole file: site-runtime/access caches the team's key set by its domain, so a second key would read as a
 * bad signature. Each token names its own audience, as the two Access applications' tokens do.
 */
const stub = await stubAccess({
  issuer: `https://${TEAM}`,
  audience: LAB_AUD,
  email: "unused@example.com",
  jwksUrl: `https://${TEAM}/cdn-cgi/access/certs`,
  claims: { aud: [LAB_AUD] },
  install: false,
});

function signer(audience: string) {
  return { mint: (email: string) => stub.token({ email, aud: [audience] }), fetch: stub.fetch };
}

async function seed(rows: Array<MemberRow & { added_by?: string }>, terms: string[] = TERMS) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM members"),
    env.DB.prepare("DELETE FROM member_audit"),
    env.DB.prepare("DELETE FROM member_terms"),
    ...rows.map((r) =>
      env.DB.prepare("INSERT INTO members (email, name, title, end_date, status, added_by) VALUES (?, ?, ?, ?, ?, ?)").bind(
        r.email,
        r.name ?? "",
        r.title,
        r.end_date,
        r.status,
        r.added_by ?? PRIMARY,
      ),
    ),
    ...terms.map((d) => env.DB.prepare("INSERT INTO member_terms (end_date, added_by) VALUES (?, ?)").bind(d, PRIMARY)),
  ]);
}

const STAFF: MemberRow[] = [
  { email: OWNER, name: "Owner", title: "owner", end_date: null, status: "active" },
  { email: MANAGER, name: "Maya Chen", title: "lab_manager", end_date: "2026-12-18", status: "active" },
  { email: MANAGER_2, name: "Lee Park", title: "lab_manager", end_date: "2026-12-18", status: "active" },
  { email: WORKER, name: "Rosa Park", title: "lab_worker", end_date: "2026-12-18", status: "active" },
];

async function actor(email: string): Promise<Actor> {
  const a = await loadLabActor(testEnv, email, NOW);
  if (!a) throw new Error(`${email} has no access`);
  return a;
}

function form(fields: Record<string, string | undefined>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.set(k, v);
  return f;
}

async function auditRows() {
  return (await env.DB.prepare("SELECT * FROM member_audit ORDER BY id").all()).results as Array<Record<string, unknown>>;
}

async function memberRow(email: string) {
  return env.DB.prepare("SELECT * FROM members WHERE email = ?").bind(email).first<Record<string, unknown>>();
}

/** Capsid's endpoint, recorded: every body it was sent, and the answer it gives. */
function capsid(status = 200, answer: unknown = { ok: true }) {
  const bodies: Array<{ url: string; auth: string | null; body: unknown }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    bodies.push({ url, auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
    return typeof answer === "string" ? new Response(answer, { status }) : Response.json(answer, { status });
  };
  return { bodies, fetchImpl };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await seed(STAFF);
});

describe("the /lab-bench gate", () => {
  async function through(token: string | null, overrides: object = VARS, mw: readonly unknown[] = labMiddleware, path = "/lab-bench") {
    const context = routeContext(undefined, overrides);
    const request = new Request(`${SITE_ORIGIN}${path}`, { headers: token ? { "cf-access-jwt-assertion": token } : {} });
    let seen: Actor | undefined;
    try {
      await throughMiddleware(
        mw,
        ((args: { context: typeof context }) => {
          seen = mw === labMiddleware ? args.context.get(labActorContext) : undefined;
          return null;
        }) as never,
        { request, context, params: {} } as never,
      );
    } catch (thrown) {
      return { thrown: thrown as Response, seen };
    }
    return { thrown: null, seen };
  }

  it("admits a member with an active row, as their title's permissions", async () => {
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    const { thrown, seen } = await through(await lab.mint(WORKER));
    expect(thrown).toBeNull();
    expect(seen?.title).toBe("lab_worker");
    expect(seen?.permissions.has("manage_members")).toBe(false);
  });

  it("admits the Primary Owner with no row at all", async () => {
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    const { thrown, seen } = await through(await lab.mint(PRIMARY));
    expect(thrown).toBeNull();
    expect(seen?.layer).toBe(0);
  });

  it("refuses an /admin token at /lab-bench, by its audience", async () => {
    const admin = signer(ADMIN_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(admin.fetch);
    const { thrown, seen } = await through(await admin.mint(PRIMARY));
    expect(seen).toBeUndefined();
    expect(thrown?.status).toBe(401);
    expect(await thrown?.text()).toContain("audience");
  });

  it("refuses a /lab-bench token at /admin, by its audience", async () => {
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    const { thrown } = await through(await lab.mint(PRIMARY), VARS, adminMiddleware, "/admin");
    expect(thrown?.status).toBe(401);
    expect(await thrown?.text()).toContain("audience");
  });

  it("refuses a person Access admits but with no row: no access, ask your lab manager", async () => {
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    const { thrown, seen } = await through(await lab.mint("stranger@example.org"));
    expect(seen).toBeUndefined();
    expect(thrown?.status).toBe(403);
    expect(await thrown?.text()).toBe(noAccessText("stranger@example.org"));
  });

  it("refuses a removed member and an expired one on their next request", async () => {
    await seed([
      { email: WORKER, name: "Rosa", title: "lab_worker", end_date: "2026-12-18", status: "removed" },
      { email: MANAGER, name: "Maya", title: "lab_manager", end_date: "2026-10-10", status: "active" },
    ]);
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    for (const email of [WORKER, MANAGER]) {
      const { thrown } = await through(await lab.mint(email));
      expect(thrown?.status, email).toBe(403);
    }
  });

  it("admits nobody while the lab's Access application or the Primary Owner is not configured", async () => {
    const lab = signer(LAB_AUD);
    vi.spyOn(globalThis, "fetch").mockImplementation(lab.fetch);
    const noApp = await through(await lab.mint(PRIMARY), { ...VARS, ACCESS_LAB_AUD: "" });
    expect(noApp.thrown?.status).toBe(403);
    const noOwner = await through(await lab.mint(PRIMARY), { ...VARS, PRIMARY_OWNER_EMAIL: "" });
    expect(noOwner.thrown?.status).toBe(403);
  });
});

describe("who may manage whom", () => {
  it("gives a Lab worker a 404 at /lab-bench/members", async () => {
    const context = routeContext(undefined, VARS);
    context.set(labActorContext, await actor(WORKER));
    const thrown = await membersLoader({ context, request: new Request(`${SITE_ORIGIN}/lab-bench/members`), params: {} } as never).catch((e) => e);
    expect(thrown?.init?.status ?? thrown?.status).toBe(404);
  });

  it("refuses a Lab worker every manager action", async () => {
    const worker = await actor(WORKER);
    for (const fields of [
      { intent: "add", email: "new@example.org", name: "New", title: "lab_worker", end_date: "" },
      { intent: "renew", email: WORKER },
      { intent: "remove", email: WORKER, confirmed: "yes" },
      { intent: "retry" },
    ]) {
      const out = await membersAction(testEnv, worker, form(fields), NOW);
      expect(out.result, fields.intent).toEqual({ ok: false, text: "You do not manage people here." });
    }
    expect(await auditRows()).toHaveLength(0);
  });

  it("refuses a Lab manager an Owner's action: an Owner or a peer title, and the term dates", async () => {
    const manager = await actor(MANAGER);
    const owner = await membersAction(testEnv, manager, form({ intent: "add", email: "x@example.org", name: "X", title: "owner" }), NOW);
    expect(owner.result).toEqual({ ok: false, text: "you can give only titles below your own layer" });
    const peer = await membersAction(testEnv, manager, form({ intent: "add", email: "y@example.org", name: "Y", title: "lab_manager", end_date: "" }), NOW);
    expect(peer.result).toEqual({ ok: false, text: "you can give only titles below your own layer" });
    const promote = await membersAction(testEnv, manager, form({ intent: "change_title", email: WORKER, title: "lab_manager", reason: "lead" }), NOW);
    expect(promote.result).toEqual({ ok: false, text: "you can give only titles below your own layer" });
    const terms = await membersAction(testEnv, manager, form({ intent: "set_terms", terms: "2027-12-17" }), NOW);
    expect(terms.result).toEqual({ ok: false, text: "Only an Owner sets the semester end dates." });
    expect(await auditRows()).toHaveLength(0);
  });

  it("lets nobody manage their own layer: not a peer, not themselves", async () => {
    const manager = await actor(MANAGER);
    for (const target of [MANAGER_2, MANAGER]) {
      for (const fields of [
        { intent: "renew", email: target },
        { intent: "remove", email: target, confirmed: "yes" },
        { intent: "change_title", email: target, title: "lab_worker", reason: "step down" },
      ]) {
        const out = await membersAction(testEnv, manager, form(fields), NOW);
        expect(out.result, `${fields.intent} ${target}`).toEqual({ ok: false, text: "you manage only people below your own layer" });
      }
    }
    const owner = await actor(OWNER);
    const peerOwner = await membersAction(testEnv, owner, form({ intent: "remove", email: OWNER, confirmed: "yes" }), NOW);
    expect(peerOwner.result).toEqual({ ok: false, text: "you manage only people below your own layer" });
    const primary = await membersAction(testEnv, owner, form({ intent: "add", email: PRIMARY, name: "D", title: "lab_worker", end_date: "" }), NOW);
    expect(primary.result?.ok).toBe(false);
    expect(await auditRows()).toHaveLength(0);
  });

  it("shows a Lab manager only the Lab workers and themselves, with no actions on their own row", async () => {
    const page = await membersPage(testEnv, await actor(MANAGER), new URL(`${SITE_ORIGIN}/lab-bench/members`), NOW);
    expect(page.people.people.map((p) => [p.email, p.manageable, p.you ?? false])).toEqual([
      [MANAGER, false, true],
      [WORKER, true, false],
    ]);
    expect(page.people.titles.map((t) => t.value)).toEqual(["lab_worker"]);
    expect(page.canEditTerms).toBe(false);
  });
});

describe("each change, its audit row and the Access sync", () => {
  it("adds a Lab worker to the term's end, audits it, and sends Capsid the whole list", async () => {
    const { bodies, fetchImpl } = capsid();
    const out = await membersAction({ ...testEnv, CAPSID_ACCESS_SYNC_KEY: "k".repeat(40) } as Env, await actor(MANAGER), form({ intent: "add", email: "Sam@Example.org ", name: "Sam Ortiz", title: "lab_worker", end_date: "" }), NOW, fetchImpl);
    expect(out.result?.ok).toBe(true);
    expect(await memberRow("sam@example.org")).toMatchObject({ title: "lab_worker", end_date: "2026-12-18", status: "active", added_by: MANAGER });
    expect(bodies).toEqual([
      {
        url: ACCESS_SYNC_URL,
        auth: `Bearer ${"k".repeat(40)}`,
        body: { namespace: "dustinedwards", members: [MANAGER_2, MANAGER, OWNER, WORKER, "sam@example.org"].sort(), removed: [] },
      },
    ]);
    const [row] = await auditRows();
    expect(row).toMatchObject({ actor: MANAGER, actor_title: "lab_manager", action: "add", member_email: "sam@example.org", cloudflare: "accepted" });
  });

  it("records a change and touches nothing in Access while this site holds no Capsid key", async () => {
    const { bodies, fetchImpl } = capsid();
    const out = await membersAction(testEnv, await actor(MANAGER), form({ intent: "renew", email: WORKER }), NOW, fetchImpl);
    expect(bodies).toHaveLength(0);
    expect(out.result?.text).toContain(SYNC_NOT_SET_UP_REASON);
    expect(await memberRow(WORKER)).toMatchObject({ end_date: "2027-05-14" });
    const [row] = await auditRows();
    expect(row).toMatchObject({ action: "renew", cloudflare: "failed", cloudflare_error: SYNC_NOT_SET_UP_REASON });
    const page = await membersPage(testEnv, await actor(MANAGER), new URL(`${SITE_ORIGIN}/lab-bench/members`), NOW);
    expect(page.syncNotice).toBe(SYNC_NOT_SET_UP);
    expect(page.people.people.find((p) => p.email === WORKER)).toMatchObject({ sync: "failed", syncError: SYNC_NOT_SET_UP_REASON });
  });

  it("asks before a removal, then removes, keeps the row, and names the seat to free", async () => {
    const keyed = { ...testEnv, CAPSID_ACCESS_SYNC_KEY: "k".repeat(40) } as Env;
    const manager = await actor(MANAGER);
    const ask = await membersAction(keyed, manager, form({ intent: "remove", email: WORKER }), NOW);
    expect(ask).toEqual({ confirm: { email: WORKER, name: "Rosa Park" } });
    expect(await auditRows()).toHaveLength(0);
    const { bodies, fetchImpl } = capsid();
    await membersAction(keyed, manager, form({ intent: "remove", email: WORKER, confirmed: "yes" }), NOW, fetchImpl);
    expect(await memberRow(WORKER)).toMatchObject({ status: "removed" });
    const sent = bodies[0]?.body as { members: string[]; removed: string[] };
    expect(sent.removed).toEqual([WORKER]);
    expect(sent.members).not.toContain(WORKER);
  });

  it("keeps Capsid's refusal on the audit row, and Retry settles it", async () => {
    const keyed = { ...testEnv, CAPSID_ACCESS_SYNC_KEY: "k".repeat(40) } as Env;
    const manager = await actor(MANAGER);
    const refusing = capsid(503, "the Capsid Worker secret CF_ACCESS_SYNC_TOKEN is not set, so nothing was called");
    const out = await membersAction(keyed, manager, form({ intent: "renew", email: WORKER }), NOW, refusing.fetchImpl);
    expect(out.result?.text).toContain("Access sync is not set up yet at Capsid");
    expect((await auditRows())[0]).toMatchObject({ cloudflare: "failed" });
    const ok = capsid();
    const retry = await membersAction(keyed, manager, form({ intent: "retry" }), NOW, ok.fetchImpl);
    expect(retry.result?.ok).toBe(true);
    expect((await auditRows())[0]).toMatchObject({ cloudflare: "accepted", cloudflare_error: null });
  });

  it("lets the Primary Owner set the term dates, with an audit row and no sync", async () => {
    const primary = await actor(PRIMARY);
    const out = await membersAction(testEnv, primary, form({ intent: "set_terms", terms: "2027-05-14, 2026-12-18 2027-12-17" }), NOW);
    expect(out.result).toEqual({ ok: true, text: "Semester end dates: 2026-12-18, 2027-05-14, 2027-12-17." });
    const [row] = await auditRows();
    expect(row).toMatchObject({ action: "set_terms", member_email: null, cloudflare: "not_needed", before_row: JSON.stringify(TERMS) });
    const bad = await membersAction(testEnv, primary, form({ intent: "set_terms", terms: "2027-02-30" }), NOW);
    expect(bad.result?.ok).toBe(false);
  });

  it("refuses a Lab worker's add when no term date lies ahead, rather than inventing one", async () => {
    await seed(STAFF, []);
    const out = await membersAction(testEnv, await actor(MANAGER), form({ intent: "add", email: "n@example.org", name: "N", title: "lab_worker", end_date: "" }), NOW);
    expect(out.result?.ok).toBe(false);
    expect(out.result?.text).toMatch(/semester end dates first/);
  });

  it("refuses a malformed email, end date or term date in words, never a 500", async () => {
    const manager = await actor(MANAGER);
    const noLocal = await membersAction(testEnv, manager, form({ intent: "add", email: "@lab.org", name: "N", title: "lab_worker" }), NOW);
    expect(noLocal.result).toEqual({ ok: false, text: "Type the email address they sign in with." });
    const badEnd = await membersAction(testEnv, manager, form({ intent: "add", email: "n@example.org", name: "N", title: "lab_worker", end_date: "2026-13-01" }), NOW);
    expect(badEnd.result).toEqual({ ok: false, text: "Not a date (YYYY-MM-DD): 2026-13-01." });
    const badTerm = await membersAction(testEnv, await actor(PRIMARY), form({ intent: "set_terms", terms: "2026-13-01" }), NOW);
    expect(badTerm.result).toEqual({ ok: false, text: "Not a date (YYYY-MM-DD): 2026-13-01." });
    expect(await auditRows()).toHaveLength(0);
  });

  it("adds back a removed person with their kept name, and never names them as removed to Capsid again", async () => {
    await seed([...STAFF.filter((r) => r.email !== WORKER), { email: WORKER, name: "Rosa Park", title: "lab_worker", end_date: "2026-09-01", status: "removed" }]);
    await env.DB.prepare(
      "INSERT INTO member_audit (at, actor, actor_title, action, member_email, cloudflare) VALUES ('2026-09-01T00:00:00.000Z', ?, 'lab_manager', 'remove', ?, 'failed')",
    ).bind(MANAGER, WORKER).run();
    const { bodies, fetchImpl } = capsid();
    const keyed = { ...testEnv, CAPSID_ACCESS_SYNC_KEY: "k".repeat(40) } as Env;
    await membersAction(keyed, await actor(MANAGER), form({ intent: "add", email: WORKER, name: "", title: "lab_worker", end_date: "" }), NOW, fetchImpl);
    expect(await memberRow(WORKER)).toMatchObject({ name: "Rosa Park", status: "active", end_date: "2026-12-18" });
    const sent = bodies[0]?.body as { members: string[]; removed: string[] };
    expect(sent.members).toContain(WORKER);
    expect(sent.removed).toEqual([]);
  });

  it("gives an expired person a new title with the next term end, not their passed date", async () => {
    await seed([...STAFF.filter((r) => r.email !== WORKER), { email: WORKER, name: "Rosa Park", title: "lab_worker", end_date: "2026-09-01", status: "active" }]);
    const out = await membersAction(testEnv, await actor(OWNER), form({ intent: "change_title", email: WORKER, title: "lab_manager", reason: "lead" }), NOW);
    expect(out.result?.ok).toBe(true);
    expect(await memberRow(WORKER)).toMatchObject({ title: "lab_manager", end_date: "2026-12-18" });
  });

  it("settles only the changes its list carried, and sends again for one made while it ran", async () => {
    const keyed = { ...testEnv, CAPSID_ACCESS_SYNC_KEY: "k".repeat(40) } as Env;
    const calls: unknown[] = [];
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      if (calls.length === 1) {
        // Another manager's change lands while this sync is in flight.
        await env.DB.prepare(
          "INSERT INTO member_audit (at, actor, actor_title, action, member_email, cloudflare) VALUES ('2026-10-11T12:00:01.000Z', ?, 'lab_manager', 'renew', ?, 'pending')",
        ).bind(MANAGER_2, WORKER).run();
      }
      return Response.json({ ok: true });
    };
    await membersAction(keyed, await actor(MANAGER), form({ intent: "renew", email: WORKER }), NOW, fetchImpl);
    expect(calls).toHaveLength(2);
    expect((await auditRows()).map((r) => r.cloudflare)).toEqual(["accepted", "accepted"]);
  });
});
