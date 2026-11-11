import { DictionaryEntry } from "capsomer/react/dictionary-entry";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entryProps, type DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";

import dictionaryArtifact from "../../content/generated/dictionary.json";

/* The entries as D1 holds them: the rows build:content compiles from content/dictionary/*.md, parsed the way
 * the page route parses a row's record, drawn by Capsomer's DictionaryEntry (which tests its own speaker). */
const DICTIONARY_ENTRIES: Entry[] = dictionaryArtifact.dictionary.map(
  (row) => JSON.parse(row.record) as Entry,
);
const render = (entry: Entry) => renderToStaticMarkup(h(DictionaryEntry, entryProps(entry)));

describe.each(DICTIONARY_ENTRIES.map((entry) => [entry.term, entry] as const))(
  "the %s entry",
  (_term, entry) => {
    it("renders the headword, pronunciation, part of speech, both senses, the clip and the etymology", () => {
      const html = render(entry);
      expect(html).toContain(`<span aria-hidden="true">${entry.syllables}</span>`);
      expect(html).toContain(`<span class="cap-dictionary-entry-ipa">${entry.ipa}</span>`);
      expect(html).toContain(
        `<span class="cap-dictionary-entry-respell">${entry.respelling}</span>`,
      );
      expect(html).toContain(`<i>${entry.partOfSpeech}</i>`);
      const senses = [...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
      expect(senses).toHaveLength(2);
      expect(html).toContain(`data-cap-part="listen-link"`);
      expect(html).toContain(`href="${entry.audio}"`);
      expect(html).toContain('<span class="cap-dictionary-entry-ety-label">Etymology</span>');
    });
  },
);

describe("the Enarratio entry", () => {
  const entry = DICTIONARY_ENTRIES.find((e) => e.term === "Enarratio");

  it("replaces Abscissa's, and marks its Latin sources as Latin", () => {
    expect(entry?.path).toBe("/software/enarratio");
    expect(DICTIONARY_ENTRIES.some((e) => e.path === "/software/abscissa")).toBe(false);
    if (!entry) return;
    const html = render(entry);
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
    const html = render(entry);
    expect(html).toContain('<i lang="fr">capsomère</i>');
    expect(html).toContain('<i lang="grc">meros</i>');
  });
});
