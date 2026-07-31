/**
 * Gate for the chart directive.
 *
 * `check:content` already byte-compares the artifact, so it catches a chart
 * whose SVG was hand-edited or has gone stale. What it CANNOT catch is a chart
 * renderer that is not deterministic: a generator that emits a different SVG on
 * every run makes the byte-comparison gate fail at random, which is exactly the
 * failure the shiki JavaScript-engine incident produced and the reason
 * oniguruma is a dependency. This gate proves the property that makes
 * `check:content` meaningful for charts.
 *
 * Four things are asserted:
 *
 *   1. **Determinism in-process.** Every fixture rendered 200 times must yield
 *      exactly one distinct output.
 *   2. **Determinism across processes.** The same fixtures rendered in three
 *      SEPARATE node processes must yield those same hashes. Module-level state
 *      and hash-order effects only show up across process boundaries.
 *   3. **Node vs Worker parity.** The two writers are a Node build script and a
 *      Cloudflare Worker, and the artifact they produce must be byte-identical
 *      or the editor commits HTML the next build will not reproduce. The Worker
 *      half runs the SAME module under real workerd, via miniflare.
 *   4. **The directive contract.** Palette tokens only, an accessible name on
 *      the SVG, a generated data table, no legend, and a validation failure for
 *      every rule the contract states.
 *
 * Pure apart from the workerd run: no database, no network, no GitHub.
 *
 * SCOPE NOTE, stated rather than implied. The parity run bundles
 * `app/lib/content/chart.mjs`, which is the whole of the new rendering surface
 * and the only part whose behaviour under workerd was ever in question (Plot and
 * linkedom). It deliberately does NOT re-bundle the markdown pipeline, because
 * that would drag in shiki's WASM module and end up testing the Vite plugin's
 * wasm handling rather than the chart renderer. The rest of the pipeline is
 * plain deterministic JavaScript shared by both callers, and the live sweep
 * exercises the full Worker path against a real deploy.
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
import { renderBody } from "../app/lib/content/pipeline.mjs";

const HERE = fileURLToPath(import.meta.url);

/** How many times one fixture is rendered in-process. Matches the ruling probe. */
const IN_PROCESS_RENDERS = 200;
/** How many separate processes render the fixtures. The ruling requires >= 3. */
const CHILD_PROCESSES = 3;

let passed = 0;
let failed = 0;

