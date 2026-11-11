import { JsonLd } from "capsomer/react/json-ld";
import { DraftNotice } from "capsomer/react/draft-notice";
import { patchSvg } from "capsomer/behavior/manual";
import { DictionaryEntry } from "capsomer/react/dictionary-entry";

import { Breadcrumb } from "~/components/breadcrumb";
import { CONTENTS_MIN, contentsOf, PageContents } from "~/components/page-contents";
import { PageShell } from "~/components/page-shell";
import { PhageRoster } from "~/components/phage-roster";
import { PhageTools } from "~/components/phage-tool";
import { Signs } from "capsomer/react/manual";
import { getPublishedEntryByPath } from "~/db/dictionary";
import { getPageByPath, getPublishedPageTitles } from "~/db/pages";
import { listRoster } from "~/db/roster";
import { draftGate } from "@dustinedwards/site-runtime/draft-gate";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { entryProps } from "~/lib/dictionary-entries.mjs";
import { longDateUTC } from "~/lib/long-date.mjs";
import { patchOf } from "~/lib/running-head";
import {
  contentPageCardPath,
  contentPageMarkdownPath,
  contentPageTrail,
  pageSequenceNeighbors,
} from "~/lib/content-pages.mjs";
import type { PageRecord } from "~/lib/pages/compile.mjs";
import { contentPageJsonLd } from "~/lib/pages/page-json-ld";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { toolsOnPage } from "~/lib/phage-tools.mjs";
import { ROSTER_PAGE_PATH } from "~/lib/roster/compile.mjs";
import { SITE_ORIGIN, pageMeta, publicHtmlHeaders, shareCard } from "~/lib/seo";

import type { Route } from "./+types/content-page";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "capsomer/tokens.css";
import "capsomer/enarratio.css";
import "capsomer/chart-frame.css";
import "~/styles/prose.css";
import "capsomer/split.css";
import "capsomer/dialog.css";
import "capsomer/dictionary-entry.css";
import "capsomer/button.css";
import "capsomer/lightbox.css";
import { RENDERED } from "~/lib/content/render-version";
import { markup } from "capsomer/behavior/trusted-html";

/**
 * Every Research, Teaching and Software page (app/lib/content-pages.mjs): the research/* splat, and
 * /teaching and /software through their own modules. Drawn from the page's D1 row at request time
 * (docs/PAGES.md), so an edit saved through the operator API is live without a deploy; the HTML in the
 * row was rendered by the site's pipeline with the URL allowlist already applied, so the Worker carries
 * no markdown renderer and nothing third-party reaches the page. A draft is served only to the signed-in
 * admin; that request carries a cookie, and the Worker never stores a cookie-bearing response.
 * The markdown twin is the sibling route in content-page[.md].ts.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  // A path with no row (not a page, or a page the content sync has not written yet) and a draft the viewer may
  // not see are the same 404 (site-runtime draftGate).
  const { row, draft } = await draftGate(await getPageByPath(env, pathname), () =>
    isAdminViewer(env, request),
  );
  const page = row.record;
  // The page it sits under, by title, for the trail above it (the course above its FAQ).
  const parent = page.path.slice(0, page.path.lastIndexOf("/"));
  // The pages either side in a sequence (the two semesters of a course), by title, for the signs at its foot.
  const sequence = pageSequenceNeighbors(page.path);
  const ways = [sequence.prev?.path, sequence.next?.path].filter((p): p is string => !!p);
  const titles = await getPublishedPageTitles(env, [...(parent ? [parent] : []), ...ways]);
  const way = (n: { path: string; label: string } | null) => {
    const title = n ? titles.get(n.path) : undefined;
    return n && title ? { href: n.path, title, label: n.label } : null;
  };
  const signs = { prev: way(sequence.prev), next: way(sequence.next) };
  // The lead a named Software page opens with, drawn from D1 beside the page (docs/DICTIONARY.md): an entry
  // edit is live at the next request, and a page with no published entry has none.
  const entry = await getPublishedEntryByPath(env, page.path);
  const trail = contentPageTrail(page, (path) => titles.get(path));
  // The program page carries the roster, drawn from D1 beside the page (docs/ROSTER.md); no other page reads it.
  const roster = page.path === ROSTER_PAGE_PATH ? await listRoster(env) : null;
  // A calculator page computes from its query string, so Calculate works as a plain GET with script off.
  return {
    page,
    trail,
    entry,
    roster,
    signs,
    draft,
    search: toolsOnPage(page.path).length > 0 ? url.search : "",
  };
}

/** The page's own social card where build:og draws one (CARDED_PAGE_ROOTS), else the site card. */
function cardUrl(page: PageRecord) {
  const path = contentPageCardPath(page);
  return path ? shareCard(`${SITE_ORIGIN}${path}`, page.seoTitle) : undefined;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page, trail, draft } = loaderData;
  return [
    ...pageMeta({
      title: page.seoTitle,
      description: page.description,
      path: page.path,
      trail,
      image: cardUrl(page),
      markdown: contentPageMarkdownPath(page.path),
      noindex: draft,
    }),
  ];
}

export default function ContentPageRoute({ loaderData }: Route.ComponentProps) {
  const { page, trail, entry, roster, signs, draft, search } = loaderData;
  const sections = contentsOf(page.html);
  const patch = patchOf(page.path);
  return (
    <PageShell
      rail={sections.length >= CONTENTS_MIN ? <PageContents sections={sections} /> : null}
      trail={
        <>
          {contentPageJsonLd(page, entry).map((block, i) => (
            <JsonLd key={i} data={block} />
          ))}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      {patch ? (
        <div className="page-patched">
          <h1 className="page-title cap-layout-grid">{page.title}</h1>
          {/* Decorative: the trail and the running head say the same in words. */}
          <span dangerouslySetInnerHTML={markup(patchSvg(patch))} />
        </div>
      ) : (
        <h1 className="page-title cap-layout-grid">{page.title}</h1>
      )}
      <DraftNotice show={draft} />
      {page.banner || page.lastUpdated ? (
        <div className="legal-status">
          {page.banner ? <p className="legal-banner">{page.banner}</p> : null}
          {page.lastUpdated ? (
            <p className="legal-updated">
              Last updated <time dateTime={page.lastUpdated}>{longDateUTC(page.lastUpdated)}</time>
            </p>
          ) : null}
        </div>
      ) : null}
      {entry ? (
        <>
          <DictionaryEntry {...entryProps(entry)} />
          <template data-island="pronounce" />
        </>
      ) : null}
      <PhageTools path={page.path} search={search} />
      <div className="prose" {...RENDERED} dangerouslySetInnerHTML={markup(page.html)} />
      {page.html.includes("data-enarratio-redraw") ? <template data-island="charts" /> : null}
      {roster ? (
        <div className="prose">
          <PhageRoster cohorts={roster} />
          <template data-island="roster" />
        </div>
      ) : null}
      {signs.prev || signs.next ? (
        <div className="page-signs">
          <Signs label="More in this program" prev={signs.prev} next={signs.next} />
        </div>
      ) : null}
    </PageShell>
  );
}
