/*
 * What the whole network does, for /features and its markdown twin (/features.md): one list, so the page and the twin cannot
 * disagree. A card is a thing a program does that a person can name. Every card was checked against the program's own README,
 * its tool list or this site's own pages (Dustin, 2026-11-07); the numbers a README gives are left out, since a number here
 * would go stale without a gate to catch it. Pure data and string building, so test/features.test.mjs runs it under plain node.
 */

export const FEATURES_PATH = "/features";

/**
 * The programs a card can belong to, in the order of the footer's strip of sites, then the shared code. `id` is what a
 * card names and what a chip filters by.
 *
 * @type {ReadonlyArray<{ id: string, name: string, what: string }>}
 */
export const PROGRAMS = Object.freeze([
  { id: "site", name: "dustinedwards.info", what: "This site." },
  { id: "capsid", name: "Capsid", what: "Memory, jobs and access for AI agents." },
  { id: "capsomer", name: "Capsomer", what: "The design system." },
  { id: "prelum", name: "Prelum", what: "Turns writing into pages and feeds." },
  { id: "carrel", name: "Carrel", what: "The private writing desk." },
  { id: "enarratio", name: "Enarratio", what: "Accessible charts." },
  {
    id: "shared",
    name: "Shared code",
    what: "site-runtime, site-api, d1-dump and devkit.",
  },
]);

/**
 * The jobs, in reading order. Each has a short label for the contents, a title and one line saying what the group is.
 *
 * @type {ReadonlyArray<{ id: string, label: string, title: string, intro: string, features: ReadonlyArray<{ name: string, program: string, text: string }> }>}
 */
