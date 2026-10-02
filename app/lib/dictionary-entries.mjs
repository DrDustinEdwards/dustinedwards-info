/**
 * How a dictionary entry reads on each surface. The entries themselves are files, content/dictionary/<key>.md
 * (docs/DICTIONARY.md), compiled by app/lib/dictionary/compile.mjs and drawn from D1 (the dictionary_entries
 * table) at request time; this module only turns one entry into the page's lead, the markdown twin's lead, the
 * search record's sentences and the DefinedTerm JSON-LD, so people and machines read the same entry.
 *
 * Each name is a real English word most readers rarely meet, so the page first says what the word means, then
 * what the software is. Sense 1 follows the dictionaries; sense 2 is the software, plain and factual, and
 * carries the subject label "software." in italics, as a dictionary marks a specialised sense.
 */

/**
 * An etymology is text with foreign words marked, so the page can set them in italics with their
 * language and the twin can emphasise them: a string is plain text, a pair is [lang, word].
 *
 * @typedef {string | [string, string]} EtymologyPart
 * @typedef {{
 *   path: string,
 *   term: string,
 *   syllables: string,
 *   ipa: string,
 *   respelling: string,
 *   partOfSpeech: string,
 *   plural: string[] | null,
 *   etymology: EtymologyPart[],
 *   senses: [string, string],
 *   senseLabels: [string | null, string | null],
 *   audio: string,
 * }} DictionaryEntry
 */

/** The subject label on each software sense (Dustin, 2026-09-28), set in italics before it. */
export const SOFTWARE_LABEL = "software";

/** @param {string | null | undefined} label */
function labelPrefix(label) {
  return label ? `${label}. ` : "";
}

/** @param {string} term */
export function listenLabel(term) {
  return `Listen to the pronunciation of ${term}`;
}

/** @param {DictionaryEntry} entry */
export function etymologyText(entry) {
  return entry.etymology.map((part) => (typeof part === "string" ? part : part[1])).join("");
}

/**
 * The entry as plain sentences, for the search record, where markup would be noise.
 *
 * @param {DictionaryEntry} entry
 */
export function dictionaryEntryText(entry) {
  const plural = entry.plural ? `; plural ${entry.plural.join(" or ")}` : "";
  return [
    `${entry.term} (${entry.syllables}), ${entry.ipa}, ${entry.respelling}, ${entry.partOfSpeech}${plural}.`,
    ...entry.senses.map((sense, i) => `${i + 1}. ${labelPrefix(entry.senseLabels[i])}${sense}`),
    `Etymology: ${etymologyText(entry)}`,
  ].join(" ");
}

/**
 * The entry in the markdown twin, directly under the title, the same place the page shows it.
 *
 * @param {DictionaryEntry} entry
 * @param {string} origin absolute origin for the audio link, so the twin read alone still resolves
 */
export function dictionaryEntryMarkdown(entry, origin = "") {
  const plural = entry.plural ? `; plural ${entry.plural.map((form) => `*${form}*`).join(" or ")}` : "";
  const etymology = entry.etymology.map((part) => (typeof part === "string" ? part : `*${part[1]}*`)).join("");
  return [
    `**${entry.syllables}** ${entry.ipa} (${entry.respelling}), *${entry.partOfSpeech}*${plural}. [Pronunciation audio](${origin}${entry.audio})`,
    "",
    ...entry.senses.map((sense, i) => {
      const label = entry.senseLabels[i];
      return `${i + 1}. ${label ? `*${label}.* ` : ""}${sense}`;
    }),
    "",
    `Etymology: ${etymology}`,
    "",
  ].join("\n");
}

/**
 * schema.org DefinedTerm: the name, sense 2 as the description (what the word means on this page),
 * and the set every entry belongs to, which is the Software hub.
 *
 * @param {DictionaryEntry} entry
 * @param {string} origin
 */
export function definedTermJsonLd(entry, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.term,
    description: entry.senses[1],
    url: `${origin}${entry.path}`,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Software names on dustinedwards.info",
      url: `${origin}/software`,
    },
  };
}
