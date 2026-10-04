import { data } from "react-router";

import { ProcedureSheet } from "~/components/procedure";
import { getFrozenVersion } from "~/db/procedure-versions";
import { getEnv } from "~/lib/context";
import { sheetAddress } from "~/lib/procedures/cite.mjs";
import { PROCEDURES_CACHE_TAG, readScale } from "~/lib/procedures/route";
import { SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/procedure.version.sheet";

import "~/styles/prose.css";
import "~/styles/procedure.css";

/**
 * The printable sheet of a frozen version, at `<page>/v/<version>/sheet`: the method as it was when the version was
 * published, with that version's id and date and a QR code that opens that version's page. So a sheet reprinted later
 * from an old version still says, and links to, the version it is. Not indexed: the page is the canonical copy.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(PROCEDURES_CACHE_TAG));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const found = /^(.*)\/v\/([^/]+)\/sheet\/?$/.exec(url.pathname);
  if (!found) throw data(null, { status: 404 });
  const frozen = await getFrozenVersion(getEnv(context), found[1] ?? "", decodeURIComponent(found[2] ?? ""));
  if (!frozen) throw data(null, { status: 404 });
  const { count, factor } = readScale(frozen.record, url);
  return { record: frozen.record, count, factor };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { record } = loaderData;
  return [
    { title: `${record.title} (version ${record.version}): printable sheet` },
    { name: "robots", content: "noindex" },
    { tagName: "link", rel: "canonical", href: `${SITE_ORIGIN}${record.path}` },
  ];
}

export default function ProcedureVersionSheetRoute({ loaderData }: Route.ComponentProps) {
  const { record, count, factor } = loaderData;
  return (
    <main className="procedure-sheet-page" id="main">
      <ProcedureSheet record={record} count={count} factor={factor} address={sheetAddress(record, SITE_ORIGIN)} />
    </main>
  );
}