export const SECTIONS = Object.freeze([
  {
    id: "writing",
    label: "Writing",
    title: "Writing and publishing",
    intro: "How an article gets written, checked and published to any site in the network.",
    features: [
      {
        name: "Drafts that stay yours",
        program: "carrel",
        text: "An AI's draft is saved beside the author's and never replaces it.",
      },
      {
        name: "Checks that flag",
        program: "carrel",
        text: "Checks and reviewers point out problems in a text. The author decides.",
      },
      {
        name: "Preview from the live site",
        program: "carrel",
        text: "A preview is drawn by the site's own renderer, so it matches what readers get.",
      },
      {
        name: "Publishing by role",
        program: "carrel",
        text: "Who may publish depends on role. An AI tool cannot publish while a flag is open.",
      },
      {
        name: "First publication is the owner's",
        program: "site",
        text: "Making a post public for the first time is reserved to the owner. The code refuses an agent that tries.",
      },
      {
        name: "Books and manuscripts",
        program: "carrel",
        text: "Books, chapters and scenes from a private manuscript repository, checked for continuity and timeline, exported to ePub and Word.",
      },
      {
        name: "Media library",
        program: "carrel",
        text: "Images are listed, imported and deleted, with alt text set for each.",
      },
      {
        name: "Webmentions",
        program: "carrel",
        text: "Mentions of a post from other sites are reviewed and accepted or declined.",
      },
      {
        name: "One publishing contract",
        program: "shared",
        text: "Every site mounts the same API (site-api), so Carrel lists, edits and publishes on all of them the same way.",
      },
      {
        name: "Scheduled updates",
        program: "shared",
        text: "A change to a live post can be set to apply later, and the site applies it on its own schedule.",
      },
    ],
  },
  {
    id: "pages",
    label: "Pages and feeds",
    title: "Pages, feeds and search engines",
    intro: "What every site sends to readers, search engines and AI agents.",
    features: [
      {
        name: "One markdown pipeline",
        program: "prelum",
        text: "Every site renders its markdown the same way, with the same safety rules.",
      },
      {
        name: "Alt text required",
        program: "prelum",
        text: "An image with no alt text is refused. A decorative image says so.",
      },
      {
        name: "Captions and transcripts",
        program: "prelum",
        text: "A video needs captions or a statement that it is silent. Audio needs a transcript.",
      },
      {
        name: "Rich blocks",
        program: "prelum",
        text: "Figures, galleries, callouts, collapsible details, FAQs, link cards and buttons.",
      },
      {
        name: "Math and code",
        program: "prelum",
        text: "Equations, and highlighted code with a file name and marked lines.",
      },
      {
        name: "Diagrams drawn ahead",
        program: "site",
        text: "Diagrams are drawn at build time, one for the light theme and one for the dark.",
      },
      {
        name: "Light embeds",
        program: "prelum",
        text: "YouTube, Spotify, Apple Podcasts and other players load only when a reader presses play.",
      },
      {
        name: "A markdown copy of every page",
        program: "prelum",
        text: "Add .md to a page's address, or ask for markdown, and you get the source the page was drawn from.",
      },
      {
        name: "llms.txt and llms-full.txt",
        program: "prelum",
        text: "A guide for AI agents, and every post in one file.",
      },
      {
        name: "Feeds",
        program: "prelum",
        text: "RSS, Atom and JSON feeds, for the whole site and for each tag and series.",
      },
      {
        name: "Sitemaps",
        program: "prelum",
        text: "Sitemaps that list each page's images and the date each page last changed.",
      },
      {
        name: "Search engine pings",
        program: "prelum",
        text: "IndexNow tells search engines when a page changes.",
      },
      {
        name: "Structured data",
        program: "prelum",
        text: "schema.org markup and the page's head tags, written the same way on every site.",
      },
      {
        name: "Crawler rules",
        program: "prelum",
        text: "robots.txt and ai.txt, naming search and AI crawlers and what each may do.",
      },
      {
        name: "Site audits",
        program: "prelum",
        text: "A crawler checks a site's pages, and its icons and manifest, against the shared rules.",
      },
      {
        name: "Search without a database",
        program: "prelum",
        text: "A small index ships to the browser, for a site that has no database to search.",
      },
    ],
  },
  {
    id: "charts",
    label: "Charts",
    title: "Charts and figures",
    intro:
      "Charts that arrive with the page and can be read by everyone. Enarratio is an early alpha.",
    features: [
      {
        name: "Drawn on the server",
        program: "enarratio",
        text: "A chart is drawn into the HTML, so it shows without JavaScript and search engines can read it.",
      },
      {
        name: "Words and numbers",
        program: "enarratio",
        text: "Every chart has a text alternative its author writes and an equivalent data table.",
      },
      {
        name: "Light and dark",
        program: "enarratio",
        text: "Colors come from the theme's stylesheet, so a chart follows the theme without being redrawn.",
      },
      {
        name: "Runs anywhere",
        program: "enarratio",
        text: "Node.js, Cloudflare Workers, Deno and Bun. Built on Observable Plot.",
      },
      {
        name: "Astro and EmDash",
        program: "enarratio",
        text: "enarratio-astro puts charts in Astro pages and Markdown, and enarratio-emdash adds a Chart block to EmDash's editor.",
      },
      {
        name: "The network's look",
        program: "capsomer",
        text: "Capsomer gives every chart the shared colors, gridlines and behavior.",
      },
    ],
  },
  {
    id: "design",
    label: "Design",
    title: "Design",
    intro: "One set of parts, so a fix in one place reaches every site.",
    features: [
      {
        name: "Plain CSS, no framework",
        program: "capsomer",
        text: "Color tokens, spacing and type are plain CSS that any site can use.",
      },
      {
        name: "A color family per site",
        program: "capsomer",
        text: "Each site has its own family of colors, drawn from the same tokens.",
      },
      {
        name: "Light, dark and higher contrast",
        program: "capsomer",
        text: "Every color has a light, a dark and a higher-contrast value, and every pair is measured against its minimum.",
      },
      {
        name: "More than 80 components",
        program: "capsomer",
        text: "Tables, dialogs, menus, tabs, forms, date pickers, a command menu, a media library and more.",
      },
      {
        name: "Shared header and footer",
        program: "capsomer",
        text: "The same letterhead header and footer on every site, each in its own color.",
      },
      {
        name: "Admin parts",
        program: "capsomer",
        text: "An admin shell, a permission matrix, a moderation queue and a publish gate.",
      },
      {
        name: "A markdown editor",
        program: "capsomer",
        text: "An editor with draft comparison, for the admin pages that write.",
      },
      {
        name: "The map of systems",
        program: "capsomer",
        text: "Draws the network as hexagons, or as a plain map of cards, from Capsid's public data.",
      },
      {
        name: "A page of states",
        program: "capsomer",
        text: "Every component is shown in every state on Capsomer's own site.",
      },
      {
        name: "No flash of the wrong theme",
        program: "site",
        text: "The theme is chosen on the server, and the toggle works with scripting off.",
      },
    ],
  },
  {
    id: "agents",
    label: "AI agents",
    title: "Memory and work for AI agents",
    intro:
      "Capsid keeps what earlier sessions settled and hands out work, with a record of who did what.",
    features: [
      {
        name: "A versioned knowledge base",
        program: "capsid",
        text: "Documents live in namespaces, each change keeps the old version, and any version can be restored.",
      },
      {
        name: "Search by words and by meaning",
        program: "capsid",
        text: "Keyword search and semantic search work together over every document.",
      },
      {
        name: "A briefing at the start",
        program: "capsid",
        text: "A new session opens with its project's conventions and the documents every agent reads first.",
      },
      {
        name: "A queue of signed jobs",
        program: "capsid",
        text: "A job's text is signed when posted, so a changed job is refused. An agent claims it and finishes with a pull request.",
      },
      {
        name: "Claims checked against GitHub",
        program: "capsid",
        text: "Capsid stores what an agent said it did beside what GitHub confirms.",
      },
      {
        name: "A key and a scope per agent",
        program: "capsid",
        text: "Each agent has its own key and its own list of allowed projects, repositories and actions, checked in one place.",
      },
      {
        name: "GitHub through an App",
        program: "capsid",
        text: "Capsid reaches GitHub as an App, so it holds no long-lived GitHub token.",
      },
      {
        name: "Merge, close and release",
        program: "capsid",
        text: "Pull requests can be merged or closed, branches deleted, commits tagged and releases published, by agents allowed to.",
      },
      {
        name: "Auto-merge by signed policy",
        program: "capsid",
        text: "A policy only the administrator can sign decides which pull requests may merge without a person.",
      },
      {
        name: "An audit log",
        program: "capsid",
        text: "Every change and delete is recorded with who made it.",
      },
      {
        name: "Site watcher",
        program: "capsid",
        text: "Reads each site's health page, CI status, deploys and live responses, and repairs drift.",
      },
      {
        name: "Session telemetry",
        program: "capsid",
        text: "Per-session summaries and cost and token totals for each job. It stores no prompts or replies.",
      },
      {
        name: "The Portal",
        program: "capsid",
        text: "The owner's dashboard: items waiting, site health, the job queue, open pull requests and deploys.",
      },
      {
        name: "Public model and explorer",
        program: "capsid",
        text: "A daily public model of the network and a public explorer that draws it.",
      },
      {
        name: "Run a site from a chat",
        program: "site",
        text: "An admin server lets the owner work with this site's registry, citations and lab procedures from a conversation. It cannot write or publish posts.",
      },
      {
        name: "A study of its own use",
        program: "capsid",
        text: "A public harness compares Claude Code with and without Capsid on the same tasks, scored on hidden tests.",
      },
    ],
  },
  {
    id: "hosting",
    label: "Hosting",
    title: "Hosting, safety and backups",
    intro: "What every site gets from shared code, so each is run the same way.",
    features: [
      {
        name: "Security headers",
        program: "shared",
        text: "A content security policy and the other headers, with a report endpoint.",
      },
      {
        name: "Rate limits",
        program: "shared",
        text: "One rate limiter for every site, with a version that counts exactly.",
      },
      {
        name: "Sign-in",
        program: "shared",
        text: "One sign-in flow for members, and a check that an Access application lets in exactly the site's admins.",
      },
      {
        name: "A health report",
        program: "shared",
        text: "Every site answers /health in one format, and Capsid reads it.",
      },
      {
        name: "Responsive images",
        program: "shared",
        text: "Images are resized to the reader's screen on request, and edits such as a crop are applied the same way everywhere.",
      },
      {
        name: "Speed",
        program: "shared",
        text: "Link prefetching, preloads and early hints, an edge page cache and a Server-Timing header.",
      },
      {
        name: "Share cards",
        program: "shared",
        text: "The preview image a page shows when it is shared.",
      },
      {
        name: "Bot checks and email",
        program: "shared",
        text: "A Turnstile check on forms, one way to send email and a security.txt file.",
      },
      {
        name: "Checks on AI-written prose",
        program: "shared",
        text: "A check on prose written with AI, and a measure of an author's voice.",
      },
      {
        name: "Per-table backups",
        program: "shared",
        text: "d1-dump copies each table to the site's own storage on a schedule and works on databases with full-text search, where D1's own export does not.",
      },
      {
        name: "Restore into a copy",
        program: "shared",
        text: "A backup restores into a copy you can inspect first, and the age of the newest backup shows on the health page.",
      },
      {
        name: "A copy outside Cloudflare",
        program: "capsid",
        text: "Every site's exports are copied to a locked Amazon S3 bucket in another account, with a markdown mirror of every Capsid document.",
      },
    ],
  },
  {
    id: "building",
    label: "Building",
    title: "Building and checking",
    intro: "How a change is tested before it reaches a reader.",
    features: [
      {
        name: "The same checks everywhere",
        program: "shared",
        text: "devkit runs one set of pull request checks: workflow audits, dependency scans, bundle size, bloat and an automatic reviewer.",
      },
      {
        name: "A shared-code check",
        program: "shared",
        text: "A repository that copies something a shared package already provides fails, so a fix is made once.",
      },
      {
        name: "Update rules",
        program: "shared",
        text: "One dependency update policy, used by every repository.",
      },
      {
        name: "Deploys that roll back",
        program: "shared",
        text: "A deployed Worker is checked live and rolled back if the site refuses it.",
      },
      {
        name: "Checks for the project's own claims",
        program: "site",
        text: "The colophon's list of what the site does is held to the code by checks that fail when a claim's anchor is gone.",
      },
      {
        name: "Accessibility in the build",
        program: "site",
        text: "Contrast, alt text, keyboard use and reading without script are tested, and the accessibility page names each check.",
      },
    ],
  },
  {
    id: "site",
    label: "This site",
    title: "On dustinedwards.info",
    intro: "What a visitor can use here.",
    features: [
      {
        name: "Publications",
        program: "site",
        text: "Each paper has a page, with BibTeX, RIS and JSON downloads.",
      },
      {
        name: "Lab calculators",
        program: "site",
        text: "Titer, dilution, webbed plate, multiplicity of infection, efficiency of plating and lysate volume.",
      },
      {
        name: "Protocols",
        program: "site",
        text: "Procedures with versions and a printable sheet, downloadable as CSV and JSON.",
      },
      {
        name: "A lab registry",
        program: "site",
        text: "A fact is stored once, in a record, and every page draws it from there.",
      },
      {
        name: "Phage records",
        program: "site",
        text: "A catalog of phages with a section for each.",
      },
      {
        name: "The CV",
        program: "site",
        text: "With its charts, a markdown copy and a PDF made on each save.",
      },
      {
        name: "Search and Ask",
        program: "site",
        text: "Keyword search by section, and a streamed AI answer with citations that link to the passage.",
      },
      {
        name: "Search from an AI tool",
        program: "site",
        text: "The same search is open to AI tools over the Model Context Protocol.",
      },
      {
        name: "How it is built",
        program: "site",
        text: "The colophon lists every resource, check and dependency, generated from the code.",
      },
    ],
  },
]);

