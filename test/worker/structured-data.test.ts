import { describe, expect, it } from "vitest";

import { env, applyD1Migrations } from "cloudflare:test";
import {
  CONTENT_PAGE_PATHS,
  CONTENT_PAGES_FROM_DATA,
  contentPageCardPath,
  hasPageCard,
} from "~/lib/content-pages.mjs";
import { listPublishedPublications } from "~/db/publications";
import { CV_PAGE } from "~/lib/cv/entries.mjs";
import { paperPath } from "~/lib/publications/paths.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import ContentPage, { loader as contentPageLoader, meta as contentPageMeta } from "~/routes/content-page";
import Cv, { loader as cvLoader, meta as cvMeta } from "~/routes/cv";
import Publications, { loader as publicationsLoader } from "~/routes/publications";
import Paper, { loader as paperLoader } from "~/routes/publications.$slug";

import { renderRoute, routeContext } from "./route-helpers";
import { seedCv, seedDictionary, seedPages, seedPublications } from "./seed";

/*
 * EVERY JSON-LD BLOCK THE PAGES EMIT, PARSED AND HELD TO ITS TYPE (2026-09-29). Each page is rendered
 * through its own route module, every <script type="application/ld+json"> is parsed, and every node is
 * checked against the properties schema.org and Google's rich-result documentation require and
 * recommend for its type. A breadcrumb list must say exactly what the visible trail says.
 *
 * The site never fills a missing fact in, so a recommended property may be absent, but only where
 * MISSING below names it and says why. An entry that no longer matches anything fails too, so the
 * ledger is always the current list of facts the repo does not hold.
 */

type Node = Record<string, unknown>;

type Rule = {
  /** schema.org's own expectations, or Google's required properties where it has a rich result. */
  required: string[];
  /** Google's and schema.org's recommended properties; `a|b` is either. */
  recommended: string[];
};

const ARTICLE: Rule = {
  // Google Article: every property is recommended; these three are what makes it a citation at all.
  required: ["headline", "author", "datePublished"],
  recommended: ["url", "image", "dateModified"],
};

const RULES: Record<string, Rule> = {
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
  ScholarlyArticle: ARTICLE,
  Chapter: ARTICLE,
  LearningResource: ARTICLE,
  // Google Dataset: name and description required, the rest recommended.
  Dataset: {
    required: ["name", "description"],
    recommended: [
      "url",
      "creator",
      "license",
      "temporalCoverage",
      "spatialCoverage",
      "variableMeasured",
      "distribution",
      "isAccessibleForFree",
      "keywords",
      "identifier",
    ],
  },
  // Google Software App: name, offers and a rating or review are required for the rich result.
  SoftwareApplication: {
    required: ["name"],
    recommended: ["offers", "aggregateRating|review", "applicationCategory", "operatingSystem", "description", "url"],
  },
  SoftwareSourceCode: {
    required: ["name", "codeRepository"],
    recommended: ["description", "url", "author", "programmingLanguage", "license"],
  },
  WebSite: { required: ["name", "url"], recommended: ["description"] },
  WebPage: { required: ["name", "url"], recommended: ["description"] },
  ProfilePage: { required: ["mainEntity"], recommended: [] },
  DefinedTerm: { required: ["name", "description", "inDefinedTermSet"], recommended: [] },
  Person: { required: ["name"], recommended: [] },
};

type Missing = { type: string; property: string; page?: RegExp; reason: string };