/** @param {boolean} condition @param {string} message */
function assert(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  FAIL ${message}`);
  }
}

/**
 * Asserts that rendering throws, and that the message names the reason.
 *
 * A rule with no paired negative is not a verified rule. Every contract rule
 * below has one of these.
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
 * facets rather than labelling at a point).
 */
export const FIXTURES = [
  ...["bar", "line", "dot", "area"].flatMap((type) => [
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
  ]),
];

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
  const { Miniflare } = await import("miniflare");

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
  const compat = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  );

  const mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: compat.compatibility_date,
    compatibilityFlags: compat.compatibility_flags ?? [],
  });
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

  // 1. Determinism, in-process.
  /** @type {string[]} */
  const baseline = [];
  for (const fixture of FIXTURES) {
    /** @type {Set<string>} */
    const seen = new Set();
    for (let i = 0; i < IN_PROCESS_RENDERS; i += 1) seen.add(sha(renderFixture(fixture)));
    assert(
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
    assert(
      childHashes.length === baseline.length &&
        childHashes.every((hash, j) => hash === baseline[j]),
      `child process ${i + 1} produced different hashes than the parent`,
    );
  }
  console.log(`  determinism: ${CHILD_PROCESSES} separate processes agree`);

  // 3. Node vs Worker parity, under real workerd.
  const worker = await workerHashes();
  assert(worker.length === baseline.length, "worker returned a different fixture count");
  FIXTURES.forEach((fixture, i) => {
    assert(
      worker[i] === baseline[i],
      `${fixture.name}: workerd SHA-256 ${worker[i]?.slice(0, 16)} != node ${baseline[i].slice(0, 16)}`,
    );
  });
  console.log(`  parity: ${FIXTURES.length} fixtures byte-identical between node and workerd`);

  // 4. The directive contract.
  for (const fixture of FIXTURES) {
    const html = renderFixture(fixture);
    const multi = fixture.attrs.y.includes(",");

    assert(!/#[0-9a-fA-F]{3,8}\b/.test(html), `${fixture.name}: chart output contains a hex colour literal`);
    assert(
      /<svg[^>]*\srole="img"/.test(html),
      `${fixture.name}: the SVG is missing role="img"`,
    );
    // The name must be on the SVG, never on the figure: role="img" makes its
    // descendants presentational, so naming the figure would hide the caption
    // and the data table from the readers the table exists for.
    const label = html.match(/<svg[^>]*\saria-label="([^"]*)"/)?.[1];
    assert(
      typeof label === "string" && label.length > 0,
      `${fixture.name}: the SVG has no non-empty aria-label`,
    );
    assert(label === fixture.attrs.alt, `${fixture.name}: aria-label does not carry the alt text`);
    assert(
      !/<figure[^>]*\srole="img"/.test(html),
      `${fixture.name}: role="img" is on the figure, which hides the data table from assistive tech`,
    );
    assert(
      /<details class="chart-data"><summary>Data table<\/summary><table>/.test(html),
      `${fixture.name}: the equivalent data table is missing`,
    );
    assert(
      html.indexOf("<details") > html.indexOf("</svg>"),
      `${fixture.name}: the data table must follow the chart, not precede it`,
    );
    assert(!/swatch|-legend/.test(html), `${fixture.name}: charts label series directly, never with a legend`);
    assert(
      !/<h[1-6][\s>]/.test(html),
      `${fixture.name}: a heading here would inject the chart title into the post's table of contents`,
    );
    if (multi) {
      // design-tokens.md rule 3: hue is never the sole channel.
      for (const series of ["allowed", "refused"]) {
        assert(
          new RegExp(`>${series}<`).test(html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))),
          `${fixture.name}: series "${series}" has no direct label on the chart`,
        );
      }
      assert(
        html.includes(CHART_SERIES_TOKENS[0]) && html.includes(CHART_SERIES_TOKENS[1]),
        `${fixture.name}: series are not drawn from the ratified palette ladder`,
      );
    } else {
      assert(html.includes(CHART_SERIES_TOKENS[0]), `${fixture.name}: single series is not the first ladder token`);
    }
  }

  // Every token used is a real chart token from the ratified ladder.
  for (const token of CHART_SERIES_TOKENS) {
    assert(/^var\(--chart-[a-z]+\)$/.test(token), `palette token "${token}" is not a var(--chart-*) reference`);
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
    /but the ratified palette has 6 chart colours/,
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
  assert(
    /<figure class="chart-figure">/.test(inPipeline.html),
    "pipeline: the chart directive did not become a chart figure",
  );
  assert(!/data-chart/.test(inPipeline.html), "pipeline: the internal data-chart marker leaked into output");
  assert(
    /<figcaption><p>A <em>caption<\/em>.<\/p><\/figcaption>/.test(inPipeline.html),
    "pipeline: the caption was not rendered as markdown",
  );
  assert(inPipeline.toc.length === 0, "pipeline: a chart put an entry in the table of contents");

  // 7. Prose that only looks like a directive. The colon-digit bug.
  const prose = await renderBody({
    file: "check-charts",
    body: "Body text needs 4.5:1, large text 3:1, at 12:30 on localhost:8080.",
    resolveImage: async () => ({ width: 1, height: 1 }),
  });
  for (const literal of ["4.5:1", "3:1", "12:30", "localhost:8080"]) {
    assert(prose.html.includes(literal), `prose: "${literal}" did not survive directive parsing`);
  }
  assert(!/<div>/.test(prose.html), "prose: a colon-digit sequence still renders as an empty div");

  console.log(`check:charts ${failed === 0 ? "ok" : "FAILED"}. ${passed} assertions passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`check:charts failed. ${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
