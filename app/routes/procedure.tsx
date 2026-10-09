import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { ProcedureView } from "~/components/procedure";
import { listFrozenVersions } from "~/db/procedure-versions";
import { getProcedureByPath, listPublishedLibraryRecords } from "~/db/procedures";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { procedureJsonLd } from "~/kb/procedures/json-ld.mjs";
import { libraryItems, workflowContext } from "~/kb/procedures/library.mjs";
import { proofFor } from "~/kb/procedures/proof.server";
import { procedureTrail, PROCEDURES_CACHE_TAG, readScale } from "~/kb/procedures/route";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, personId, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/procedure";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";
import "~/styles/procedure.css";
import "~/styles/run.css";

/**
 * Every procedure page (docs/PROCEDURES.md): a protocol, a recipe or a computational procedure, drawn
 * from its D1 row at request time, so an edit saved through the operator API is live without a deploy.
 * A draft is served only to the signed-in admin; that request carries a cookie, and the Worker never
 * stores a cookie-bearing response.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(PROCEDURES_CACHE_TAG));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const row = await getProcedureByPath(env, path);
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const { count, factor } = readScale(row.record, url);
  // Where a protocol sits in the phage workflow: its neighbours are the other published protocols, so they are read here.
  const workflow =
    row.record.profile === "protocol" ? workflowContext(libraryItems(await listPublishedLibraryRecords(env)), row.record.path) : null;
  // Proof of use is slugs in the file; the papers' and phages' words and addresses are read from their rows.
  const proof = await proofFor(env, row.record.proofOfUse);
  // The versions with a frozen copy, which the history links.
  const frozen = await listFrozenVersions(env, row.slug);
  return { record: row.record, draft: row.status === "draft", count, factor, workflow, proof, frozen };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { record, draft } = loaderData;
  return [
    ...pageMeta({ title: record.seoTitle, description: record.description, path: record.path }),
    { tagName: "link", rel: "alternate", type: "text/markdown", href: `${SITE_ORIGIN}${record.path}.md` },
    ...(draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function ProcedureRoute({ loaderData }: Route.ComponentProps) {
  const { record, draft, count, factor, workflow, proof, frozen } = loaderData;
  const trail = procedureTrail(record);
  const person = { "@type": "Person", "@id": personId(SITE_ORIGIN), name: SITE.name, url: SITE_ORIGIN };
  const blocks = [breadcrumbJsonLd(SITE_ORIGIN, trail), procedureJsonLd(record, SITE_ORIGIN, person)];
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
      {draft ? <p className="procedure-draft">Draft: only you can see this page.</p> : null}
      <ProcedureView record={record} count={count} factor={factor} workflow={workflow} proof={proof} frozen={frozen} />
      {/* Run mode (app/enhance/run.ts): the page is complete as served; this adds the bench checklist. */}
      <Enhance module="run" />
    </PageShell>
  );
}
