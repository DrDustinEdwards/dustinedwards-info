/**
 * Gate for the chart directive: determinism, Node-versus-Worker parity and the emitted contract.
 *
 *   npm run check:charts
 *
 * BOUNDARY: it bundles the chart module ALONE and never looks at a chart in a browser, so nothing
 * here sees whether one is legible or correctly scaled.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import {
  CHART_SERIES_TOKENS,
  buildChartModel,
  renderChartHast,
} from "../app/lib/content/chart.mjs";
import { KNOWN_DIRECTIVES, renderBody } from "../app/lib/content/pipeline.mjs";
import { assertFloor } from "./lib/floor.mjs";

const HERE = fileURLToPath(import.meta.url);

/** How many times one fixture is rendered in-process. Matches the ruling probe. */
const IN_PROCESS_RENDERS = 200;
/** How many separate processes render the fixtures. The ruling requires >= 3. */
const CHILD_PROCESSES = 3;

let passed = 0;
let failed = 0;

/** @param {boolean} ok @param {string} message */
function assertThat(ok, message) {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  FAIL ${message}`);
  }
}

/**
 * Asserts that rendering throws, and that the message names the reason. A rule with no paired
 * negative is not a verified rule.
 *
 * @param {string} label
 * @param {Record<string, any>} attrs an omitted attribute is `undefined`, which
 *   is exactly what the directive hands over when an author leaves it out
 * @param {string} csv
 * @param {RegExp} expected
 */
function assertRejects(label, attrs, csv, expected) {
  try {
    buildChartModel(attrs, csv);
    failed += 1;
    console.error(`  FAIL ${label}: expected a validation failure, got none`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (expected.test(message)) {
      passed += 1;
    } else {
      failed += 1;
      console.error(`  FAIL ${label}: message did not match ${expected}. Got: ${message}`);
    }
  }
}

const SINGLE_CSV = "label,refused\nsequential 36,0\nconcurrent 45,19\nsync DO 14,11";
const MULTI_CSV = "run,allowed,refused\n1,5,7\n2,8,4\n3,3,9\n4,6,6";

/**
 * One fixture per mark type, in both the single and multi-series shape, because
 * the two take different code paths (multi-series adds direct labels, and bar
 * facets rather than labeling at a point).
 */
export const FIXTURES = ["bar", "line", "dot", "area"].flatMap((type) => [
    {
      name: `${type}/single`,
      attrs: { type, x: "label", y: "refused", title: "Refusals", alt: `A ${type} chart of refusals.` },
      csv: SINGLE_CSV,
    },
    {
      name: `${type}/multi`,
      attrs: { type, x: "run", y: "allowed,refused", title: "Outcomes", alt: `A ${type} chart of outcomes.` },
      csv: MULTI_CSV,
    },
]);

const serialize = (/** @type {any[]} */ children) =>
  unified().use(rehypeStringify).stringify({ type: "root", children });

/** Renders one fixture to the HTML the artifact would carry. */
export function renderFixture(/** @type {any} */ fixture) {
  return serialize(renderChartHast(buildChartModel(fixture.attrs, fixture.csv), []));
}

/** @param {string} value */
const sha = (value) => createHash("sha256").update(value).digest("hex");

/** Every fixture's hash, in fixture order. Shared by the parent and children. */
export function fixtureHashes() {
  return FIXTURES.map((fixture) => sha(renderFixture(fixture)));
}

// A child process asks for hashes and prints them. Same file, so the child is
// provably running the same code the parent is asserting about.
if (process.argv.includes("--hashes")) {
  process.stdout.write(JSON.stringify(fixtureHashes()));
  process.exit(0);
}

/** Bundles the chart module for workerd and returns the SVG hashes it produces. */
async function workerHashes() {
  const { build } = await import("esbuild");
  const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");

  const entry = `
    import { buildChartModel, renderChartHast } from ${JSON.stringify(
      fileURLToPath(new URL("../app/lib/content/chart.mjs", import.meta.url)).replace(/\\/g, "/"),
    )};
    import rehypeStringify from "rehype-stringify";
    import { unified } from "unified";
    const FIXTURES = ${JSON.stringify(FIXTURES)};
    export default {
      async fetch() {
        const out = FIXTURES.map((f) =>
          unified().use(rehypeStringify).stringify({
            type: "root",
            children: renderChartHast(buildChartModel(f.attrs, f.csv), []),
          }),
        );
        return Response.json(out);
      },
    };
  `;

  const bundled = await build({
    stdin: { contents: entry, resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "js" },
    bundle: true,
    format: "esm",
    target: "es2022",
    // The same resolution conditions the Cloudflare Vite plugin uses, so the
    // bundle takes the branches the real Worker takes.
    conditions: ["workerd", "worker", "browser", "import", "default"],
    platform: "neutral",
    mainFields: ["module", "main"],
    write: false,
  });

  // Block comments come out FIRST. The config opens with one, and stripping only
  // line comments leaves `/**` as the first token, which is the same trap
  // check:contrast hit when its parser found prose in a comment before the real
  // declaration.
  /*
   * WEAK ON PURPOSE: this is JSONC on its way to a parser, and the shared strong stripper's
   * line-comment rule eats a protocol-relative url. Weak is SUFFICIENT, the parser throwing on any
   * comment this fails to remove, so an under-strip cannot pass quietly.
   */
  const compat = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  );

  /*
   * THROUGH THE LIBRARY'S OWN CONVERTER: a major version reshaped the constructor and refuses the
   * pair this used to pass. The options then stay in a shape a reader can compare against the
   * wrangler config beside them, and the translation is the library's. Found by RUNNING.
   */
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundled.outputFiles[0].text,
      compatibilityDate: compat.compatibility_date,
      compatibilityFlags: compat.compatibility_flags ?? [],
    }),
  );
  try {
    const response = await mf.dispatchFetch("http://localhost/");
    const rendered = /** @type {string[]} */ (await response.json());
    return rendered.map(sha);
  } finally {
    await mf.dispose();
  }
}

