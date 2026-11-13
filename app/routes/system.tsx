import { systemMapHtml } from "capsomer/behavior/system-map";
import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { PageShell } from "~/components/page-shell";
import { pageMeta, publicHtmlHeaders, type Trail } from "~/lib/seo";
import { explorerLabel } from "capsomer/behavior/system-model";
import {
  SYSTEMS_PATH,
  explorerUrl,
  loadSystemModel,
  mapData,
  repoOf,
  systemPath,
} from "~/lib/systems.mjs";

import rawModel from "../../data/system-model.json";
import type { Route } from "./+types/system";

// Route-scoped: the map is Capsomer's, and only the systems pages draw it.
import "capsomer/tokens.css";
import "capsomer/button.css";
import "capsomer/system-map.css";
import "~/styles/systems.css";
import { markup } from "capsomer/behavior/trusted-html";

/**
 * One system at /systems/<id>: its address, its repo (or that the repo is private) and its page in the Capsid
 * explorer, then Capsomer's system map at level 2: what uses it, its parts, what it uses, and the flows over its
 * parts, each a list Start, Next and Back step (app/enhance/system-map.ts). Every system is in the build, so an id
 * the model lacks answers 404. A private system is shown in full, without its repo link (Dustin, 2026-10-23).
 */
export function headers() {
  return publicHtmlHeaders();
}

const MODEL = loadSystemModel(rawModel);
const DATA = mapData(MODEL);

export function loader({ params }: Route.LoaderArgs) {
  const system = MODEL.systems.find((s) => s.id === params.id);
  if (!system) throw data(null, { status: 404 });
  return { id: system.id };
}

const systemOf = (id: string) => MODEL.systems.find((s) => s.id === id)!;
const trailOf = (id: string): Trail => [
  ["Systems", SYSTEMS_PATH],
  [systemOf(id).name, systemPath(id)],
];

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const s = systemOf(loaderData.id);
  return pageMeta({
    title: `${s.name}: what it is made of and how it connects`,
    description: s.description ?? (s.domain ? `${s.name}, at ${s.domain}.` : s.name),
    path: systemPath(s.id),
    markdown: `${systemPath(s.id)}.md`,
    trail: trailOf(s.id),
  });
}

export default function SystemRoute({ loaderData }: Route.ComponentProps) {
  const s = systemOf(loaderData.id);
  const repo = repoOf(s);
  const facts = [
    s.domain ? (
      <a key="domain" href={`https://${s.domain}`}>
        {s.domain}
      </a>
    ) : null,
    repo ? (
      <a key="repo" href={repo}>
        {repo.replace(/^https:\/\//, "")}
      </a>
    ) : null,
    s.private ? "private repo" : null,
    <a key="explorer" href={explorerUrl(s.id)}>
      {explorerLabel(s.id)}
    </a>,
  ].filter((f) => f !== null);
  const map = systemMapHtml(DATA, {
    id: "system",
    system: s.id,
    label: `How ${s.name} connects`,
    headingLevel: 2,
  });
  return (
    <PageShell>
      <Breadcrumb trail={trailOf(s.id)} />
      <h1 className="page-title cap-layout-grid">{s.name}</h1>
      {s.description ? <p className="systems-lead">{s.description}</p> : null}
      <p className="systems-links">
        {facts.map((f, i) => (
          <span key={i}>
            {i ? " · " : null}
            {f}
          </span>
        ))}
      </p>
      {/* The map is a string from Capsomer, every text in it escaped there. */}
      <div className="systems-map" dangerouslySetInnerHTML={markup(map)} />
      <p className="systems-source">
        Public model, {MODEL.as_of}. <a href={`${systemPath(s.id)}.md`}>Markdown</a>
      </p>
      <template data-island="system-map" />
    </PageShell>
  );
}
