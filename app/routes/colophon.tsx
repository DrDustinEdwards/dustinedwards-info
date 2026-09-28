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
  SECURITY_TRADEOFF,
  SITE_OPERATION,
  COLOPHON_TITLE,
  statusLabel,
  COLOPHON_URL,
} from "~/lib/colophon-sections.mjs";
import stack from "../../content/generated/stack.json";
import { PageShell } from "~/components/page-shell";
import { HEALTH_EDGE_CACHE_CONTROL, publicHtmlHeaders, SITE,
  pageMeta,
} from "~/lib/seo";

import "~/styles/evidence-row.css";
import "~/styles/prose.css";

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
      !anchor.path.includes(":") &&
      !anchor.path.includes("*") &&
      anchor.anonymousGet !== false;
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
    <PageShell>
      <h1 className="page-title">{COLOPHON_TITLE}</h1>

      {/* `data-health-age` is in seconds: `check:browser` and `verify-live` read the attribute, not the sentence. */}
      <div className="colophon-evidence">
        <EvidenceRow
          facts={[
            <a href="#bindings">{stack.bindings.length} resources</a>,
            <a href="#gates">
              {gates} {gates === 1 ? "check" : "checks"}
            </a>,
            <span className="evidence-health" data-health-age={healthAge}>
              <Link to="/api/health">
                {/* A failed read says so; "--" is kept for a snapshot that was never written or is too old. */}
                {health.state === "unreadable" ? "health status unreadable" : `${healthValue} passing`}
              </Link>
            </span>,
          ]}
        />
      </div>

      <div className="prose">
        <p>{COLOPHON_VERSIONS}</p>
        <p>{COLOPHON_INTRO}</p>

        <SectionHead id="runtime" />
        <dl>
          <dt>Compatibility date</dt>
          <dd>
            <code>{stack.runtime.compatibilityDate}</code>
          </dd>
          <dt>Compatibility flags</dt>
          <dd>
            {stack.runtime.compatibilityFlags.length > 0
              ? stack.runtime.compatibilityFlags.join(", ")
              : "none"}
          </dd>
          <dt>Node</dt>
          <dd>
            <code>{stack.runtime.nodeVersion}</code>
          </dd>
        </dl>

        <SectionHead id="bindings" />
        <p>{stack.bindings.length} resources.</p>
        {stack.bindings.map((binding) => (
          <section key={binding.id} aria-labelledby={`binding-${binding.name}`}>
            <h3 id={`binding-${binding.name}`}>
              <code>{binding.name}</code>{" "}
              <span className="muted">({binding.kind})</span>
            </h3>
            <p>{binding.what}</p>
            <p>
              <strong>Why it is load-bearing.</strong> {binding.whyLoadBearing}
            </p>
          </section>
        ))}

        <SectionHead id="schema" />
        <p>{stack.migrations.length} migrations.</p>
        <ul>
          {stack.migrations.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>

        <SectionHead id="gates" />
        <p>{stack.gates.length} checks.</p>
        <ul>
          {stack.gates.map((gate) => (
            <li key={gate}>
              <code>{gate}</code>
            </li>
          ))}
        </ul>

        <SectionHead id="dependencies" />
        <p>{stack.dependencies.length} runtime dependencies.</p>
        <ul>
          {stack.dependencies.map((dep) => (
            <li key={dep.name}>
              <code>{dep.name}</code> <span className="muted">{dep.range}</span>
            </li>
          ))}
        </ul>

        <SectionHead id="features" />
        <p>{features.features.length} entries.</p>

        {byComponent().map(([component, entries]) => (
          <section key={component} aria-labelledby={`c-${component.replace(/\s+/g, "-")}`}>
            <h3 id={`c-${component.replace(/\s+/g, "-")}`}>{component}</h3>
            {entries.map((feature) => (
              <section key={feature.name}>
                <h4>{feature.name}</h4>
                <p>{feature.what}</p>
                <ul>
                  {(feature.anchors as Anchor[]).map((anchor, i) => (
                    <AnchorItem key={i} anchor={anchor} />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))}

        <SectionHead id="security" />
        {SECURITY_TRADEOFF.map((sentence) => (
          <p key={sentence.slice(0, 32)}>{sentence}</p>
        ))}

        <SectionHead id="ai" />
        {AI_DISCLOSURE.map((sentence) => (
          <p key={sentence.slice(0, 32)}>{sentence}</p>
        ))}

        <SectionHead id="run" />
        {SITE_OPERATION.map((sentence) => (
          <p key={sentence.slice(0, 32)}>{sentence}</p>
        ))}
        <p>
          Capsid's source is public <a href={CAPSID_REPO_URL}>on GitHub</a>.
        </p>

        <SectionHead id="not-adopted" />
        <p>{stack.notAdopted.length} entries.</p>
        <dl>
          {stack.notAdopted.map((entry) => (
            <div key={entry.name}>
              <dt>
                {entry.name}{" "}
                <span className="muted">({statusLabel(entry.status)})</span>
              </dt>
              <dd>{entry.reason}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="muted">
        For what the site records about a visit, and where each of those facts lives in
        the code, see <Link to="/privacy">privacy</Link>.
      </p>
    </PageShell>
  );
}
