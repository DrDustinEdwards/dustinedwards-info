import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { readCv } from "~/db/cv";
import { cvFingerprint } from "~/lib/cv/pdf-html.mjs";
import { CV_PDF_KEY, FINGERPRINT_FIELD, ensureCvPdf } from "~/lib/cv/pdf.server";
import { CV_FILES, cvSourcePath } from "~/lib/cv/parse.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { action } from "~/routes/api.carrel.v1.$";
import { loader as pdfLoader } from "~/routes/cv-pdf";

import { collectingContext, fakeAssets, fakeBrowser, fakePdf, workingBrowser } from "./cv-pdf-fixtures";
import { stubGitHub, versionOf, type GitHubStub } from "./github-stub";
import { routeContext } from "./route-helpers";
import { seedCv, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* The CV's PDF follows each CV save (hard rule 18: the CV rows are the source, the PDF is derived). A save through
 * site-api's adapter commits, writes D1, and then renders ONCE in the background through Browser Run (mocked here:
 * the binding has no local emulation) into one R2 object stamped with the fingerprint of the data. A failed render
 * never undoes the save; the cv-pdf-drift check goes red and sync_cv_pdf repairs it. */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;

const FILES = import.meta.glob("../../content/cv/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const rawOf = (slug: string) => {
  const found = FILES[`../../content/cv/${slug}.md`];
  if (found === undefined) throw new Error(`no content/cv/${slug}.md`);
  return found;
};
const repository = () => Object.fromEntries(CV_FILES.map(({ slug }) => [cvSourcePath(slug), rawOf(slug)]));

const FIRST = "First Pdf Equipment Award";
const SECOND = "Second Pdf Equipment Award";
const withGrant = (title: string, amount: number) =>
  rawOf("grants").replace(
    "entries:\n",
    `entries:\n  - year: 2026\n    amount: ${amount}\n    title: ${title}\n    funder: Example Foundation\n    areas: []\n    role: recipient\n`,
  );

let gh: GitHubStub;

