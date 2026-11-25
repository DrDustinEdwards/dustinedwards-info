/** Feature sections about producing and presenting writing: authoring, pages and feeds, charts, design. */

/** @type {ReadonlyArray<import("./features.mjs").Section>} */
export const PUBLISHING_SECTIONS = Object.freeze([
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
]);
