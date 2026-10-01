import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as twinLoader } from "~/routes/procedure[.md]";

import zncl2 from "../../content/procedures/phage-dna-extraction.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";

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
  gh = stubGitHub({ [procedurePath(SLUG)]: zncl2 });
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