/** The cards, in page order. */
export const ALL_FEATURES = SECTIONS.flatMap((section) =>
  section.features.map((feature) => ({ ...feature, section: section.id })),
);

/** @param {string} id */
export function programName(id) {
  const program = PROGRAMS.find((p) => p.id === id);
  if (!program) throw new Error(`no program "${id}" in PROGRAMS`);
  return program.name;
}

/** How many cards each program has, for the filter's spoken count. @returns {Record<string, number>} */
export function programCounts() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const feature of ALL_FEATURES) counts[feature.program] = (counts[feature.program] ?? 0) + 1;
  return counts;
}

/**
 * The page as markdown: every card, by section, with its program. What a person scans, an agent reads.
 * @param {string} origin
 */
export function featuresMarkdown(origin) {
  const lines = [
    "# Features",
    "",
    "What the whole network of programs and sites does, by job. Each entry names the program that does it.",
    "",
    `Programs: ${PROGRAMS.map((p) => p.name).join(", ")}.`,
    "",
  ];
  for (const section of SECTIONS) {
    lines.push(`## ${section.title}`, "", section.intro, "");
    for (const feature of section.features) {
      lines.push(`- **${feature.name}** (${programName(feature.program)}). ${feature.text}`);
    }
    lines.push("");
  }
  lines.push(`Systems map: ${origin}/systems`, `Colophon: ${origin}/colophon`, "");
  return lines.join("\n");
}
