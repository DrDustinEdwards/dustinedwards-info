// The site header as served: the search anchor, its hidden shortcut hint, and the theme form.

import { check, get } from "./client.mjs";

export async function run() {
  const { text } = await get("/");
  const anchorsToSearch = (text.match(/href="\/search"/g) ?? []).length;
  check("header: exactly one anchor to /search", anchorsToSearch === 1, `found ${anchorsToSearch}`);

  const start = text.indexOf('<a class="search-trigger"');
  const end = text.indexOf("</a>", start);
  const anchor = start === -1 ? "" : text.slice(start, end);
  check("header: the search anchor is present", start !== -1);
  check("header: the search anchor has an accessible name", anchor.includes('aria-label="Search"'));
  // The no-JS wire never advertises the shortcut, which does not exist there.
  check(
    "header: the shortcut description ships hidden in the no-JS state",
    /<span[^>]*data-search-hint[^>]*hidden/.test(text) ||
      /<span[^>]*hidden[^>]*data-search-hint/.test(text),
  );
  check(
    "header: nothing paints the shortcut key on the wire",
    !anchor.includes("<kbd"),
  );
  // The description is outside the anchor, so assert the association.
  check(
    "header: the search anchor names its description",
    /aria-describedby="([^"]+)"/.test(anchor) &&
      text.includes(`id="${/aria-describedby="([^"]+)"/.exec(anchor)?.[1]}"`),
  );
  check("header: theme toggle is a real form posting to /theme", text.includes('action="/theme"'));
  const themeButtons = text.match(/<button[^>]*name="theme"[^>]*>/g) ?? [];
  check("header: the theme control ships both writable buttons", themeButtons.length === 2);
  check(
    "header: the theme buttons post only light and dark",
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
