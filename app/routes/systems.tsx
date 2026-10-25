import { systemMapHtml } from "capsomer/behavior/system-map";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { jsonLdText as serializeJsonLd } from "@drdustinedwards/site-helpers/xml";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";
import {
  SYSTEMS_PATH,
  SYSTEM_PARAM,
  chosenSystem,
  explorerUrl,
  loadSystemModel,
  mapData,
  repoOf,
} from "~/lib/systems.mjs";

import { INSIDE_LAYERS, INSIDES_URL } from "virtual:system-insides";

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
// Capsomer's map with circles, so one tap on any system zooms into its circle. The circles are drawn at build time
// (scripts/lib/system-insides-plugin.mjs, as virtual:system-insides). The page at rest carries none, for its first
// paint on a slow phone, and the map's script fetches them all from INSIDES_URL once the page has loaded; a chosen
// system's is inlined and drawn zoomed into, so a shared ?system= link opens there before any script and with none.
// The detail line sits above the drawing here (app/styles/systems.css), so it and the views are sent shown: a box
// that appeared there once the script ran would push the drawing down. Where no script runs, systems.css hides them.
const mapHtml = (chosen?: string) =>
  systemMapHtml(mapData(MODEL), {
    id: "family",
    label: "The family of systems",
    ringNames: { shared: "Shared code" },
    headingLevel: 2,
    circles: { src: INSIDES_URL, layers: chosen && INSIDE_LAYERS[chosen] ? { [chosen]: INSIDE_LAYERS[chosen] } : {}, chosen },
  }).replace(/(data-cap-part="(?:views|detail)"[^>]*?) hidden>/g, "$1>");
const MAP = mapHtml();

export function loader({ request }: Route.LoaderArgs) {
  return { chosen: chosenSystem(MODEL, new URL(request.url).searchParams.get(SYSTEM_PARAM)) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const chosen = loaderData?.chosen ? MODEL.systems.find((s) => s.id === loaderData.chosen) : undefined;
  // One page, so one canonical address whichever system is chosen.
  if (!chosen) {
    return pageMeta({
      title: `${TITLE}: the family as a capsid`,
      description: `The ${MODEL.systems.length} systems Dustin Edwards runs, on one map.`,
      path: SYSTEMS_PATH,
    });
  }
  return pageMeta({
    title: `${chosen.name}, in the family of systems`,
    description: chosen.description ?? (chosen.domain ? `${chosen.name}, at ${chosen.domain}.` : chosen.name),
    path: SYSTEMS_PATH,
  });
}

export default function SystemsRoute({ loaderData }: Route.ComponentProps) {
  const chosen = loaderData.chosen;
  const trail: Array<[string, string]> = [[TITLE, SYSTEMS_PATH]];
  return (
    <PageShell trail={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />}>
      <Breadcrumb trail={trail} />
      <h1 className="page-title">{TITLE}</h1>
      {/* The map is a string from Capsomer, every text in it escaped there. A chosen system is drawn zoomed in. */}
      <div className="systems-map" dangerouslySetInnerHTML={{ __html: chosen ? mapHtml(chosen) : MAP }} />
      {/* Every system's facts, all shown with no script; with script, only the chosen one's (systems.css). */}
      <div className="systems-all" data-systems-facts="">
        {MODEL.systems.map((s) => (
          <SystemFacts key={s.id} id={s.id} chosen={s.id === chosen} />
        ))}
      </div>
      <p className="systems-source">
        Public model, {MODEL.as_of}. <a href={`${SYSTEMS_PATH}.md`}>Markdown</a>
      </p>
      <Enhance module="system-map" />
    </PageShell>
  );
}

// Under the drawing, once: the system's name, its sentence, and the links the drawing cannot carry. Its parts and
// lines are the drawing; as words they are in /systems.md. A private system says so where its repo link would be.
function SystemFacts({ id, chosen }: { id: string; chosen: boolean }) {
  const s = MODEL.systems.find((x) => x.id === id)!;
  const repo = repoOf(s);
  const links = [
    s.domain ? { href: `https://${s.domain}`, text: s.domain } : null,
    repo ? { href: repo, text: repo.replace(/^https:\/\//, "") } : null,
    { href: explorerUrl(s.id), text: "explorer" },
  ].filter((l) => l !== null);
  const parts = [...links.map((l) => <a href={l.href}>{l.text}</a>), ...(s.private ? ["private repo"] : [])];
  return (
    <section className="systems-facts" id={`system-${s.id}`} data-system={s.id} data-chosen={chosen ? "" : undefined} aria-labelledby={`system-${s.id}-name`}>
      <h2 id={`system-${s.id}-name`}>{s.name}</h2>
      {s.description ? <p className="systems-lead">{s.description}</p> : null}
      <p className="systems-links">
        {parts.map((part, i) => (
          <span key={i}>
            {i ? " · " : null}
            {part}
          </span>
        ))}
      </p>
    </section>
  );
}