/** The recommended facts the repo does not hold. Each is a question for Dustin, not a gap to fill. */
const MISSING: Missing[] = [
  { type: "ScholarlyArticle|Chapter|LearningResource", property: "image", reason: "no figure or cover image is held for any paper" },
  { type: "ScholarlyArticle|Chapter|LearningResource", property: "dateModified", reason: "the corpus records the publication date only" },
  {
    type: "SoftwareApplication",
    property: "offers",
    reason: "no price is recorded for any product, so no page is eligible for Google's software rich result",
  },
  { type: "SoftwareApplication", property: "aggregateRating|review", reason: "no rating or review is recorded" },
  { type: "SoftwareApplication", property: "operatingSystem", reason: "no platform is recorded for any product" },
  {
    type: "SoftwareApplication",
    property: "applicationCategory",
    page: /^\/software\/(capsid|carrel|foxing-edu)$/,
    reason: "the frontmatter states no category for Capsid, Carrel or Foxing Edu",
  },
  {
    type: "SoftwareSourceCode",
    property: "programmingLanguage",
    page: /^\/software\/capsid$/,
    reason: "the Capsid page names its repository but not its language",
  },
  { type: "SoftwareSourceCode", property: "license", page: /^\/software\/capsid$/, reason: "no licence is recorded for Capsid" },
  {
    type: "SoftwareSourceCode",
    property: "description",
    page: /^\/software\/capsid$/,
    reason: "the source node describes the repository, and the page describes the application, not its code",
  },
  { type: "SoftwareSourceCode", property: "url", page: /^\/software\/capsid$/, reason: "its address is codeRepository" },
  { type: "Dataset", property: "license", page: /^\/research\/phages$/, reason: "no licence is stated for the phage table" },
  { type: "Dataset", property: "keywords", page: /^\/research\/phages$/, reason: "no keywords are recorded" },
  { type: "Dataset", property: "identifier", page: /^\/research\/phages$/, reason: "the table has no DOI or other identifier" },
];

type Page = { path: string; html: string };

const context = () => routeContext();

async function contentPage(path: string): Promise<Page> {
  const request = new Request(`${SITE_ORIGIN}${path}`);
  const loaderData = await contentPageLoader({ request, params: {}, context: context() } as never);
  return { path, html: renderRoute(path, ContentPage, { loaderData }) };
}

async function pages(): Promise<Page[]> {
  const out: Page[] = [];
  for (const path of CONTENT_PAGE_PATHS) {
    if (!CONTENT_PAGES_FROM_DATA.includes(path)) out.push(await contentPage(path));
  }
  {
    const request = new Request(`${SITE_ORIGIN}/cv`);
    const loaderData = await cvLoader({ request, params: {}, context: context() } as never);
    out.push({ path: "/cv", html: renderRoute("/cv", Cv, { loaderData }) });
  }
  {
    const path = "/research/publications";
    const request = new Request(`${SITE_ORIGIN}${path}`);
    const loaderData = await publicationsLoader({ request, params: {}, context: context() } as never);
    out.push({ path, html: renderRoute(path, Publications, { loaderData }) });
  }
  for (const paper of await listPublishedPublications(env as never)) {
    const { slug } = paper;
    const path = paperPath(slug);
    const request = new Request(`${SITE_ORIGIN}${path}`);
    const loaderData = await paperLoader({ request, params: { slug }, context: context() } as never);
    out.push({ path, html: renderRoute(path, Paper, { loaderData }) });
  }
  return out;
}

const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function blocks(html: string): unknown[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1] ?? ""),
  );
}

/** Every typed node in a block, nested ones included, since a Person inside an article is a node too. */
function nodes(value: unknown, out: Node[] = [], top = true): Node[] {
  if (Array.isArray(value)) {
    for (const item of value) nodes(item, out, top);
  } else if (value && typeof value === "object") {
    const node = value as Node;
    // Only top-level nodes are held to their type's rules; a nested one is a reference or a detail.
    if (top && typeof node["@type"] === "string") out.push(node);
    if (Array.isArray(node["@graph"])) nodes(node["@graph"], out, true);
  }
  return out;
}

const present = (node: Node, property: string) =>
  property.split("|").some((name) => {
    const value = node[name];
    return value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
  });

/** The visible trail: each step's name, and its link, which the current step has none of. */
function visibleTrail(html: string): Array<{ name: string; href: string | null }> {
  const nav = html.match(/<nav class="page-breadcrumb" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/)?.[1];
  if (!nav) return [];
  return [...nav.matchAll(/<li>(?:<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<span aria-current="page">([\s\S]*?)<\/span>)/g)].map(
    (m) => ({ name: decode(m[2] ?? m[3] ?? ""), href: m[1] ?? null }),
  );
}

// The papers are D1 rows now, so the schema and the rows exist before the cases below are collected (setup.ts
// applies the same migrations again, which is a no-op).
await applyD1Migrations(env.DB, (env as unknown as { TEST_D1_MIGRATIONS: never }).TEST_D1_MIGRATIONS);
const PAPER_COUNT = await seedPublications();
await seedPages();
await seedCv();
await seedDictionary();
const rendered = await pages();

