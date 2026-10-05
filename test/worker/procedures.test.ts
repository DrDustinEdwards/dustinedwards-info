import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProcedureSheet, ProcedureView } from "~/components/procedure";
import { procedureJsonLd } from "~/lib/procedures/json-ld.mjs";

import { runTool } from "~/lib/operator/api.server";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { procedureSearchUid } from "~/lib/procedures/render.mjs";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as twinLoader } from "~/routes/procedure[.md]";

import isolation from "../../content/procedures/phage-isolation.md?raw";
import zncl2 from "../../content/procedures/phage-dna-extraction.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { reagentRepoFiles, strainRepoFiles } from "./seed";

/* The operator API's procedure tools against the real migrations and a stubbed repository: a save is
 * validated by the same compile CI runs, committed, and written to D1, and the NEXT request for the page
 * draws the edited step. No build and no deploy sit between the two, which is the procedure system's
 * whole claim (job_86709d790a73). */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const PAGE = "https://example.com/research/protocols/phage-dna-extraction";
const SLUG = "phage-dna-extraction";

const OLD_STEP = "Incubate at 55 to 60 °C for ~{30 to 60%minutes}.";
const NEW_STEP = "Incubate at 60 °C for ~{45%minutes}.";

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub({ [procedurePath(SLUG)]: zncl2, ...strainRepoFiles, ...reagentRepoFiles });
});

afterEach(() => {
  gh.restore();
});

async function page() {
  const out = await pageLoader({
    request: new Request(PAGE),
    context: routeContext(),
    params: { slug: SLUG },
  } as never);
  return out.record;
}

/** Every step's words, as the page draws them. */
async function stepTexts() {
  const record = await page();
  return record.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "steps" ? b.steps.map((x) => x.text) : [])));
}

