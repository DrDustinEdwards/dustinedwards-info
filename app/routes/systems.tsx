import { systemMapHtml } from "capsomer/behaviour/system-map";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";
import {
  EXPLORER_ORIGIN,
  SYSTEMS_PATH,
  SYSTEM_PARAM,
  chooseInMapHtml,
  chosenSystem,
  connectionsOf,
  explorerLabel,
  explorerUrl,
  loadSystemModel,
  mapData,
  outsideOf,
  partsOf,
  repoOf,
  summaryOf,
  systemHref,
  wiresOf,
} from "~/lib/systems.mjs";

import { wireMapHtml, zoomInMapHtml } from "~/lib/system-wiring.mjs";
import { INSIDE_LAYERS } from "virtual:system-insides";

import rawModel from "../../data/system-model.json";
import type { Route } from "./+types/systems";

// Route-scoped: the map is Capsomer's, and only this page draws it.
import "capsomer/tokens.css";
import "capsomer/button.css";
import "capsomer/system-map.css";
import "~/styles/systems.css";

/**
 * The family of systems at /systems, drawn as a capsid by Capsomer's system map (slice 4 of
 * capsid/research/design-system-explorer.md). One page: choosing a system draws its lines and
 * shows its facts below the map, in place, and keeps it in the address as /systems?system=<id>,
 * which the server renders chosen too. The data is the committed copy of Capsid's public model
 * (data/system-model.json), checked when the module loads, so a bad file fails the build and never
 * reaches a reader. The whole map, the list of the same data and every system's facts are in the
 * HTML; the script (app/enhance/system-map.ts) makes one tap zoom into a system's circle, and
 * shows one system's facts at a time.
 */
export function headers() {
  return publicHtmlHeaders();
}

const MODEL = loadSystemModel(rawModel);
const TITLE = "Systems";
const CAPTION = "A capsid is the protein shell of a virus, built from repeated parts called capsomers. This family is built the same way: Capsid in the middle, the shared parts around it, what people use on the outside.";
// Capsomer's map, with an inside for every system rather than the core alone, so one tap on any system zooms into
// its circle. The insides are drawn at build time (scripts/lib/system-layout.mjs, as virtual:system-insides).
const MAP = wireMapHtml(
  systemMapHtml(mapData(MODEL), { id: "family", label: "The family of systems", caption: CAPTION, headingLevel: 2 }),
  INSIDE_LAYERS,
  MODEL.systems.find((s) => s.ring === "core")?.id,
);

export function loader({ request }: Route.LoaderArgs) {
  return { chosen: chosenSystem(MODEL, new URL(request.url).searchParams.get(SYSTEM_PARAM)) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const chosen = loaderData?.chosen ? MODEL.systems.find((s) => s.id === loaderData.chosen) : undefined;
  // One page, so one canonical address whichever system is chosen.
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
    path: SYSTEMS_PATH,
  });
}

export default function SystemsRoute({ loaderData }: Route.ComponentProps) {
  const chosen = loaderData.chosen;
  const trail: Array<[string, string]> = [[TITLE, SYSTEMS_PATH]];
  return (
    <PageShell trail={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />}>
      <Breadcrumb trail={trail} />
      <SystemsIntro />
      {/* The map is a string from Capsomer and app/lib/system-wiring.mjs, every text in it escaped there. A chosen system is drawn zoomed in; data-chosen tells the script which. */}
      <div className="systems-map" data-chosen={chosen ?? undefined} dangerouslySetInnerHTML={{ __html: chosen ? zoomInMapHtml(chooseInMapHtml(MAP, chosen), chosen) : MAP }} />
      {/* Every system's facts, all shown with no script; with script, only the chosen one's (systems.css). */}
      <div className="systems-all" data-systems-facts="">
        {MODEL.systems.map((s) => (
          <SystemFacts key={s.id} id={s.id} chosen={s.id === chosen} />
        ))}
      </div>
      <p className="systems-source">
        From Capsid&apos;s public model of {MODEL.as_of}. Also as <a href={`${SYSTEMS_PATH}.md`}>markdown</a>.
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
        The {MODEL.systems.length} systems I run, as one drawing. Tap one to zoom into it: its parts inside the circle, the systems it connects to around the rim, and each
        wire from the part that uses it, with its facts below the map. {privates} are private, so they show only a name and, where they have one, an address. The <a href={`${EXPLORER_ORIGIN}/`}>Capsid explorer</a> goes deeper, with what
        Capsid is made of and its daily numbers.
      </p>
    </>
  );
}

function SystemFacts({ id, chosen }: { id: string; chosen: boolean }) {
  const s = MODEL.systems.find((x) => x.id === id)!;
  const links = connectionsOf(MODEL, id);
  const parts = partsOf(MODEL, id);
  const outside = outsideOf(MODEL, id);
  const wires = wiresOf(MODEL, id);
  const repo = repoOf(s);
  return (
    <section className="systems-facts" id={`system-${s.id}`} data-system={s.id} data-chosen={chosen ? "" : undefined} aria-labelledby={`system-${s.id}-name`}>
      <h2 id={`system-${s.id}-name`}>{s.name}</h2>
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
          <h4>How they connect</h4>
          <ul>
            {wires.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Connections</h3>
      {links.length === 0 ? (
        <p>None drawn.</p>
      ) : (
        <ul>
          {links.map((c, i) => (
            <li key={`${c.other}-${i}`}>
              {/* With script, choosing in place (app/enhance/system-map.ts); without, the page with that system chosen. */}
              {c.verb} <a href={systemHref(c.other)} data-choose={c.other}>{c.name}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContainerList({ title, containers }: { title: string; containers: ReturnType<typeof partsOf> }) {
  return (
    <>
      <h3>{title}</h3>
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
