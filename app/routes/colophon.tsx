import { Link } from "react-router";

import features from "../../content/features.json";
import {
  COLOPHON_DESCRIPTION,
  COLOPHON_INTRO,
  COLOPHON_SECTIONS,
  AI_DISCLOSURE,
  SECURITY_TRADEOFF,
  COLOPHON_TITLE,
  statusLabel,
  COLOPHON_URL,
} from "~/lib/colophon-sections.mjs";
import stack from "../../content/generated/stack.json";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { publicHtmlHeaders, SITE,
  pageMeta,
} from "~/lib/seo";

import "~/styles/prose.css";

/**
 * Publicly cacheable for COOKIELESS readers only. See home.tsx; same shape,
 * same downgrade in workers/app.ts.
 */
export function headers() {
  return publicHtmlHeaders();
}

/**
 * The colophon.
 *
 * THE URL IS /colophon AND THE TITLE IS "How this site is built". A colophon is an
 * IndieWeb convention and machines expect the conventional path, but the word is
 * one many readers do not know, so the title takes the legibility. Do not swap
 * them.
 *
 * EVERYTHING HERE IS READ FROM A GENERATED ARTIFACT. Nothing on this page is typed
 * out. If you find yourself adding a fact here, it belongs in `stack-notes.json`
 * where the gate can reconcile it.
 *
 * FLAT: no filtering, no facets, no taxonomy.
 *
 * NOTHING CLIENT-SIDE, and there is nothing to enhance. Hard rule 9 makes every
 * public reading route server-complete without script; this one is server-complete
 * because it is static markup over a build artifact, so the fallback and the page
 * are the same thing.
 */

export function meta() {
  return pageMeta({
    title: `${COLOPHON_TITLE}, ${SITE.name}`,
    description: COLOPHON_DESCRIPTION,
    path: COLOPHON_URL,
  });
}

/**
 * The heading and lead BOTH read from the descriptor. `recordsForPage` reads the
 * same list, so a record can never point at a fragment the page does not render.
 * That failure would be silent: the hit still appears and scrolls nowhere.
 */
function SectionHead({ id }: { id: string }) {
  const section = COLOPHON_SECTIONS.find((s) => s.id === id);
  // Fail loudly rather than rendering a headless section. An id the descriptor
  // does not know is a typo here, and the gate asserts the reverse direction.
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
  /**
   * False when an anonymous GET does not produce a page: the anchor still NAMES the
   * route, it just stops pretending to be a destination. `check:features` derives
   * the same answer and refuses a declaration that disagrees.
   */
  anonymousGet?: boolean;
};

/**
 * A Map preserves insertion order, so the grouping is the author's rather than
 * alphabetical. That is deliberately all the structure this page has: facets over a
 * few dozen entries are decoration, and the right axes will be obvious from having
 * the data.
 */
function byComponent() {
  const groups = new Map<string, typeof features.features>();
  for (const feature of features.features) {
    const existing = groups.get(feature.component);
    if (existing) existing.push(feature);
    else groups.set(feature.component, [feature]);
  }
  return [...groups.entries()];
}

/**
 * Every claim links to its evidence. A route anchor becomes a real link. A gate
 * anchor NAMES the script rather than linking, because the scripts are not served,
 * and `check:features` guarantees the name still resolves. A decision anchor is
 * context and says so.
 */
function AnchorItem({ anchor }: { anchor: Anchor }) {
  if (anchor.kind === "route" && anchor.path) {
    /*
     * TWO REASONS A ROUTE IS NOT A DESTINATION. A PARAMETER SEGMENT is a declaration
     * with no one URL it stands for. AN ANONYMOUS GET THAT IS NOT A PAGE is the other.
     *
     * A link a reader cannot follow is worse than no link: it reads as evidence until
     * you click it. The path is still NAMED.
     */
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

export default function Colophon() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          {/*
           * THE TITLE IS READ, NOT TYPED. This h1 was the one place it was a literal, so
           * renaming the page would have changed the tab, the search record and the social
           * card while the heading kept the old words.
           */}
          <h1 className="page-title">{COLOPHON_TITLE}</h1>

          <div className="prose">
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

            {/*
             * Rendered from the SAME constant the search record is built from, so the page
             * cannot describe it one way and the index another. Prose, not a table: it is an
             * argument.
             */}
            <SectionHead id="security" />
            {SECURITY_TRADEOFF.map((sentence) => (
              <p key={sentence.slice(0, 32)}>{sentence}</p>
            ))}

            {/*
             * Rendered from the SAME constant the search index is built from. Plain
             * paragraphs: this is the section a reader is most likely to have arrived for, and
             * it should read as prose rather than a compliance notice.
             */}
            <SectionHead id="ai" />
            {AI_DISCLOSURE.map((sentence) => (
              <p key={sentence.slice(0, 32)}>{sentence}</p>
            ))}

            <SectionHead id="not-adopted" />
            <p>{stack.notAdopted.length} entries.</p>
            <dl>
              {stack.notAdopted.map((entry) => (
                <div key={entry.name}>
                  {/*
                   * The status is spelled out in TEXT, not carried by color or position. Usage
                   * rule 1: hue is never the sole channel.
                   */}
                  <dt>
                    {entry.name}{" "}
                    <span className="muted">({statusLabel(entry.status)})</span>
                  </dt>
                  <dd>{entry.reason}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/*
           * The colophon says how the site is BUILT; /privacy says what it RECORDS. A
           * reader who found either is likely looking for the other, so each names the other
           * rather than leaving it to the footer.
           */}
          <p className="muted">
            For what the site records about a visit, and where each of those facts lives in
            the code, see <Link to="/privacy">privacy</Link>.
          </p>
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