describe("every JSON-LD block on the pages", () => {
  it("covers every content page, the CV, the publications list and every paper", () => {
    expect(rendered.length).toBe(CONTENT_PAGE_PATHS.length + 1 + PAPER_COUNT);
    // Scope, so a pattern that matched no script element cannot pass every case below: only the two
    // hubs emit nothing.
    expect(rendered.filter((page) => blocks(page.html).length === 0).map((page) => page.path)).toEqual([
      "/research",
      "/teaching",
    ]);
  });

  it.each(rendered.map((page) => [page.path, page] as const))("%s: every block parses and every node has its required properties", (_path, page) => {
    // A hub with no trail and no declared type (/research, /teaching) emits none, and that passes.
    const found = blocks(page.html).flatMap((block) => nodes(block));
    for (const node of found) {
      const type = String(node["@type"]);
      const rule = RULES[type];
      expect(rule, `${page.path}: no rule for @type ${type}`).toBeDefined();
      expect(node["@context"] ?? "https://schema.org", `${page.path} ${type}`).toBe("https://schema.org");
      for (const property of rule?.required ?? []) {
        expect(present(node, property), `${page.path} ${type} lacks required ${property}`).toBe(true);
      }
    }
  });

  it("every missing recommended property is one the ledger names, and every ledger entry is still missing", () => {
    const used = new Set<Missing>();
    const unexplained: string[] = [];
    for (const page of rendered) {
      for (const node of blocks(page.html).flatMap((block) => nodes(block))) {
        const type = String(node["@type"]);
        for (const property of RULES[type]?.recommended ?? []) {
          if (present(node, property)) continue;
          const entry = MISSING.find(
            (m) => m.type.split("|").includes(type) && m.property === property && (!m.page || m.page.test(page.path)),
          );
          if (entry) used.add(entry);
          else unexplained.push(`${page.path} ${type}.${property}`);
        }
      }
    }
    expect(unexplained, "recommended properties missing with no reason in MISSING").toEqual([]);
    expect(MISSING.filter((m) => !used.has(m)).map((m) => `${m.type}.${m.property}`), "stale MISSING entries").toEqual([]);
  });

  it.each(rendered.map((page) => [page.path, page] as const))("%s: a breadcrumb list says exactly what the visible trail says", (_path, page) => {
    const visible = visibleTrail(page.html);
    const lists = blocks(page.html)
      .flatMap((block) => nodes(block))
      .filter((node) => node["@type"] === "BreadcrumbList");
    if (visible.length === 0) {
      expect(lists, `${page.path} marks up a trail it does not show`).toEqual([]);
      return;
    }
    expect(lists).toHaveLength(1);
    const items = (lists[0]?.itemListElement ?? []) as Node[];
    // Google reads a trail of two steps or more.
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((item) => item.position)).toEqual(items.map((_, i) => i + 1));
    expect(items.map((item) => item.name)).toEqual(visible.map((step) => step.name));
    visible.forEach((step, i) => {
      const item = String(items[i]?.item);
      expect(item.startsWith(SITE_ORIGIN), `${page.path}: ${item}`).toBe(true);
      if (step.href) expect(item).toBe(`${SITE_ORIGIN}${step.href}`);
    });
    // The last step is this page, which the visible trail shows unlinked.
    expect(items.at(-1)?.item).toBe(`${SITE_ORIGIN}${page.path}`);
  });
});

