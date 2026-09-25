import type { RootContent } from "hast";
import { Form, Link } from "react-router";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import playgroundData from "../../content/playground.json";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { CHART_TYPES } from "~/lib/content/chart-types.mjs";
/*
 * Behind a named server export: React Router's server-code removal traces names, so a bare
 * side-effect import failed the build.
 */
import { renderSnippet } from "~/lib/content/render-snippet.server";
import { apca, contrast, normalizeHex } from "~/lib/contrast.mjs";
import { getEnv } from "~/lib/context";
import {
  classify,
  cropSafe,
  digestFromKey,
  dimensionsFromKey,
  excludedFromAssets,
  isContentKey,
  isRaster,
  roleOf,
  storageOf,
} from "~/lib/media/classify.mjs";
import {
  PLAYGROUND_DESCRIPTION,
  PLAYGROUND_INTRO,
  PLAYGROUND_TITLE,
  PLAYGROUND_URL,
  demoAnchor,
} from "~/lib/playground-page.mjs";
import { search } from "~/lib/search/search.server";
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";
import {
  publicHtmlHeaders,
  pageMeta,
} from "~/lib/seo";

import type { Route } from "./+types/playground";

import "~/styles/prose.css";
import "~/styles/playground.css";
import { errorMessage } from "~/lib/error-message.mjs";

/**
 * Every demo runs the real code path, and every result is a server-rendered GET URL. No user input
 * is persisted. Hidden fields because three demos share one URL. Cache-Control is explicit: with the
 * Workers cache on, a response carrying none is cached.
 */

const DEMOS = playgroundData.demos;

/** From `content/playground.json`, which `check:features` asserts against; a copy here would let the gate check itself. */
const SWATCHES = playgroundData.swatches;
const DATASETS = playgroundData.datasets;
const KEY_PRESETS = playgroundData.keyPresets;
const COOKIE_PRESETS = playgroundData.cookiePresets;
const SNIPPETS = playgroundData.markdownSnippets;

/**
 * An enum, not a text box: the highlighter runs a WebAssembly regex engine that needs its own threat
 * model before it takes public input.
 */
const SNIPPET_SLUGS = SNIPPETS.map((s) => s.slug);


type DatasetKey = keyof typeof DATASETS;

const MARKS = CHART_TYPES;
type MarkKey = string;

const QUERY_CAP = 100;

/** Cut at this length and said so in the UI: an unstated cap is a silent truncation. */
const KEY_CAP = 120;

/** Printable ASCII only, refused rather than cut: a control character in a header value makes `new Request` throw. */
const COOKIE_CAP = 200;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

export function meta() {
  return pageMeta({
    title: `${PLAYGROUND_TITLE} | Dustin Edwards`,
    description: PLAYGROUND_DESCRIPTION,
    path: PLAYGROUND_URL,
  });
}

export function headers() {
  return publicHtmlHeaders();
}

