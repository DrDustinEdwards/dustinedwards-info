import type { RootContent } from "hast";
import { Form, Link } from "react-router";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import playgroundData from "../../content/playground.json";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { CHART_TYPES, buildChartModel, renderChartHast } from "~/lib/content/chart.mjs";
/*
 * THE MARKDOWN DEMO'S ONE CALL, behind a NAMED server export.
 *
 * `renderSnippet` wraps `renderBody`, the renderer every post goes through,
 * and installs the Worker's WASM instantiator on the way. The wrapper is not
 * decoration: a bare `import "~/lib/content/wasm.server"` here failed the
 * build, because a side-effect import binds no name and React Router's
 * server-code removal traces NAMES. That module's docblock carries the
 * measurement.
 *
 * NO NEW BYTES IN THE WORKER. It is the same pipeline and the same WASM module
 * the editor and operator paths already pull in, and the Worker is one bundle.
 */
import { renderSnippet } from "~/lib/content/render-snippet.server";
import { apca, contrast, normalizeHex } from "~/lib/contrast.mjs";
import { getEnv } from "~/lib/context";
/*
 * The key grammar's four readers, plus the classifier and the two per-asset
 * predicates. IMPORTED, never restated: this module is the only statement of
 * the grammar in the repository, and the last time there were more they had
 * already drifted into two answers for one key.
 */
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
/*
 * The theme resolver, IMPORTED. `themeFromRequest` is the function
 * `workers/app.ts` calls on every request to build its cache key and that
 * `root.tsx` calls to write `data-theme` into the first byte of HTML, so a
 * demo that reimplemented it would keep agreeing with itself while the site
 * disagreed with both.
 */
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";
import {
  publicHtmlHeaders,
  pageMeta,
} from "~/lib/seo";

import type { Route } from "./+types/playground";

import "~/styles/prose.css";
import "~/styles/playground.css";

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
 *    THIS LAW USED TO READ "ZERO JAVASCRIPT, BY CONSTRUCTION", WHICH WAS
 *    FALSE, AND THE PARAGRAPH THAT CORRECTED IT IS NOW FALSE THE OTHER WAY.
 *
 *    Corrected 2026-08-16: `root.tsx` rendered `<Scripts />` on every route, so
 *    the router runtime shipped here and the zero-JavaScript claim was only
 *    ever true of this file's own code. The reader-facing copy in
 *    `playground-page.mjs` was corrected with it, having told visitors the
 *    demos ran "with no JavaScript".
 *
 *    Corrected again 2026-08-28, because the public plane stopped hydrating on
 *    2026-08-26: hydration is opt-in by route and this route does not opt in,
 *    so `<Scripts>` is not rendered here and NO router runtime ships. The forms
 *    are react-router `<Form method="get">`, which emits the same markup and
 *    the same URL as a plain form, and with nothing to intercept them they
 *    submit natively for every reader. The client transition this paragraph
 *    used to describe no longer happens on this page, so the document-load
 *    figures it carried are history rather than a live comparison, and they are
 *    left dated rather than deleted: MEASURED on production 2026-08-16, a full
 *    document load of this page spent 861ms after `responseEnd` reaching
 *    interactive and 2111ms reaching load, against a wire cost of 145ms either
 *    way. Bytes were never the reason, and now there is no second path.
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
const KEY_PRESETS = playgroundData.keyPresets;
const COOKIE_PRESETS = playgroundData.cookiePresets;
const SNIPPETS = playgroundData.markdownSnippets;

/**
 * The markdown demo's input bound, and it is the strictest on the page.
 *
 * AN ENUM, NOT A TEXT BOX. WHAT REFUSES BEYOND IT: an unknown value is
 * REPORTED and the default is rendered, the same shape the chart demo takes,
 * so a hand-edited URL says what happened rather than quietly showing
 * something else. There is no way to put a character of your own into this
 * renderer.
 *
 * That is not caution for its own sake. The pipeline runs a syntax highlighter
 * over a WebAssembly regex engine and a directive layer that resolves assets,
 * so arbitrary text into it is a compute and sanitization surface that needs a
 * threat model of its own before it can be opened to the public plane. The
 * deferred entry at the foot of the page says so and stays.
 */
const SNIPPET_SLUGS = SNIPPETS.map((s) => s.slug);


type DatasetKey = keyof typeof DATASETS;

/**
 * The mark enum, IMPORTED from the module that owns it rather than restated, so
 * the demo can never offer a mark the renderer would reject. The manifest lists
 * the same four and `check:features` argues the two lists against each other.
 */
const MARKS = CHART_TYPES;
type MarkKey = string;

const QUERY_CAP = 100;

