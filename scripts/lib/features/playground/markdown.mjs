// The markdown demo: every snippet through the renderer every post goes through, and the page
// reaches it only through the Worker's one door.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderBody } from "../../../../app/lib/content/pipeline.mjs";
import { root, stripped } from "../shared.mjs";

/** @param {import("./index.mjs").PlaygroundContext} p */
export async function checkMarkdown({ ok, snippets, deferredDemos, playgroundSource }) {
  const refuseImages = async (/** @type {string} */ src) => {
    throw new Error(`the markdown snippets cite no media, and one cites ${src}`);
  };

  for (const snippet of snippets) {
    const label = snippet.label ?? snippet.slug;
    const expect = snippet.expect ?? {};

    ok(
      `markdown: ${label} declares a slug, a source and a note`,
      typeof snippet.slug === "string" &&
        typeof snippet.source === "string" &&
        snippet.source.length > 0 &&
        typeof snippet.note === "string" &&
        snippet.note.trim().length > 0,
    );

    /* On the source: the resolver's throw names the wrong cause. */
    ok(
      `markdown: ${label} cites no media`,
      !/!\[[^\]]*\]\(/.test(snippet.source) && !/\/media\//.test(snippet.source),
      "the demo hands the renderer a resolver that refuses, so a media citation " +
        "would surface as a render failure naming the wrong cause",
    );

    let rendered = null;
    let refusal = null;
    try {
      rendered = await renderBody({
        file: `playground/${snippet.slug}.md`,
        body: snippet.source,
        resolveImage: refuseImages,
      });
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }

    ok(
      `markdown: ${label} ${expect.throws ? "is refused" : "renders"}`,
      (refusal !== null) === expect.throws,
      expect.throws
        ? `the pipeline accepted a snippet the demo says it must refuse`
        : `the pipeline refused it: ${refusal}`,
    );

    if (expect.throws) {
      ok(
        `markdown: ${label} refusal names the unknown directive`,
        typeof refusal === "string" && /unknown directive/i.test(refusal),
        `the message was ${JSON.stringify(refusal)}`,
      );
      continue;
    }
    if (!rendered) {
      ok(
        `markdown: ${label} rendered to something`,
        false,
        `renderBody resolved to ${JSON.stringify(rendered)} without throwing, so every ` +
          `per-snippet check below would have been skipped`,
      );
      continue;
    }

    const anchors = rendered.toc.map((/** @type {any} */ h) => h.id);
    ok(
      `markdown: ${label} collects ${JSON.stringify(expect.toc)}`,
      JSON.stringify(anchors) === JSON.stringify(expect.toc),
      `the pipeline collected ${JSON.stringify(anchors)}`,
    );
    ok(
      `markdown: ${label} demotes ${expect.blockedCount} URL(s)`,
      rendered.blockedUrls.length === expect.blockedCount,
      `the pipeline demoted ${JSON.stringify(
        rendered.blockedUrls.map((/** @type {any} */ b) => b.url),
      )}`,
    );

    /* Escaped text is fine; an attribute is not. */
    for (const blocked of rendered.blockedUrls) {
      ok(
        `markdown: ${label} demotes ${blocked.url} out of every attribute`,
        !new RegExp(`(?:href|src)="[^"]*${blocked.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(
          rendered.html,
        ),
        "the allowlist counted it and the document still carries it as a live URL",
      );
    }
  }

  ok(
    "markdown: a snippet is refused outright",
    snippets.some((/** @type {any} */ s) => s.expect?.throws === true),
    "without one, the fail-closed directive branch is never entered",
  );
  ok(
    "markdown: a snippet has a URL demoted",
    snippets.some((/** @type {any} */ s) => (s.expect?.blockedCount ?? 0) > 0),
    "without one, the URL allowlist is never exercised here",
  );
  ok(
    "markdown: a snippet renders headings into the table of contents",
    snippets.some((/** @type {any} */ s) => (s.expect?.toc ?? []).length > 0),
    "without one, the ordinary path is untested and only the refusals are shown",
  );

  /* The wrapper reaches the pipeline through `loadPipeline()`, the Worker's one door to the renderer,
     and that door is where the WASM instantiator is installed. */
  const snippetRendererSource = stripped(
    readFileSync(join(root, "app", "lib", "content", "render-snippet.server.ts"), "utf8"),
  );
  const pipelineDoorSource = stripped(
    readFileSync(join(root, "app", "lib", "content", "load-pipeline.server.ts"), "utf8"),
  );
  ok(
    "markdown: the page renders through the server wrapper",
    /\brenderSnippet\b/.test(playgroundSource) &&
      /from\s+["']~\/lib\/content\/render-snippet\.server["']/.test(playgroundSource),
    "the demo must go through the wrapper that installs the WASM instantiator",
  );
  ok(
    "markdown: the wrapper calls the renderer every post goes through",
    /\brenderBody\b/.test(snippetRendererSource) &&
      /from\s+["']\.\/load-pipeline\.server["']/.test(snippetRendererSource) &&
      /\bloadPipeline\s*\(/.test(snippetRendererSource) &&
      /import\(\s*["']\.\/pipeline\.mjs["']\s*\)/.test(pipelineDoorSource),
    "a second renderer here would demonstrate nothing: it would keep working " +
      "while the thing it claims to show was broken",
  );
  ok(
    "markdown: the wrapper loads the Worker's WASM instantiator",
    /import\(\s*["']\.\/wasm\.server["']\s*\)/.test(pipelineDoorSource) &&
      /\bsetWasmLoader\s*\(/.test(pipelineDoorSource),
    "without it the highlighter cannot start in a Worker, and the demo answers " +
      "every reader with a render failure",
  );
  ok(
    "markdown: the wrapper's image resolver refuses",
    /* Inside the resolver itself: a throw anywhere in the file is not this resolver refusing. */
    /resolveImage:\s*async\s*\([^)]*\)\s*=>\s*\{\s*throw new Error\(/.test(snippetRendererSource),
    "a resolver that reached a bucket on behalf of fixture text is a door this " +
      "demo has no reason to open",
  );
  /* The loader picks from manifest slugs, never a body from the URL. */
  ok(
    "markdown: the snippet is chosen from the manifest, never taken from the URL",
    /SNIPPET_SLUGS\.includes\(/.test(playgroundSource),
    "an unbounded body reaching renderBody is the surface the deferred entry " +
      "says needs a threat model first",
  );
  ok(
    "markdown: the loader passes no request text to the renderer",
    !/body:\s*(?:md|mdParam|params\.get)/.test(playgroundSource),
    "the renderer's body must come from a committed snippet and nothing else",
  );
  ok(
    "markdown: the page reports an unknown snippet rather than silently correcting",
    /Unknown snippet/.test(playgroundSource),
    "a hand-edited URL must say what happened, the same rule the chart demo follows",
  );
  ok(
    "markdown: the free-text form is still stated as deferred",
    deferredDemos.some(
      (/** @type {any} */ d) =>
        /markdown/i.test(d.slug ?? "") && /threat model/i.test(d.reason ?? ""),
    ),
    "the fixed-snippet demo shipping does not settle arbitrary text into the " +
      "highlighter, and the page must keep saying so",
  );
}
