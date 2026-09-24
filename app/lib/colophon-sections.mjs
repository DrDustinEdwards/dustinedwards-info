/**
 * The colophon's section structure. ONE ordered list, two readers.
 *
 * `app/routes/colophon.tsx` RENDERS from this. `recordsForPage` in
 * `app/lib/search/records.mjs` INDEXES from it. Neither hardcodes the other's
 * list, and no anchor string is typed in more than one file.
 *
 * **Why this module exists rather than literal ids in the page.** For posts,
 * `splitSections` zips markdown against the pipeline's `toc` BY INDEX and throws
 * if the counts disagree, because re-deriving anchors would be a second slugger
 * that drifts from the renderer. This page has no toc: it is hand-built TSX with
 * literal `id` attributes. Writing those ids into the record emitter as well
 * would be the same class of defect with none of the same protection, and the
 * failure would be SILENT: a record pointing at a fragment that no longer exists
 * still returns a hit, still looks correct in a result list, and scrolls
 * nowhere. So the list moved here and both sides read it.
 *
 * `lead` is the section's own prose. The page renders it as the paragraph under
 * the heading and the index carries it as the section's body, so the words a
 * reader searches for are the words they then see. Data-driven content
 * (bindings, features, refusals) is appended to the indexed body from the same
 * JSON the page renders, so that is one source too.
 *
 * Nothing here reads the clock, the filesystem or git, for the reason
 * records.mjs states: records must be a pure function of committed data to live
 * in the gated artifact.
 */

/** The route. Asserted against `routes.ts` by the gate. */
export const COLOPHON_URL = "/colophon";

/**
 * The page's own title, which is deliberately NOT its URL.
 *
 * `/colophon` is the IndieWeb convention and is what tooling expects; the title
 * carries the legibility, because the word is not universally known. Both are
 * ruled. This is the string the search result shows.
 */
export const COLOPHON_TITLE = "How this site is built";

export const COLOPHON_DESCRIPTION =
  "The stack behind dustinedwards.info: every binding, migration and gate, " +
  "generated from the repository's own configuration, with what was " +
  "deliberately not adopted and why.";

/** The lead paragraph above the first section, indexed with the document. */
export const COLOPHON_INTRO =
  "Everything below is generated from this repository's own configuration and " +
  "checked against it in both directions on every build. If a binding is added " +
  "and this page is not regenerated, the build fails. The one thing no " +
  "generator can produce is why each piece is load-bearing, so those notes are " +
  "written by hand and reconciled against the bindings they describe.";

/**
 * Every section, in document order.
 *
 * `id` is the fragment. `title` is the heading text and the search result's
 * title. `lead` is the prose under the heading.
 *
 * ORDER IS THE DOCUMENT ORDER and is load-bearing twice: the page renders in
 * this order, and record `ordinal` is derived from the index here, so a
 * reordering changes the artifact and `check:content` sees it.
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
    /*
     * THE LEAD NAMED TWO KINDS AND ONLY ONE IS LEFT, 2026-09-11.
     *
     * "Two different things are listed here" is a tense-bound state claim
     * about a list that changes, which the one-owner rule gives to a gate or to
     * nobody, and it went false the moment the last accepted gap left. So the
     * sentence describes what IS here rather than promising a second category
     * the vocabulary no longer carries. See STATUS_LABEL below for where the
     * other one went and what bringing it back costs.
     */
    lead:
      "Anyone can list what they shipped. A refusal is a decision that was " +
      "made and recorded: not a thing nobody got to, but a thing somebody " +
      "ruled out, with the reason beside it.",
  },
]);

/**
 * THE SECURITY TRADEOFF, in one place so the page and the search index cannot
 * drift apart. That drift is the exact failure this module exists to prevent,
 * and it has already happened once here (the 2026-08-05 not-adopted defect,
 * where the index carried a word the page never showed).
 *
 * Plain language on purpose. A showcase that only lists its wins is an
 * advertisement; the honest account of a compromise is the more useful artifact,
 * and this one is genuinely a compromise.
 *
 * @type {ReadonlyArray<string>}
 */
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
 * THE AI DISCLOSURE, in one place for the same reason SECURITY_TRADEOFF is: the
 * page renders these sentences and the search index carries the same ones.
 *
 * Ruled 2026-09-04. The EU AI Act's transparency obligations reach anyone
 * publishing AI-assisted text, with a carve-out for text under human editorial
 * responsibility. This site already meets the carve-out; the disclosure states
 * it plainly rather than relying on a reader inferring it.
 *
 * ## WHAT THIS DELIBERATELY DOES NOT CLAIM
 *
 * An earlier draft asserted that text from models released after a given date
 * "carries a machine-readable mark applied by the provider". That is a legal
 * OBLIGATION on providers restated as an accomplished fact about output, and it
 * is not one this page can stand behind: whether a given provider marks TEXT is
 * an empirical question, the obligation is keyed to systems on the market
 * rather than to a model's release date, and text marks are known to degrade
 * under paraphrase and editing. Since every word here is edited by hand before
 * it is published, a mark applied upstream would very likely not survive into
 * what a reader receives. Telling a reader they can detect something they
 * cannot is worse than saying nothing, so the sentence below is conditional and
 * points at the human review, which is the guarantee that is actually true.
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