/**
 * The key demo's input bound.
 *
 * WHAT REFUSES BEYOND IT: the loader cuts at this length and SAYS SO, the same
 * shape the search demo's cap takes, because a cap enforced in the loader and
 * unstated in the UI is a silent truncation. There is no other bound to state
 * and that is a property of the subject rather than an omission: every function
 * this demo calls is pure string work over one argument, with no database, no
 * network, no clock and no allocation that grows with the input. The longest
 * real key this site holds is a content digest plus a dimension segment plus an
 * extension, so a hundred and twenty characters is generous by a wide margin
 * and still small enough that no input can cost anything.
 */
const KEY_CAP = 120;

/**
 * The theme demo's input bounds. TWO, and the second is not a length.
 *
 * LENGTH: cut at this many characters, said in the form and reported by the
 * loader, the same shape the other two caps take.
 *
 * SHAPE: printable ASCII only, and this one is a REFUSAL rather than a cut.
 * The demo runs the real `themeFromRequest`, which takes a Request, so the
 * input has to become a real header value. A control character in a header
 * value makes `new Request` throw a TypeError, and a demo whose input can
 * crash its own loader is a demo that answers some readers with a stack trace.
 * Refusing the shape up front means the request is only ever constructed from
 * something a browser could actually have sent, which is also the only input
 * the answer would mean anything for.
 */
const COOKIE_CAP = 200;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

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
  return publicHtmlHeaders();
}

/* The hast types, so neither side of this is an escape: check:slop makes a type
   assertion an error, and an assertion here would hide a wrong tree shape. */
