import { Link } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { getEnv } from "~/lib/context";
import { readHealthTile } from "~/lib/health/snapshot.server";
import type { Route } from "./+types/colophon";

import features from "../../content/features.json";
import {
  COLOPHON_DESCRIPTION,
  COLOPHON_INTRO,
  COLOPHON_VERSIONS,
  COLOPHON_SECTIONS,
  AI_DISCLOSURE,
  CAPSID_REPO_URL,
  CAPSOMER_NAME,
  CAPSOMER_SENTENCE_REST,
  CAPSOMER_URL,
  CARREL_NAME,
  CARREL_PAGE_PATH,
  CARREL_SENTENCE_REST,
  CREDITS,
  SECURITY_TRADEOFF,
  SHARED_PACKAGES,
  SITE_OPERATION,
  COLOPHON_TITLE,
  statusLabel,
  COLOPHON_URL,
} from "~/lib/colophon-sections.mjs";
import stack from "../../content/generated/stack.json";
import { PageContents } from "~/components/page-contents";
import { PageShell } from "~/components/page-shell";
import { HEALTH_EDGE_CACHE_CONTROL, publicHtmlHeaders, SITE, pageMeta } from "~/lib/seo";

import "~/styles/evidence-row.css";
import "capsomer/tokens.css";
import "~/styles/prose.css";
import "capsomer/chips.css";
import "capsomer/panel.css";
import "~/styles/colophon.css";

/**
 * Publicly cacheable for cookieless readers only; workers/app.ts downgrades the rest. The short edge
 * policy is for the health tile.
 */
export function headers() {
  return publicHtmlHeaders(undefined, HEALTH_EDGE_CACHE_CONTROL);
}

/**
 * The cached page must not lie: only a `fresh` verdict shows a ratio, with its age in
 * `data-health-age`. Nothing here starts a health run: a Worker fetching its own public URL is an
 * edge round trip naming an origin that changes at cutover.
 */
export async function loader({ context }: Route.LoaderArgs) {
  return { health: await readHealthTile(getEnv(context)) };
}

/**
 * The URL is /colophon (the IndieWeb path machines expect) and the title "How this site is built"
 * (the words readers know). Do not swap them. New facts belong in `stack-notes.json`, where the gate
 * reconciles them.
 */

export function meta() {
  return pageMeta({
    title: `${COLOPHON_TITLE}, ${SITE.name}`,
    description: COLOPHON_DESCRIPTION,
    path: COLOPHON_URL,
    trail: [[COLOPHON_TITLE, COLOPHON_URL]],
  });
}

/** `recordsForPage` reads the same list, so no record can point at a fragment the page does not render. */
function SectionHead({ id }: { id: string }) {
  const section = COLOPHON_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`unknown colophon section "${id}"`);
  return (
    <>
      <h2 id={section.id}>{section.title}</h2>
      <p>{section.lead}</p>
    </>
  );
}

type Anchor = {
  kind: string;
  path?: string;
  gate?: string;
  text?: string;
  id?: string;
  anonymousGet?: boolean;
};

function byComponent() {
  const groups = new Map<string, typeof features.features>();
  for (const feature of features.features) {
    const existing = groups.get(feature.component);
    if (existing) existing.push(feature);
    else groups.set(feature.component, [feature]);
  }
  return [...groups.entries()];
}

/** A gate anchor names the script rather than linking: the scripts are not served. */
function AnchorItem({ anchor }: { anchor: Anchor }) {
  if (anchor.kind === "route" && anchor.path) {
    /* A link a reader cannot follow reads as evidence until clicked, so such a path is named, not linked. */
    const followable =
      !anchor.path.includes(":") && !anchor.path.includes("*") && anchor.anonymousGet !== false;
    return (
      <li>
        <span className="muted">route </span>
        {followable ? (
          <Link to={anchor.path}>
            <code>{anchor.path}</code>
          </Link>
        ) : (
          <code>{anchor.path}</code>
        )}
      </li>
    );
  }
  if (anchor.kind === "gate") {
    return (
      <li>
        <span className="muted">gate </span>
        <code>{anchor.gate}</code>
      </li>
    );
  }
  if (anchor.kind === "assertion") {
    return (
      <li>
        <span className="muted">assertion in </span>
        <code>{anchor.gate}</code>
        <span className="muted">: </span>
        <q>{anchor.text}</q>
      </li>
    );
  }
  return (
    <li>
      <span className="muted">decision </span>
      <code>{anchor.id}</code>
    </li>
  );
}

