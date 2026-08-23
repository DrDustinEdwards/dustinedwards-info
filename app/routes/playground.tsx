import { Form, Link } from "react-router";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import playgroundData from "../../content/playground.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { CHART_TYPES, buildChartModel, renderChartHast } from "~/lib/content/chart.mjs";
import { apca, contrast, normalizeHex } from "~/lib/contrast.mjs";
import { getEnv } from "~/lib/context";
import {
  PLAYGROUND_DESCRIPTION,
  PLAYGROUND_INTRO,
  PLAYGROUND_TITLE,
  PLAYGROUND_URL,
  demoAnchor,
} from "~/lib/playground-page.mjs";
import { search } from "~/lib/search/search.server";
import { HTML_VARY, SHARED_CACHE_CONTROL, SITE_ORIGIN,
  pageMeta,
} from "~/lib/seo";

import type { Route } from "./+types/playground";

/**
 * /playground, the interactive index of this site's own machinery.
 *
 * TWO LAWS GOVERN THIS FILE.
 *
 * 1. EVERY DEMO RUNS THE REAL CODE PATH. The contrast lab computes with
 *    `app/lib/contrast.mjs`, which `scripts/check-contrast.mjs` also imports.
 *    The search demo calls `search()`, the function `/search` calls. The chart
 *    is drawn by `app/lib/content/chart.mjs`, the module the build, the editor
 *    preview and the operator save all render through. Nothing here reimplements
 *    a rule, because a demo of a reimplementation demonstrates nothing: it would
 *    keep working while the thing it claims to show was broken.
 *
 * 2. EVERY RESULT STATE IS A URL, AND THE SERVER RENDERS IT. Every demo is a
 *    GET form whose entire input is the query string, so a reader can paste a
 *    URL and the recipient sees the identical render. With scripting off the
 *    forms submit natively and the server answers exactly the same way, which
 *    is what satisfies hard rule 9 here.
 *
 *    THIS LAW USED TO READ "ZERO JAVASCRIPT, BY CONSTRUCTION" AND THAT WAS
 *    NEVER TRUE OF THE DELIVERED PAGE. `root.tsx` renders `<Scripts />` on
 *    every route, so the router runtime has always shipped here; the claim was
 *    only ever true of this file's own code. Corrected 2026-08-16 along with
 *    the reader-facing copy in `playground-page.mjs`, which told visitors the
 *    demos ran "with no JavaScript".
 *
 *    The forms are react-router `<Form method="get">`. That emits the same
 *    markup and the same URL as a plain form, so the no-script path is
 *    unchanged, and where script is present it skips the document teardown.
 *    MEASURED on production 2026-08-16: a full document load of this page
 *    spends 861ms after `responseEnd` reaching interactive and 2111ms reaching
 *    load, all of which a client transition skips. The wire cost is the same
 *    either way (145ms both), so bytes were never the reason.
 *
 * NO USER INPUT IS PERSISTED ANYWHERE. Not logged, not stored, not counted. The
 * analytics point carries the bare path and never the query string, which is a
 * property of the capture in `workers/app.ts` rather than a promise made here.
 *
 * WHY THE FORMS CARRY HIDDEN FIELDS. Three independent demos share one URL, so
 * submitting one would otherwise wipe the other two results. Each form restates
 * the others' current values as hidden inputs, which keeps a shared URL whole
 * with no script and no session.
 *
 * CACHE-CONTROL IS EXPLICIT, per hard rule 8: with the Workers cache on, a
 * response carrying no Cache-Control is CACHED rather than skipped. This page
 * takes the ordinary public-HTML policy the rest of the public plane takes.
 */

const DEMOS = playgroundData.demos;

/**
 * Presets and fixtures come from the MANIFEST, not from this file.
 *
 * `content/playground.json` is the one source, exactly as `content/projects.json`
 * is for /projects: this route renders from it and `check:features` asserts
 * against it, including rendering the same chart through the same module and
 * computing the same ratio through the same maths. If the data lived here, the
 * gate would have to restate it, and a gate whose expected values come from a
 * copy of the input is checking itself.
 */
