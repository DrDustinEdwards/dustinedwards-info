import { systemMapHtml } from "capsomer/behavior/system-map";

import { Breadcrumb } from "~/components/breadcrumb";
import { PageShell } from "~/components/page-shell";
import { pageMeta, publicHtmlHeaders, type Trail } from "~/lib/seo";
import { SYSTEMS_PATH, loadSystemModel, mapData } from "~/lib/systems.mjs";

import rawModel from "../../data/system-model.json";

// Route-scoped: the map is Capsomer's, and only the systems pages draw it.
import "capsomer/tokens.css";
import "capsomer/system-map.css";
// The map's two views, hexagons and the plain map, are Capsomer's tabs.
import "capsomer/tabs.css";
import "~/styles/systems.css";

/**
 * The network of systems at /systems: Capsomer's system map at level 1, hexagons first (the core in the middle, the shared
 * packages around it, what people use by group outside, every tie a line), and the plain map of cards a tab away
 * (Dustin, 2026-11-03). A card's link opens the system's own page (app/routes/system.tsx).
 * The data is the committed copy of Capsid's public model (data/system-model.json), checked when the module loads, so a
 * bad file fails the build and never reaches a reader. The whole map is in the HTML, lines included; the
 * script (app/enhance/system-map.ts) adds the tabs and lights a system's ties under the pointer or the focus.
 */
export function headers() {
  return publicHtmlHeaders();
}

const MODEL = loadSystemModel(rawModel);
const TITLE = "Systems";
const TRAIL: Trail = [[TITLE, SYSTEMS_PATH]];
const MAP = systemMapHtml(mapData(MODEL), {
  id: "network",
  label: "The network of systems",
  caption:
    "Capsid at the core, the shared packages around it, and what people use, by group, on the outside. Point at a system to light what it uses and what uses it, or open it.",
  ringNames: { shared: "Shared packages", core: "Core" },
  headingLevel: 2,
});

export function meta() {
  return pageMeta({
    title: `${TITLE}: the network`,
    description: `The ${MODEL.systems.length} systems Dustin Edwards runs, drawn as a map of what each uses and what uses it, each with a page of its own for its parts.`,
    path: SYSTEMS_PATH,
    markdown: `${SYSTEMS_PATH}.md`,
    trail: TRAIL,
  });
}

export default function SystemsRoute() {
  return (
    <PageShell>
      <Breadcrumb trail={TRAIL} />
      <h1 className="page-title cap-layout-grid">{TITLE}</h1>
      {/* The map is a string from Capsomer, every text in it escaped there. */}
      <div className="systems-map" dangerouslySetInnerHTML={{ __html: MAP }} />
      <p className="systems-source">
        Public model, {MODEL.as_of}. <a href={`${SYSTEMS_PATH}.md`}>Markdown</a>
      </p>
      <template data-island="system-map" />
    </PageShell>
  );
}