describe("the types each page states", () => {
  const onPage = (path: string) => {
    const page = rendered.find((p) => p.path === path);
    expect(page, path).toBeDefined();
    return blocks(page?.html ?? "").flatMap((block) => nodes(block));
  };
  const ofType = (path: string, type: string) => onPage(path).filter((node) => node["@type"] === type);

  it("the phage table is a Dataset whose facts come from the table", () => {
    const [dataset] = ofType("/research/phages", "Dataset");
    expect(dataset?.temporalCoverage).toBe("2017/2025");
    expect(dataset?.variableMeasured).toEqual(["Phage", "Year", "Host", "County", "PhagesDB", "Paper"]);
    expect((dataset?.distribution as Node | undefined)?.contentUrl).toBe(`${SITE_ORIGIN}/research/phages.md`);
    // Google reads a Dataset description of 50 to 5000 characters.
    const length = String(dataset?.description).length;
    expect(length).toBeGreaterThanOrEqual(50);
    expect(length).toBeLessThanOrEqual(5000);
  });

  it("Enarratio is source code with its repository; Capsid is an application whose source is its own node", () => {
    const [enarratio] = ofType("/software/enarratio", "SoftwareSourceCode");
    expect(enarratio?.codeRepository).toBe("https://github.com/DrDustinEdwards/enarratio");
    expect(ofType("/software/capsid", "SoftwareApplication")[0]?.codeRepository).toBeUndefined();
    const [source] = ofType("/software/capsid", "SoftwareSourceCode");
    expect(source?.codeRepository).toBe("https://github.com/DrDustinEdwards/capsid-mcp");
    expect((source?.targetProduct as Node | undefined)?.["@id"]).toBe(ofType("/software/capsid", "SoftwareApplication")[0]?.["@id"]);
  });

  it("CARREL CARRIES NO CODE REPOSITORY AND NO LINK TO ITS CODE (#255)", () => {
    const page = rendered.find((p) => p.path === "/software/carrel");
    const json = JSON.stringify(blocks(page?.html ?? ""));
    expect(json).not.toMatch(/github\.com\/DrDustinEdwards\/carrel/i);
    expect(json).not.toContain("codeRepository");
    expect(ofType("/software/carrel", "SoftwareApplication")).toHaveLength(1);
  });

  it("every software page under /software states a software type, a site or a web page", () => {
    for (const path of CONTENT_PAGE_PATHS.filter((p) => p.startsWith("/software"))) {
      const types = onPage(path).map((node) => node["@type"]);
      expect(
        types.some((t) => ["SoftwareApplication", "SoftwareSourceCode", "WebSite", "WebPage"].includes(String(t))),
        `${path}: ${types.join(", ")}`,
      ).toBe(true);
    }
  });

  it("each paper in the list is the node its own page describes", () => {
    const listed = ofType("/research/publications", "ScholarlyArticle")
      .concat(ofType("/research/publications", "Chapter"), ofType("/research/publications", "LearningResource"));
    expect(listed.length).toBeGreaterThan(0);
    for (const article of listed) {
      const path = String(article["@id"]).slice(SITE_ORIGIN.length);
      const own = onPage(path).find((node) => node["@id"] === article["@id"]);
      expect(own, path).toBeDefined();
      expect(own?.["@type"], path).toBe(article["@type"]);
      expect(own?.headline, path).toBe(article.headline);
    }
  });
});

describe("each carded page's og:image is its own card", () => {
  const image = (descriptors: unknown[], property: string) =>
    (descriptors as Array<Record<string, unknown>>).find((d) => d.property === property || d.name === property)?.content;

  it.each(CONTENT_PAGE_PATHS.filter((path) => hasPageCard(path)).map((path) => [path]))("%s", async (path) => {
    let descriptors: unknown[];
    let card: string | null;
    if (path === "/cv") {
      descriptors = cvMeta() as unknown[];
      card = contentPageCardPath(CV_PAGE);
    } else {
      const loaderData = await contentPageLoader({
        request: new Request(`${SITE_ORIGIN}${path}`),
        params: {},
        context: context(),
      } as never);
      descriptors = contentPageMeta({ loaderData } as never) as unknown[];
      card = contentPageCardPath(loaderData.page);
    }
    expect(card, path).toMatch(/^\/media\/og\//);
    expect(image(descriptors, "og:image")).toBe(`${SITE_ORIGIN}${card}`);
    expect(image(descriptors, "twitter:image")).toBe(`${SITE_ORIGIN}${card}`);
  });

  it("a page outside the carded roots keeps the site card", async () => {
    const loaderData = await contentPageLoader({
      request: new Request(`${SITE_ORIGIN}/research/phages`),
      params: {},
      context: context(),
    } as never);
    const descriptors = contentPageMeta({ loaderData } as never) as unknown[];
    expect(image(descriptors, "og:image")).toBe(`${SITE_ORIGIN}/dustin-edwards-og-image.png`);
  });
});