const SWATCHES = playgroundData.swatches;
const DATASETS = playgroundData.datasets;

type DatasetKey = keyof typeof DATASETS;

/**
 * The mark enum, IMPORTED from the module that owns it rather than restated, so
 * the demo can never offer a mark the renderer would reject. The manifest lists
 * the same four and `check:features` argues the two lists against each other.
 */
const MARKS = CHART_TYPES;
type MarkKey = string;

const QUERY_CAP = 100;

export function meta() {
  /* Was canonical plus OG text with NO image and NO twitter card, so a shared
     link rendered as a bare URL rather than a card. pageMeta carries the set. */
  return pageMeta({
    title: `${PLAYGROUND_TITLE} | Dustin Edwards`,
    description: PLAYGROUND_DESCRIPTION,
    path: PLAYGROUND_URL,
  });
}

export function headers() {
  return { "Cache-Control": SHARED_CACHE_CONTROL, Vary: HTML_VARY };
}

const serialize = (children: any[]) =>
  unified().use(rehypeStringify).stringify({ type: "root", children } as any);

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  /* ---------------------------------------------------------------- lab --- */
  const fgRaw = (params.get("fg") ?? "").trim();
  const bgRaw = (params.get("bg") ?? "").trim();
  let lab = null;
  let labError: string | null = null;

  if (fgRaw || bgRaw) {
    // Validated through the SAME parser that computes, so the page cannot accept
    // a string the maths would then throw on, or refuse one it would have taken.
    const fg = normalizeHex(fgRaw);
    const bg = normalizeHex(bgRaw);
    if (!fg || !bg) {
      const bad = [!fg ? "foreground" : null, !bg ? "background" : null]
        .filter(Boolean)
        .join(" and ");
      labError = `The ${bad} is not a hex colour. Use three or six hex digits, like #4F2D7F.`;
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

  /* ------------------------------------------------------------- search --- */
  const qRaw = params.get("q") ?? "";
  const q = qRaw.trim().slice(0, QUERY_CAP);
  let anatomy = null;
  let anatomyError: string | null = null;

  if (q) {
    if (qRaw.trim().length > QUERY_CAP) {
      anatomyError = `That query is ${qRaw.trim().length} characters. The cap is ${QUERY_CAP}, so it was cut.`;
    }
    const env = getEnv(context);
    // The real search, with the flag that attaches what fuse() already recorded.
    // No query changes, no ordering changes, and no scoring rule is restated.
    const result = await search(env, { q, pageSize: 10, explain: true });
    anatomy = {
      q,
      total: result.total,
      explain: result.explain ?? null,
      browse: result.explain === undefined && result.total > 0,
    };
  }

  /* -------------------------------------------------------------- chart --- */
  const markParam = params.get("mark");
  const dataParam = params.get("data");
  const mark: MarkKey = markParam && MARKS.includes(markParam) ? markParam : "bar";
  const dataset: DatasetKey =
    dataParam && Object.hasOwn(DATASETS, dataParam)
      ? (dataParam as DatasetKey)
      : "limiter";
  // An out-of-enum value is reported rather than silently corrected, so a
  // hand-edited URL says what happened instead of quietly rendering something
  // else. This is the only place the demo can disagree with its input.
  const chartError =
    (markParam && markParam !== mark ? `Unknown mark type "${markParam}", showing ${mark}. ` : "") +
    (dataParam && dataParam !== dataset ? `Unknown dataset "${dataParam}", showing ${dataset}.` : "");

  const d = DATASETS[dataset];
  let chartHtml = "";
  let chartRenderError: string | null = null;
  try {
    // The real renderer. `renderChartHast` returns the FIGURE'S CHILDREN, not
    // the figure, so the wrapper and its class are this route's responsibility;
    // without `.chart-figure` the stylesheet's chart rules never apply.
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
    chartRenderError = error instanceof Error ? error.message : String(error);
  }

  return {
    lab,
    labError,
    fgRaw,
    bgRaw,
    anatomy,
    anatomyError,
    qRaw: qRaw.slice(0, QUERY_CAP),
    chartHtml,
    chartRenderError,
    chartError: chartError.trim(),
    mark,
    dataset,
    datasetNote: d.note,
    datasetLabel: d.label,
  };
}

/** A boring, visible error. Never a toast, never a colour on its own. */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="playground-error" role="status">
      <strong>Cannot show that.</strong> {children}
    </p>
  );
}

