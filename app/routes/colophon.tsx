import { Link } from "react-router";

import features from "../../content/features.json";
import {
  COLOPHON_DESCRIPTION,
  COLOPHON_INTRO,
  COLOPHON_SECTIONS,
  SECURITY_TRADEOFF,
  COLOPHON_TITLE,
  statusLabel,
  COLOPHON_URL,
} from "~/lib/colophon-sections.mjs";
import stack from "../../content/generated/stack.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { publicHtmlHeaders, SITE,
  pageMeta,
} from "~/lib/seo";

/**
 * Publicly cacheable for COOKIELESS readers only. See home.tsx; same shape,
 * same downgrade in workers/app.ts.
 */
export function headers() {
  return publicHtmlHeaders();
}

/**
 * The colophon. Ruling: colophon-page.md, 2026-08-05.
 *
 * **The URL is /colophon and the title is "How this site is built", and the
 * split is deliberate.** A colophon is an IndieWeb convention with a lineage,
 * and machines and tooling expect the conventional top-level path. But
 * "colophon" is a word many readers do not know, so the TITLE takes the
 * legibility while the URL takes the convention. Do not swap them.
 *
 * **Everything here is READ FROM A GENERATED ARTIFACT.** `content/generated/
 * stack.json` is emitted by `build:stack` from the repo's own configuration and
 * reconciled by `check:stack` in both directions. Nothing on this page is typed
 * out: no binding name, no version, no migration, no gate. That is the whole
 * design, on the ruling's evidence rather than on taste, because a hand-written
 * reference page has a 100% chance of being wrong within a quarter and this
 * site has already published three quantitative claims that went wrong.
 *
 * If you find yourself adding a fact here, it belongs in `stack-notes.json`
 * where the gate can reconcile it, or in the generator where it can be derived.
 *
 * **FLAT, no filtering, no facets, no taxonomy.** Ruled: roughly ten components
 * and a few dozen entries do not need a menu, and the right axes will be
 * obvious from having the data rather than from guessing now.
 *
 * **NOTHING CLIENT-SIDE, and there is nothing to enhance.** Hard rule 9 makes
 * every public reading route server-complete without script; this one is
 * server-complete because it is entirely static markup over a build artifact.
 * There is no interaction to progressively enhance, which is why this file
 * imports no `~/enhance` chunk and declares no fallback: the fallback and the
 * page are the same thing.
 *
 * **Styled by `.prose`, deliberately**, exactly as the Roster page is. It
 * already carries the ratified treatment for h2, dl, ul and code, and
 * `check:contrast` already covers those, so this page needs no CSS of its own.
 * A `.colophon-*` block would be per-page rules in a large stylesheet for
 * markup that prose already describes.
 */

export function meta() {
  return pageMeta({
    title: `${COLOPHON_TITLE}, ${SITE.name}`,
    description: COLOPHON_DESCRIPTION,
    path: COLOPHON_URL,
  });
}

/**
 * The heading and lead for a section, BOTH read from the descriptor.
 *
 * No `id` or heading text is typed in this file. `recordsForPage` reads the
 * same list, so a renamed section changes the page and its search records
 * together, and a record can never point at a fragment the page does not
 * render. That failure would be silent: the hit still appears and scrolls
 * nowhere.
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
};

/**
 * Features grouped by component, in the order the data file declares them.
 *
 * A Map preserves insertion order, so the grouping is the author's rather than
 * alphabetical. That is the closest thing this page has to structure, and it is
 * deliberately all it has: the ruling forbids building the taxonomy before the
 * data exists, on the grounds that facets over a few dozen entries are
 * decoration and the right axes will be obvious from having the data.
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
 * One anchor, rendered as the thing that proves the claim.
 *
 * **This is the page's best property**, per the ruling: every claim links to
 * its evidence. A route anchor becomes a real link, so a reader can go and see
 * it. A gate or assertion anchor NAMES the script rather than linking, because
 * the scripts are not served; the name is enough to find it in the repository,
 * and `check:features` is what guarantees the name still resolves to something.
 *
 * A decision anchor is context and says so. It cannot be verified offline,
 * which is why the gate refuses to let one stand as a feature's only anchor.
 */
function AnchorItem({ anchor }: { anchor: Anchor }) {
  if (anchor.kind === "route" && anchor.path) {
    // Only a path with no parameter segment is a URL a reader can follow.
    // `/blog/:slug` is a declaration, not a destination.
    const followable = !anchor.path.includes(":") && !anchor.path.includes("*");
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
      <main className="page" id="main">
        <div className="page-inner">
          {/* THE TITLE IS READ, NOT TYPED. meta() and recordsForPage both use
              COLOPHON_TITLE, and this h1 was the one place it was a literal, so
              renaming the page would have changed the tab, the search record and
              the social card while the heading kept the old words. That is the
              exact drift colophon-sections.mjs exists to prevent, inside the
              page it protects. */}
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
              The security tradeoff, rendered from the SAME constant the search
              record is built from, so the page cannot describe it one way and
              the index another. Prose, not a table: it is an argument, and a
              reader deciding whether to trust the claim needs the reasoning
              rather than a row.
            */}
            <SectionHead id="security" />
            {SECURITY_TRADEOFF.map((sentence) => (
              <p key={sentence.slice(0, 32)}>{sentence}</p>
            ))}

            <SectionHead id="not-adopted" />
            <p>{stack.notAdopted.length} entries.</p>
            <dl>
              {stack.notAdopted.map((entry) => (
                <div key={entry.name}>
                  {/* The status is spelled out in TEXT, not carried by colour
                      or by position. design-tokens usage rule 1: hue is never
                      the sole channel, and a reader who cannot see the styling
                      still gets the distinction. */}
                  <dt>
                    {entry.name}{" "}
                    <span className="muted">({statusLabel(entry.status)})</span>
                  </dt>
                  <dd>{entry.reason}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