const serialize = (children: RootContent[]) =>
  unified().use(rehypeStringify).stringify({ type: "root", children });

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const fgRaw = (params.get("fg") ?? "").trim();
  const bgRaw = (params.get("bg") ?? "").trim();
  let lab = null;
  let labError: string | null = null;

  if (fgRaw || bgRaw) {
    const fg = normalizeHex(fgRaw);
    const bg = normalizeHex(bgRaw);
    if (!fg || !bg) {
      const bad = [!fg ? "foreground" : null, !bg ? "background" : null]
        .filter(Boolean)
        .join(" and ");
      labError = `The ${bad} is not a hex color. Use three or six hex digits, like #4F2D7F.`;
    } else {
      const ratio = contrast(fg, bg);
      lab = {
        fg,
        bg,
        ratio,
        lc: apca(fg, bg),
        // WCAG 2.2 1.4.3. Large is 18.66px bold or 24px, hence the two floors.
        passNormal: ratio >= 4.5,
        passLarge: ratio >= 3,
        passAAANormal: ratio >= 7,
      };
    }
  }

  const qRaw = params.get("q") ?? "";
  const q = qRaw.trim().slice(0, QUERY_CAP);
  let anatomy = null;
  let anatomyError: string | null = null;

  if (q) {
    if (qRaw.trim().length > QUERY_CAP) {
      anatomyError = `That query is ${qRaw.trim().length} characters. The cap is ${QUERY_CAP}, so it was cut.`;
    }
    const env = getEnv(context);
    const result = await search(env, { q, pageSize: 10, explain: true });
    anatomy = {
      q,
      total: result.total,
      explain: result.explain ?? null,
      browse: result.explain === undefined && result.total > 0,
    };
  }

  const keyRaw = params.get("key") ?? "";
  const keyTrimmed = keyRaw.trim();
  const key = keyTrimmed.slice(0, KEY_CAP);
  let keyResult = null;
  let keyError: string | null = null;

  if (key) {
    if (keyTrimmed.length > KEY_CAP) {
      keyError = `That key is ${keyTrimmed.length} characters. The cap is ${KEY_CAP}, so it was cut.`;
    }
    /* `classify()` throws on an unknown extension deliberately; catching it here softens nothing for other callers. */
    let classification: { kind: string; mime: string; extension: string } | null = null;
    let classifyRefusal: string | null = null;
    try {
      classification = classify(key);
    } catch (error) {
      classifyRefusal = errorMessage(error);
    }

    const dimensions = dimensionsFromKey(key);
    keyResult = {
      key,
      contentKey: isContentKey(key),
      digest: digestFromKey(key),
      dimensions: dimensions ? `${dimensions.width} by ${dimensions.height}` : null,
      storage: storageOf(key),
      role: roleOf(key),
      classification,
      classifyRefusal,
      raster: isRaster(key),
      cropSafe: cropSafe(key),
      excluded: excludedFromAssets(key),
    };
  }

  /* Presence, not truthiness: an empty cookie header is a real case, the reader who has chosen nothing. */
  const cookieAsked = params.has("cookie");
  const cookieRaw = params.get("cookie") ?? "";
  const cookie = cookieRaw.slice(0, COOKIE_CAP);
  let themeResult = null;
  let themeError: string | null = null;

  if (cookieAsked) {
    if (cookieRaw.length > COOKIE_CAP) {
      themeError = `That header is ${cookieRaw.length} characters. The cap is ${COOKIE_CAP}, so it was cut.`;
    }
    if (!PRINTABLE_ASCII.test(cookie)) {
      themeError =
        "A Cookie header carries printable characters only. That string holds a " +
        "control character, which no browser can send and which would make the " +
        "request itself refuse to be built, so nothing was resolved.";
    } else {
      /* No cookie header at all when the input is empty, which differs from an empty one. */
      const request = new Request(
        "https://example.invalid/",
        cookie ? { headers: { cookie } } : undefined,
      );
      const theme = themeFromRequest(request);
      themeResult = {
        cookie,
        theme,
        attribute: themeAttribute(theme) ?? null,
        colorScheme: colorSchemeMeta(theme),
      };
    }
  }

  const mdParam = params.get("md");
  const snippetSlug =
    mdParam && SNIPPET_SLUGS.includes(mdParam) ? mdParam : SNIPPET_SLUGS[0];
  const snippetError =
    mdParam && mdParam !== snippetSlug
      ? `Unknown snippet "${mdParam}", showing ${snippetSlug}.`
      : "";

  const snippet = SNIPPETS.find((s) => s.slug === snippetSlug);
  let markdown = null;
  let markdownRefusal: string | null = null;
  if (snippet) {
    try {
      const rendered = await renderSnippet(snippet.slug, snippet.source);
      markdown = {
        slug: snippet.slug,
        source: snippet.source,
        html: rendered.html,
        toc: rendered.toc,
        blockedUrls: rendered.blockedUrls,
      };
    } catch (error) {
      markdownRefusal = errorMessage(error);
    }
  }

  const markParam = params.get("mark");
  const dataParam = params.get("data");
  const mark: MarkKey = markParam && MARKS.includes(markParam) ? markParam : "bar";
  const dataset: DatasetKey =
    dataParam && Object.hasOwn(DATASETS, dataParam)
      ? (dataParam as DatasetKey)
      : "limiter";
  const chartError =
    (markParam && markParam !== mark ? `Unknown mark type "${markParam}", showing ${mark}. ` : "") +
    (dataParam && dataParam !== dataset ? `Unknown dataset "${dataParam}", showing ${dataset}.` : "");

  const d = DATASETS[dataset];
  let chartHtml = "";
  let chartRenderError: string | null = null;
  try {
    const { buildChartModel, renderChartHast } = await import("~/lib/content/chart.mjs");
    // `renderChartHast` returns the figure's children, so the wrapper is this route's: without
    // `.chart-figure` no chart rules apply.
    const model = buildChartModel(
      {
        type: mark,
        x: d.x,
        y: d.y,
        ...(d.labels ? { labels: d.labels } : {}),
        title: d.title,
        alt: `${mark} chart. ${d.alt}`,
      },
      d.csv,
    );
    chartHtml = serialize(renderChartHast(model, []));
  } catch (error) {
    chartRenderError = errorMessage(error);
  }

  return {
    lab,
    labError,
    fgRaw,
    bgRaw,
    anatomy,
    anatomyError,
    qRaw: qRaw.slice(0, QUERY_CAP),
    keyResult,
    keyError,
    keyRaw: key,
    themeResult,
    themeError,
    cookieAsked,
    cookieRaw: cookie,
    markdown,
    markdownRefusal,
    snippetError,
    snippetSlug,
    snippetNote: snippet?.note ?? "",
    chartHtml,
    chartRenderError,
    chartError: chartError.trim(),
    mark,
    dataset,
    datasetNote: d.note,
    datasetLabel: d.label,
  };
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="playground-error" role="status">
      <strong>Cannot show that.</strong> {children}
    </p>
  );
}