/** Fragment ids, for a gate that needs the set rather than the order. */
export const COLOPHON_ANCHORS = COLOPHON_SECTIONS.map((s) => s.id);

/**
 * The two states a not-adopted entry may declare, spelled for a reader.
 *
 * ONE map, two readers, for the reason `COLOPHON_SECTIONS` is one list: the
 * page renders it and `colophonPageInput` indexes it, so the word a reader
 * searches for is the word they then see.
 *
 * **It lived in `colophon.tsx` until 2026-08-05 and the split was a real
 * defect.** The page rendered `(Refused)` and `(Accepted gap)` while the record
 * body carried the raw enum, `(refused)` and `(accepted-gap)`. For
 * `accepted-gap` the hyphen means the indexed token appeared on the page in no
 * casing at all, so the index promised a word the page never showed. Nothing
 * caught it: `check:content` compared the generated output against itself and
 * `check:features` reconciled ids, not labels. It was found by sweeping every
 * indexed fact against the rendered page.
 *
 * @type {Record<string, string>}
 */
/*
 * `accepted-gap` WAS HERE AND IS NOT, removed 2026-09-11 with its last member.
 *
 * The one entry carrying it was "Continuous integration", whose reason read
 * "with no CI, any gate can be skipped indefinitely". `.github/workflows/ci.yml`
 * has run on every push to main since 2026-08-20 and `scripts/ship.mjs` refuses
 * a HEAD without a green run for that exact sha, so the colophon was printing a
 * false sentence on the page whose whole claim is that its sentences are
 * checked against the repository.
 *
 * THE VOCABULARY SHRANK WITH IT RATHER THAN OUTLIVING IT, because
 * `check:features` asserts both directions over this map: a label no entry uses
 * is the mirror-going-stale shape, caught here before it is the one that
 * matters. Writing down the next real accepted gap means re-adding the value
 * here.
 */
export const STATUS_LABEL = {
  refused: "Refused",
};

/**
 * The label for a status, or a throw.
 *
 * FAILS CLOSED, and the previous `?? status` fallback is exactly why. A status
 * with no label silently rendered its raw enum, which is the divergence this
 * module now exists to prevent, and it would have looked like working output on
 * the page and in the index at the same time. A build that stops and names the
 * status is the only safe outcome, and it is the same stance `SectionHead` and
 * the missing-body-rule branch below already take.
 *
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
 * Every hand-authored page, as `recordsForPages` takes them.
 *
 * One function both artifact writers call, so the assembly cannot differ between
 * a build from a clone and a save from the editor. The two callers differ only
 * in how they LOAD the two JSON files, which is environment-specific for the
 * same reason `makeResolveImage` is: Node reads the filesystem, the Worker gets
 * them from the bundle.
 *
 * @param {any} stack   content/generated/stack.json
 * @param {any} features content/features.json
 */
export function colophonPages(stack, features) {
  return [colophonPageInput(stack, features)];
}

/**
 * The colophon as the generic page shape `recordsForPage` consumes.
 *
 * The section BODIES are assembled here, from the same two JSON files the page
 * renders, so the index and the page draw on one source. This is the only place
 * that knows how a colophon section's indexable text is put together.
 *
 * Kept out of `records.mjs` deliberately: that module is the generic indexer for
 * any page and must not learn the colophon's shape, exactly as it does not know
 * how a post's markdown is produced.
 *
 * @param {any} stack   content/generated/stack.json
 * @param {any} features content/features.json
 */
export function colophonPageInput(stack, features) {
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
      // The page renders these sentences; the index gets the same ones.
      return SECURITY_TRADEOFF.join(" ");
    }
    if (id === "ai") {
      // The page renders these sentences; the index gets the same ones.
      return AI_DISCLOSURE.join(" ");
    }
    if (id === "not-adopted") {
      // `statusLabel`, never `n.status`. The page renders the label, so the
      // index has to carry the label or it promises a word the page never
      // shows. That was the 2026-08-05 defect.
      return stack.notAdopted
        .map(
          (/** @type {any} */ n) =>
            `${n.name} (${statusLabel(n.status)}). ${n.reason}`,
        )
        .join(" ");
    }
    // Fail closed. A section added to the descriptor with no body rule here
    // would otherwise be indexed as its lead alone, which reads as a working
    // record and silently omits everything the section actually shows.
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
