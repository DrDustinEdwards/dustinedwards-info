/*
 * One list read by both the page and the search index: a record pointing at a
 * fragment the page no longer has still looks like a hit and scrolls nowhere.
 * Nothing here reads the clock, filesystem or git; records must be pure.
 */

export const COLOPHON_URL = "/colophon";

/** Deliberately not the URL: `/colophon` is the IndieWeb convention, but the word is not widely known. */
export const COLOPHON_TITLE = "How this site is built";

export const COLOPHON_DESCRIPTION =
  "This site runs on Cloudflare Workers with React Router, a D1 database and R2 storage. " +
  "Here is how it all fits together.";

/**
 * The site's versions. WordPress is named for version 2 because the WordPress export's earliest item is
 * dated 2016-12-05; version 1's platform is not recorded anywhere this repo can read, so it is not named.
 */
export const COLOPHON_VERSIONS =
  "This is the third version of this site. The first launched in 2006, the second, " +
  "on WordPress, in 2016, and this one in 2026.";

export const COLOPHON_INTRO =
  "Most of this page is generated from the repository's configuration and checked on " +
  "every build. The reasons behind each choice are written by hand.";

/**
 * Order is load-bearing: record `ordinal` is derived from the index here.
 *
 * @type {ReadonlyArray<{ id: string, title: string, lead: string }>}
 */
export const COLOPHON_SECTIONS = /** @type {const} */ ([
  {
    id: "run",
    title: "The network behind this site",
    lead:
      "Other systems run behind or beside this site, and some packages are shared with " +
      "my other sites. None is in this repository.",
  },
  {
    id: "features",
    title: "What the site does",
    lead:
      "Each entry names an anchor, and a gate checks that the anchor still exists. " +
      "The gate does not check that the sentence is true.",
  },
  {
    id: "security",
    title: "A tradeoff in the security headers",
    lead:
      "The content security policy is enforced, not report-only. One part of it is a " +
      "tradeoff.",
  },
  {
    id: "runtime",
    title: "Runtime",
    lead: "Compatibility date, Worker flags and the pinned Node version.",
  },
  {
    id: "bindings",
    title: "Bindings",
    lead:
      "Every resource the Worker binds to, what it is for, and the measurement that " +
      "put it there.",
  },
  {
    id: "schema",
    title: "Schema",
    lead:
      "Hand-written migrations, applied in order. drizzle-kit is not a dependency. The " +
      "database export command fails on this schema, so this directory is the only copy " +
      "of the table definitions.",
  },
  {
    id: "gates",
    title: "Gates",
    lead:
      "Checks that run before anything ships. The list is derived from the scripts, so a " +
      "gate cannot be added and forgotten.",
  },
  {
    id: "dependencies",
    title: "Dependencies",
    lead: "Runtime dependencies only. Build tooling is excluded.",
  },
  {
    id: "credits",
    title: "Credits",
    lead:
      "The packages shared with my other sites adapt code from three open-source " +
      "projects, each under the MIT license.",
  },
  {
    id: "not-adopted",
    title: "What was not adopted",
    lead: "Choices ruled out on purpose, each with its reason.",
  },
  {
    id: "ai",
    title: "AI disclosure",
    lead: "Claude, Anthropic's model, helps write the code and the prose of this site.",
  },
]);

/** @type {ReadonlyArray<string>} */
export const SECURITY_TRADEOFF = Object.freeze([
  "Each response carries a one-time nonce, and scripts must quote it to run. The nonce " +
    "is generated per response.",
  "Seven pages are cached at Cloudflare's edge and served from one stored copy for up " +
    "to ten minutes. The nonce is part of that copy, so visitors served from one cache " +
    "entry share it.",
  "I chose this over uncached pages, which would make every reader wait for the origin " +
    "on every visit.",
  "It is safe only because those pages hold no one else's writing. There are no " +
    "comments and no submissions, so no stranger's script can reach the shared nonce.",
]);

/**
 * The last sentence is conditional on purpose: provider text marks do not survive
 * hand editing, so the page must not claim a reader can check for one.
 *
 * @type {ReadonlyArray<string>}
 */
export const AI_DISCLOSURE = Object.freeze([
  "The model runs through Claude Code and publishes through the same API, and passes " +
    "the same gates, as I do.",
  "A model cannot make a post public for the first time. Code enforces that " +
    "reservation, and an agent that tries is refused by name.",
  "I read and edit every post before it goes live, and I am answerable for it.",
  "Provider marks on model output do not survive editing, so you cannot check for one " +
    "here. My review is the guarantee.",
]);

/** @type {ReadonlyArray<string>} */
export const SITE_OPERATION = Object.freeze([
  "Capsid is the site's memory and job queue. It stores decisions and current state, " +
    "and hands work from a conversation to a working session as a signed job that " +
    "ends in a pull request.",
  "A small admin server lets me run the site from a chat, covering the registry, " +
    "citations and lab procedures. It cannot write or publish posts. Carrel does that.",
]);

/**
 * Carrel's one sentence. Its name links to its page on this site (Dustin, 2026-09-28), never to the
 * app, which is private; the footer's Workspace link is the separate sign-in.
 */
