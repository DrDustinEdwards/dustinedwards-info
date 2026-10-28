// The site header as served: the search icon and the theme form.

import { check, get } from "./client.mjs";

export async function run() {
  const { text } = await get("/");

  // Capsomer's search icon: a link to the search page, so it works with no script.
  check(
    "header: the search icon links to /search and has an accessible name",
    /<a class="cap-site-header-icon cap-site-header-search-button" href="\/search" aria-label="Search [^"]+"/.test(text),
  );
  check("header: theme toggle is a real form posting to /theme", text.includes('action="/theme"'));
  const themeButtons = text.match(/<button[^>]*name="theme"[^>]*>/g) ?? [];
  check(
    "header: the theme buttons post only light and dark, and both are reachable",
    themeButtons.every((b) => /value="(light|dark)"/.test(b)) &&
      new Set(themeButtons.map((b) => /value="([a-z]+)"/.exec(b)?.[1])).size === 2,
  );
  check(
    "header: the theme control carries no pressed state",
    !text.includes('aria-pressed="true"'),
  );
  check(
    "header: each theme button names the action it performs",
    themeButtons.every((b) => /aria-label="Switch to (light|dark) theme"/.test(b)),
  );
}
