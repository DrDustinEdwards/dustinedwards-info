import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProcedureSheet, ProcedureView } from "~/components/procedure";
import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { saveRegistryItem } from "~/lib/registry/save.server";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as twinLoader } from "~/routes/procedure[.md]";

import coi from "../../content/procedures/coi-primers.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";

/* A protocol reads its primer tables from the lab registry (docs/REGISTRY.md): the file names the primers by id and holds no
 * sequence, the compile reads them from the repository into the record, and a change to a primer reaches every protocol that
 * prints it. The files are the repository's own: the COI protocol and every primer record. */

const PRIMER_FILES = import.meta.glob("../../content/registry/primer/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const registryFiles = Object.fromEntries(Object.entries(PRIMER_FILES).map(([path, raw]) => [`content/registry/primer/${path.split("/").pop()}`, raw]));
const LCO = "content/registry/primer/lco1490.md";
const SLUG = "coi-primers";
const PAGE = `https://example.com/research/protocols/${SLUG}`;

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const gitEnv = () => env as unknown as Parameters<typeof saveRegistryItem>[0];
const operator = { kind: "operator", id: "test" } as const;
const carrel = { kind: "carrel", changeId: "chg-primer" } as const;

let gh: GitHubStub;
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM procedures").run();
  await env.DB.prepare("DELETE FROM registry").run();
  // The REV primers name the Stewart paper, which is a publication of this site, so the repository holds its file.
  gh = stubGitHub({ [procedurePath(SLUG)]: coi, ...registryFiles, "content/publications/10-7589-2018-08-187.md": "x" });
  purge.mockClear();
});
afterEach(() => {
  gh.restore();
});

const save = async () => {
  const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: coi });
  expect(saved.ok, JSON.stringify(saved)).toBe(true);
};
const record = async () => (await pageLoader({ request: new Request(PAGE), context: routeContext(), params: { slug: SLUG } } as never)).record;
const stored = async () =>
  JSON.parse((await env.DB.prepare("SELECT record FROM procedures WHERE slug = ?1").bind(SLUG).first<{ record: string }>())?.record ?? "{}") as {
    primers: Array<{ id: string; sequence: string | null }>;
  };

describe("a protocol that names its primers by id", () => {
  it("compiles with the registry's facts in its record, and the file holds no sequence", { timeout: 120_000 }, async () => {
    expect(coi).not.toContain("GGTCAACAAATCATAAAGATATTGG");
    await save();
    const { primers } = await stored();
    expect(primers.map((p) => p.id)).toEqual(["lco1490", "hco2198"]);
    expect(primers[0]).toMatchObject({ name: "LCO1490", direction: "forward", sequence: "GGTCAACAAATCATAAAGATATTGG" });
  });

  it("prints a Primers section on the page: each primer linked to its record, its sequence, length and Tm estimate, and the NEB link", { timeout: 120_000 }, async () => {
    await save();
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: await record(), count: 1, factor: 1 }));
    const section = /<section aria-labelledby="primers">[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(section).toContain('id="primers"');
    expect(section).toContain('<a href="/research/lab/primers/lco1490">LCO1490</a>');
    expect(section).toContain("GGTCAACAAATCATAAAGATATTGG");
    expect(section).toContain("Tm estimate (°C)");
    expect(section).toContain("53");
    expect(section).toContain('href="https://tmcalculator.neb.com/"');
    expect(html).not.toContain("Primer sequences");
  });

  it("never presents the computed Tm as an annealing temperature", { timeout: 120_000 }, async () => {
    await save();
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: await record(), count: 1, factor: 1 }));
    const section = /<section aria-labelledby="primers">[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(section).toContain("The Tm estimate is not an annealing temperature.");
    // With the sentences that say so removed, the section never says annealing at all.
    const rest = section
      .replace("The Tm estimate is not an annealing temperature.", "")
      .replace("For the annealing temperature of a particular polymerase, use the", "");
    expect(rest).not.toMatch(/annealing/i);
  });

  it("prints the sequences on the bench sheet without the estimate, and in the markdown twin", { timeout: 120_000 }, async () => {
    await save();
    const sheet = renderToStaticMarkup(createElement(ProcedureSheet, { record: await record(), count: 1, factor: 1, address: PAGE }));
    expect(sheet).toContain("<h2>Primers</h2>");
    expect(sheet).toContain("TAAACTTCAGGGTGACCAAAAAATCA");
    expect(sheet).not.toContain("Tm estimate");
    const twin = await (await twinLoader({ request: new Request(`${PAGE}.md`), context: routeContext(), params: { slug: SLUG } } as never) as Response).text();
    expect(twin).toContain("## Primers");
    expect(twin).toContain("| [LCO1490](/research/lab/primers/lco1490) | forward | `GGTCAACAAATCATAAAGATATTGG` |");
  });

  it("is refused, naming the primer, when the registry does not hold it", { timeout: 120_000 }, async () => {
    gh.files.delete("content/registry/primer/hco2198.md");
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: coi });
    expect(saved.ok).toBe(false);
    expect(JSON.stringify(saved)).toMatch(/primers\[hco2198\] names no primer in the lab registry/);
  });
});

