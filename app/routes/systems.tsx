import { systemMapHtml } from "capsomer/behaviour/system-map";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";
import {
  SYSTEMS_PATH,
  SYSTEM_PARAM,
  chooseInMapHtml,
  chosenSystem,
  explorerUrl,
  loadSystemModel,
  mapData,
  repoOf,
} from "~/lib/systems.mjs";

import { wireMapHtml, zoomInMapHtml } from "~/lib/system-wiring.mjs";
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
// Capsomer's map, with an inside for every system rather than the core alone, so one tap on any system zooms into
// its circle. The insides are drawn at build time (scripts/lib/system-layout.mjs, as virtual:system-insides). The
// page at rest carries none, for its first paint on a slow phone, and the map's script fetches them all from
// INSIDES_URL once the page has loaded; a chosen system's is inlined, so a shared ?system= link opens zoomed in
// before any script and with none.
const CORE_ID = MODEL.systems.find((s) => s.ring === "core")?.id;
const CAPSOMER_MAP = systemMapHtml(mapData(MODEL), { id: "family", label: "The family of systems", headingLevel: 2 });
/** The map with the given system's circle in it, or none. */
const mapWith = (id?: string) => wireMapHtml(CAPSOMER_MAP, id && INSIDE_LAYERS[id] ? { [id]: INSIDE_LAYERS[id] } : {}, CORE_ID, INSIDES_URL);
const MAP = mapWith();
/** The map zoomed into one system, its circle inlined. */
const zoomedMap = (id: string) => zoomInMapHtml(chooseInMapHtml(mapWith(id), id), id);

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
      {/* The map is a string from Capsomer and app/lib/system-wiring.mjs, every text in it escaped there. A chosen system is drawn zoomed in; data-chosen tells the script which. */}
      <div className="systems-map" data-chosen={chosen ?? undefined} dangerouslySetInnerHTML={{ __html: chosen ? zoomedMap(chosen) : MAP }} />
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
// lines are the drawing; as words they are in /systems.md. A private system is its name, its address when it has
// one, and its place in the explorer.
function SystemFacts({ id, chosen }: { id: string; chosen: boolean }) {
  const s = MODEL.systems.find((x) => x.id === id)!;
  const repo = repoOf(s);
  const links = [
    s.domain ? { href: `https://${s.domain}`, text: s.domain } : null,
    repo ? { href: repo, text: repo.replace(/^https:\/\//, "") } : null,
    { href: explorerUrl(s.id), text: "explorer" },
  ].filter((l) => l !== null);
  return (
    <section className="systems-facts" id={`system-${s.id}`} data-system={s.id} data-chosen={chosen ? "" : undefined} aria-labelledby={`system-${s.id}-name`}>
      <h2 id={`system-${s.id}-name`}>{s.name}</h2>
      {s.private || !s.description ? null : <p className="systems-lead">{s.description}</p>}
      <p className="systems-links">
        {links.map((l, i) => (
          <span key={l.href}>
            {i ? " · " : null}
            <a href={l.href}>{l.text}</a>
          </span>
        ))}
      </p>
    </section>
  );
}