describe("save_procedure", () => {
  // Two compiles through the cold pipeline (shiki, KaTeX) take longer than the default 30 s here.
  it("puts an edited step on the page at the next request, with no build in between", { timeout: 120_000 }, async () => {
    // The current file, saved once, is the page as it stands.
    const first = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: zncl2 });
    expect(first.ok).toBe(true);
    expect((await stepTexts()).some((t) => t.includes("Incubate at 55 to 60 °C for 30 to 60 minutes."))).toBe(true);

    // The targeted edit: "change the proteinase K step to 60 °C for 45 minutes".
    expect(zncl2).toContain(OLD_STEP);
    const edited = zncl2.replace(OLD_STEP, NEW_STEP);
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: edited });
    expect(saved.ok).toBe(true);
    expect(gh.files.get(procedurePath(SLUG))).toBe(edited);

    const steps = await stepTexts();
    expect(steps.some((t) => t.includes("Incubate at 60 °C for 45 minutes."))).toBe(true);
    expect(steps.some((t) => t.includes("55 to 60 °C for 30 to 60 minutes"))).toBe(false);

    // The machine copy changed with it.
    const twin = await twinLoader({
      request: new Request(`${PAGE}.md`),
      context: routeContext(),
      params: { slug: SLUG },
    } as never);
    expect(await twin.text()).toContain("Incubate at 60 °C for 45 minutes.");
  });

  it("places a protocol in the phage workflow from its neighbours, on the page and in the twin, with nothing stored on it", { timeout: 180_000 }, async () => {
    gh.restore();
    gh = stubGitHub({ [procedurePath(SLUG)]: zncl2, [procedurePath("phage-isolation")]: isolation, ...strainRepoFiles, ...reagentRepoFiles });
    for (const [slug, raw] of [[SLUG, zncl2], ["phage-isolation", isolation]] as const) {
      expect((await runTool(operatorEnv(), operator, "save_procedure", { slug, raw })).ok).toBe(true);
    }
    const out = await pageLoader({ request: new Request(PAGE), context: routeContext(), params: { slug: SLUG } } as never);
    expect(out.workflow).toMatchObject({
      stage: "Extract DNA",
      before: [{ title: expect.stringContaining("Phage Isolation"), href: "/research/protocols/phage-isolation" }],
      after: [],
    });
    const twin = await twinLoader({ request: new Request(`${PAGE}.md`), context: routeContext(), params: { slug: SLUG } } as never);
    const text = await twin.text();
    expect(text).toContain("## In the phage workflow");
    expect(text).toContain("Before this: [Phage Isolation");
  });

  it("REFUSES an invalid file with every validator message, and commits nothing", async () => {
    const broken = zncl2.replace("Spin at 10,000 rpm", "Spin at 10,000 rpm in the @mystery reagent").replace(
      'version: "MISSING: No version',
      'version: "MISSING',
    );
    const result = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: broken });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      const errors = (result.detail as { errors: string[] }).errors;
      expect(errors.some((e) => e.includes("@mystery is not in materials"))).toBe(true);
      expect(gh.files.get(procedurePath(SLUG))).toBe(zncl2);
    }
  });

  it("REFUSES an operator's first publication of a procedure", async () => {
    const result = await runTool(operatorEnv(), operator, "save_procedure", {
      slug: "brand-new-protocol",
      raw: zncl2.replace("path: /research/protocols/phage-dna-extraction", "path: /research/protocols/brand-new-protocol"),
      isNew: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.detail).toMatchObject({ policy: "first-publish-requires-admin" });
    }
    expect(gh.files.has(procedurePath("brand-new-protocol"))).toBe(false);
  });

  it("does nothing for a file identical to the committed one, and says so", { timeout: 120_000 }, async () => {
    const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length;

    // D1 has no row yet, so the first identical save commits nothing but repairs the row from the file.
    const repaired = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: zncl2 });
    expect(repaired.ok).toBe(true);
    if (repaired.ok) expect(repaired.data).toMatchObject({ unchanged: true, created: false });
    expect(commits()).toBe(0);
    expect((await stepTexts()).length).toBeGreaterThan(0);

    // The row is current now: the same save is a pure no-op, and the response says so.
    const again = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: zncl2 });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ unchanged: true, purged: null });
    expect(commits()).toBe(0);

    // A real edit still commits.
    const edited = await runTool(operatorEnv(), operator, "save_procedure", {
      slug: SLUG,
      raw: zncl2.replace(OLD_STEP, NEW_STEP),
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.data).toMatchObject({ unchanged: false });
    expect(commits()).toBe(1);
  });

  it("lists every procedure with a draft flag and a count, as list_posts does", { timeout: 120_000 }, async () => {
    await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: zncl2 });
    const result = await runTool(operatorEnv(), operator, "list_procedures", {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { count: number; procedures: Array<{ slug: string; draft: boolean; status?: string }> };
      expect(data.count).toBe(data.procedures.length);
      const row = data.procedures.find((p) => p.slug === SLUG);
      expect(row).toMatchObject({ draft: false });
      expect(row).not.toHaveProperty("status");
    }
  });

  it("reads a procedure back as its file, its structure and its recorded gaps", async () => {
    const result = await runTool(operatorEnv(), operator, "get_procedure", { slug: SLUG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { raw: string; gaps: Array<{ field: string }>; errors: string[] };
      expect(data.raw).toBe(zncl2);
      expect(data.errors).toEqual([]);
      expect(data.gaps.some((g) => g.field === "version")).toBe(true);
    }
  });
});

describe("the biosafety level", () => {
  const MISSING_LINE = /^biosafety_level: .*$/m;
  const person = { "@type": "Person", "@id": "https://example.com/#person", name: "Test", url: "https://example.com" };
  const twin = async () =>
    (await twinLoader({ request: new Request(`${PAGE}.md`), context: routeContext(), params: { slug: SLUG } } as never)).text();
  const everywhere = async () => {
    const record = await page();
    const view = renderToStaticMarkup(createElement(ProcedureView, { record, count: 1, factor: 1 }));
    const sheet = renderToStaticMarkup(createElement(ProcedureSheet, { record, count: 1, factor: 1, address: PAGE }));
    return { record, view, sheet, twin: await twin(), ld: JSON.stringify(procedureJsonLd(record, "https://example.com", person)) };
  };

  it("never shows MISSING on the page, the sheet, the twin or the structured data, and shows it to the operator", { timeout: 120_000 }, async () => {
    expect(zncl2).toMatch(MISSING_LINE);
    expect(zncl2.match(MISSING_LINE)?.[0]).toContain("MISSING");
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: zncl2 });
    expect(saved.ok).toBe(true);
    const out = await everywhere();
    expect(out.record.biosafetyLevel).toBeNull();
    for (const surface of [out.view, out.sheet, out.twin, out.ld]) {
      expect(surface).not.toMatch(/biosafety level/i);
      expect(surface).not.toContain("Waiting on Dustin");
    }
    const list = await runTool(operatorEnv(), operator, "list_procedures", {});
    expect(list.ok).toBe(true);
    if (list.ok) {
      const rows = (list.data as { procedures: Array<{ slug: string; biosafetyLevel: string | null }> }).procedures;
      expect(rows.find((p) => p.slug === SLUG)?.biosafetyLevel).toBe("MISSING");
    }
    const read = await runTool(operatorEnv(), operator, "get_procedure", { slug: SLUG });
    expect(read.ok && JSON.stringify(read.data)).toContain("biosafety_level");
  });

  it("shows the level once Dustin has set it, on the page, the sheet, the twin and the structured data", { timeout: 120_000 }, async () => {
    const set = zncl2.replace(MISSING_LINE, "biosafety_level: BSL-2");
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: set });
    expect(saved.ok).toBe(true);
    const out = await everywhere();
    expect(out.record.biosafetyLevel).toBe("BSL-2");
    expect(out.view).toContain("<dt>Biosafety level</dt><dd>BSL-2</dd>");
    expect(out.sheet).toContain("<dt>Biosafety level</dt><dd>BSL-2</dd>");
    expect(out.twin).toContain("- Biosafety level: BSL-2");
    expect(out.ld).toContain('"name":"Biosafety level","value":"BSL-2"');
    const list = await runTool(operatorEnv(), operator, "list_procedures", {});
    if (list.ok) {
      const rows = (list.data as { procedures: Array<{ slug: string; biosafetyLevel: string | null }> }).procedures;
      expect(rows.find((p) => p.slug === SLUG)?.biosafetyLevel).toBe("BSL-2");
    }
  });
});

