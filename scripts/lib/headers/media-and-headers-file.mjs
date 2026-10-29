// Script-capable media: never uploadable, served as an attachment if stored anyway, and every /media
// response sandboxed by its own policy. Then the freshness rules in public/_headers.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ALLOWED, SVG_TYPE, validateUpload } from "../../../app/lib/media/upload-contract.mjs";
import { MEDIA_CSP, contentSecurityPolicy } from "../../../workers/csp.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

export async function run() {
  /*
   * Script-capable types are never uploadable: from /media, the site's own origin, one would run as
   * the site. Asserted on the allowlist and on the validator, which refuses SVG by name.
   */
  const CAPABLE = ["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/xml"];
  {
    const uploadableCapable = [...ALLOWED.keys()].filter((t) => CAPABLE.includes(t));
    ok("media: no script-capable type is in the upload allowlist",
      uploadableCapable.length === 0,
      `ALLOWED holds ${uploadableCapable.join(", ")}, which can carry script and would be served ` +
        `from this site's own origin`);
    const svgRefusal = validateUpload({ type: SVG_TYPE, bytes: new TextEncoder().encode("<svg/>").buffer });
    ok("media: validateUpload refuses SVG by name",
      svgRefusal?.code === "svg-refused" && svgRefusal.status === 415,
      `an SVG upload returned ${JSON.stringify(svgRefusal)}, not the svg-refused 415`);
  }

  /*
   * Every /media response carries the sandboxed media policy, chosen by path inside
   * contentSecurityPolicy(), since the Renderer sets that header last and would overwrite a route's.
   * Called, not parsed, like the document policy in csp.mjs.
   */
  {
    const directives = MEDIA_CSP.split("; ");
    ok("media: the media policy is default-src 'none'", directives.includes("default-src 'none'"),
      `MEDIA_CSP is "${MEDIA_CSP}"`);
    ok("media: the media policy sandboxes", directives.includes("sandbox"),
      `MEDIA_CSP is "${MEDIA_CSP}"; without sandbox an opened SVG or HTML body runs as the site`);
    ok("media: the media policy allows no script", !directives.some((d) => d.startsWith("script-src")),
      `MEDIA_CSP is "${MEDIA_CSP}"`);
    for (const path of ["/media/x.png", "/media/a/b.svg", "/media"]) {
      const policy = await contentSecurityPolicy(path, undefined);
      ok(`media: ${path} gets the media policy`, policy === MEDIA_CSP,
        `contentSecurityPolicy("${path}") returned "${policy}"`);
    }
    for (const path of ["/", "/mediakit", "/blog/media/x"]) {
      const policy = await contentSecurityPolicy(path, undefined);
      ok(`media: ${path} keeps the document policy`, policy !== MEDIA_CSP && !policy.includes("sandbox"),
        `contentSecurityPolicy("${path}") returned the media policy, so a page is sandboxed`);
    }
  }

  /*
   * A stored SVG is served as an attachment: upload refuses it, but a legacy or hand-put object can
   * still be in the bucket. The route is site-runtime's (./image), which attaches an SVG on every path
   * that serves stored bytes and is tested there; this holds the route to it, so a hand-written
   * response beside it cannot serve one inline.
   */
  {
    /* Stripped like every other source here: a comment naming the call would otherwise satisfy it. */
    const mediaRoute = stripComments(readFileSync(join(root, "app/routes/media.$.ts"), "utf8"));
    const imagesModule = stripComments(readFileSync(join(root, "app/lib/media/images.mjs"), "utf8"));
    ok("media: the route answers with site-runtime's image route",
      /return images\.respond\(request,/.test(mediaRoute) && /from "@dustinedwards\/site-runtime\/image"/.test(imagesModule),
      "app/routes/media.$.ts does not return images.respond() from app/lib/media/images.mjs, so the SVG attachment " +
        "and the closed width set are not the shared route's");
    ok("media: no other response serves the stored bytes",
      // The empty key's 404 is a string literal; any other body is the stored object's.
      !/new Response\((?!"Not found")/.test(mediaRoute),
      "the route builds a response of its own beside images.respond(); a path that serves an SVG inline is back");
  }

  /*
   * The immutable year is scoped to /assets/* and /islands/*, whose names carry a content hash; the danger is the glob
   * widening over stable paths. Read per block, since a file-wide reading cannot attribute a directive.
   */
  const HEADERS_FILE = "public/_headers";
  const headersPath = join(root, HEADERS_FILE);

  ok(`${HEADERS_FILE} exists`, existsSync(headersPath),
    "Workers Assets falls back to max-age=0 for every asset without it");

  /**
   * The longest freshness an UNHASHED path may declare, in seconds. Nothing recalls a stored
   * entry: static assets are not in the purgeable page cache. /assets/* and /islands/* are exempt.
   */
  const MAX_UNHASHED_FRESHNESS = 3600;

  if (existsSync(headersPath)) {
    const raw = readFileSync(headersPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#"));

    /** @type {Array<{ path: string, directives: string[] }>} */
    const blocks = [];
    for (const raw_line of lines) {
      const line = raw_line.trim();
      if (/^\s/.test(raw_line)) {
        if (blocks.length === 0) blocks.push({ path: "(no path line)", directives: [] });
        blocks[blocks.length - 1].directives.push(line);
      } else {
        blocks.push({ path: line, directives: [] });
      }
    }
    const paths = blocks.map((b) => b.path);

    ok("the rule file declares at least one path", blocks.length > 0,
      `parsed ${blocks.length} block(s) from ${HEADERS_FILE}`);

    ok("every declared block carries at least one header",
      blocks.every((b) => b.directives.length > 0),
      `a path with no directives under it sets nothing. Found: ` +
        `${blocks.filter((b) => b.directives.length === 0).map((b) => b.path).join(", ")}`);

    /* Vite's /assets/ and devkit's /islands/ (the islands and their chunks): every name carries a content hash. */
    const HASHED = ["/assets/*", "/islands/*"];
    const hashed = blocks.filter((b) => HASHED.includes(b.path));
    ok("the hashed build output has a rule", hashed.length === HASHED.length,
      `expected one block each for ${HASHED.join(" and ")}, found ${hashed.length}. ` +
        `Without them every asset revalidates on every load.`);

    const immutable = hashed.flatMap((b) =>
      b.directives.filter((d) => /immutable|max-age=\d{5,}/i.test(d)),
    );
    ok("an immutable rule is declared", immutable.length >= HASHED.length,
      "the file exists but pins nothing, so every asset still revalidates");

    /* THE PROPERTY, per block, and both max-age and s-maxage: a year at the edge is as un-revokable. */
    const unhashed = blocks.filter((b) => !HASHED.includes(b.path));
    const overFresh = unhashed.flatMap((b) =>
      b.directives.flatMap((d) => {
        if (/immutable/i.test(d)) return [`${b.path}: ${d} (immutable)`];
        return [...d.matchAll(/\b(?:s-maxage|max-age)=(\d+)/gi)]
          .filter((m) => Number(m[1]) > MAX_UNHASHED_FRESHNESS)
          .map((m) => `${b.path}: ${m[0]}`);
      }),
    );
    ok(
      `no unhashed path is fresh for more than ${MAX_UNHASHED_FRESHNESS}s ` +
        `(${unhashed.length} unhashed block(s) read)`,
      overFresh.length === 0,
      `a long-lived rule on an unhashed path cannot be revoked before it ` +
        `expires: ${overFresh.join("; ")}`,
    );

    // No page twin is a static file now: every page's twin, and the CV's, is a route whose headers are code
    // (docs/PAGES.md, docs/CV.md), so the only rules left here are the hashed assets'.
    ok("the paths declared here are the ones this site means to declare",
      paths.every((p) => HASHED.includes(p)),
      `an unrecognized rule path is a decision nobody argued. Found: ${paths.join(", ")}`);

    /*
     * The CV's twin is a Worker route too, so its canonical Link, its noindex and the tag a CV save purges are
     * code, and a rule here would be a stale copy.
     */
    const cvTwinRoute = stripComments(readFileSync(join(root, "app", "routes", "cv[.md].ts"), "utf8"));
    ok("the CV twin names its page with Link rel=canonical, from the route that serves it",
      /canonicalLink\(CV_PAGE\.path\)/.test(cvTwinRoute) && /"x-robots-tag":\s*"noindex"/.test(cvTwinRoute) &&
        /"cache-tag":\s*CV_CACHE_TAG/.test(cvTwinRoute),
      "every other markdown twin carries canonicalLink (app/lib/markdown-twin.ts); " +
        "without it the CV twin is the one machine document that does not say which page it stands for");

    /*
     * The paper twins are a Worker route since publications moved to D1, so their headers are code. A rule
     * here would be a stale copy, and the route has to carry the canonical Link, the noindex and the cache
     * tag a save purges.
     */
    const twinRoute = stripComments(
      readFileSync(join(root, "app", "routes", "publications.$slug[.md].ts"), "utf8"),
    );
    ok("the paper twins name their page with Link rel=canonical, from the route that serves them",
      /canonicalLink\(paperPath\(/.test(twinRoute) && /"x-robots-tag":\s*"noindex"/.test(twinRoute) &&
        /"cache-tag":\s*PUBLICATIONS_CACHE_TAG/.test(twinRoute),
      "every other markdown twin and llms file carries canonicalLink (app/lib/markdown-twin.ts); " +
        "without it a paper twin is the one machine document that does not say which page it stands for");
  }
}
