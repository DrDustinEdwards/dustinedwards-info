import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LICENSE_LINK, TERMS_PATH } from "~/lib/license.mjs";
import { CONTENT_PAGE_PATHS, LEGAL_PAGE_PATHS } from "~/lib/content-pages.mjs";
import { pageSourcePath } from "~/lib/pages/compile.mjs";
import { deletePageRow } from "~/lib/pages/save.server";
import { contentPageJsonLd } from "~/lib/pages/page-json-ld";
import { LICENSE_URL } from "~/lib/seo";
import { action } from "~/routes/api.carrel.v1.$";
import ContentPage, { loader as pageLoader } from "~/routes/content-page";
import { loader as twinLoader } from "~/routes/content-page[.md]";
import { loader as csvLoader } from "~/routes/protocols[.csv]";

import privacy from "../../content/pages/privacy.md?raw";
import terms from "../../content/pages/terms.md?raw";

import { stubGitHub, versionOf, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedPages, seedProcedures } from "./seed";
import { testEnv } from "./test-env";

/* The site side of Carrel's legal pages (job_044f96426efa): /privacy is a page like /terms, the layout draws
 * the banner and the date from the front matter, /terms can never be unpublished or deleted, and the license
 * wiring behind TERMS_PATH keeps working. */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const TERMS_FILE = pageSourcePath("terms");
const TERMS_ID = "page.terms";
const PRIVACY_FILE = pageSourcePath("privacy");

const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});
const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;
const send = (method: "PUT" | "POST", url: string, body: unknown) =>
  action(argsFor(new Request(url, { method, headers: headersFor(testEnv.CARREL_SITE_KEY), body: JSON.stringify(body) })));
const pageData = (path: string) => pageLoader(argsFor(new Request(`${ORIGIN}${path}`)));
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const termsRow = () => testEnv.DB.prepare("SELECT status FROM pages WHERE path = ?1").bind(TERMS_PATH).first<{ status: string }>();

let gh: GitHubStub;

beforeAll(async () => {
  await seedPages();
  await seedProcedures();
});
beforeEach(() => {
  gh = stubGitHub({ [TERMS_FILE]: terms, [PRIVACY_FILE]: privacy });
});
afterEach(() => {
  gh.restore();
});

describe("/privacy is a registered page", () => {
  it("is a legal page in the registry, served from its row with a twin, in Carrel's page kind", async () => {
    expect(CONTENT_PAGE_PATHS).toContain("/privacy");
    expect(LEGAL_PAGE_PATHS).toEqual(["/privacy", TERMS_PATH]);
    expect((await pageData("/privacy")).page).toMatchObject({ path: "/privacy", title: "Privacy" });
    const twin = (await twinLoader(argsFor(new Request(`${ORIGIN}/privacy.md`)))) as Response;
    expect(twin.status).toBe(200);
    expect(await twin.text()).toMatch(/^# Privacy\n\nWhat this site records/);
  });
});

describe("the layout draws the banner and the date", () => {
  const render = async (path: string) =>
    renderRoute(path, ContentPage, { loaderData: await pageData(path) });

  it("draws neither when the front matter states neither", async () => {
    const html = await render("/privacy");
    expect(html).not.toContain("legal-banner");
    expect(html).not.toContain("legal-updated");
  });

  it("draws the single word Draft and the date once a save states them, and nothing else", async () => {
    const source = terms.replace(/^---\n/, "---\nbanner: Draft\nlast_updated: 2026-10-06\n");
    const saved = await send("PUT", `${PREFIX}/content/${TERMS_ID}/draft`, {
      source,
      expectedVersion: await versionOf(gh, TERMS_FILE),
      changeId: "chg-legal-fields",
    });
    expect(saved.status, await saved.clone().text()).toBe(200);

    const html = await render(TERMS_PATH);
    expect(html).toContain('<p class="legal-banner">Draft</p>');
    expect(html).toContain('Last updated <time dateTime="2026-10-06">October 6, 2026</time>');
    const twin = (await twinLoader(argsFor(new Request(`${ORIGIN}/terms.md`)))) as Response;
    expect(await twin.text()).toMatch(/^# Terms\n\nDraft\n\nLast updated: October 6, 2026\n\n/);
  });
});

describe("/terms can never be unpublished or deleted", () => {
  it("REFUSES an unpublish through site-api, names the reason, and changes nothing", async () => {
    const before = gh.files.get(TERMS_FILE);
    const response = await send("POST", `${PREFIX}/content/${TERMS_ID}/unpublish`, {
      expectedVersion: await versionOf(gh, TERMS_FILE),
      changeId: "chg-unpublish-terms",
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/license on every data set/);
    expect(gh.files.get(TERMS_FILE)).toBe(before);
    expect(commits()).toHaveLength(0);
    expect((await pageData(TERMS_PATH)).draft).toBe(false);
    expect((await termsRow())?.status).toBe("published");
  });

  it("keeps it published when a save's source says draft: true: a save keeps the stored status", async () => {
    const response = await send("PUT", `${PREFIX}/content/${TERMS_ID}/draft`, {
      source: terms.replace(/^---\n/, "---\ndraft: true\n"),
      expectedVersion: await versionOf(gh, TERMS_FILE),
      changeId: "chg-draft-terms",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(gh.files.get(TERMS_FILE)).not.toMatch(/^draft: true$/m);
    expect((await termsRow())?.status).toBe("published");
  });

  it("REFUSES the sync that would remove its row, and the row stays", async () => {
    await expect(deletePageRow(testEnv as never, { slug: "terms", path: TERMS_PATH })).rejects.toMatchObject({
      name: "PolicyError",
      policy: "terms-cannot-be-removed",
    });
    expect((await termsRow())?.status).toBe("published");
  });

  it("still lets another page go down: the guard is the license page's alone", async () => {
    const row = await testEnv.DB.prepare("SELECT slug, path FROM pages WHERE path = '/privacy'").first<{ slug: string; path: string }>();
    expect(row).toBeTruthy();
    await deletePageRow(testEnv as never, row as { slug: string; path: string });
    expect(await testEnv.DB.prepare("SELECT 1 FROM pages WHERE path = '/privacy'").first()).toBeNull();
    await seedPages();
  });
});

describe("the license wiring behind TERMS_PATH", () => {
  it("TERMS_PATH resolves to a published page", async () => {
    expect(TERMS_PATH).toBe("/terms");
    const { page, draft } = await pageData(TERMS_PATH);
    expect(page.path).toBe(TERMS_PATH);
    expect(draft).toBe(false);
  });

  it("a download carries the Link rel=license header", async () => {
    const response = (await csvLoader(argsFor(new Request(`${ORIGIN}/protocols.csv`)))) as Response;
    expect(response.status).toBe(200);
    expect(response.headers.get("link")).toContain(LICENSE_LINK);
    expect(LICENSE_LINK).toBe(`<${TERMS_PATH}>; rel="license"`);
  });

  it("a Dataset's JSON-LD names the license URL, whatever the front matter says", async () => {
    const { page } = await pageData(TERMS_PATH);
    const dataset = { ...page, schemaType: "Dataset", license: "https://example.com/other", dataset: { variableMeasured: ["Phage"], temporalCoverage: null, rows: 1 } };
    const nodes = contentPageJsonLd(dataset as never, [], null) as Array<Record<string, unknown>>;
    const node = nodes.find((n) => n["@type"] === "Dataset");
    expect(node?.license).toBe(LICENSE_URL);
  });
});
