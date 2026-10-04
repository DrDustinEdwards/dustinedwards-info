import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProcedureView, VersionNotice } from "~/components/procedure";
import { getFrozenVersion, listFrozenVersions } from "~/db/procedure-versions";
import { readProcedureSides } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as versionLoader } from "~/routes/procedure.version";
import { loader as versionTwinLoader } from "~/routes/procedure.version[.md]";

import isolation from "../../content/procedures/phage-isolation.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";

/* Frozen versions (drizzle/0027_procedure_versions.sql, docs/PROCEDURES.md): a published, versioned procedure keeps a
 * copy of every version at <page>/v/<version>, written once and never changed, so a printed sheet's QR code and a
 * citation keep meaning what they did. The file is the repository's own phage-isolation, given versions here. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const SLUG = "phage-isolation";
const PAGE = `https://example.com/research/protocols/${SLUG}`;
const PATH = `/research/protocols/${SLUG}`;

const OLD = "Plan about 6 webbed plates to cover 10 ml";
const NEW = "Plan about 7 webbed plates to cover 10 ml";
expect(isolation).toContain(OLD);

const V1 = isolation.replace(
  /^version: .*$/m,
  'version: "1"\nhistory:\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.',
);
const V2 = isolation
  .replace(
    /^version: .*$/m,
    'version: "2"\nhistory:\n  - version: "2"\n    date: 2026-10-01\n    summary: Seven plates, not six.\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.',
  )
  .replace(OLD, NEW);

let gh: GitHubStub;
beforeEach(() => {
  gh = stubGitHub({ [procedurePath(SLUG)]: isolation });
});
afterEach(() => {
  gh.restore();
});

const save = (raw: string) => runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw });
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length;
const versionPage = (version: string) =>
  versionLoader({ request: new Request(`${PAGE}/v/${version}`), context: routeContext(), params: {} } as never);
const text = (record: { sections: Array<{ blocks: Array<{ type: string; steps?: Array<{ text: string }>; html?: string }> }> }) =>
  JSON.stringify(record.sections);

describe("frozen procedure versions", () => {
  it("freezes a version when it is published, and the page for it is drawn from the copy", { timeout: 180_000 }, async () => {
    expect((await save(V1)).ok).toBe(true);
    const frozen = await getFrozenVersion(env as never, PATH, "1");
    expect(frozen?.version).toBe("1");
    expect(frozen?.record.version).toBe("1");
    expect(frozen?.markdown).toContain("Version history");
    expect(await listFrozenVersions(env as never, SLUG)).toEqual(["1"]);

    const out = await versionPage("1");
    expect(out.record.version).toBe("1");
    expect(out.current).toEqual({ path: PATH, version: "1" });
    // The current version needs no notice; the page links its history to the copy and cites the copy's address.
    expect(renderToStaticMarkup(createElement(VersionNotice, { record: out.record, current: out.current }))).toBe("");
    const html = renderToStaticMarkup(
      createElement(ProcedureView, { record: out.record, count: 1, factor: 1, basePath: `${PATH}/v/1`, sheetPath: null, frozen: out.frozen }),
    );
    expect(html).toContain(`href="${PATH}/v/1">Version 1</a>`);
    expect(html).toContain(`https://dustinedwards.info${PATH}/v/1`);
    expect(html).toContain(`data-run-path="${PATH}/v/1"`);
    expect(html).not.toContain("Printable sheet");
  });

  it("refuses an edit to a published version before it commits, and a new version leaves the old words alone", { timeout: 240_000 }, async () => {
    expect((await save(V1)).ok).toBe(true);
    const before = commits();
    const frozenBefore = await getFrozenVersion(env as never, PATH, "1");

    // The same version with different words is refused with the fix, and nothing is committed.
    const edited = await save(V1.replace(OLD, NEW));
    expect(edited.ok).toBe(false);
    if (!edited.ok) {
      expect(edited.status).toBe(422);
      expect((edited.detail as { errors: string[] }).errors.join(" ")).toMatch(/Version 1 is already published and frozen at .*\/v\/1.*new version/);
    }
    expect(commits()).toBe(before);

    // A new version is accepted, and the old copy is byte for byte what it was.
    expect((await save(V2)).ok).toBe(true);
    const frozenAfter = await getFrozenVersion(env as never, PATH, "1");
    expect(frozenAfter).toEqual(frozenBefore);
    expect(text(frozenAfter!.record)).toContain("Plan about 6 webbed plates");
    expect(text((await versionPage("2")).record)).toContain("Plan about 7 webbed plates");
    expect(await listFrozenVersions(env as never, SLUG)).toEqual(["1", "2"]);

    // The old version's page says which version is current and links to it; the live page is the new words.
    const old = await versionPage("1");
    expect(old.current).toEqual({ path: PATH, version: "2" });
    const notice = renderToStaticMarkup(createElement(VersionNotice, { record: old.record, current: old.current }));
    expect(notice).toContain("This is version 1");
    expect(notice).toContain("The current version is version 2");
    expect(notice).toContain(`href="${PATH}"`);
    const live = await pageLoader({ request: new Request(PAGE), context: routeContext(), params: { slug: SLUG } } as never);
    expect(live.record.version).toBe("2");
    expect(live.frozen).toEqual(["1", "2"]);

    // Its twin is the twin it had, with the words it had.
    const twin = await (
      await versionTwinLoader({ request: new Request(`${PAGE}/v/1.md`), context: routeContext(), params: {} } as never)
    ).text();
    expect(twin).toContain("Plan about 6 webbed plates");
    expect(twin).not.toContain("Plan about 7 webbed plates");
  });

  it("answers 404 for a version that was never frozen, and names the fix when a git edit reaches a frozen one", { timeout: 240_000 }, async () => {
    expect((await save(V2)).ok).toBe(true);
    await expect(versionPage("9")).rejects.toMatchObject({ init: { status: 404 } });
    const missingTwin = await versionTwinLoader({ request: new Request(`${PAGE}/v/9.md`), context: routeContext(), params: {} } as never);
    expect(missingTwin.status).toBe(404);

    // The file changes behind the save tool's back (a git edit), and the sync is asked to converge it.
    gh.files.set(procedurePath(SLUG), V2.replace(NEW, "Plan about 8 webbed plates to cover 10 ml"));
    const synced = await runTool(operatorEnv(), operator, "sync_procedures", {});
    expect(synced.ok).toBe(false);
    if (!synced.ok) expect(synced.error).toMatch(/already published and frozen/);
    const kept = await getFrozenVersion(env as never, PATH, "2");
    expect(text(kept!.record)).toContain("Plan about 7 webbed plates");
  });

  it("is refused by the database itself when anything tries to change or delete a sealed copy", { timeout: 180_000 }, async () => {
    expect((await save(V1)).ok).toBe(true);
    await expect(env.DB.prepare("UPDATE procedure_versions SET record = 'x' WHERE slug = ?1").bind(SLUG).run()).rejects.toThrow(/never changed/);
    await expect(env.DB.prepare("DELETE FROM procedure_versions WHERE slug = ?1").bind(SLUG).run()).rejects.toThrow(/never deleted/);
    // An unsealed row (a sync part way through) is not served and may be replaced.
    await env.DB.prepare(
      "INSERT INTO procedure_versions (slug, version, path, profile, record, markdown, source_blob_sha, sealed) VALUES ('half', '1', '/research/protocols/half', 'protocol', '{', '', 'x', 0)",
    ).run();
    expect(await getFrozenVersion(env as never, "/research/protocols/half", "1")).toBeNull();
    await env.DB.prepare("DELETE FROM procedure_versions WHERE slug = 'half'").run();
  });

  it("freezes nothing for a procedure with no version, and a published version with no copy reads as drift", { timeout: 180_000 }, async () => {
    expect((await save(isolation)).ok).toBe(true);
    const none = await env.DB.prepare("SELECT count(*) AS n FROM procedure_versions WHERE slug = ?1").bind(SLUG).first<{ n: number }>();
    // The earlier cases in this file froze versions of the same slug; an unversioned save adds none.
    const n = none?.n ?? 0;
    expect((await save(isolation)).ok).toBe(true);
    const again = await env.DB.prepare("SELECT count(*) AS n FROM procedure_versions WHERE slug = ?1").bind(SLUG).first<{ n: number }>();
    expect(again?.n).toBe(n);

    // A published, versioned row whose copy is missing reads as having no sha, which is what drift is.
    await env.DB.prepare(
      `INSERT INTO procedures (slug, path, profile, title, description, status, version, updated, record, markdown, source_path, source_blob_sha)
       VALUES ('ghost', '/research/protocols/ghost', 'protocol', 'Ghost', 'd', 'published', '3', NULL, '{}', '', 'content/procedures/ghost.md', 'abc')`,
    ).run();
    const sides = await readProcedureSides(env as never);
    expect(sides.rows.find((r) => r.slug === "ghost")?.source_blob_sha).toBeNull();
    expect(sides.rows.find((r) => r.slug === SLUG)?.source_blob_sha).not.toBeNull();
    await env.DB.prepare("DELETE FROM procedures WHERE slug = 'ghost'").run();
  });
});
