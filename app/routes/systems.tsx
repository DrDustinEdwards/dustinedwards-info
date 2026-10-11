import { systemMapHtml } from "capsomer/behaviour/system-map";
import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";
import { EXPLORER_ORIGIN, SYSTEMS_PATH, connectionsOf, explorerLabel, explorerUrl, loadSystemModel, mapData, outsideOf, partsOf, repoOf, summaryOf, systemPath, wiresOf } from "~/lib/systems.mjs";

import rawModel from "../../data/system-model.json";
import type { Route } from "./+types/systems";

// Route-scoped: the map is Capsomer's, and only these pages draw it.
import "capsomer/tokens.css";
import "capsomer/button.css";
import "capsomer/system-map.css";
import "~/styles/systems.css";

/**
 * The family of systems at /systems, drawn as a capsid by Capsomer's system map (slice 4 of
 * capsid/research/design-system-explorer.md), and one system at /systems/<id>, the same map
 * with that system chosen and its facts above it. The data is the committed copy of Capsid's
 * public model (data/system-model.json), checked when the module loads, so a bad file fails
 * the build and never reaches a reader. The whole map and the list of the same data are in
 * the HTML; the script (app/enhance/system-map.ts) adds choosing, the lines and going inside.
 */
export function headers() {
  return publicHtmlHeaders();
}

const MODEL = loadSystemModel(rawModel);
const TITLE = "Systems";
const CAPTION = "A capsid is the protein shell of a virus, built from repeated parts called capsomers. This family is built the same way: Capsid in the middle, the shared parts around it, what people use on the outside.";

export function loader({ params }: Route.LoaderArgs) {
  const id = params.system;
  if (id === undefined) return { chosen: null };
  if (!MODEL.systems.some((s) => s.id === id)) throw data(null, { status: 404 });
  return { chosen: id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const chosen = loaderData?.chosen ? MODEL.systems.find((s) => s.id === loaderData.chosen) : undefined;
  if (!chosen) {
    return pageMeta({
      title: `${TITLE}: the family as a capsid`,
      description: `The ${MODEL.systems.length} systems Dustin Edwards runs, drawn as a capsid: Capsid in the middle, the shared parts around it, what people use on the outside.`,
      path: SYSTEMS_PATH,
    });
  }
  return pageMeta({
    title: `${chosen.name}, in the family of systems`,
    description: chosen.private ? `${chosen.name}. ${summaryOf(chosen)}` : (chosen.description ?? `${chosen.name}, one of Dustin Edwards's systems.`),
    path: systemPath(chosen.id),
  });
}

export default function SystemsRoute({ loaderData }: Route.ComponentProps) {
  const chosen = loaderData.chosen ? MODEL.systems.find((s) => s.id === loaderData.chosen) : undefined;
  const trail: Array<[string, string]> = chosen ? [[TITLE, SYSTEMS_PATH], [chosen.name, systemPath(chosen.id)]] : [[TITLE, SYSTEMS_PATH]];
  const map = systemMapHtml(mapData(MODEL), {
    id: "family",
    label: chosen ? "The family" : "The family of systems",
    caption: chosen ? undefined : CAPTION,
    headingLevel: 2,
    openLabel: "Its page",
  });
  return (
    <PageShell trail={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />}>
      <Breadcrumb trail={trail} />
      {chosen ? <SystemFacts id={chosen.id} /> : <SystemsIntro />}
      {/* The map is a string from Capsomer, every text in it escaped there. data-chosen tells the script which system to choose. */}
      <div className="systems-map" data-chosen={chosen?.id} dangerouslySetInnerHTML={{ __html: map }} />
      <p className="systems-source">
        From Capsid&apos;s public model of {MODEL.as_of}. Also as <a href={chosen ? `${systemPath(chosen.id)}.md` : `${SYSTEMS_PATH}.md`}>markdown</a>.
      </p>
      <Enhance module="system-map" />
    </PageShell>
  );
}

function SystemsIntro() {
  const privates = MODEL.systems.filter((s) => s.private).length;
  return (
    <>
      <h1 className="page-title">{TITLE}</h1>
      <p className="systems-lead">
        The {MODEL.systems.length} systems I run, as one drawing. Choose one to see what it connects to; choose Capsid again to go inside it. {privates} are private, so
        they show only a name and, where they have one, an address. The <a href={`${EXPLORER_ORIGIN}/`}>Capsid explorer</a> goes deeper, with what
        Capsid is made of and its daily numbers.
      </p>
    </>
  );
}

function SystemFacts({ id }: { id: string }) {
  const s = MODEL.systems.find((x) => x.id === id)!;
  const links = connectionsOf(MODEL, id);
  const parts = partsOf(MODEL, id);
  const outside = outsideOf(MODEL, id);
  const wires = wiresOf(MODEL, id);
  const repo = repoOf(s);
  return (
    <>
      <h1 className="page-title">{s.name}</h1>
      <div className="systems-facts">
        <p className="systems-lead">{summaryOf(s)}</p>
        <dl>
          {s.domain ? (
            <>
              <dt>Address</dt>
              <dd>
                <a href={`https://${s.domain}`}>{s.domain}</a>
              </dd>
            </>
          ) : null}
          {repo ? (
            <>
              <dt>Source</dt>
              <dd>
                <a href={repo}>{repo.replace(/^https:\/\//, "")}</a>
              </dd>
            </>
          ) : null}
          <dt>Explorer</dt>
          <dd>
            <a href={explorerUrl(s.id)}>{explorerLabel(s.id)}</a>
          </dd>
        </dl>
        {parts.length ? <ContainerList title="Inside" containers={parts} /> : null}
        {outside.length ? <ContainerList title="Outside it" containers={outside} /> : null}
        {wires.length ? (
          <>
            <h3>How they connect</h3>
            <ul>
              {wires.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        ) : null}
        <h2>Connections</h2>
        {links.length === 0 ? (
          <p>None drawn.</p>
        ) : (
          <ul>
            {links.map((c, i) => (
              <li key={`${c.other}-${i}`}>
                {c.verb} <a href={systemPath(c.other)}>{c.name}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ContainerList({ title, containers }: { title: string; containers: ReturnType<typeof partsOf> }) {
  return (
    <>
      <h2>{title}</h2>
      <ul>
        {containers.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong> ({c.technology}){c.description ? `: ${c.description}` : null}
          </li>
        ))}
      </ul>
    </>
  );
}