const headersFor = () => ({
  authorization: `Bearer ${testEnv.CARREL_SITE_KEY}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});

/** The Worker's env with the two bindings the renderer reads, and a context that keeps the save's background work. */
function world(browser: Env["BROWSER"]) {
  const background = collectingContext();
  const withBindings = { ...env, BROWSER: browser, ASSETS: fakeAssets } as unknown as Env;
  const put = async (source: string, changeId: string) => {
    const response = await action({
      request: new Request(`${PREFIX}/content/cv.grants/draft`, {
        method: "PUT",
        headers: headersFor(),
        body: JSON.stringify({ source, expectedVersion: await versionOf(gh, "content/cv/grants.md"), changeId }),
      }),
      context: routeContext(background.ctx, { BROWSER: browser, ASSETS: fakeAssets }),
      params: {},
    } as never);
    return response;
  };
  const save = (title: string, amount: number, changeId: string) => put(withGrant(title, amount), changeId);
  return { env: withBindings, save, put, settle: background.settle };
}

const stored = () => env.OG.head(CV_PDF_KEY);
const fingerprintOfD1 = async () => cvFingerprint(await readCv(env as never));
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const check = async (w: { env: Env }) => (await runHealthChecks(w.env)).checks.find((c) => c.name === "cv-pdf-drift");
const grantsRow = () => env.DB.prepare("SELECT record FROM cv WHERE slug = 'grants'").first<{ record: string }>();
const operator = { kind: "operator", id: "test" } as never;

beforeAll(async () => {
  await seedPublications();
}, 300_000);

beforeEach(async () => {
  await seedCv();
  await env.OG.delete(CV_PDF_KEY);
  gh = stubGitHub(repository());
});

afterEach(() => {
  gh.restore();
  vi.restoreAllMocks();
});

describe("a CV save through the adapter renders the PDF once", () => {
  it("stores ONE object, stamped with the fingerprint of the data the save wrote, and the check is green", { timeout: 300_000 }, async () => {
    const browser = workingBrowser();
    const w = world(browser.binding);

    expect((await check(w))?.ok, "no object yet").toBe(false);

    const response = await w.save(FIRST, 1111, "chg-pdf-1");
    expect(response.status, await response.clone().text()).toBe(200);
    // The save answered without waiting for the renderer; the background work settles here.
    await w.settle();

    expect(browser.calls).toHaveLength(1);
    expect(browser.calls[0]?.html).toContain(FIRST);
    expect(browser.calls[0]?.pdfOptions).toMatchObject({ format: "letter", tagged: true, outline: true, preferCSSPageSize: true });

    const object = await stored();
    expect(object?.httpMetadata?.contentType).toBe("application/pdf");
    const fingerprint = await fingerprintOfD1();
    expect(object?.customMetadata?.[FINGERPRINT_FIELD]).toBe(fingerprint);
    expect(browser.calls[0]?.html).toContain(`CV data ${fingerprint}.`);
    // ONE key, whatever the number of saves.
    expect((await env.OG.list({ prefix: "derived/" })).objects.map((o) => o.key)).toEqual([CV_PDF_KEY]);

    expect((await check(w))?.ok).toBe(true);
  });

  it("a second save REPLACES the one object, with the newer fingerprint", { timeout: 300_000 }, async () => {
    const browser = workingBrowser();
    const w = world(browser.binding);

    expect((await w.save(FIRST, 1111, "chg-a")).status).toBe(200);
    await w.settle();
    const first = (await stored())?.customMetadata?.[FINGERPRINT_FIELD];

    expect((await w.save(SECOND, 2222, "chg-b")).status).toBe(200);
    await w.settle();
    const second = (await stored())?.customMetadata?.[FINGERPRINT_FIELD];

    expect(browser.calls).toHaveLength(2);
    expect(second).toBe(await fingerprintOfD1());
    expect(second).not.toBe(first);
    expect((await env.OG.list({ prefix: "derived/" })).objects).toHaveLength(1);
  });

  it("a save of a file with no change renders nothing", { timeout: 300_000 }, async () => {
    const browser = workingBrowser();
    const w = world(browser.binding);
    const response = await w.put(rawOf("grants"), "chg-same");
    expect(response.status).toBe(200);
    await w.settle();
    expect(commits()).toHaveLength(0);
    expect(browser.calls).toHaveLength(0);
  });
});

describe("a render that fails never undoes the save", () => {
  it("keeps the commit and the D1 row, logs the alert, shows red, and sync_cv_pdf repairs it", { timeout: 300_000 }, async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = fakeBrowser(() => new Response('{"success":false}', { status: 503 }));
    const w = world(broken.binding);

    const response = await w.save(FIRST, 1111, "chg-fail");
    // The save is a success: the PDF is derived (hard rule 18).
    expect(response.status, await response.clone().text()).toBe(200);
    const settled = await w.settle();
    expect(settled[0]?.status).toBe("rejected");

    expect(commits()).toHaveLength(1);
    expect(gh.files.get(cvSourcePath("grants"))).toBe(withGrant(FIRST, 1111));
    expect((await grantsRow())?.record).toContain(FIRST);
    expect(await stored()).toBeNull();
    expect(errors.mock.calls.some(([line]) => String(line).includes('"alert":"cv-pdf-render-failed"') && String(line).includes("503"))).toBe(true);

    const red = await check(w);
    expect(red?.ok).toBe(false);
    expect(red?.detail).toContain("sync_cv_pdf");

    // The repair, through the operator door, with a renderer that works.
    const good = workingBrowser();
    const repairing = world(good.binding);
    const repaired = await runTool(repairing.env as never, operator, "sync_cv_pdf", {});
    expect(repaired.ok, JSON.stringify(repaired)).toBe(true);
    if (repaired.ok) expect(repaired.data).toMatchObject({ action: "stored", expected: 1, present: 1, drift: 0, converged: true });
    expect((await stored())?.customMetadata?.[FINGERPRINT_FIELD]).toBe(await fingerprintOfD1());
    expect((await check(repairing))?.ok).toBe(true);

    // Idempotent: the object is current, so a second run renders nothing.
    const again = await runTool(repairing.env as never, operator, "sync_cv_pdf", {});
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ action: "current", converged: true });
    expect(good.calls).toHaveLength(1);
  });

  it("never replaces a PDF with a 200 that is not one", { timeout: 300_000 }, async () => {
    const w = world(workingBrowser().binding);
    await ensureCvPdf(w.env);
    const before = await stored();
    expect(before).not.toBeNull();

    // The data moves, and the renderer answers 200 with junk.
    await env.DB.prepare("UPDATE cv SET record = REPLACE(record, 'Fall 2026', 'Winter 2026') WHERE slug = 'profile'").run();
    const junk = fakeBrowser(() => new Response("<html>not a pdf</html>", { status: 200 }));
    await expect(ensureCvPdf({ ...env, BROWSER: junk.binding, ASSETS: fakeAssets } as unknown as Env)).rejects.toThrow(/not a PDF/);
    expect((await stored())?.etag).toBe(before?.etag);
  });

  it("says which binding is missing, instead of rendering nothing quietly", async () => {
    await expect(ensureCvPdf({ ...env, BROWSER: undefined, ASSETS: fakeAssets } as unknown as Env)).rejects.toThrow(
      /BROWSER binding is not configured/,
    );
  });
});

describe("a later save is never overwritten by an earlier render", () => {
  it("discards the slow render of save A once save B has changed the data, and the final object is B's", { timeout: 300_000 }, async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Render 1 (save A) is held open; every later render answers at once.
    const browser = fakeBrowser(async (call) => {
      if (call === 1) await gate;
      return new Response(fakePdf(`render ${call}`), { headers: { "content-type": "application/pdf" } });
    });
    const a = world(browser.binding);

    expect((await a.save(FIRST, 1111, "chg-slow")).status).toBe(200);
    const fingerprintA = await fingerprintOfD1();
    // A's render has started and is waiting on the gate; save B lands, and its render is the quick one.
    await vi.waitFor(() => expect(browser.calls).toHaveLength(1));

    const b = world(browser.binding);
    expect((await b.save(SECOND, 2222, "chg-fast")).status).toBe(200);
    const fingerprintB = await fingerprintOfD1();
    expect(fingerprintB).not.toBe(fingerprintA);
    await b.settle();
    expect((await stored())?.customMetadata?.[FINGERPRINT_FIELD]).toBe(fingerprintB);

    // A's render finishes now, drawn from data that is no longer the CV. It must not land.
    release();
    await a.settle();

    expect((await stored())?.customMetadata?.[FINGERPRINT_FIELD], "the older render did not overwrite the newer").toBe(fingerprintB);
    expect((await check(a))?.ok).toBe(true);
  });
});

describe("/dustin-edwards-cv.pdf", () => {
  const request = (init?: RequestInit) =>
    pdfLoader({ request: new Request(`${ORIGIN}/dustin-edwards-cv.pdf`, init), context: routeContext(), params: {} } as never);
  const PDF = fakePdf("route");

  const put = () =>
    env.OG.put(CV_PDF_KEY, PDF, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { [FINGERPRINT_FIELD]: "feedc0de" } });

  it("serves the object as application/pdf, tagged cv, with an ETag and byte ranges advertised", async () => {
    await put();
    const res = await request();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-tag")).toBe("cv");
    expect(res.headers.get("cache-control")).toBe("public, max-age=0");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe(String(PDF.length));
    expect(res.headers.get("content-disposition"), "the static file carried none").toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("answers a conditional request with 304 and a HEAD with headers and no body", async () => {
    await put();
    const etag = (await request()).headers.get("etag") ?? "";
    expect(etag).not.toBe("");
    expect((await request({ headers: { "if-none-match": etag } })).status).toBe(304);

    const head = await request({ method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toBe("application/pdf");
    expect(head.headers.get("content-length")).toBe(String(PDF.length));
    expect(await head.text()).toBe("");
  });

  it("answers a byte range with 206 and its Content-Range", async () => {
    await put();
    const res = await request({ headers: { range: "bytes=0-9" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-9/${PDF.length}`);
    expect(res.headers.get("content-length")).toBe("10");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF.subarray(0, 10));

    const tail = await request({ headers: { range: "bytes=-5" } });
    expect(tail.status).toBe(206);
    expect(tail.headers.get("content-range")).toBe(`bytes ${PDF.length - 5}-${PDF.length - 1}/${PDF.length}`);
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(PDF.subarray(PDF.length - 5));
  });

  it("answers 404 with a message that says why, and is not cached", async () => {
    const res = await request();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toMatch(/not been rendered yet.*sync_cv_pdf/);
    expect((await request({ method: "HEAD" })).status).toBe(404);
  });
});
