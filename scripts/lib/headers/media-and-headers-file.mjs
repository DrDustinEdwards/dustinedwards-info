// Uploaded script-capable media served as an attachment, and the freshness rules in public/_headers.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ALLOWED } from "../../../app/lib/media/upload-contract.mjs";
import { blockFrom } from "../source-body.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

export function run() {
  /*
   * Uploaded SVG is served as an attachment: it can carry script and /media/* is the site's own
   * origin. Kept even though the CSP blocks it, so it does not depend on the policy.
   */
  {
    /* Stripped like every other source here: a comment naming a type, the disposition or
       `new Response(object.body` would otherwise satisfy or inflate the checks below. */
    const mediaRoute = stripComments(readFileSync(join(root, "app/routes/media.$.ts"), "utf8"));

    const helperAt = mediaRoute.search(/function attachIfActive/);
    ok("media: the svg attachment helper exists", helperAt !== -1,
      "nothing sets Content-Disposition, so an uploaded SVG renders inline");

    // Scoped to the helper's own body: asserting the file mentions attachment would pass on a comment.
    const helperBody = helperAt === -1 ? "" : blockFrom(mediaRoute, helperAt);
    /* DERIVED FROM THE UPLOAD ALLOWLIST, never restated, or a NEW capable type joins with no rule. */
    const CAPABLE = ["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/xml"];
    const uploadableCapable = [...ALLOWED.keys()].filter((t) => CAPABLE.includes(t));

    ok("media: some uploadable type can carry script, so this block has scope",
      uploadableCapable.length > 0,
      "no script-capable type is uploadable; if that is now true, delete this block " +
        "deliberately rather than leaving it asserting nothing");

    for (const type of uploadableCapable) {
      ok(`media: the helper refuses ${type} inline`,
        helperBody.includes(type),
        `${type} is uploadable and this route does not attach it, so it is served ` +
          `inline from our own origin`);
    }
    ok("media: it sets content-disposition attachment",
      /content-disposition"?,\s*"attachment/.test(helperBody),
      "the helper exists but does not set the disposition");
    ok("media: it sets nosniff alongside",
      /x-content-type-options/.test(helperBody),
      "an attachment a browser sniffs back to SVG defeats the disposition");

    /* AND APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, the half a helper check cannot see. */
    const bodyReturns = [...mediaRoute.matchAll(/new Response\(object\.body/g)].length;
    const applications = [...mediaRoute.matchAll(/attachIfActive\(headers\)/g)].length;
    ok("media: some path serves the stored bytes", bodyReturns > 0,
      "no `new Response(object.body` found; this block is asserting nothing");
    ok("media: every stored-bytes response applies the helper",
      applications >= bodyReturns,
      `${bodyReturns} response(s) return the object body but the helper is ` +
        `applied ${applications} time(s). A path serves an SVG inline.`);
  }

  /*
   * The immutable year is scoped to /assets/*, whose names carry a content hash; the danger is the glob
   * widening over stable paths. Read per block, since a file-wide reading cannot attribute a directive.
   */
  const HEADERS_FILE = "public/_headers";
  const headersPath = join(root, HEADERS_FILE);

  ok(`${HEADERS_FILE} exists`, existsSync(headersPath),
    "Workers Assets falls back to max-age=0 for every asset without it");

  /**
   * The longest freshness an UNHASHED path may declare, in seconds. Nothing recalls a stored
   * entry: static assets are not in the purgeable page cache. /assets/* is exempt.
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

    const hashed = blocks.filter((b) => b.path === "/assets/*");
    ok("the hashed build output has a rule", hashed.length === 1,
      `expected exactly one /assets/* block, found ${hashed.length}. ` +
        `Without it every asset revalidates on every load.`);

    const immutable = hashed.flatMap((b) =>
      b.directives.filter((d) => /immutable|max-age=\d{5,}/i.test(d)),
    );
    ok("an immutable rule is declared", immutable.length > 0,
      "the file exists but pins nothing, so every asset still revalidates");

    /* THE PROPERTY, per block, and both max-age and s-maxage: a year at the edge is as un-revokable. */
    const unhashed = blocks.filter((b) => b.path !== "/assets/*");
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

    ok("the paths declared here are the ones this site means to declare",
      paths.every((p) => p === "/assets/*" || p === "/publications/*.md"),
      `an unrecognised rule path is a decision nobody argued. Found: ${paths.join(", ")}`);
  }
}
