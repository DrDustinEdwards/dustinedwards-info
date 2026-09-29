import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const appCss = read("app/app.css");
const proseCss = read("app/styles/prose.css");

// Inter's ascent and descent, in em. An override is a share of the size-adjusted size, so it is these
// divided by the face's size-adjust; a retune that moves one and not the other shifts every line box.
const INTER_ASCENT = 0.969;
const INTER_DESCENT = 0.241;

/** @param {string} family */
function faces(family) {
  const out = [];
  for (const m of appCss.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const pick = (prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim();
    if (pick("font-family")?.replace(/^"|"$/g, "") !== family) continue;
    const pct = (prop) => Number.parseFloat(pick(prop) ?? "NaN") / 100;
    out.push({
      weight: pick("font-weight"),
      src: pick("src") ?? "",
      size: pct("size-adjust"),
      ascent: pct("ascent-override"),
      descent: pct("descent-override"),
    });
  }
  return out;
}

for (const family of ["Inter Fallback", "Inter Prose Fallback"]) {
  test(`${family} has a regular and a bold face, each with Inter's ascent and descent`, () => {
    const found = faces(family);
    assert.deepEqual(
      found.map((f) => f.weight),
      ["100 549", "550 900"],
      `${family} needs one face per weight band, or the heavy weights draw in regular Arial`,
    );
    for (const f of found) {
      assert.match(f.src, /^local\(/, `${family} ${f.weight} must be a local() face`);
      assert.ok(Math.abs(f.ascent - INTER_ASCENT / f.size) < 0.0005, `${family} ${f.weight} ascent-override`);
      assert.ok(Math.abs(f.descent - INTER_DESCENT / f.size) < 0.0005, `${family} ${f.weight} descent-override`);
    }
  });
}

test("sans prose falls back to the face sized at prose size, not the UI one", () => {
  // Inter's opsz axis narrows it as the size grows, so the 109% UI face ran every 17px prose line about
  // 4% wide and the swap re-wrapped paragraphs (/teaching/phage-discovery, CLS 0.177).
  const rule = proseCss.match(/(?:^|\})\s*\.prose\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /font-family:\s*var\(--font-prose\)/, ".prose must set font-family: var(--font-prose)");
  const stack = appCss.match(/--font-prose:\s*([^;]+);/)?.[1] ?? "";
  assert.match(stack, /^"Inter",\s*"Inter Prose Fallback",/, "--font-prose must be Inter, then its prose fallback");
  const [uiRegular] = faces("Inter Fallback");
  const [proseRegular] = faces("Inter Prose Fallback");
  assert.ok(proseRegular.size < uiRegular.size, "the prose fallback must be narrower than the UI one");
});
