import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { ProcedureView, VersionNotice } from "~/components/procedure";
import { getFrozenVersion, listFrozenVersions } from "~/db/procedure-versions";
import { getProcedureByPath } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { versionPath } from "~/lib/procedures/cite.mjs";
import { procedureJsonLd } from "~/lib/procedures/json-ld.mjs";
import { procedureTrail, PROCEDURES_CACHE_TAG, readScale } from "~/lib/procedures/route";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, personId, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/procedure.version";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";
import "~/styles/procedure.css";
import "~/styles/run.css";

/**
 * A procedure as it was when a version was published, at `<page>/v/<version>` (drizzle/0027_procedure_versions.sql).
 * The words are the frozen copy's and never change, so a printed sheet's QR code and a citation keep meaning what they
 * did. The page says which version is current when this is not, links to it, and puts its canonical on the plain page.
 * Only published versions are frozen, so there is no draft here to hide.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(PROCEDURES_CACHE_TAG));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const found = /^(.*)\/v\/([^/]+?)\/?$/.exec(url.pathname);
  if (!found) throw data(null, { status: 404 });
  const path = found[1] ?? "";
  const version = decodeURIComponent(found[2] ?? "");
  const frozen = await getFrozenVersion(env, path, version);
  if (!frozen) throw data(null, { status: 404 });
  // The live page tells this one what is current. A draft or a removed procedure has no current version.
  const live = await getProcedureByPath(env, path);
  const current = live && live.status === "published" ? { path, version: live.record.version } : null;
  const { count, factor } = readScale(frozen.record, url);
  return { record: frozen.record, current, count, factor, frozen: await listFrozenVersions(env, frozen.slug) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { record } = loaderData;
  return [
    // The canonical is the plain page, so the copies are never competing results for the same words.
    ...pageMeta({ title: `${record.seoTitle} (version ${record.version})`, description: record.description, path: record.path }),
    { tagName: "link", rel: "alternate", type: "text/markdown", href: `${SITE_ORIGIN}${versionPath(record.path, String(record.version))}.md` },
  ];
}

export default function ProcedureVersionRoute({ loaderData }: Route.ComponentProps) {
  const { record, current, count, factor, frozen } = loaderData;
  const trail = procedureTrail(record);
  const person = { "@type": "Person", "@id": personId(SITE_ORIGIN), name: SITE.name, url: SITE_ORIGIN };
  const blocks = [breadcrumbJsonLd(SITE_ORIGIN, trail), procedureJsonLd(record, SITE_ORIGIN, person)];
  const basePath = versionPath(record.path, String(record.version));
  return (
    <PageShell
      trail={
        <>
          {blocks.map((block, i) => (
            <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }} />
          ))}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title">{record.title}</h1>
      <VersionNotice record={record} current={current} />
      <ProcedureView record={record} count={count} factor={factor} basePath={basePath} sheetPath={`${basePath}/sheet`} frozen={frozen} />
      <Enhance module="run" />
    </PageShell>
  );
}