describe("a change to a primer reaches the protocols that print it", () => {
  it("a registry save rewrites the protocol's row from its file, and purges the registry and the procedures", { timeout: 120_000 }, async () => {
    await save();
    purge.mockClear();
    const edited = (registryFiles[LCO] ?? "").replace("GGTCAACAAATCATAAAGATATTGG", "GGTCAACAAATCATAAAGATATTGA");
    expect(edited).not.toBe(registryFiles[LCO]);
    await saveRegistryItem(gitEnv(), { slug: "primer/lco1490", raw: edited, isNew: false, actor: carrel });
    expect((await stored()).primers[0]?.sequence).toBe("GGTCAACAAATCATAAAGATATTGA");
    const tags = purge.mock.calls.flatMap(([options]) => options.tags);
    expect(tags).toContain("registry");
    expect(tags).toContain("procedures");
  });

  it("a primer made a draft stops the save, naming the protocol that can no longer print it", { timeout: 120_000 }, async () => {
    await save();
    const draft = (registryFiles[LCO] ?? "").replace("name: ", "draft: true\nname: ");
    await expect(saveRegistryItem(gitEnv(), { slug: "primer/lco1490", raw: draft, isNew: false, actor: carrel })).rejects.toThrow(
      /coi-primers no longer compiles[\s\S]*is a draft in the lab registry/,
    );
  });

  it("sync_registry recompiles every protocol that names a primer, so an edit made through git reaches it", { timeout: 120_000 }, async () => {
    await save();
    gh.files.set(LCO, (registryFiles[LCO] ?? "").replace("GGTCAACAAATCATAAAGATATTGG", "GGTCAACAAATCATAAAGATATTGC"));
    const synced = await runTool(operatorEnv(), operator, "sync_registry", {});
    expect(synced.ok, JSON.stringify(synced)).toBe(true);
    if (synced.ok) expect(synced.data).toMatchObject({ protocolsRefreshed: 1 });
    expect((await stored()).primers[0]?.sequence).toBe("GGTCAACAAATCATAAAGATATTGC");
  });
});

describe("a published version keeps the sequence it was published with", () => {
  it("freezes the primers into the copy, and a later change to the primer moves the live protocol and not the frozen version", { timeout: 120_000 }, async () => {
    const versioned = coi.replace(/^version: .*$/m, 'version: "1"\nhistory:\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.');
    expect(versioned).not.toBe(coi);
    gh.files.set(procedurePath(SLUG), versioned);
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: versioned });
    expect(saved.ok, JSON.stringify(saved)).toBe(true);
    const frozen = async () =>
      JSON.parse((await env.DB.prepare("SELECT record FROM procedure_versions WHERE slug = ?1 AND version = '1'").bind(SLUG).first<{ record: string }>())?.record ?? "{}") as {
        primers: Array<{ sequence: string | null }>;
      };
    expect((await frozen()).primers[0]?.sequence).toBe("GGTCAACAAATCATAAAGATATTGG");

    const edited = (registryFiles[LCO] ?? "").replace("GGTCAACAAATCATAAAGATATTGG", "GGTCAACAAATCATAAAGATATTGA");
    await saveRegistryItem(gitEnv(), { slug: "primer/lco1490", raw: edited, isNew: false, actor: carrel });
    expect((await stored()).primers[0]?.sequence).toBe("GGTCAACAAATCATAAAGATATTGA");
    expect((await frozen()).primers[0]?.sequence).toBe("GGTCAACAAATCATAAAGATATTGG");
  });
});
