import { ProcedureSheet } from "~/components/procedure";
import { getProcedureByPath } from "~/db/procedures";
import { draftGate } from "@dustinedwards/site-runtime/draft-gate";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { sheetAddress } from "~/kb/procedures/cite.mjs";
import { PROCEDURES_CACHE_TAG, readScale } from "~/kb/procedures/route";
import { SITE_ORIGIN, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/procedure.sheet";

import "~/styles/prose.css";
import "~/styles/procedure.css";

/**
 * A procedure's printable sheet at `<page>/sheet`: the materials (scaled by the same `?n=` or
 * `?servings=` as the page), the steps with their flags and the troubleshooting table, without the site's
 * header and footer or the reasoning notes. Not indexed: the page is the canonical copy.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(PROCEDURES_CACHE_TAG));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/sheet\/?$/, "");
  const { row } = await draftGate(await getProcedureByPath(env, path), () =>
    isAdminViewer(env, request),
  );
  const { count, factor } = readScale(row.record, url);
  return { record: row.record, count, factor };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { record } = loaderData;
  // Prelum's head (pageMeta): not indexed, and canonical to the procedure's page, the copy that is.
  return pageMeta({
    title: `${record.title}: printable sheet`,
    description: record.description,
    path: record.path,
    noindex: true,
  });
}

export default function ProcedureSheetRoute({ loaderData }: Route.ComponentProps) {
  const { record, count, factor } = loaderData;
  return (
    <main className="procedure-sheet-page" id="main">
      <ProcedureSheet
        record={record}
        count={count}
        factor={factor}
        address={sheetAddress(record, SITE_ORIGIN)}
      />
    </main>
  );
}
