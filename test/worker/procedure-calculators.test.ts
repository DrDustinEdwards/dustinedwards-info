import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProcedureSheet, ProcedureView } from "~/components/procedure";
import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/kb/procedures/parse.mjs";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as twinLoader } from "~/routes/procedure[.md]";

import isolation from "../../content/procedures/phage-isolation.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { equipmentRepoFiles, reagentRepoFiles, strainRepoFiles } from "./seed";

/* Calculators folded under the steps that name them (docs/PROCEDURES.md): what a reader, a machine and the printed
 * sheet are given. The file is the repository's own phage-isolation, whose steps 2, 3 and 4 name a calculator each. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const SLUG = "phage-isolation";
const PAGE = `https://example.com/research/protocols/${SLUG}`;

let gh: GitHubStub;
beforeEach(() => {
  gh = stubGitHub({ [procedurePath(SLUG)]: isolation, ...strainRepoFiles, ...reagentRepoFiles, ...equipmentRepoFiles });
});
afterEach(() => {
  gh.restore();
});

async function record(raw: string) {
  const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw });
  expect(saved.ok).toBe(true);
  const out = await pageLoader({ request: new Request(PAGE), context: routeContext(), params: { slug: SLUG } } as never);
  return out.record;
}

describe("calculators in a procedure's steps", () => {
  it("folds each named calculator under its step, with ids of its own and the answer in the HTML", { timeout: 120_000 }, async () => {
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: await record(isolation), count: 1, factor: 1 }));
    const folded = [...html.matchAll(/<details class="phage-tool phage-tool-step"><summary>Calculator: ([^<]+)<\/summary>/g)].map((m) => m[1]);
    expect(folded).toEqual(["Serial dilution planner", "Webbed plate calculator", "Titer calculator"]);
    // The embedded forms submit to the tool's own page, and no two controls share an id.
    expect(html).toContain('action="/research/tools/webbed-plate"');
    expect(html).toContain('data-tool-embedded=""');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // Computed on the server from the worked example, so a reader without script sees an answer.
    expect(html).toContain("phage-tool-answer");
    expect(html).toContain('data-enhance="');
  });

  it("fills a field from the step's own words and says so", { timeout: 120_000 }, async () => {
    const raw = isolation.replace("   > CALC: webbed-plate", "   > CALC: webbed-plate plates=10");
    expect(raw).not.toBe(isolation);
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: await record(raw), count: 1, factor: 1 }));
    expect(html).toMatch(/id="[^"]*webbed-plate-plates"[^>]*value="10"/);
    expect(html).toContain("except what this step states");
  });

  it("gives the machine the calculators in the twin, and leaves them off the printed sheet", { timeout: 120_000 }, async () => {
    const rec = await record(isolation);
    const twin = await (
      await twinLoader({ request: new Request(`${PAGE}.md`), context: routeContext(), params: { slug: SLUG } } as never)
    ).text();
    expect(twin).toContain("> Calculator: [Webbed plate calculator](/research/tools/webbed-plate)");
    expect(twin).toContain("> Calculator: [Titer calculator](/research/tools/titer)");
    const sheet = renderToStaticMarkup(createElement(ProcedureSheet, { record: rec, count: 1, factor: 1, address: PAGE }));
    expect(sheet).not.toContain("phage-tool");
  });
});
