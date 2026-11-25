/** Feature sections about running the network: agents, hosting, building and checking, this site. */

/** @type {ReadonlyArray<import("./features.mjs").Section>} */
export const PLATFORM_SECTIONS = Object.freeze([
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