async function main() {
  console.log("check:charts");

  /*
   * SCOPE FLOOR. Every block below iterates the fixtures, and an empty list makes all three agree
   * about nothing, the two that compare hashes saying "identical" loudest. The executed-count floor
   * is a floor on OUTPUT and this on INPUT. EXACT rather than under, uniquely here, because this
   * list is CONSTRUCTED: the mark types crossed with the two shapes.
   */
  assertThat(
    FIXTURES.length >= 8,
    `only ${FIXTURES.length} fixture(s), expected the four mark types in both shapes. ` +
      `Every determinism and parity comparison below would agree by comparing nothing.`,
  );

  // 1. Determinism, in-process.
  /** @type {string[]} */
  const baseline = [];
  for (const fixture of FIXTURES) {
    /** @type {Set<string>} */
    const seen = new Set();
    for (let i = 0; i < IN_PROCESS_RENDERS; i += 1) seen.add(sha(renderFixture(fixture)));
    assertThat(
      seen.size === 1,
      `${fixture.name}: ${IN_PROCESS_RENDERS} renders produced ${seen.size} distinct outputs, expected 1`,
    );
    baseline.push([...seen][0]);
  }
  console.log(`  determinism: ${FIXTURES.length} fixtures x ${IN_PROCESS_RENDERS} renders, 1 output each`);

  // 2. Determinism, across processes.
  for (let i = 0; i < CHILD_PROCESSES; i += 1) {
    const out = execFileSync(process.execPath, [HERE, "--hashes"], { encoding: "utf8" });
    /** @type {string[]} */
    const childHashes = JSON.parse(out);
    assertThat(
      childHashes.length === baseline.length &&
        childHashes.every((hash, j) => hash === baseline[j]),
      `child process ${i + 1} produced different hashes than the parent`,
    );
  }
  console.log(`  determinism: ${CHILD_PROCESSES} separate processes agree`);

  // 3. Node vs Worker parity, under real workerd.
  const worker = await workerHashes();
  assertThat(worker.length === baseline.length, "worker returned a different fixture count");
  FIXTURES.forEach((fixture, i) => {
    assertThat(
      worker[i] === baseline[i],
      `${fixture.name}: workerd SHA-256 ${worker[i]?.slice(0, 16)} != node ${baseline[i].slice(0, 16)}`,
    );
  });
  console.log(`  parity: ${FIXTURES.length} fixtures byte-identical between node and workerd`);

  // 4. The directive contract.
  for (const fixture of FIXTURES) {
    const html = renderFixture(fixture);
    const multi = fixture.attrs.y.includes(",");

    assertThat(!/#[0-9a-fA-F]{3,8}\b/.test(html), `${fixture.name}: chart output contains a hex color literal`);
    assertThat(
      /<svg[^>]*\srole="img"/.test(html),
      `${fixture.name}: the SVG is missing role="img"`,
    );
    // The name must be on the SVG, never on the figure: the image role makes its descendants
    // presentational, so naming the figure hides the caption and the data table.
    const label = html.match(/<svg[^>]*\saria-label="([^"]*)"/)?.[1];
    assertThat(
      typeof label === "string" && label.length > 0,
      `${fixture.name}: the SVG has no non-empty aria-label`,
    );
    assertThat(label === fixture.attrs.alt, `${fixture.name}: aria-label does not carry the alt text`);
    assertThat(
      !/<figure[^>]*\srole="img"/.test(html),
      `${fixture.name}: role="img" is on the figure, which hides the data table from assistive tech`,
    );
    assertThat(
      /<details class="chart-data"><summary>Data table<\/summary><table>/.test(html),
      `${fixture.name}: the equivalent data table is missing`,
    );
    assertThat(
      html.indexOf("<details") > html.indexOf("</svg>"),
      `${fixture.name}: the data table must follow the chart, not precede it`,
    );
    assertThat(!/swatch|-legend/.test(html), `${fixture.name}: charts label series directly, never with a legend`);

    // The model reshapes data internally, and those names must never surface as an axis label: the
    // default prints the data structure rather than the thing measured.
    const svg = html.slice(html.indexOf("<svg"), html.indexOf("</svg>"));
    assertThat(
      !/>\s*[↑→]?\s*value\s*</.test(svg),
      `${fixture.name}: the internal "value" name leaked into an axis label`,
    );
    assertThat(!/>\s*x\s*</.test(svg), `${fixture.name}: the internal "x" name leaked into an axis label`);
    // A linear x scale prints the label with a trailing arrow ("run →"); a band
    // scale prints it bare. Both are the label, so the arrow is optional here.
    assertThat(
      new RegExp(`>\\s*${fixture.attrs.x}\\s*→?\\s*<`).test(svg),
      `${fixture.name}: the x axis is not labeled with the author's column name "${fixture.attrs.x}"`,
    );
    if (!multi) {
      assertThat(
        new RegExp(`>\\s*↑\\s*${fixture.attrs.y}\\s*<`).test(svg),
        `${fixture.name}: the y axis is not labeled with the author's column name "${fixture.attrs.y}"`,
      );
    }
    assertThat(
      !/<h[1-6][\s>]/.test(html),
      `${fixture.name}: a heading here would inject the chart title into the post's table of contents`,
    );
    if (multi) {
      // design-tokens.md rule 3: hue is never the sole channel.
      for (const series of ["allowed", "refused"]) {
        assertThat(
          new RegExp(`>${series}<`).test(html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))),
          `${fixture.name}: series "${series}" has no direct label on the chart`,
        );
      }
      assertThat(
        html.includes(CHART_SERIES_TOKENS[0]) && html.includes(CHART_SERIES_TOKENS[1]),
        `${fixture.name}: series are not drawn from the ratified palette ladder`,
      );
    } else {
      assertThat(html.includes(CHART_SERIES_TOKENS[0]), `${fixture.name}: single series is not the first ladder token`);
    }
  }

  // Every token used is a real chart token from the ratified ladder.
  for (const token of CHART_SERIES_TOKENS) {
    assertThat(/^var\(--chart-[a-z]+\)$/.test(token), `palette token "${token}" is not a var(--chart-*) reference`);
  }

  // 5. The paired negatives. Each is a rule the contract states.
  const ok = { type: "bar", x: "label", y: "refused", alt: "An alt." };
  assertRejects("missing alt", { ...ok, alt: undefined }, SINGLE_CSV, /requires an alt attribute/);
  assertRejects("blank alt", { ...ok, alt: "   " }, SINGLE_CSV, /requires an alt attribute/);
  assertRejects("missing type", { ...ok, type: undefined }, SINGLE_CSV, /requires a type attribute/);
  assertRejects("unknown type", { ...ok, type: "pie" }, SINGLE_CSV, /is not one of/);
  assertRejects("missing x", { ...ok, x: undefined }, SINGLE_CSV, /requires an x attribute/);
  assertRejects("missing y", { ...ok, y: undefined }, SINGLE_CSV, /requires a y attribute/);
  assertRejects("unknown x column", { ...ok, x: "nope" }, SINGLE_CSV, /x column "nope" is not in the data/);
  assertRejects("unknown y column", { ...ok, y: "nope" }, SINGLE_CSV, /y column "nope" is not in the data/);
  assertRejects(
    "non-numeric value",
    { ...ok, x: "label", y: "refused" },
    "label,refused\na,many\n",
    /is "many", which is not a number/,
  );
  assertRejects("empty data", ok, "", /chart data is empty/);
  assertRejects("header with no rows", ok, "label,refused", /header but no rows/);
  assertRejects("ragged row", ok, "label,refused\na,1,2", /has 3 fields, expected 2/);
  assertRejects("duplicate columns", { ...ok, x: "a", y: "a" }, "a,a\n1,2", /duplicate column names/);
  assertRejects("empty column name", { ...ok, x: "label", y: "refused" }, "label,\na,1", /has an empty name/);
  assertRejects(
    "multi-series with an empty label",
    { type: "bar", x: "run", y: "allowed,refused", labels: "Allowed,", alt: "An alt." },
    MULTI_CSV,
    /must label every series/,
  );
  assertRejects(
    "multi-series with duplicate labels",
    { type: "bar", x: "run", y: "allowed,refused", labels: "Same,Same", alt: "An alt." },
    MULTI_CSV,
    /labels must be unique/,
  );
  assertRejects(
    "label count mismatch",
    { type: "bar", x: "run", y: "allowed,refused", labels: "OnlyOne", alt: "An alt." },
    MULTI_CSV,
    /2 series but 1 labels/,
  );
  assertRejects(
    "more series than palette tokens",
    { type: "bar", x: "x", y: "a,b,c,d,e,f,g", alt: "An alt." },
    "x,a,b,c,d,e,f,g\n1,1,2,3,4,5,6,7",
    /but the ratified palette has 6 chart colors/,
  );

  // 6. The directive inside the real pipeline, since that is how a post reaches it.
  const inPipeline = await renderBody({
    file: "check-charts",
    body: [
      ':::chart{type=bar x=label y=refused title="T" alt="An alt."}',
      "```csv",
      SINGLE_CSV,
      "```",
      "A *caption*.",
      ":::",
    ].join("\n"),
    resolveImage: async () => ({ width: 1, height: 1 }),
  });
  assertThat(
    /<figure class="chart-figure">/.test(inPipeline.html),
    "pipeline: the chart directive did not become a chart figure",
  );
  assertThat(!/data-chart/.test(inPipeline.html), "pipeline: the internal data-chart marker leaked into output");
  assertThat(
    /<figcaption><p>A <em>caption<\/em>.<\/p><\/figcaption>/.test(inPipeline.html),
    "pipeline: the caption was not rendered as markdown",
  );
  assertThat(inPipeline.toc.length === 0, "pipeline: a chart put an entry in the table of contents");

  // 7. Prose that only looks like a directive. The colon-digit bug.
  const prose = await renderBody({
    file: "check-charts",
    body: "Body text needs 4.5:1, large text 3:1, at 12:30 on localhost:8080.",
    resolveImage: async () => ({ width: 1, height: 1 }),
  });
  for (const literal of ["4.5:1", "3:1", "12:30", "localhost:8080"]) {
    assertThat(prose.html.includes(literal), `prose: "${literal}" did not survive directive parsing`);
  }
  assertThat(!/<div>/.test(prose.html), "prose: a colon-digit sequence still renders as an empty div");

  // Unknown directives fail closed: the renderer emits a bare element, so a typo publishes a silent
  // empty block where a figure was meant to be.
  const render = (/** @type {string} */ body) =>
    renderBody({ file: "check-charts", body, resolveImage: async () => ({ width: 1, height: 1 }) });

  for (const [label, body, needle] of [
    ["a typo'd container", ':::figrue{src="/a.png" alt="x"}\ncap\n:::', ":::figrue"],
    ["an unknown inline directive", "Inline :abbr[HTML] here.", ":abbr"],
    ["a numeric container", ":::99\nbody\n:::", ":::99"],
  ]) {
    try {
      await render(body);
      failed += 1;
      console.error(`  FAIL ${label} did not fail the build`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assertThat(message.includes(needle), `${label}: the error does not name "${needle}". Got: ${message}`);
      assertThat(/on line \d+/.test(message), `${label}: the error does not name a line`);
      assertThat(
        message.includes(KNOWN_DIRECTIVES.join(", ")),
        `${label}: the error does not list the known directives`,
      );
    }
  }

  // The escape hatch the error message advertises has to actually work, or the
  // advice in it is wrong.
  const escaped = await render("A note\\:this is important.");
  assertThat(escaped.html.includes("note:this"), "an escaped colon did not survive as text");
  assertThat(!/<div>/.test(escaped.html), "an escaped colon still produced a div");

  /*
   * And the known ones still render, so the check is not refusing everything. TWO ASSERTIONS RATHER
   * THAN ONE ADJACENCY: this pinned two tags as neighbors and went red when body images started
   * being wrapped in a link. A control that pins markup BETWEEN the things it cares about fails on
   * changes it has no opinion about.
   */
  const known = await render(':::figure{src="/dustin-edwards-og-image.png" alt="x"}\ncap\n:::');
  assertThat(
    known.html.startsWith("<figure>"),
    `the figure directive stopped producing a figure. Got: ${known.html.slice(0, 80)}`,
  );
  assertThat(
    /<img[^>]*src="\/dustin-edwards-og-image\.png"/.test(known.html),
    `the figure directive stopped rendering its image. Got: ${known.html.slice(0, 160)}`,
  );

  /*
   * EXECUTED-COUNT FLOOR. This gate is ASYNC and spawns a bundler and a worker runtime, the shape
   * most able to skip silently: an await resolving to an empty fixture list, a parity block
   * returning early, a determinism loop running zero renders, all leaving the count at zero.
   * MEASURED BY RUNNING IT, never summed.
   */
  const MINIMUM_PASSED = 173;
  const floorBreach = assertFloor("check:charts", "passed", passed, MINIMUM_PASSED);
  if (floorBreach) {
    failed += 1;
    console.error(`  FAIL  ${floorBreach}`);
  }

  console.log(`check:charts ${failed === 0 ? "ok" : "FAILED"}. ${passed} assertions passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`check:charts failed. ${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