/** The bindings grouped for the diagram. A kind with no group here lands in "Other", so a new binding still shows. */
const STACK_GROUPS = [
  { label: "Data", kinds: ["d1", "r2", "kv", "durable_object"] },
  { label: "Queues", kinds: ["queue_producer", "queue_consumer"] },
  { label: "AI", kinds: ["ai", "ai_search"] },
  { label: "Media and files", kinds: ["images", "assets"] },
] as const;

/**
 * How a request moves through the stack, drawn from the same bindings data as the table below, so the
 * diagram cannot name a resource the Worker no longer holds. Plain HTML: an ordered list of layers.
 */
function StackDiagram() {
  const grouped = new Set<string>(STACK_GROUPS.flatMap((group) => group.kinds));
  const groups = [
    ...STACK_GROUPS.map((group) => ({
      label: group.label,
      names: stack.bindings
        .filter((binding) => (group.kinds as readonly string[]).includes(binding.kind))
        .map((binding) => binding.name),
    })),
    {
      label: "Other",
      names: stack.bindings
        .filter((binding) => !grouped.has(binding.kind))
        .map((binding) => binding.name),
    },
  ].filter((group) => group.names.length > 0);
  return (
    <figure className="colophon-stack">
      <ol className="colophon-stack-layers" aria-label="Layers of the stack, top to bottom">
        <li>
          <span className="colophon-stack-tag">Callers</span>
          <ul className="colophon-stack-boxes">
            <li>Readers and their browsers</li>
            <li>
              <a href="#run">Carrel</a>, through <code>/api/carrel/v1</code>
            </li>
            <li>
              <a href="#run">Capsid</a> and the admin server, through <code>/api/operator</code>
            </li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">Cloudflare edge</span>
          <ul className="colophon-stack-boxes">
            <li>Edge page cache</li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">Worker</span>
          <ul className="colophon-stack-boxes">
            <li>React Router</li>
            <li>
              <a href="#run">Prelum, site-runtime, site-api</a>
            </li>
            <li>
              <a href={CAPSOMER_URL}>Capsomer</a>
            </li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">
            <a href="#bindings">Bindings</a>
          </span>
          <ul className="colophon-stack-boxes">
            {groups.map((group) => (
              <li key={group.label}>
                <strong>{group.label}</strong>
                <span className="colophon-stack-names">{group.names.join(", ")}</span>
              </li>
            ))}
          </ul>
        </li>
      </ol>
      <figcaption>How a request moves through the stack, top to bottom.</figcaption>
    </figure>
  );
}

/** A statement as a lead sentence and the rest as a short list, so it reads in a glance and not as a wall. */
function Statements({ sentences }: { sentences: readonly string[] }) {
  const [lead, ...rest] = sentences;
  return (
    <>
      <p className="colophon-note-lead">{lead}</p>
      <ul className="colophon-note-list">
        {rest.map((sentence) => (
          <li key={sentence.slice(0, 32)}>{sentence}</li>
        ))}
      </ul>
    </>
  );
}

/** A /health status as a cockpit light: at rest, caution (amber) or warning (red), and the word it says. */
const LIGHTS = {
  pass: { state: "normal", word: "Pass" },
  warn: { state: "caution", word: "Caution" },
  fail: { state: "warning", word: "Warning" },
} as const;

/**
 * Every /health check as a tile on a cockpit caution and warning panel (capsomer/manual.css .cap-annunciator), from
 * the snapshot the health-snapshot cron job stores. A stale snapshot shows every tile dark, since an old light is not a reading;
 * with no snapshot there is no panel, and the evidence line above says why.
 */