export const CARREL_PAGE_PATH = "/software/carrel";
export const CARREL_NAME = "Carrel";
const CARREL_SENTENCE =
  "Carrel is my private writing hub, behind a login, where articles are " +
  "written before publication. A finished article reaches this site through " +
  "a small keyed API.";

/** The sentence after its linked name, which is how the page renders it. */
export const CARREL_SENTENCE_REST = CARREL_SENTENCE.slice(CARREL_NAME.length);

export const CAPSID_REPO_URL = "https://github.com/DrDustinEdwards/capsid";

/**
 * Capsomer's one sentence. Its name links to its public site, which answers 200 (checked 2026-10-02).
 * Capsid's public site, capsid.dustinedwards.info, did not answer then, so Capsid keeps its repository
 * link until it does (job_a8f7cfc629de).
 */
export const CAPSOMER_NAME = "Capsomer";
export const CAPSOMER_URL = "https://capsomer.dustinedwards.info";
const CAPSOMER_SENTENCE =
  "Capsomer is the shared design system: color tokens, header, footer and " +
  "components, in plain CSS.";

/** The sentence after its linked name, which is how the page renders it. */
export const CAPSOMER_SENTENCE_REST = CAPSOMER_SENTENCE.slice(CAPSOMER_NAME.length);

/**
 * The packages this site shares with my other sites, each rendered as its linked name followed by `rest`.
 * No version numbers: the dependencies section lists those from package.json.
 *
 * @type {ReadonlyArray<{ name: string, url: string, rest: string }>}
 */
export const SHARED_PACKAGES = Object.freeze([
  {
    name: "Prelum",
    url: "https://github.com/DrDustinEdwards/prelum",
    rest:
      " turns markdown into pages, feeds, sitemaps, search records, llms.txt " +
      "and each page's structured data.",
  },
  {
    name: "site-runtime",
    url: "https://github.com/DrDustinEdwards/site-runtime",
    rest:
      " supplies security headers, the rate limiter, the health report, " +
      "responsive images, sign-in and the edge page cache.",
  },
  {
    name: "site-api",
    url: "https://github.com/DrDustinEdwards/site-api",
    rest: " is the contract Carrel uses to list, edit and publish this site's content.",
  },
  {
    name: "d1-dump",
    url: "https://github.com/DrDustinEdwards/d1-dump",
    rest:
      " backs up each table of the database to the site's own storage and " +
      "restores it. The database's own export cannot handle tables with full-text search.",
  },
  {
    name: "Enarratio",
    url: "https://github.com/DrDustinEdwards/enarratio",
    rest: " renders charts on the server, each with a text alternative and a data table.",
  },
  {
    name: "devkit",
    url: "https://github.com/DrDustinEdwards/devkit",
    rest:
      " holds the shared test workflows, the dependency update rules and the " +
      "check that fails on a copy of code a shared package already provides.",
  },
]);

/**
 * Each credit renders as its linked name followed by `rest`, so `rest` starts right after the name.
 *
 * @type {ReadonlyArray<{ name: string, url: string, rest: string }>}
 */
export const CREDITS = Object.freeze([
  {
    name: "Astro",
    url: "https://astro.build",
    rest:
      " is the source of devkit's island-loading rules and dev-toolbar audit " +
      "rules. Site-runtime adapts its speculation-rules prefetching and image " +
      "layouts and widths. Capsomer adapts its size-matched fallback fonts.",
  },
  {
    name: "EmDash",
    url: "https://github.com/emdash-cms/emdash",
    rest:
      " is the source of the scheduled updates to live posts that site-api and " +
      "Carrel apply, and of the ideas for focal points and captions on media.",
  },
  {
    name: "Cloudflare Nimbus",
    url: "https://github.com/cloudflare/nimbus",
    rest:
      " is the model for how Prelum serves Markdown copies of pages to AI " +
      "agents. Prelum uses Nimbus's own code to decide when a request prefers " +
      "Markdown.",
  },
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
        .map((/** @type {any} */ b) => `${b.name} (${b.kind}). ${b.what} ${b.whyLoadBearing}`)
        .join(" ");
    }
    if (id === "schema") {
      return stack.migrations.join(" ");
    }
    if (id === "gates") {
      return stack.gates.join(" ");
    }
    if (id === "dependencies") {
      return stack.dependencies.map((/** @type {any} */ d) => `${d.name} ${d.range}`).join(" ");
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
    if (id === "run") {
      return `${SITE_OPERATION.join(" ")} ${CARREL_SENTENCE} Capsid's source is public at ${CAPSID_REPO_URL}. ${CAPSOMER_SENTENCE} Its site is ${CAPSOMER_URL}. ${SHARED_PACKAGES.map((p) => `${p.name}${p.rest}`).join(" ")}`;
    }
    if (id === "credits") {
      return CREDITS.map((c) => `${c.name}${c.rest}`).join(" ");
    }
    if (id === "not-adopted") {
      // The label, never `n.status`: the page shows the label, so the index must.
      return stack.notAdopted
        .map((/** @type {any} */ n) => `${n.name} (${statusLabel(n.status)}). ${n.reason}`)
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
    intro: `${COLOPHON_VERSIONS} ${COLOPHON_INTRO}`,
    sections: COLOPHON_SECTIONS.map((section) => ({
      anchor: section.id,
      title: section.title,
      body: `${section.lead} ${contentFor(section.id)}`,
    })),
  };
}
