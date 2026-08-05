import features from "../../content/features.json";
import stack from "../../content/generated/stack.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { HTML_VARY, PUBLIC_CACHE_CONTROL, SITE } from "~/lib/seo";

/**
 * Publicly cacheable for COOKIELESS readers only. See home.tsx; same shape,
 * same downgrade in workers/app.ts.
 */
export function headers() {
  return { "Cache-Control": PUBLIC_CACHE_CONTROL, Vary: HTML_VARY };
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

const DESCRIPTION =
  "The stack behind dustinedwards.info: every binding, migration and gate, " +
  "generated from the repository's own configuration, with what was " +
  "deliberately not adopted and why.";

export function meta() {
  return [
    { title: `How this site is built, ${SITE.name}` },
    { name: "description", content: DESCRIPTION },
  ];
}

/** The two states a not-adopted entry may declare, spelled for a reader. */
const STATUS_LABEL: Record<string, string> = {
  refused: "Refused",
  "accepted-gap": "Accepted gap",
};

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
          <a href={anchor.path}>
            <code>{anchor.path}</code>
          </a>
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
          <h1 className="page-title">How this site is built</h1>

          <div className="prose">
            <p>
              Everything below is generated from this repository's own
              configuration and checked against it in both directions on every
              build. If a binding is added and this page is not regenerated, the
              build fails. The one thing no generator can produce is why each
              piece is load-bearing, so those notes are written by hand and
              reconciled against the bindings they describe.
            </p>

            <h2 id="runtime">Runtime</h2>
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

            <h2 id="bindings">Bindings</h2>
            <p>
              {stack.bindings.length} resources, every one of them Cloudflare.
              There is no other provider anywhere in the stack.
            </p>
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

            <h2 id="schema">Schema</h2>
            <p>
              {stack.migrations.length} hand-written migrations. drizzle-kit is
              deliberately not a dependency, and because the database export
              command is broken on this schema, this directory is the only copy
              of the table definitions that exists anywhere.
            </p>
            <ul>
              {stack.migrations.map((file) => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
            </ul>

            <h2 id="gates">Gates</h2>
            <p>
              {stack.gates.length} checks run before anything ships. The list is
              derived from the scripts themselves rather than maintained beside
              them, so a gate that is added and forgotten is not possible.
            </p>
            <ul>
              {stack.gates.map((gate) => (
                <li key={gate}>
                  <code>{gate}</code>
                </li>
              ))}
            </ul>

            <h2 id="dependencies">Dependencies</h2>
            <p>
              {stack.dependencies.length} runtime dependencies. Build tooling is
              excluded: this is what serves the site, not what assembles it.
            </p>
            <ul>
              {stack.dependencies.map((dep) => (
                <li key={dep.name}>
                  <code>{dep.name}</code> <span className="muted">{dep.range}</span>
                </li>
              ))}
            </ul>

            <h2 id="features">What it does</h2>
            <p>
              Everything above is generated from configuration. Nothing below
              can be: a sentence like "the editor refuses a save if the branch
              moved" is in no config file and never will be. So each entry
              carries an anchor, and a build gate verifies that the thing the
              claim is about still exists: the route is still declared, the
              gate is still there, the exact assertion text is still in its
              script. That catches most rot, because prose usually goes stale by
              describing something that was removed or renamed.
            </p>
            <p>
              It does not verify that any sentence here is TRUE. That limit is
              stated in the gate's own header rather than left implied, and it is
              the honest boundary of the technique.
            </p>

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

            <h2 id="not-adopted">What was not adopted</h2>
            <p>
              Anyone can list what they shipped. Two different things are listed
              here and the difference matters: a <strong>refusal</strong> is a
              decision that was made and recorded, and an{" "}
              <strong>accepted gap</strong> is something missing that nobody
              ruled on, written down so it is not mistaken for a choice.
            </p>
            <dl>
              {stack.notAdopted.map((entry) => (
                <div key={entry.name}>
                  {/* The status is spelled out in TEXT, not carried by colour
                      or by position. design-tokens usage rule 1: hue is never
                      the sole channel, and a reader who cannot see the styling
                      still gets the distinction. */}
                  <dt>
                    {entry.name}{" "}
                    <span className="muted">
                      ({STATUS_LABEL[entry.status] ?? entry.status})
                    </span>
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
