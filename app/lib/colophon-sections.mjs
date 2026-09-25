/*
 * One list read by both the page and the search index: a record pointing at a
 * fragment the page no longer has still looks like a hit and scrolls nowhere.
 * Nothing here reads the clock, filesystem or git; records must be pure.
 */

export const COLOPHON_URL = "/colophon";

/** Deliberately not the URL: `/colophon` is the IndieWeb convention, but the word is not widely known. */
export const COLOPHON_TITLE = "How this site is built";

export const COLOPHON_DESCRIPTION =
  "The stack behind dustinedwards.info: every binding, migration and gate, " +
  "generated from the repository's own configuration, with what was " +
  "deliberately not adopted and why.";

export const COLOPHON_INTRO =
  "Everything below is generated from this repository's own configuration and " +
  "checked against it in both directions on every build. If a binding is added " +
  "and this page is not regenerated, the build fails. The one thing no " +
  "generator can produce is why each piece is load-bearing, so those notes are " +
  "written by hand and reconciled against the bindings they describe.";

/**
 * Order is load-bearing: record `ordinal` is derived from the index here.
 *
 * @type {ReadonlyArray<{ id: string, title: string, lead: string }>}
 */
export const COLOPHON_SECTIONS = /** @type {const} */ ([
  {
    id: "runtime",
    title: "Runtime",
    lead:
      "The compatibility date, the flags the Worker runs under, and the Node " +
      "version the build is pinned to.",
  },
  {
    id: "bindings",
    title: "Bindings",
    lead:
      "Every resource this Worker holds a handle to, with what it is for and " +
      "the measurement that put it there rather than a logo wall.",
  },
  {
    id: "schema",
    title: "Schema",
    lead:
      "Hand-written migrations, applied in order. drizzle-kit is deliberately " +
      "not a dependency, and because the database export command is broken on " +
      "this schema, this directory is the only copy of the table definitions " +
      "that exists anywhere.",
  },
  {
    id: "gates",
    title: "Gates",
    lead:
      "Checks that run before anything ships. The list is derived from the " +
      "scripts themselves rather than maintained beside them, so a gate that " +
      "is added and forgotten is not possible.",
  },
  {
    id: "dependencies",
    title: "Dependencies",
    lead:
      "The runtime dependencies. Build tooling is excluded: this is what " +
      "serves the site, not what assembles it.",
  },
  {
    id: "features",
    title: "What it does",
    lead:
      "Nothing in this section can be generated from configuration, so each " +
      "entry carries an anchor and a gate verifies that the thing the claim is " +
      "about still exists. It does not verify that the sentence is true, which " +
      "is the honest boundary of the technique.",
  },
  {
    id: "security",
    title: "A tradeoff in the security headers",
    lead:
      "The content security policy is enforced, not merely reported. One part " +
      "of it is a compromise rather than a clean win, and the compromise is " +
      "worth stating plainly.",
  },
  {
    id: "ai",
    title: "AI disclosure",
    lead:
      "This site is built with AI assistance and says so here rather than " +
      "leaving you to guess, because a site about how it is built owes you " +
      "that before it owes you anything else.",
  },
  {
    id: "not-adopted",
    title: "What was not adopted",
    lead:
      "Anyone can list what they shipped. A refusal is a decision that was " +
      "made and recorded: not a thing nobody got to, but a thing somebody " +
      "ruled out, with the reason beside it.",
  },
]);

/** @type {ReadonlyArray<string>} */
export const SECURITY_TRADEOFF = Object.freeze([
  "Every response carries a one-time number that scripts on the page must " +
    "quote to be allowed to run. That number is generated per response.",
  "Seven pages of this site are cached at Cloudflare's edge and served to " +
    "everyone from the same stored copy for up to ten minutes. The number is " +
    "part of that copy, so visitors served from one cache entry share it.",
  "We took that trade deliberately. The alternative is to stop caching those " +
    "pages, which would make every reader wait for the origin on every visit.",
  "It is acceptable only because these pages carry no writing from anyone but " +
    "me. There are no comments and no user submissions, so there is nowhere " +
    "for a stranger's script to get in and use the shared number.",
]);

