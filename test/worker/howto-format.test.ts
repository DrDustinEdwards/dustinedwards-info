import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ProcedureSheet, ProcedureView } from "~/components/procedure";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { compileProcedure } from "~/kb/procedures/compile.mjs";
import type { ProcedureRecord } from "~/kb/procedures/render.mjs";

import fixture from "../fixtures/procedures/tutorial-fixture.md?raw";

/* A software how-to's page (docs/KNOWLEDGE-BASE.md, step 10), as served with no script: its type, a tutorial's overview
 * first and key points last, each platform's command under a link, and a challenge's solution folded in a <details>. */

let record: ProcedureRecord;

beforeAll(async () => {
  const { renderBody, findWideDashes } = await loadPipeline();
  const compiled = await compileProcedure({ slug: "tutorial-fixture", raw: fixture, pipeline: { renderBody, findWideDashes } });
  if (!compiled.ok) throw new Error(compiled.errors.join("; "));
  record = compiled.record;
}, 120_000);

const page = () => renderToStaticMarkup(createElement(ProcedureView, { record, count: 0, factor: 1 }));

describe("a software how-to's page", () => {
  it("says it is a tutorial, opens with its questions and objectives, and ends with its key points", () => {
    const html = page();
    expect(html).toContain("<dt>Type</dt><dd>Tutorial</dd>");
    const overview = html.indexOf('id="overview"');
    const method = html.indexOf('id="count-the-reads"');
    const keyPoints = html.indexOf('id="key-points"');
    expect(overview).toBeGreaterThan(-1);
    expect(overview).toBeLessThan(method);
    expect(keyPoints).toBeGreaterThan(method);
    expect(html).toContain('<h3 id="objectives">Objectives</h3>');
    expect(html).toContain('<a href="https://en.wikipedia.org/wiki/FASTA_format">The FASTA format</a>');
  });

  it("shows every platform's command with no script, each under a link the tabs are made from", () => {
    const html = page();
    const links = [...html.matchAll(/<a href="#(count-the-reads-0-step-2-0-(\w+))" data-platform="\2">/g)].map((m) => m[2]);
    expect(links).toEqual(["linux", "macos", "windows"]);
    for (const platform of links) expect(html).toContain(`id="count-the-reads-0-step-2-0-${platform}" class="procedure-platform"`);
    expect(html).toContain("(Select-String -Pattern &#x27;^&gt;&#x27; -Path reads.fasta).Count");
    // The panels are all there and none is hidden: hiding is the script's, so a page with none shows them all.
    expect(html).not.toMatch(/class="procedure-platform"[^>]*hidden/);
    expect(html).toContain('<template data-enhance="');
  });

  it("folds a challenge's solution into a <details>, which opens with no script", () => {
    const html = page();
    expect(html).toMatch(/<strong class="procedure-flag-label">Challenge\.<\/strong><div><p>Add a fourth read/);
    expect(html).toMatch(/<details class="procedure-solution"><summary>Solution<\/summary><div><p>The count is 4/);
  });

  it("prints every platform's command on the sheet, with no tabs", () => {
    const sheet = renderToStaticMarkup(createElement(ProcedureSheet, { record, count: 0, factor: 1, address: "https://example.com/x" }));
    expect(sheet).not.toContain("procedure-platform-tabs");
    expect([...sheet.matchAll(/<p class="procedure-platform-label">(\w+)<\/p>/g)].map((m) => m[1])).toEqual(["Linux", "macOS", "Windows", "Linux", "macOS", "Windows"]);
  });
});