/** Throws rather than defaulting: an input rendered with no value silently stops demonstrating. */
function inputDefault(demoSlug: string, inputName: string): string {
  const demo = DEMOS.find((d) => d.slug === demoSlug);
  const input = demo?.inputs?.find((i) => i.name === inputName);
  const value = input && "default" in input ? input.default : undefined;
  if (typeof value !== "string") {
    throw new Error(`playground.json has no default for ${demoSlug}.${inputName}`);
  }
  return value;
}

/** Keyed by slug: a positional index would silently put another demo's title over this form. */
function DemoHeader({ slug }: { slug: string }) {
  const demo = DEMOS.find((d) => d.slug === slug);
  if (!demo) return null;
  return (
    <>
      <h2 className="playground-demo-title">{demo.title}</h2>
      <p className="playground-demo-lede">{demo.lede}</p>
      <p className="playground-demo-runs">
        Runs <code>{demo.realPath.split(",")[0]}</code>.{" "}
        <Link to={`/blog/${demo.homeArticle.slug}`}>{demo.homeArticle.title}</Link>
      </p>
    </>
  );
}

export default function Playground({ loaderData }: Route.ComponentProps) {
  const {
    lab, labError, fgRaw, bgRaw,
    anatomy, anatomyError, qRaw,
    keyResult, keyError, keyRaw,
    themeResult, themeError, cookieAsked, cookieRaw,
    markdown, markdownRefusal, snippetError, snippetSlug, snippetNote,
    chartHtml, chartRenderError, chartError, mark, dataset, datasetNote, datasetLabel,
  } = loaderData;

  const carry = (except: "lab" | "search" | "key" | "theme" | "markdown" | "chart") => (
    <>
      {except !== "lab" && fgRaw && <input type="hidden" name="fg" value={fgRaw} />}
      {except !== "lab" && bgRaw && <input type="hidden" name="bg" value={bgRaw} />}
      {except !== "search" && qRaw && <input type="hidden" name="q" value={qRaw} />}
      {except !== "key" && keyRaw && <input type="hidden" name="key" value={keyRaw} />}
      {/* Carried on presence, matching the loader: an empty cookie is a real result here. */}
      {except !== "theme" && cookieAsked && (
        <input type="hidden" name="cookie" value={cookieRaw} />
      )}
      {except !== "markdown" && <input type="hidden" name="md" value={snippetSlug} />}
      {except !== "chart" && (
        <>
          <input type="hidden" name="mark" value={mark} />
          <input type="hidden" name="data" value={dataset} />
        </>
      )}
    </>
  );

  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <h1 className="page-title">{PLAYGROUND_TITLE}</h1>
          <p className="page-intro">{PLAYGROUND_INTRO}</p>
          <p className="page-intro">
            The <a href="/playground/ui">UI inventory</a> is the companion page: every component
            and every palette token, in both themes.
          </p>

          <section id={demoAnchor("contrast")} className="playground-demo">
            <DemoHeader slug="contrast" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("lab")}
              <div className="playground-field">
                <label htmlFor="pg-fg">Foreground</label>
                <input
                  id="pg-fg" name="fg" type="text" inputMode="text"
                  maxLength={7} size={9} spellCheck={false}
                  defaultValue={fgRaw || inputDefault("contrast", "fg")}
                  aria-describedby="pg-hex-cap"
                />
              </div>
              <div className="playground-field">
                <label htmlFor="pg-bg">Background</label>
                <input
                  id="pg-bg" name="bg" type="text" inputMode="text"
                  maxLength={7} size={9} spellCheck={false}
                  defaultValue={bgRaw || inputDefault("contrast", "bg")}
                  aria-describedby="pg-hex-cap"
                />
              </div>
              <button type="submit">Compute</button>
              <p id="pg-hex-cap" className="playground-cap">
                Three or six hex digits each, with or without the hash.
              </p>
            </Form>

            <ul className="playground-swatches">
              {SWATCHES.map((s) => (
                <li key={s.label}>
                  <Link
                    to={`${PLAYGROUND_URL}?fg=${encodeURIComponent(s.fg)}&bg=${encodeURIComponent(s.bg)}#${demoAnchor("contrast")}`}
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>

            {labError && <Problem>{labError}</Problem>}

            {lab && (
              <div className="playground-result">
                <p
                  className="playground-sample"
                  style={{ color: lab.fg, background: lab.bg }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
                <dl className="playground-metrics">
                  <div>
                    <dt>WCAG 2.2 contrast ratio</dt>
                    <dd>
                      <strong>{lab.ratio.toFixed(2)}:1</strong>
                    </dd>
                  </div>
                  <div>
                    <dt>AA, normal text (4.5:1)</dt>
                    <dd>{lab.passNormal ? "Pass" : "Fail"}</dd>
                  </div>
                  <div>
                    <dt>AA, large text (3:1)</dt>
                    <dd>{lab.passLarge ? "Pass" : "Fail"}</dd>
                  </div>
                  <div>
                    <dt>AAA, normal text (7:1)</dt>
                    <dd>{lab.passAAANormal ? "Pass" : "Fail"}</dd>
                  </div>
                  <div>
                    <dt>APCA Lc</dt>
                    <dd>
                      {lab.lc >= 0 ? "+" : ""}
                      {lab.lc.toFixed(1)}
                    </dd>
                  </div>
                </dl>
                <p className="playground-note">
                  The ratio is the conformance number: WCAG 2.2 AA is what this
                  site is measured against, and it is what the build gate fails
                  on. APCA Lc is shown beside it as an experimental perceptual
                  model, not part of any standard and not a pass or fail. It is
                  here because it is what decided one real rule in the palette:
                  the dark semantic pastels clear the ratio comfortably and APCA
                  still rates them around Lc 57 to 60, which is why interactive
                  elements in dark mode take solid fills instead.
                </p>
              </div>
            )}
          </section>

          <section id={demoAnchor("search-anatomy")} className="playground-demo">
            <DemoHeader slug="search-anatomy" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("search")}
              <div className="playground-field playground-field-wide">
                <label htmlFor="pg-q">Query</label>
                <input
                  id="pg-q" name="q" type="search"
                  maxLength={QUERY_CAP} defaultValue={qRaw}
                  aria-describedby="pg-q-cap"
                />
              </div>
              <button type="submit">Run</button>
              <p id="pg-q-cap" className="playground-cap">
                Up to {QUERY_CAP} characters. Nothing you type is stored.
              </p>
            </Form>

            {anatomyError && <Problem>{anatomyError}</Problem>}

            {anatomy && anatomy.total === 0 && (
              <p className="playground-note">
                No rows matched, so there is nothing to fuse. Try a word that
                appears in an article, like <code>fusion</code> or{" "}
                <code>durable</code>.
              </p>
            )}

            {anatomy && anatomy.browse && (
              <p className="playground-note">
                That query has filters but no matchable text, so it took the
                browse path: a plain filtered listing with no ranking and
                therefore no fusion to show.
              </p>
            )}

            {anatomy?.explain && anatomy.total > 0 && (
              <div className="playground-result">
{/* No timing: a wall-clock value would make one result URL render differently on each fetch. */}
                <p className="playground-note">
                  {anatomy.explain.identityCount} row(s) from{" "}
                  <code>search_identity</code>, {anatomy.explain.proseCount} from{" "}
                  <code>search_prose</code>.
                </p>
                <div className="playground-table-scroll">
                  <table className="playground-table">
                    <caption>
                      Within each layer, ordering comes from bm25. Values from
                      differently tokenized indexes are not comparable, so
                      reciprocal rank fusion combines the ranks rather than the
                      scores. That is why there is no score column: each row
                      contributes 1/(k + rank) from every layer it appeared in,
                      with k = {anatomy.explain.k}, and the totals are what sort
                      the results.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Result</th>
                        <th scope="col">Identity rank</th>
                        <th scope="col">Prose rank</th>
                        <th scope="col">Identity 1/(k+rank)</th>
                        <th scope="col">Prose 1/(k+rank)</th>
                        <th scope="col">Fused total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anatomy.explain.rows.slice(0, 10).map((row) => (
                        <tr key={row.uid}>
                          <th scope="row">
                            <a href={row.url}>{row.title}</a>
                            {row.docTitle && row.docTitle !== row.title && (
                              <span className="playground-row-parent">
                                in {row.docTitle}
                              </span>
                            )}
                          </th>
                          <td>{row.identityRank ?? "not returned"}</td>
                          <td>{row.proseRank ?? "not returned"}</td>
                          <td>
                            {row.identityContribution === null
                              ? "0"
                              : row.identityContribution.toFixed(5)}
                          </td>
                          <td>
                            {row.proseContribution === null
                              ? "0"
                              : row.proseContribution.toFixed(5)}
                          </td>
                          <td>
                            <strong>{row.score.toFixed(5)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section id={demoAnchor("chart-options")} className="playground-demo">
            <DemoHeader slug="chart-options" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("chart")}
              <fieldset className="playground-fieldset">
                <legend>Mark type</legend>
                {MARKS.map((m) => (
                  <label key={m} className="playground-radio">
                    <input type="radio" name="mark" value={m} defaultChecked={m === mark} />
                    {m}
                  </label>
                ))}
              </fieldset>
              <fieldset className="playground-fieldset">
                <legend>Dataset</legend>
                {(Object.keys(DATASETS) as DatasetKey[]).map((k) => (
                  <label key={k} className="playground-radio">
                    <input type="radio" name="data" value={k} defaultChecked={k === dataset} />
                    {DATASETS[k].label}
                  </label>
                ))}
              </fieldset>
              <button type="submit">Render</button>
              <p className="playground-cap">
                Enum inputs only. There is no free-text chart specification here:
                arbitrary input into the renderer is a compute surface this page
                does not open.
              </p>
            </Form>

            {chartError && <Problem>{chartError}</Problem>}
            {chartRenderError && <Problem>{chartRenderError}</Problem>}

            {chartHtml && (
              <div className="playground-result">
                {/* Pipeline output from data committed in this file; no third-party input, so it can be injected. */}
                <figure
                  className="chart-figure"
                  dangerouslySetInnerHTML={{ __html: chartHtml }}
                />
                <p className="playground-note">
                  {datasetLabel}: {datasetNote}
                </p>
                <p className="playground-note">
                  One render serves both themes. The series colors in that SVG
                  are <code>var(--chart-cadet)</code> and its siblings, not
                  literals, so the bytes are identical in light and dark and the
                  browser resolves them per theme. Use the theme switch in the
                  header and watch this chart recolor without a new request:
                  that is the proof, and it is why there is no theme control
                  here to press.
                </p>
              </div>
            )}
          </section>

          <section id={demoAnchor("media-key")} className="playground-demo">
            <DemoHeader slug="media-key" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("key")}
              <div className="playground-field playground-field-wide">
                <label htmlFor="pg-key">Key or path</label>
                <input
                  id="pg-key" name="key" type="text" inputMode="text"
                  maxLength={KEY_CAP} spellCheck={false}
                  defaultValue={keyRaw}
                  aria-describedby="pg-key-cap"
                />
              </div>
              <button type="submit">Parse</button>
              <p id="pg-key-cap" className="playground-cap">
                Up to {KEY_CAP} characters. Nothing you type is stored, and
                nothing here reads a bucket: every answer below is a function of
                the string and nothing else.
              </p>
            </Form>

            <ul className="playground-swatches">
              {KEY_PRESETS.map((preset) => (
                <li key={preset.key}>
                  <Link
                    to={`${PLAYGROUND_URL}?key=${encodeURIComponent(preset.key)}#${demoAnchor("media-key")}`}
                  >
                    {preset.label}
                  </Link>
                </li>
              ))}
            </ul>

            {keyError && <Problem>{keyError}</Problem>}

            {keyResult && (
              <div className="playground-result">
                <dl className="playground-metrics">
                  <div>
                    <dt>Content key</dt>
                    <dd>{keyResult.contentKey ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Content digest</dt>
                    <dd>{keyResult.digest ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Intrinsic dimensions</dt>
                    <dd>{keyResult.dimensions ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Storage tier</dt>
                    <dd>{keyResult.storage}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{keyResult.role}</dd>
                  </div>
                  <div>
                    <dt>Kind</dt>
                    <dd>{keyResult.classification?.kind ?? "refused"}</dd>
                  </div>
                  <div>
                    <dt>Media type</dt>
                    <dd>{keyResult.classification?.mime ?? "refused"}</dd>
                  </div>
                  <div>
                    <dt>Transformable raster</dt>
                    <dd>{keyResult.raster ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Safe to crop</dt>
                    <dd>{keyResult.cropSafe ? "Yes" : "No"}</dd>
                  </div>
                </dl>

                {keyResult.classifyRefusal && (
                  <>
                    <Problem>{keyResult.classifyRefusal}</Problem>
                    <p className="playground-note">
                      That is the classifier doing its job. It throws on an
                      unrecognised extension rather than returning a default,
                      which is the whole reason it is a function and not a
                      lookup at the call site: a new file type appearing under{" "}
                      <code>public/</code> has to stop a build, not acquire a
                      plausible kind nobody chose. Adding a type means adding it
                      to the table in the same commit as the file.
                    </p>
                  </>
                )}

                {keyResult.excluded && (
                  <p className="playground-note">
                    Excluded from the asset index: {keyResult.excluded}
                  </p>
                )}

                <p className="playground-note">
                  The three shapes above are one grammar, stated once. A key is
                  sixteen hex digits of the content digest, optionally the
                  intrinsic dimensions, then the extension; nothing else is a
                  content key. Four functions read that one statement, and they
                  do not all take the same argument: the digest and dimension
                  readers accept a bare key OR a <code>/media/</code> path and
                  strip any transform query, because a width is a request for a
                  different rendering rather than a different object, while the
                  boolean documents a bare key and the classifier reads
                  everything after the last dot. Every one of those contracts is
                  visible in the presets above, which is the reason they are the
                  presets.
                </p>
                <p className="playground-note">
                  Why one statement rather than four: there used to be more, and
                  they had already drifted. Collapsing them was done as a
                  differential over generated and negative cases, and the two
                  spellings disagreed on a key with a leading zero in its
                  dimension, where the loose reader returned a size for a key the
                  strict readers were simultaneously refusing to give a digest
                  for. A grammar with two spellings fails exactly when the writer
                  moves, which is the one moment it is needed.
                </p>
              </div>
            )}
          </section>

          <section id={demoAnchor("theme-resolution")} className="playground-demo">
            <DemoHeader slug="theme-resolution" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("theme")}
              <div className="playground-field playground-field-wide">
                <label htmlFor="pg-cookie">Cookie header</label>
                <input
                  id="pg-cookie" name="cookie" type="text" inputMode="text"
                  maxLength={COOKIE_CAP} spellCheck={false}
                  defaultValue={cookieRaw}
                  aria-describedby="pg-cookie-cap"
                />
              </div>
              <button type="submit">Resolve</button>
              <p id="pg-cookie-cap" className="playground-cap">
                Up to {COOKIE_CAP} printable characters. Your own cookie is not
                read and nothing you type is stored: the resolver is handed a
                request built from this box and from nothing else.
              </p>
            </Form>

            <ul className="playground-swatches">
              {COOKIE_PRESETS.map((preset) => (
                <li key={preset.label}>
                  <Link
                    to={`${PLAYGROUND_URL}?cookie=${encodeURIComponent(preset.cookie)}#${demoAnchor("theme-resolution")}`}
                  >
                    {preset.label}
                  </Link>
                </li>
              ))}
            </ul>

            {themeError && <Problem>{themeError}</Problem>}

            {themeResult && (
              <div className="playground-result">
                <dl className="playground-metrics">
                  <div>
                    <dt>Cookie header</dt>
                    <dd>{themeResult.cookie === "" ? "none sent" : themeResult.cookie}</dd>
                  </div>
                  <div>
                    <dt>Resolved theme</dt>
                    <dd>{themeResult.theme}</dd>
                  </div>
                  <div>
                    <dt>data-theme</dt>
                    <dd>{themeResult.attribute ?? "omitted"}</dd>
                  </div>
                  <div>
                    <dt>meta color-scheme</dt>
                    <dd>{themeResult.colorScheme}</dd>
                  </div>
                </dl>

                <p className="playground-note">
                  The choice is a cookie rather than local storage, and that is
                  the whole anti-flash design. Local storage is unreadable on the
                  server, so a site that keeps the theme there has to paint once
                  and then correct itself, which is the flash. A cookie arrives
                  with the request, so the server writes the right{" "}
                  <code>data-theme</code> into the very first byte of HTML and
                  nothing is ever corrected.
                </p>
                <p className="playground-note">
                  Omitting the attribute is not a missing value, it is the
                  mechanism: with no <code>data-theme</code> the stylesheet falls
                  through to <code>prefers-color-scheme</code> and the machine
                  decides. That is why a legacy <code>theme=system</code> cookie
                  and no cookie at all resolve to the same thing here rather than
                  to two states that merely look alike.
                </p>
                <p className="playground-note">
                  The meta element is separate from the attribute and does a
                  different job. <code>data-theme</code> tells the STYLESHEET
                  which palette to use and tells the browser nothing, because the
                  browser cannot know what that attribute means until it has
                  parsed the CSS that gives it meaning. Until then the canvas it
                  paints between documents is the default one, and the default is
                  light: a white frame, for exactly one composited frame, for the
                  reader whose choice disagrees with their machine.
                </p>
              </div>
            )}
          </section>

          <section id={demoAnchor("markdown-render")} className="playground-demo">
            <DemoHeader slug="markdown-render" />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("markdown")}
              <fieldset className="playground-fieldset">
                <legend>Snippet</legend>
                {SNIPPETS.map((s) => (
                  <label key={s.slug} className="playground-radio">
                    <input
                      type="radio" name="md" value={s.slug}
                      defaultChecked={s.slug === snippetSlug}
                    />
                    {s.label}
                  </label>
                ))}
              </fieldset>
              <button type="submit">Render</button>
              <p className="playground-cap">
                Enum inputs only. There is no text box here: the pipeline runs a
                syntax highlighter over a WebAssembly regex engine and a
                directive layer that resolves assets, so arbitrary text into it
                is a compute and sanitization surface that needs its own threat
                model before it reaches the public plane.
              </p>
            </Form>

            {snippetError && <Problem>{snippetError}</Problem>}

            <div className="playground-result">
              <h3 className="playground-subhead">In</h3>
              <pre className="playground-source">
                <code>{markdown?.source ?? SNIPPETS.find((s) => s.slug === snippetSlug)?.source}</code>
              </pre>
              <p className="playground-note">{snippetNote}</p>

              <h3 className="playground-subhead">Out</h3>

              {markdownRefusal && (
                <>
                  <Problem>{markdownRefusal}</Problem>
                  <p className="playground-note">
                    That is the pipeline failing closed, before any directive
                    handler runs. A directive nobody implemented is a named build
                    error rather than a silent empty div in a published article,
                    which is why this branch cannot be shown any other way: an
                    article carrying it would never have been published.
                  </p>
                </>
              )}

              {markdown && (
                <>
                  {/* The same `renderBody` output an article gets; no third-party input, so it can be injected. */}
                  <div
                    className="prose playground-rendered"
                    dangerouslySetInnerHTML={{ __html: markdown.html }}
                  />

                  <h3 className="playground-subhead">Collected on the way through</h3>
                  <dl className="playground-metrics">
                    <div>
                      <dt>Heading anchors</dt>
                      <dd>
                        {markdown.toc.length > 0
                          ? markdown.toc.map((h) => h.id).join(", ")
                          : "none"}
                      </dd>
                    </div>
                    <div>
                      <dt>URLs the allowlist demoted</dt>
                      <dd>
                        {markdown.blockedUrls.length > 0
                          ? markdown.blockedUrls.map((b) => b.url).join(", ")
                          : "none"}
                      </dd>
                    </div>
                  </dl>

                  {markdown.blockedUrls.length > 0 && (
                    <p className="playground-note">
                      A refused link is demoted to the markdown that produced it
                      rather than stripped or emptied, because both of those look
                      to an author exactly like a link that worked. Un-rendered
                      markdown is the one signal every markdown author already
                      reads as "this did not become what I meant", and the
                      offending URL stays in the text so the reason is legible
                      without opening a console. It is emitted as a text node, so
                      it cannot re-enter the document as markup. The guard runs
                      LAST in the chain on purpose, after every href and src the
                      pipeline can emit: markdown links and images, the figure
                      directive, diagram assets, heading autolinks and footnote
                      references.
                    </p>
                  )}

                  <p className="playground-note">
                    The heading anchors are collected during the same pass that
                    renders, not by a second walk afterwards, which is what makes
                    a post's table of contents and its heading permalinks
                    incapable of disagreeing. This is one call, and it is the one
                    the deploy build makes for every article, the editor preview
                    makes on every keystroke and the operator API makes on every
                    save.
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="playground-deferred">
            <h2>Not here yet</h2>
            <p>
              A missing demo is a stated absence rather than a stub. Each of
              these needs a decision before it can exist.
            </p>
            <dl>
              {playgroundData.deferred.map((d) => (
                <div key={d.slug}>
                  <dt>{d.title}</dt>
                  <dd>{d.reason}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