/**
 * The last sentence is conditional on purpose: provider text marks do not survive
 * hand editing, so the page must not claim a reader can check for one.
 *
 * @type {ReadonlyArray<string>}
 */
export const AI_DISCLOSURE = Object.freeze([
  "The code and the prose here are written with AI assistance. The model is " +
    "Anthropic's Claude, driven through Claude Code, and it reaches this site " +
    "through exactly the same publishing API and the same gates a person does.",
  "Nothing goes public on a model's say-so. Making a post public for the first " +
    "time is reserved to me and the reservation is enforced in code, not asked " +
    "for in a prompt: an agent that attempts it is refused by name.",
  "Every published post has been read and edited by me before it went live, so " +
    "what you are reading is human-reviewed writing I am answerable for rather " +
    "than model output passed straight through.",
  "Where a provider marks its model's output in a machine-readable way, that " +
    "mark does not survive being edited, so it is not something you can check " +
    "on this page. The review above is the guarantee instead, which is why it " +
    "is stated as a practice and not as a badge.",
]);

export const COLOPHON_ANCHORS = COLOPHON_SECTIONS.map((s) => s.id);

/**
 * `check:features` asserts both directions over this map, so a label no entry
 * uses fails the gate; add a status here only together with its first entry.
 *
 * @type {Record<string, string>}
 */
export const STATUS_LABEL = {
  refused: "Refused",
};

/**
 * @param {string} status
 * @returns {string}
 */
export function statusLabel(status) {
  const label = STATUS_LABEL[status];
  if (!label) {
    throw new Error(
      `no label for not-adopted status "${status}". Add one to STATUS_LABEL, ` +
        `or the page and the search index would disagree about what it is called.`,
    );
  }
  return label;
}

/**
 * @param {any} stack   content/generated/stack.json
 * @param {any} features content/features.json
 */
export function colophonPages(stack, features) {
  return [colophonPageInput(stack, features)];
}

/**
 * @param {any} stack   content/generated/stack.json
 * @param {any} features content/features.json
 */
function colophonPageInput(stack, features) {
  /** @param {string} id @returns {string} */
  const contentFor = (id) => {
    if (id === "runtime") {
      return [
        `Compatibility date ${stack.runtime.compatibilityDate}.`,
        `Compatibility flags ${stack.runtime.compatibilityFlags.join(", ") || "none"}.`,
        `Node ${stack.runtime.nodeVersion}.`,
      ].join(" ");
    }
    if (id === "bindings") {
      return stack.bindings
        .map(
          (/** @type {any} */ b) =>
            `${b.name} (${b.kind}). ${b.what} ${b.whyLoadBearing}`,
        )
        .join(" ");
    }
    if (id === "schema") {
      return stack.migrations.join(" ");
    }
    if (id === "gates") {
      return stack.gates.join(" ");
    }
    if (id === "dependencies") {
      return stack.dependencies
        .map((/** @type {any} */ d) => `${d.name} ${d.range}`)
        .join(" ");
    }
    if (id === "features") {
      return features.features
        .map((/** @type {any} */ f) => `${f.component}. ${f.name}. ${f.what}`)
        .join(" ");
    }
    if (id === "security") {
      return SECURITY_TRADEOFF.join(" ");
    }
    if (id === "ai") {
      return AI_DISCLOSURE.join(" ");
    }
    if (id === "not-adopted") {
      // The label, never `n.status`: the page shows the label, so the index must.
      return stack.notAdopted
        .map(
          (/** @type {any} */ n) =>
            `${n.name} (${statusLabel(n.status)}). ${n.reason}`,
        )
        .join(" ");
    }
    // Fail closed: otherwise a new section is silently indexed as its lead alone.
    throw new Error(
      `colophonPageInput has no body rule for section "${id}". ` +
        `Add one, or the section would be indexed without its content.`,
    );
  };

  return {
    url: COLOPHON_URL,
    uid: "page:colophon",
    title: COLOPHON_TITLE,
    description: COLOPHON_DESCRIPTION,
    intro: COLOPHON_INTRO,
    sections: COLOPHON_SECTIONS.map((section) => ({
      anchor: section.id,
      title: section.title,
      body: `${section.lead} ${contentFor(section.id)}`,
    })),
  };
}
