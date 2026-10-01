import { data } from "react-router";

import { ProcedureSheet } from "~/components/procedure";
import { getProcedureByPath } from "~/db/procedures";
import { getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { PROCEDURES_CACHE_TAG, readScale } from "~/lib/procedures/route";
import { SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";

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
  const row = await getProcedureByPath(env, path);
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await getAdminSession(env, request))) throw data(null, { status: 404 });
  const { count, factor } = readScale(row.record, url);
  return { record: row.record, count, factor };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { record } = loaderData;
  return [
    { title: `${record.title}: printable sheet` },
    { name: "robots", content: "noindex" },
    { tagName: "link", rel: "canonical", href: `${SITE_ORIGIN}${record.path}` },
  ];
}

export default function ProcedureSheetRoute({ loaderData }: Route.ComponentProps) {
  const { record, count, factor } = loaderData;
  return (
    <main className="procedure-sheet-page" id="main">
      <ProcedureSheet record={record} count={count} factor={factor} url={`${SITE_ORIGIN}${record.path}`} />
    </main>
  );
}
