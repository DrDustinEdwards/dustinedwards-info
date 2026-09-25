// The theme demo: every cookie preset through the resolver the Worker calls.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { colorSchemeMeta, themeAttribute, themeFromRequest } from "../../../../app/lib/theme.ts";
import { root, stripped } from "../shared.mjs";

/** @param {import("./index.mjs").PlaygroundContext} p */
export function checkTheme({ ok, cookiePresets, playgroundSource, statesInputCap }) {
  for (const preset of cookiePresets) {
    const label = preset.label ?? JSON.stringify(preset.cookie);
    const expect = preset.expect ?? {};

    ok(
      `theme: ${label} declares a cookie header`,
      typeof preset.cookie === "string",
      "the empty string is a legal and important value here; undefined is not",
    );
    ok(
      `theme: ${label} declares a note`,
      typeof preset.note === "string" && preset.note.trim().length > 0,
    );

    /* No header differs from an empty one: the resolver returns early. */
    const request = new Request(
      "https://example.invalid/",
      preset.cookie ? { headers: { cookie: preset.cookie } } : undefined,
    );

    let theme;
    try {
      theme = themeFromRequest(request);
    } catch (error) {
      ok(
        `theme: ${label} resolves without throwing`,
        false,
        `the resolver threw ${error instanceof Error ? error.message : String(error)}. ` +
          `A bad cookie must cost a reader the default theme, never the page, and ` +
          `this function runs on the cache-key path before anything renders.`,
      );
      continue;
    }
    ok(
      `theme: ${label} resolves to ${expect.theme}`,
      theme === expect.theme,
      `the module says ${theme}`,
    );

    const attribute = themeAttribute(theme) ?? null;
    ok(
      `theme: ${label} data-theme is ${JSON.stringify(expect.attribute)}`,
      attribute === expect.attribute,
      `the module says ${JSON.stringify(attribute)}; the ABSENCE is what hands the ` +
        `decision to prefers-color-scheme, so null and a value are different answers`,
    );

    ok(
      `theme: ${label} color-scheme meta is ${JSON.stringify(expect.colorScheme)}`,
      colorSchemeMeta(theme) === expect.colorScheme,
      `the module says ${JSON.stringify(colorSchemeMeta(theme))}`,
    );
  }

  const cookieValues = cookiePresets.map((/** @type {any} */ p) => String(p.cookie ?? ""));
  ok(
    "theme: a preset sends no cookie at all",
    cookieValues.includes(""),
    "the header-absent branch is the default every first-time reader takes, and it " +
      "is the one an always-send-a-header fixture stops testing",
  );
  ok(
    "theme: a preset carries the legacy system value",
    cookieValues.some((/** @type {string} */ v) => /(^|;\s*)theme=system(\s*;|$)/.test(v)),
    "those cookies exist in readers' browsers for a year and must keep resolving " +
      "to the no-cookie document, or the two split into separate cache entries",
  );
  ok(
    "theme: a preset carries a malformed percent escape",
    cookieValues.some((/** @type {string} */ v) => v.includes("%%%")),
    "decoding it raises a URIError on the cache-key path, which was a server error " +
      "on every page for that reader until it was guarded",
  );
  ok(
    "theme: a preset carries the theme among other cookies",
    cookieValues.some((/** @type {string} */ v) => v.includes(";") && v.includes("theme=")),
    "the header is walked rather than matched whole, and only a multi-cookie " +
      "fixture exercises that",
  );
  ok(
    "theme: presets cover both writable values",
    ["light", "dark"].every((value) =>
      cookiePresets.some((/** @type {any} */ p) => p.expect?.theme === value),
    ),
    "the endpoint accepts exactly these two and both must resolve",
  );

  /* Word-anchored: a suffixed name contains the shorter one. */
  ok(
    "theme: the page imports the resolver",
    /from\s+["']~\/lib\/theme["']/.test(playgroundSource) &&
      /\bthemeFromRequest\b/.test(playgroundSource),
    "the demo must call the real resolver, not restate its rules",
  );
  ok(
    "theme: the Worker still resolves the theme through this function",
    /\bthemeFromRequest\b/.test(stripped(readFileSync(join(root, "workers", "app.ts"), "utf8"))),
    "the demo's lede claims workers/app.ts calls it on every request, and it no longer does",
  );
  ok(
    "theme: the page keys the demo on parameter PRESENCE, not on a non-empty value",
    /params\.has\(["']cookie["']\)/.test(playgroundSource),
    "the empty cookie header is this demo's most important case, and a truthiness " +
      "test would make it unreachable by URL",
  );
  ok(
    "theme: the page refuses a header shape a browser could not send",
    /PRINTABLE_ASCII/.test(playgroundSource),
    "an unguarded control character makes new Request throw, and a demo whose input " +
      "can crash its own loader answers some readers with a stack trace",
  );
  statesInputCap("theme: ", /Up to \{COOKIE_CAP\} printable characters/);
  ok(
    "theme: the page renders the absent attribute as a word rather than a blank",
    /"omitted"/.test(playgroundSource),
    "an empty cell reads as a bug; the absence IS the answer for a reader on system",
  );
}
