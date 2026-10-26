import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProcedureView } from "~/components/procedure";
import { runTool } from "~/lib/operator/api.server";
import { lineageFor } from "~/kb/procedures/lineage.server";
import { procedureJsonLd } from "~/kb/procedures/json-ld.mjs";
import { procedurePath } from "~/kb/procedures/parse.mjs";
import { loader as pageLoader } from "~/routes/procedure";
import { loader as twinLoader } from "~/routes/procedure[.md]";

import isolation from "../../content/procedures/phage-isolation.md?raw";

import { routeContext } from "./route-helpers";
import { stubSources, type SourceStub } from "./source-stub";
import { equipmentRepoFiles, reagentRepoFiles, strainRepoFiles } from "./seed";

/* A variant's lineage (docs/KNOWLEDGE-BASE.md, P3): a procedure copied with Duplicate names its parent and the version it
 * was copied at. Published, it must point at a version that is frozen; its page, twin and JSON-LD name the parent by its
 * title and link the frozen copy. The parent is the repository's phage-isolation, given a version here. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const PARENT = "/research/protocols/phage-isolation";
const CHILD = "isolation-variant";
const CHILD_PATH = `/research/protocols/${CHILD}`;

const V1 = isolation.replace(/^version: .*$/m, 'version: "1"\nhistory:\n  - version: "1"\n    date: 2026-09-01\n    summary: First version.');
const variant = (draft: boolean) =>
  isolation
    .replace(/^path: .*$/m, `path: ${CHILD_PATH}`)
    .replace(/^title: .*$/m, 'title: "Phage Isolation, a Variant"\nforked_from:\n  slug: phage-isolation\n  version: "1"')
    .replace(/^start_here: 1\n/m, "")
    .replace(/^draft: .*\n/m, "")
    .replace(/^path: /m, `draft: ${draft}\npath: `);

let gh: SourceStub;
beforeEach(async () => {
  // The variant is already in the repository, published, so a save is an edit: an operator never makes a first publication.
  gh = await stubSources({ [procedurePath("phage-isolation")]: isolation, [procedurePath(CHILD)]: variant(false), ...strainRepoFiles, ...reagentRepoFiles, ...equipmentRepoFiles });
});
afterEach(async () => {
  await gh.restore();
});

const save = (slug: string, raw: string) => runTool(operatorEnv(), operator, "save_procedure", { slug, raw });

describe("a variant's lineage", () => {
  it("is published only from a frozen version of its parent; a draft may wait for one", { timeout: 240_000 }, async () => {
    const early = await save(CHILD, variant(false));
    expect(early.ok).toBe(false);
    expect(JSON.stringify(early)).toContain("forked_from names version 1 of phage-isolation, which has no frozen copy");
    const draft = await save(CHILD, variant(true));
    expect(draft.ok, JSON.stringify(draft)).toBe(true);
  });

  it("names its parent by title, linked to the frozen copy, on the page, in the twin and in the JSON-LD", { timeout: 240_000 }, async () => {
    expect((await save("phage-isolation", V1)).ok).toBe(true);
    const published = await save(CHILD, variant(false));
    expect(published.ok, JSON.stringify(published)).toBe(true);

    const out = await pageLoader({ request: new Request(`https://example.com${CHILD_PATH}`), context: routeContext(), params: {} } as never);
    expect(out.lineage).toEqual({ title: "Phage Isolation and Purification Protocol", href: `${PARENT}/v/1`, version: "1" });
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: out.record, count: 1, factor: 1, lineage: out.lineage }));
    expect(html).toContain(`<dt>Based on</dt><dd><a href="${PARENT}/v/1">Phage Isolation and Purification Protocol, version 1</a></dd>`);

    const person = { "@type": "Person", "@id": "https://example.com/#person", name: "D", url: "https://example.com" };
    const ld = procedureJsonLd(out.record, "https://example.com", person, out.lineage) as { isBasedOn: Array<Record<string, unknown>> };
    expect(ld.isBasedOn[0]).toEqual({ "@type": "CreativeWork", name: "Phage Isolation and Purification Protocol", url: `https://example.com${PARENT}/v/1`, version: "1" });

    const twin = await ((await twinLoader({ request: new Request(`https://example.com${CHILD_PATH}.md`), context: routeContext(), params: {} } as never)) as Response).text();
    expect(twin).toContain(`- Based on: [Phage Isolation and Purification Protocol, version 1](https://dustinedwards.info${PARENT}/v/1)\n`);
    expect(twin).not.toContain("- Based on: phage-isolation, version 1");
  });

  it("names a parent that is a draft by its file name alone, unlinked, so no draft's title or address shows", { timeout: 240_000 }, async () => {
    const hidden = await save("phage-isolation", isolation.replace(/^path: /m, "draft: true\npath: "));
    expect(hidden.ok, JSON.stringify(hidden)).toBe(true);
    const lineage = await lineageFor(env as never, { forkedFrom: { slug: "phage-isolation", version: null }, profile: "protocol" });
    expect(lineage).toEqual({ title: "phage-isolation", href: null, version: null });
  });
});
