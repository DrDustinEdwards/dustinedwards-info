// Draft preview links: an unminted token's 404 and its headers, and robots.txt.

import { check, get } from "./client.mjs";

export async function run() {
  console.log("\n  draft preview links");

  /* The 200 needs a live token, so only the unminted-token 404 is asserted here. */

  // Well formed: a malformed token is refused before lookup.
  const UNMINTED = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
  check(
    "the probe token is the shape a real one has",
    UNMINTED.length === 43 && /^[A-Za-z0-9_-]+$/.test(UNMINTED),
    `${UNMINTED.length} characters. A malformed token is refused on shape, which ` +
      `would make the assertions below prove something weaker than they claim.`,
  );

  const preview = await get(`/preview/${UNMINTED}`);
  check(
    "an unminted preview token is a 404",
    preview.status === 404,
    `status ${preview.status}`,
  );
  check(
    "the preview 404 is the post route's boring one",
    preview.text.includes(">This page is not here.<"),
    "a distinguishable 404 tells a caller whether a token ever existed",
  );
  check(
    "the preview 404 is private, no-store",
    (preview.res.headers.get("cache-control") ?? "").includes("no-store"),
    `cache-control is ${JSON.stringify(preview.res.headers.get("cache-control"))}. ` +
      `Workers Cache does not key on cookies, so a cacheable response on this ` +
      `path is a draft in a shared cache entry.`,
  );
  check(
    "the preview 404 is not publicly cacheable",
    !/public/i.test(preview.res.headers.get("cache-control") ?? ""),
    "a copy-paste of blog.$slug.tsx's headers() is the exact edit this catches",
  );

  const robots = await get("/robots.txt");
  /* Whole lines, so `/preview` cannot match a longer path. */
  check(
    "robots.txt disallows /preview",
    robots.text.includes("\nDisallow: /preview\n"),
    "advisory, not the control. The header is the control.",
  );
  check(
    "robots.txt still disallows /admin",
    robots.text.includes("\nDisallow: /admin\n"),
    "the paired assertion: a robots.txt that lost both would satisfy neither, and " +
      "an added line is the likeliest way to break the existing one",
  );
}