describe("sync_procedures and the procedures-drift check", () => {
  const OTHER = "other-protocol";
  const otherRaw = () =>
    zncl2.replace(
      "path: /research/protocols/phage-dna-extraction",
      `path: /research/protocols/${OTHER}`,
    );
  const rowFor = (slug: string) =>
    env.DB.prepare("SELECT slug, source_blob_sha FROM procedures WHERE slug = ?1")
      .bind(slug)
      .first<{ slug: string; source_blob_sha: string }>();
  const driftCheck = async () =>
    (await runHealthChecks(env as never)).checks.find((c) => c.name === "procedures-drift");
  const sync = () => runTool(operatorEnv(), operator, "sync_procedures", {});

  /* D1 persists across the cases of a file, and each starts from a repository ahead of an empty table. */
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM procedures").run();
  });

  it("converges an unrowed file, reports it as drift first, and is idempotent", { timeout: 120_000 }, async () => {
    // A file in the repository with no row: committed from a clone, or a save whose D1 write failed.
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 1, removed: 0, expected: 1, present: 1, converged: true });
    expect((await rowFor(SLUG))?.source_blob_sha).toBe(await gitBlobSha(zncl2));
    expect((await stepTexts()).length).toBeGreaterThan(0);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles a file edited through git, and removes the row of a file that is gone", { timeout: 180_000 }, async () => {
    gh.files.set(procedurePath(OTHER), otherRaw());
    expect((await sync()).ok).toBe(true);
    expect(await rowFor(OTHER)).not.toBeNull();

    // An edit committed outside the save tool, and a deletion.
    gh.files.set(procedurePath(SLUG), zncl2.replace(OLD_STEP, NEW_STEP));
    gh.files.delete(procedurePath(OTHER));
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 1, removed: 1, converged: true });
    expect(await rowFor(OTHER)).toBeNull();
    expect((await stepTexts()).some((t) => t.includes("Incubate at 60 °C for 45 minutes."))).toBe(true);
    const searchRows = await env.DB.prepare("SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid = ?1")
      .bind(procedureSearchUid(`/research/protocols/${OTHER}`))
      .first<{ n: number }>();
    expect(searchRows?.n).toBe(0);
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 120_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no procedure: a fault, not a repository with none.
    gh.files.delete(procedurePath(SLUG));
    gh.files.set("content/procedures/README.txt", "not a procedure");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor(SLUG)).not.toBeNull();
  });

  it("converges the rest and then FAILS NAMING a file the validator refuses", { timeout: 180_000 }, async () => {
    gh.files.set(procedurePath(OTHER), otherRaw().replace("Spin at 10,000 rpm", "Spin at 10,000 rpm in the @mystery reagent"));
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain(`${procedurePath(OTHER)} fails`);
      expect(JSON.stringify(result.detail)).toContain("@mystery is not in materials");
    }
    // The valid file was still converged, and the refused one has no row.
    expect(await rowFor(SLUG)).not.toBeNull();
    expect(await rowFor(OTHER)).toBeNull();
  });
});