function HealthPanel({ health }: { health: Route.ComponentProps["loaderData"]["health"] }) {
  if (health.state !== "fresh" && health.state !== "stale") return null;
  const fresh = health.state === "fresh";
  return (
    <ul
      className="cap-annunciator colophon-annunciator"
      aria-label={fresh ? "Health checks" : "Health checks, last read too long ago"}
    >
      {health.checks.map((check) => {
        const light = fresh ? LIGHTS[check.status] : { state: "off", word: "No reading" };
        return (
          <li key={check.name} data-state={light.state}>
            {check.name}
            <span className="cap-annunciator-state">{light.word}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Colophon({ loaderData }: Route.ComponentProps) {
  const { health } = loaderData;
  const gates = stack.gates.length;
  /*
   * `missing` and `stale` show no ratio: a number beside "health checks passing" is read as the
   * current answer whatever sentence sits under it.
   */
  const healthValue =
    health.state === "fresh" ? `${health.total - health.failed}/${health.total}` : "--";
  const healthAge = "ageSeconds" in health ? String(health.ageSeconds) : undefined;

  return (
    <PageShell
      rail={
        <PageContents
          label="Sections"
          sections={COLOPHON_SECTIONS.map((section) => ({ id: section.id, text: section.title }))}
        />
      }
    >
      <h1 className="page-title cap-layout-grid">{COLOPHON_TITLE}</h1>

      {/* `data-health-age` is in seconds: `check:browser` and `verify-live` read the attribute, not the sentence. */}
      <div className="colophon-evidence">
        <EvidenceRow
          facts={[
            <a key="bindings" href="#bindings">
              {stack.bindings.length} resources
            </a>,
            <a key="gates" href="#gates">
              {gates} {gates === 1 ? "check" : "checks"}
            </a>,
            <span key="health" className="evidence-health" data-health-age={healthAge}>
              <Link to="/health">
                {/* A failed read says so; "--" is kept for a snapshot that was never written or is too old. */}
                {health.state === "unreadable"
                  ? "health status unreadable"
                  : `${healthValue} passing`}
              </Link>
            </span>,
          ]}
        />
      </div>

      <HealthPanel health={health} />

      <p className="colophon-versions">{COLOPHON_VERSIONS}</p>
      <p className="colophon-intro">{COLOPHON_INTRO}</p>

      <StackDiagram />

      <div className="prose colophon-body" data-colophon>
        <SectionHead id="run" />
        {SITE_OPERATION.map((sentence) => (
          <p key={sentence.slice(0, 32)}>{sentence}</p>
        ))}
        <ul className="colophon-systems">
          <li className="cap-panel">
            <p className="cap-panel-body">
              <Link to={CARREL_PAGE_PATH}>{CARREL_NAME}</Link>
              {CARREL_SENTENCE_REST}
            </p>
          </li>
          <li className="cap-panel">
            <p className="cap-panel-body">
              Capsid's source is public <a href={CAPSID_REPO_URL}>on GitHub</a>.
            </p>
          </li>
          <li className="cap-panel">
            <p className="cap-panel-body">
              <a href={CAPSOMER_URL}>{CAPSOMER_NAME}</a>
              {CAPSOMER_SENTENCE_REST}
            </p>
          </li>
          {SHARED_PACKAGES.map((pkg) => (
            <li key={pkg.name} className="cap-panel">
              <p className="cap-panel-body">
                <a href={pkg.url}>{pkg.name}</a>
                {pkg.rest}
              </p>
            </li>
          ))}
        </ul>

        <SectionHead id="features" />
        <p>
          {features.features.length} entries. What the whole network does is on the{" "}
          <Link to="/features">features page</Link>.
        </p>
        <div
          className="cap-chips colophon-chips"
          data-variant="solid"
          role="group"
          aria-label="Show one group of features"
          hidden
        >
          <button type="button" className="cap-chip" data-value="all" aria-pressed="true">
            All<span className="cap-chip-count">{features.features.length}</span>
          </button>
          {byComponent().map(([component, entries]) => (
            <button
              key={component}
              type="button"
              className="cap-chip"
              data-value={component}
              aria-pressed="false"
            >
              {component}
              <span className="cap-chip-count">{entries.length}</span>
            </button>
          ))}
        </div>
        <span className="colophon-status" role="status" />
        <ul className="colophon-cards colophon-features">
          {features.features.map((feature) => (
            <li
              key={feature.name}
              className="cap-panel colophon-card"
              data-group={feature.component}
            >
              <div className="cap-panel-body">
                <p className="colophon-card-tag">
                  <span>{feature.component}</span>
                </p>
                <h3>{feature.name}</h3>
                <p>{feature.what}</p>
                <ul className="colophon-anchors">
                  {(feature.anchors as Anchor[]).map((anchor, i) => (
                    <AnchorItem key={i} anchor={anchor} />
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>

        <section className="cap-panel colophon-note" aria-labelledby="security">
          <div className="cap-panel-body">
            <SectionHead id="security" />
            <Statements sentences={SECURITY_TRADEOFF} />
          </div>
        </section>

        <SectionHead id="runtime" />
        <dl className="colophon-facts">
          <div>
            <dt>Compatibility date</dt>
            <dd>
              <code>{stack.runtime.compatibilityDate}</code>
            </dd>
          </div>
          <div>
            <dt>Compatibility flags</dt>
            <dd>
              {stack.runtime.compatibilityFlags.length > 0
                ? stack.runtime.compatibilityFlags.join(", ")
                : "none"}
            </dd>
          </div>
          <div>
            <dt>Node</dt>
            <dd>
              <code>{stack.runtime.nodeVersion}</code>
            </dd>
          </div>
        </dl>

        <SectionHead id="bindings" />
        <p>{stack.bindings.length} resources.</p>
        <div
          className="cap-chips colophon-kinds"
          data-variant="solid"
          role="group"
          aria-label="Show one kind of resource"
          hidden
        >
          <button type="button" className="cap-chip" data-value="all" aria-pressed="true">
            All<span className="cap-chip-count">{stack.bindings.length}</span>
          </button>
          {[...new Set(stack.bindings.map((binding) => binding.kind))].map((kind) => (
            <button
              key={kind}
              type="button"
              className="cap-chip"
              data-value={kind}
              aria-pressed="false"
            >
              {kind}
              <span className="cap-chip-count">
                {stack.bindings.filter((binding) => binding.kind === kind).length}
              </span>
            </button>
          ))}
        </div>
        <table className="colophon-table" data-cols="3">
          <thead>
            <tr>
              <th scope="col">Resource</th>
              <th scope="col">What it is</th>
              <th scope="col">Why it is load-bearing</th>
            </tr>
          </thead>
          <tbody>
            {stack.bindings.map((binding) => (
              <tr key={binding.id} data-kind={binding.kind}>
                <th scope="row" id={`binding-${binding.name}`}>
                  <code>{binding.name}</code> <span className="muted">({binding.kind})</span>
                </th>
                <td>{binding.what}</td>
                <td>{binding.whyLoadBearing}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="colophon-lists">
          <div>
            <SectionHead id="schema" />
            <p>{stack.migrations.length} migrations.</p>
            <input
              type="search"
              className="colophon-find"
              aria-label="Filter migrations"
              placeholder="Filter"
              data-find="migrations"
              hidden
            />
            <ul className="colophon-scroll" aria-label="Migrations" data-list="migrations">
              {stack.migrations.map((file) => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHead id="gates" />
            <p>{stack.gates.length} checks.</p>
            <input
              type="search"
              className="colophon-find"
              aria-label="Filter checks"
              placeholder="Filter"
              data-find="checks"
              hidden
            />
            <ul className="colophon-scroll" aria-label="Checks" data-list="checks">
              {stack.gates.map((gate) => (
                <li key={gate}>
                  <code>{gate}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHead id="dependencies" />
            <p>{stack.dependencies.length} runtime dependencies.</p>
            <input
              type="search"
              className="colophon-find"
              aria-label="Filter runtime dependencies"
              placeholder="Filter"
              data-find="dependencies"
              hidden
            />
            <ul
              className="colophon-scroll"
              aria-label="Runtime dependencies"
              data-list="dependencies"
            >
              {stack.dependencies.map((dep) => (
                <li key={dep.name}>
                  <code>{dep.name}</code> <span className="muted dep-range">{dep.range}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SectionHead id="credits" />
        <ul className="colophon-systems">
          {CREDITS.map((credit) => (
            <li key={credit.name} className="cap-panel">
              <p className="cap-panel-body">
                <a href={credit.url}>{credit.name}</a>
                {credit.rest}
              </p>
            </li>
          ))}
        </ul>

        <SectionHead id="not-adopted" />
        <p>{stack.notAdopted.length} entries.</p>
        <table className="colophon-table">
          <thead>
            <tr>
              <th scope="col">Choice</th>
              <th scope="col">Why not</th>
            </tr>
          </thead>
          <tbody>
            {stack.notAdopted.map((entry) => (
              <tr key={entry.name}>
                <th scope="row">
                  {entry.name} <span className="muted">({statusLabel(entry.status)})</span>
                </th>
                <td>{entry.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="cap-panel colophon-note" aria-labelledby="ai">
          <div className="cap-panel-body">
            <SectionHead id="ai" />
            <Statements sentences={AI_DISCLOSURE} />
          </div>
        </section>
      </div>

      <template data-island="colophon" />

      <p className="muted">
        For what the site records about a visit, and where each of those facts lives in the code,
        see <Link to="/privacy">privacy</Link>.
      </p>
    </PageShell>
  );
}
