/**
 * The dictionary entries that open the named software pages (Dustin, 2026-09-28): each name is a
 * real English word most readers rarely meet, so the page first says what the word means, then what
 * the software is. Sense 1 follows the dictionaries; sense 2 is the software, plain and factual, and
 * carries the subject label "software." in italics, as a dictionary marks a specialised sense.
 *
 * Verified 2026-09-28 against Merriam-Webster and Wiktionary (the OED is not freely readable; where
 * Wiktionary cites it, that citation is the OED evidence). Pronunciations are American, matching
 * Merriam-Webster's first form. The clips under public/audio/ were generated once with Workers AI
 * (Deepgram Aura 2, voice "thalia") and transcribed back to check them; the PR that added them
 * lists the transcriptions.
 *
 * Enarratio (2026-09-29) is Latin and in no English dictionary read, so it was verified against
 * Lewis and Short (Perseus: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=enarratio
 * and :entry=enarro) and Wiktionary (https://en.wiktionary.org/wiki/enarratio, /wiki/enarro), and
 * sense 1 against Quintilian, Institutio Oratoria 1.4.2-3 and 1.9.1 (Latin: The Latin Library;
 * English: Butler's Loeb on LacusCurtius). Quintilian names grammar's two parts as correct speech and
 * poetarum enarratio, and says correct reading comes before enarratio, so the word is the
 * explanation, not the reading aloud. Its American pronunciation is derived, not quoted: the Latin
 * stress (on -ra-, since the -ti- is short) with the vowels English speakers give restored Latin.
 *
 * One source for the page, its markdown twin, its search record and its DefinedTerm JSON-LD, so
 * people and machines read the same entry.
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

/** @type {readonly DictionaryEntry[]} */
export const DICTIONARY_ENTRIES = Object.freeze([
  {
    path: "/software/capsid",
    term: "Capsid",
    syllables: "cap·sid",
    ipa: "/ˈkæp.sɪd/",
    respelling: "KAP-sid",
    partOfSpeech: "noun",
    plural: null,
    etymology: ["From French ", ["fr", "capside"], ", from Latin ", ["la", "capsa"], ", “box, case”."],
    senses: [
      "The protein shell of a virus particle, which surrounds its nucleic acid.",
      "A system that stores the instructions and decisions of AI agents and coordinates their work within and across projects.",
    ],
    senseLabels: [null, SOFTWARE_LABEL],
    audio: "/audio/capsid.mp3",
  },
  {
    path: "/software/enarratio",
    term: "Enarratio",
    syllables: "e·nar·ra·ti·o",
    ipa: "/ˌɛn.ɑˈrɑ.ti.oʊ/",
    respelling: "en-ar-RAH-tee-oh",
    partOfSpeech: "noun",
    plural: null,
    etymology: [
      "Latin, from ",
      ["la", "enarrare"],
      ", “to explain in detail”, from ",
      ["la", "ex-"],
      ", “out”, and ",
      ["la", "narrare"],
      ", “to relate”.",
    ],
    senses: [
      "In ancient grammar, a teacher’s detailed explanation and interpretation of a text, especially of the poets.",
      "An open-source toolkit that renders scientific figures on the server and makes each readable by people, screen readers, and AI agents.",
    ],
    senseLabels: [null, SOFTWARE_LABEL],
    audio: "/audio/enarratio.mp3",
  },
  {
    path: "/software/carrel",
    term: "Carrel",
    syllables: "car·rel",
    ipa: "/ˈkɛr.əl/",
    respelling: "KAIR-uhl",
    partOfSpeech: "noun",
    plural: null,
    etymology: [
      "Alteration of Middle English ",
      ["enm", "caroll"],
      ", from Medieval Latin ",
      ["la", "carola"],
      ". First recorded in 1593, for the enclosed study nooks in the cloister of Durham’s medieval monastery.",
    ],
    senses: [
      "A table, often partitioned or enclosed, for individual study, especially in a library.",
      "A private workspace for writing, in which drafts are composed, revised, and published.",
    ],
    senseLabels: [null, SOFTWARE_LABEL],
    audio: "/audio/carrel.mp3",
  },
]);

/**
 * @param {string} path
 * @returns {DictionaryEntry | undefined}
 */
export function dictionaryEntryFor(path) {
  return DICTIONARY_ENTRIES.find((entry) => entry.path === path);
}

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
