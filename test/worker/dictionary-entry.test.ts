import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DictionaryEntry } from "~/components/dictionary-entry";
import type { DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";

import dictionaryArtifact from "../../content/generated/dictionary.json";

/* The entries as D1 holds them: the rows build:content compiles from content/dictionary/*.md, parsed the way
 * the page route parses a row's record. */
const DICTIONARY_ENTRIES: Entry[] = dictionaryArtifact.dictionary.map((row) => JSON.parse(row.record) as Entry);

describe.each(DICTIONARY_ENTRIES.map((entry) => [entry.term, entry] as const))("the %s entry", (term, entry) => {
  const html = renderToStaticMarkup(h(DictionaryEntry, { entry }));

  it("renders the headword, pronunciation, part of speech, both senses and the etymology", () => {
    expect(html).toContain(`<span aria-hidden="true">${entry.syllables}</span>`);
    expect(html).toContain(`<span class="term-ipa">${entry.ipa}</span>`);
    expect(html).toContain(`<span class="term-respell">${entry.respelling}</span>`);
    expect(html).toContain(`<i>${entry.partOfSpeech}</i>`);
    const senses = [...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
    expect(senses).toHaveLength(2);
    expect(html).toContain('<span class="term-ety-label">Etymology</span>');
  });

  it("names the speaker exactly, as a real button and as the no-script link", () => {
    const label = `Listen to the pronunciation of ${term}`;
    expect(html).toMatch(new RegExp(`<button type="button" class="term-listen"[^>]*aria-label="${label}"`));
    expect(html).toMatch(new RegExp(`<a class="term-listen term-listen-link" href="${entry.audio}"[^>]*aria-label="${label}"`));
    expect(html).toContain('aria-pressed="false"');
  });

  it("never autoplays: no audio element in the markup, and nothing marked to play on load", () => {
    expect(html).not.toMatch(/<audio|autoplay/i);
  });

  it("loads the pronunciation enhancement", () => {
    expect(html).toMatch(/<template data-enhance="\/assets\/pronounce-[A-Za-z0-9_-]{8}\.js"><\/template>/);
  });
});

describe("the Enarratio entry", () => {
  const entry = DICTIONARY_ENTRIES.find((e) => e.term === "Enarratio");

  it("replaces Abscissa's, and marks its Latin sources as Latin", () => {
    expect(entry?.path).toBe("/software/enarratio");
    expect(DICTIONARY_ENTRIES.some((e) => e.path === "/software/abscissa")).toBe(false);
    if (!entry) return;
    const html = renderToStaticMarkup(h(DictionaryEntry, { entry }));
    expect(html).toContain('<i lang="la">enarrare</i>');
    expect(html).toContain('<i lang="la">narrare</i>');
  });
});

describe("the Capsomer entry", () => {
  const entry = DICTIONARY_ENTRIES.find((e) => e.term === "Capsomer");

  it("is the software's own page, with its French and Greek sources marked and its clip named", () => {
    expect(entry?.path).toBe("/software/capsomer");
    expect(entry?.audio).toBe("/audio/capsomer.mp3");
    if (!entry) return;
    const html = renderToStaticMarkup(h(DictionaryEntry, { entry }));
    expect(html).toContain('<i lang="fr">capsomère</i>');
    expect(html).toContain('<i lang="grc">meros</i>');
  });
});
