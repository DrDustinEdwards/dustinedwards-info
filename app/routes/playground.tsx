import playgroundData from "../../content/playground.json";
import { PageShell } from "~/components/page-shell";
import { ChartOptionsDemo } from "~/components/playground/chart-options";
import { ContrastDemo } from "~/components/playground/contrast";
import { MarkdownRenderDemo } from "~/components/playground/markdown-render";
import { MediaKeyDemo } from "~/components/playground/media-key";
import { SearchAnatomyDemo } from "~/components/playground/search-anatomy";
import { ThemeResolutionDemo } from "~/components/playground/theme-resolution";
import { chartOptionsDemo } from "~/lib/playground/chart-options";
import { contrastDemo } from "~/lib/playground/contrast";
import { markdownRenderDemo } from "~/lib/playground/markdown-render";
import { mediaKeyDemo } from "~/lib/playground/media-key";
import { searchAnatomyDemo } from "~/lib/playground/search-anatomy";
import { themeResolutionDemo } from "~/lib/playground/theme-resolution";
import {
  PLAYGROUND_DESCRIPTION,
  PLAYGROUND_INTRO,
  PLAYGROUND_TITLE,
  PLAYGROUND_URL,
} from "~/lib/playground-page.mjs";
import {
  publicHtmlHeaders,
  pageMeta,
} from "~/lib/seo";

import type { Route } from "./+types/playground";

import "~/styles/prose.css";
import "~/styles/playground.css";

/**
 * Every demo runs the real code path, and every result is a server-rendered GET URL. No user input
 * is persisted. Hidden fields because three demos share one URL. Cache-Control is explicit: with the
 * Workers cache on, a response carrying none is cached. Each demo is one loader module under
 * app/lib/playground/ and one section component under app/components/playground/.
 */

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

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const contrast = contrastDemo(params);
  const anatomy = await searchAnatomyDemo(context, params);
  const mediaKey = mediaKeyDemo(params);
  const theme = themeResolutionDemo(params);
  const markdown = await markdownRenderDemo(params);
  const chart = await chartOptionsDemo(params);

  return {
    ...contrast,
    ...anatomy,
    ...mediaKey,
    ...theme,
    ...markdown,
    ...chart,
  };
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
    <PageShell>
      <h1 className="page-title">{PLAYGROUND_TITLE}</h1>
      <p className="page-intro">{PLAYGROUND_INTRO}</p>
      <p className="page-intro">
        The <a href="/playground/ui">UI inventory</a> is the companion page: every component
        and every palette token, in both themes.
      </p>

      <ContrastDemo
        lab={lab}
        labError={labError}
        fgRaw={fgRaw}
        bgRaw={bgRaw}
        carry={carry("lab")}
      />
      <SearchAnatomyDemo
        anatomy={anatomy}
        anatomyError={anatomyError}
        qRaw={qRaw}
        carry={carry("search")}
      />
      <ChartOptionsDemo
        chartHtml={chartHtml}
        chartRenderError={chartRenderError}
        chartError={chartError}
        mark={mark}
        dataset={dataset}
        datasetNote={datasetNote}
        datasetLabel={datasetLabel}
        carry={carry("chart")}
      />
      <MediaKeyDemo
        keyResult={keyResult}
        keyError={keyError}
        keyRaw={keyRaw}
        carry={carry("key")}
      />
      <ThemeResolutionDemo
        themeResult={themeResult}
        themeError={themeError}
        cookieRaw={cookieRaw}
        carry={carry("theme")}
      />
      <MarkdownRenderDemo
        markdown={markdown}
        markdownRefusal={markdownRefusal}
        snippetError={snippetError}
        snippetSlug={snippetSlug}
        snippetNote={snippetNote}
        carry={carry("markdown")}
      />

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
    </PageShell>
  );
}
