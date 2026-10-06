import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import SheetRoute, { loader as sheetLoader } from "~/routes/procedure.sheet";
import VersionSheetRoute, { loader as versionSheetLoader } from "~/routes/procedure.version.sheet";

import isolation from "../../content/procedures/phage-isolation.md?raw";

import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { reagentRepoFiles, strainRepoFiles } from "./seed";

/* The printed bench sheet (docs/PROCEDURES.md): its head carries the version id and date, and its QR code opens the
 * frozen copy of that exact version, so a sheet printed now still opens the words it was printed from after the page has
 * moved on, and a sheet reprinted from an old version opens that version. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const SLUG = "phage-isolation";
const PATH = `/research/protocols/${SLUG}`;
const ORIGIN = "https://dustinedwards.info";

const V1 = isolation.replace(
  /^version: .*$/m,
  'version: "1"\nhistory:\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.',
);
const V2 = isolation
  .replace(
    /^version: .*$/m,
    'version: "2"\nhistory:\n  - version: "2"\n    date: 2026-10-01\n    summary: Seven plates, not six.\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.',
  )
  .replace("Pour 5 to 10 replicate plates", "Pour 6 to 10 replicate plates");

let gh: GitHubStub;
beforeEach(() => {
  gh = stubGitHub({ [procedurePath(SLUG)]: isolation, ...strainRepoFiles, ...reagentRepoFiles });
});
afterEach(() => {
  gh.restore();
});

const save = async (raw: string) => expect((await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw })).ok).toBe(true);
// The routes' own components, so the address each draws is the one the route computes.
const liveSheet = async () => {
  const loaderData = await sheetLoader({ request: new Request(`https://example.com${PATH}/sheet`), context: routeContext(), params: {} } as never);
  return { loaderData, html: renderToStaticMarkup(createElement(SheetRoute, { loaderData } as never)) };
};
const versionSheet = async (version: string) => {
  const loaderData = await versionSheetLoader({
    request: new Request(`https://example.com${PATH}/v/${version}/sheet`),
    context: routeContext(),
    params: {},
  } as never);
  return { loaderData, html: renderToStaticMarkup(createElement(VersionSheetRoute, { loaderData } as never)) };
};

describe("the printed sheet", () => {
  it("opens the frozen copy of the version it prints, with that version's id and date", { timeout: 240_000 }, async () => {
    await save(V1);
    await save(V2);
    // The live sheet is the current version, version 2, and its code opens that version's copy.
    const { html: sheet } = await liveSheet();
    expect(sheet).toContain(`role="img" aria-label="QR code for ${ORIGIN}${PATH}/v/2"`);
    expect(sheet).toMatch(/<figure class="procedure-sheet-qr"><div[^>]*><svg /);
    expect(sheet).toContain(`Version 2, 2026-10-01. ${ORIGIN}${PATH}/v/2`);
    expect(sheet).toContain("Pour 6 to 10 replicate plates");
    expect(sheet).not.toContain("phage-tool");
  });

  it("serves the sheet of an old version from its frozen copy, and its code opens that old version", { timeout: 240_000 }, async () => {
    await save(V1);
    await save(V2);
    const { loaderData, html } = await versionSheet("1");
    expect(loaderData.record.version).toBe("1");
    expect(html).toContain(`aria-label="QR code for ${ORIGIN}${PATH}/v/1"`);
    expect(html).toContain(`Version 1, 2026-09-01. ${ORIGIN}${PATH}/v/1`);
    expect(html).toContain("Pour 5 to 10 replicate plates");
    expect(html).not.toContain("Pour 6 to 10 replicate plates");
    await expect(versionSheet("9")).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("points a sheet with no published version at the page, and says no version is assigned", { timeout: 180_000 }, async () => {
    await save(isolation);
    const { loaderData, html } = await liveSheet();
    expect(loaderData.record.version).toBeNull();
    expect(html).toContain(`aria-label="QR code for ${ORIGIN}${PATH}"`);
    expect(html).toContain("Version not yet assigned");
  });
});