const serialize = (children: RootContent[]) =>
  unified().use(rehypeStringify).stringify({ type: "root", children });

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

  /* ---------------------------------------------------------------- key --- */

  const keyRaw = params.get("key") ?? "";
  const keyTrimmed = keyRaw.trim();
  const key = keyTrimmed.slice(0, KEY_CAP);
  let keyResult = null;
  let keyError: string | null = null;

  if (key) {
    if (keyTrimmed.length > KEY_CAP) {
      keyError = `That key is ${keyTrimmed.length} characters. The cap is ${KEY_CAP}, so it was cut.`;
    }
    /*
     * THE CLASSIFIER'S REFUSAL IS A RESULT, not an error page.
     *
     * `classify()` throws on an unknown extension, deliberately, so a new file
     * type under public/ stops a build rather than acquiring a plausible kind
     * nobody chose. That refusal is one of the most interesting things this
     * module does and it is invisible everywhere else on the site, so it is
     * caught here and RENDERED as the answer it is. Catching it does not soften
     * it: every other caller still gets the throw.
     */
    let classification: { kind: string; mime: string; extension: string } | null = null;
    let classifyRefusal: string | null = null;
    try {
      classification = classify(key);
    } catch (error) {
      classifyRefusal = error instanceof Error ? error.message : String(error);
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

  /* -------------------------------------------------------------- theme --- */

  /*
   * PRESENCE, NOT TRUTHINESS, decides whether this demo ran.
   *
   * The empty cookie header is a REAL AND INTERESTING CASE here: it is the
   * reader who has chosen nothing, which is the default branch the whole
   * anti-flash design rests on. Keying on `params.has` rather than on the
   * string being non-empty is what lets that case have a URL at all. The other
   * demos key on a non-empty value because for them the empty input means
   * "not asked".
   */
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
      /*
       * A REAL REQUEST, because the real function takes one. Constructed with
       * no cookie header at all when the input is empty, which is a different
       * thing from an empty one and is the state a first-time reader arrives
       * in: the resolver's first line is a test for the header's absence.
       */
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

  /* ----------------------------------------------------------- markdown --- */

  const mdParam = params.get("md");
  const snippetSlug =
    mdParam && SNIPPET_SLUGS.includes(mdParam) ? mdParam : SNIPPET_SLUGS[0];
  // Reported rather than silently corrected, the same rule the chart demo
  // follows: a hand-edited URL says what happened instead of quietly rendering
  // something else.
  const snippetError =
    mdParam && mdParam !== snippetSlug
      ? `Unknown snippet "${mdParam}", showing ${snippetSlug}.`
      : "";

  const snippet = SNIPPETS.find((s) => s.slug === snippetSlug);
  let markdown = null;
  let markdownRefusal: string | null = null;
  if (snippet) {
    try {
      /*
       * THE REAL RENDERER, through the server wrapper. The same `renderBody`
       * call the deploy build makes for every post and the same one the editor
       * preview and every operator save make; the wrapper adds the WASM
       * instantiator and an image resolver that REFUSES, and nothing else.
       */
      const rendered = await renderSnippet(snippet.slug, snippet.source);
      markdown = {
        slug: snippet.slug,
        source: snippet.source,
        html: rendered.html,
        toc: rendered.toc,
        blockedUrls: rendered.blockedUrls,
      };
    } catch (error) {
      /*
       * A REFUSAL IS A RESULT, exactly as the classifier's is in the key demo.
       * One of the three snippets exists to earn this, and it is the branch a
       * published article can never show: an article carrying an unknown
       * directive would never have been published.
       */
      markdownRefusal = error instanceof Error ? error.message : String(error);
    }
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

/** A boring, visible error. Never a toast, never a colour on its own. */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="playground-error" role="status">
      <strong>Cannot show that.</strong> {children}
    </p>
  );
}

/**
 * A demo input's declared default, read out of the manifest.
 *
 * BOTH DEFAULTS WERE WRITTEN TWICE until 2026-08-28: `#2B2320` and `#FAF7F2`
 * were in `content/playground.json` as each input's `default`, AND again as a
 * literal in the two `defaultValue` expressions below. They agreed, which is
 * the only reason nobody noticed; a second copy that agrees is a second copy.
 *
 * They are the `--text` and `--bg` tokens, and the manifest is as close to
 * those as JavaScript gets: a Worker cannot read the stylesheet, and
 * `scripts/lib/tokens.mjs`, which does read it, is a build-time module. So the
 * manifest is the JS-side owner and this reads it rather than restating it.
 *
 * Throws rather than defaulting. An input rendered with no value is a form that
 * silently stops demonstrating anything, and `check:features` reconciles this
 * page against the manifest in both directions, so a missing entry is already
 * a build failure rather than something to paper over here.
 *
 * @param {string} demoSlug the demo's slug in the manifest
 * @param {string} inputName
 */
function inputDefault(demoSlug: string, inputName: string): string {
  const demo = DEMOS.find((d) => d.slug === demoSlug);
  const input = demo?.inputs?.find((i) => i.name === inputName);
  const value = input && "default" in input ? input.default : undefined;
  if (typeof value !== "string") {
    throw new Error(`playground.json has no default for ${demoSlug}.${inputName}`);
  }
  return value;
}

/**
 * KEYED BY SLUG SINCE 2026-08-30, and it used to be a positional index.
 *
 * An index couples the page's ORDER to the manifest's, silently: insert a demo
 * anywhere but the end and every section below it renders another demo's title,
 * lede and article link over its own form. Nothing would fail. `check:features`
 * reconciles which demos exist in both directions and says nothing about which
 * header sits above which form, because both lists are still complete.
 *
 * The slug is already the thing this section is identified by, since the
 * section id comes from `demoAnchor(slug)` beside it, so keying on it removes
 * the coupling rather than moving it.
 */
function DemoHeader({ slug }: { slug: string }) {
  const demo = DEMOS.find((d) => d.slug === slug);
  /*
   * FAIL CLOSED ON A MISSING DEMO, rather than rendering an empty header.
   *
   * `check:features` reconciles this page's demos against `playground.json` in
   * both directions, so a slug with no entry is already a build failure. What
   * this adds is that if one ever slips through, the page renders nothing for
   * that demo instead of a heading with no title, which is the shape that reads
   * as a styling bug and sends the next reader to the stylesheet.
   */
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

  // Hidden fields keep the other demos' results alive across a submit.
  const carry = (except: "lab" | "search" | "key" | "theme" | "markdown" | "chart") => (
    <>
      {except !== "lab" && fgRaw && <input type="hidden" name="fg" value={fgRaw} />}
      {except !== "lab" && bgRaw && <input type="hidden" name="bg" value={bgRaw} />}
      {except !== "search" && qRaw && <input type="hidden" name="q" value={qRaw} />}
      {except !== "key" && keyRaw && <input type="hidden" name="key" value={keyRaw} />}
      {/* Carried on PRESENCE, matching the loader: an empty cookie is a real
          result here, so dropping it would lose that demo's state on any other
          demo's submit. */}
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

          {/* ------------------------------------------------ contrast --- */}
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

          {/* -------------------------------------------------- search --- */}
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

          {/* ----------------------------------------------- media key --- */}
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

            {/* Real URLs, exactly as the contrast lab's swatches are, so each
                preset is a shareable result rather than a control to press. */}
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

                {/*
                  THE REFUSAL, verbatim, and it is a result rather than a fault.
                  Shown in the ordinary error block because that is what a
                  refusal looks like everywhere else on this page, and the note
                  underneath says why this one is the module working.
                */}
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

          {/* --------------------------------------------------- theme --- */}
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
                    {/*
                      THE ABSENCE IS THE ANSWER for a reader on system, so it is
                      spelled out rather than rendered as an empty cell. An empty
                      cell reads as a bug; "omitted" reads as the mechanism it is.
                    */}
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

          {/* ------------------------------------------------ markdown --- */}
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
              {/*
                The snippet verbatim, in a plain <pre>. NOT run through the
                highlighter: this is the INPUT, and highlighting it would render
                the demo's subject with the demo's subject, which is the mirror
                this page exists not to be.
              */}
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
                  {/*
                    Rendered into `.prose`, the same treatment an article body
                    gets, because it IS an article body: it came out of the same
                    call. Injected the way the chart is and for the same reason,
                    which is that it was produced by this pipeline from data
                    committed in this repository and contains no third-party
                    input at all.
                  */}
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
      <ShellFooter />
    </>
  );
}