function DemoHeader({ index }: { index: number }) {
  const demo = DEMOS[index];
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
    chartHtml, chartRenderError, chartError, mark, dataset, datasetNote, datasetLabel,
  } = loaderData;

  // Hidden fields keep the other demos' results alive across a submit.
  const carry = (except: "lab" | "search" | "chart") => (
    <>
      {except !== "lab" && fgRaw && <input type="hidden" name="fg" value={fgRaw} />}
      {except !== "lab" && bgRaw && <input type="hidden" name="bg" value={bgRaw} />}
      {except !== "search" && qRaw && <input type="hidden" name="q" value={qRaw} />}
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
      <main className="page" id="main">
        <div className="page-inner">
          <h1 className="page-title">{PLAYGROUND_TITLE}</h1>
          <p className="page-intro">{PLAYGROUND_INTRO}</p>

          {/* ------------------------------------------------ contrast --- */}
          <section id={demoAnchor("contrast")} className="playground-demo">
            <DemoHeader index={0} />

            <Form method="get" action={PLAYGROUND_URL} className="playground-form">
              {carry("lab")}
              <div className="playground-field">
                <label htmlFor="pg-fg">Foreground</label>
                <input
                  id="pg-fg" name="fg" type="text" inputMode="text"
                  maxLength={7} size={9} spellCheck={false}
                  defaultValue={fgRaw || "#2B2320"}
                  aria-describedby="pg-hex-cap"
                />
              </div>
              <div className="playground-field">
                <label htmlFor="pg-bg">Background</label>
                <input
                  id="pg-bg" name="bg" type="text" inputMode="text"
                  maxLength={7} size={9} spellCheck={false}
                  defaultValue={bgRaw || "#FAF7F2"}
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

          {/* -------------------------------------------------- search --- */}
          <section id={demoAnchor("search-anatomy")} className="playground-demo">
            <DemoHeader index={1} />

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
{/*
                  NO TIMING HERE, deliberately. A wall-clock reading is the one
                  value that would differ between two fetches of the same URL,
                  and this page's contract is that a result URL renders
                  identically wherever it is opened. Latency claims belong in
                  the article, measured properly, not in a demo where a cold
                  Worker would quietly libel the database.
                */}
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
                            {/* Records are section-grained, so a bare heading
                                like "Limitations" needs its article to mean
                                anything. Shown only when they differ. */}
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

          {/* --------------------------------------------------- chart --- */}
          <section id={demoAnchor("chart-options")} className="playground-demo">
            <DemoHeader index={2} />

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
                {/*
                  The chart is produced by the pipeline from data committed in
                  this file, and contains no third-party input, which is why it
                  can be injected the way an article body is.
                */}
                <figure
                  className="chart-figure"
                  dangerouslySetInnerHTML={{ __html: chartHtml }}
                />
                <p className="playground-note">
                  {datasetLabel}: {datasetNote}
                </p>
                <p className="playground-note">
                  One render serves both themes. The series colours in that SVG
                  are <code>var(--chart-cadet)</code> and its siblings, not
                  literals, so the bytes are identical in light and dark and the
                  browser resolves them per theme. Use the theme switch in the
                  header and watch this chart recolour without a new request:
                  that is the proof, and it is why there is no theme control
                  here to press.
                </p>
              </div>
            )}
          </section>

          {/* ------------------------------------------------ deferred --- */}
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
      <SiteFooter />
    </>
  );
}
