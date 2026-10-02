// One door from a dictionary entry file to everything derived from it: parse, validate, the entry every
// surface reads. check:content, build:content, sync:content and the Carrel adapter's save all call
// compileDictionaryEntry, so a file CI passes is the file the save accepts and the page draws. The rules
// below are the ones the CI tests used to read the entries for (docs/DICTIONARY.md).

import { contentIdFits } from "../carrel/content-id.mjs";
import { gitBlobSha } from "../content/hashes.mjs";
import { CONTENT_PAGE_PATHS } from "../content-pages.mjs";
import { SOFTWARE_LABEL, dictionaryEntryMarkdown, definedTermJsonLd } from "../dictionary-entries.mjs";
import { dictionaryPath, parseDictionaryEntry } from "./parse.mjs";

export const DICTIONARY_KIND = "dictionary";

/** Every key a file may carry. Anything else is a typo that would be silently ignored. */
const FRONT_MATTER_FIELDS = new Set([
  "path", "term", "syllables", "ipa", "respelling", "partOfSpeech", "plural", "etymology", "senses",
  "senseLabels", "audio", "draft",
]);

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUDIO_PATTERN = /^\/audio\/[a-z]+\.mp3$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;
/** A pronunciation clip is a few seconds of speech, not a recording. */
export const AUDIO_MAX_BYTES = 32 * 1024;

/**
 * @typedef {object} DictionaryHost
 * @property {(path: string) => Promise<{ size: number, head?: number[] } | null>} audio the repository file at
 *   a site-absolute public path (`/audio/capsid.mp3`), or null when it is not there. `head` is its first two
 *   bytes where the host can read them (CI); the Worker's GitHub listing cannot, so the MPEG frame sync is
 *   checked in CI only.
 *
 * @typedef {{ key: string, path: string }} OtherEntry
 */

/** @param {unknown} value @returns {value is string} */
const isFilled = (value) => typeof value === "string" && value.trim() !== "";

/**
 * @param {Record<string, unknown>} data
 * @returns {string[]}
 */
function shapeProblems(data) {
  /** @type {string[]} */
  const errors = [];
  const bad = (/** @type {string} */ field, /** @type {string} */ message) => errors.push(`${field}: ${message}`);

  for (const field of Object.keys(data)) {
    if (!FRONT_MATTER_FIELDS.has(field)) bad(field, `is not a field of a dictionary entry (${[...FRONT_MATTER_FIELDS].join(", ")})`);
  }
  for (const field of ["term", "syllables", "ipa", "respelling", "partOfSpeech"]) {
    if (!isFilled(data[field])) bad(field, "is required text");
  }
  if (isFilled(data.ipa) && !/^\/.+\/$/.test(String(data.ipa))) bad("ipa", "sits between slashes, as /ˈkæp.sɪd/");
  if (isFilled(data.respelling) && !/^[A-Za-z-]+$/.test(String(data.respelling))) bad("respelling", "is letters and hyphens only, as KAP-sid");
  if (isFilled(data.term) && isFilled(data.syllables) && String(data.syllables).replaceAll("·", "") !== String(data.term).toLowerCase()) {
    bad("syllables", `joined without its dots it is "${String(data.syllables).replaceAll("·", "")}", not the term "${String(data.term).toLowerCase()}" in lower case`);
  }
  if (data.plural !== undefined && data.plural !== null) {
    if (!Array.isArray(data.plural) || data.plural.length === 0 || !data.plural.every(isFilled)) {
      bad("plural", "is a list of forms, or absent");
    }
  }
  if (!Array.isArray(data.etymology) || data.etymology.length === 0) {
    bad("etymology", "is a list: text, and [language, word] pairs for foreign words");
  } else {
    data.etymology.forEach((part, i) => {
      const pair = Array.isArray(part) && part.length === 2 && LANGUAGE_PATTERN.test(String(part[0])) && isFilled(part[1]);
      if (!(typeof part === "string" && part !== "") && !pair) {
        bad(`etymology[${i}]`, "is text, or a [language, word] pair with a language code such as la");
      }
    });
  }
  if (!Array.isArray(data.senses) || data.senses.length !== 2 || !data.senses.every(isFilled)) {
    bad("senses", "is exactly two senses: the word's meaning, then the software");
  }
  const labels = data.senseLabels;
  if (!Array.isArray(labels) || labels.length !== 2 || labels[0] !== null || labels[1] !== SOFTWARE_LABEL) {
    bad("senseLabels", `is [null, ${SOFTWARE_LABEL}]: sense 1 carries no label, and sense 2 is the software`);
  }
  if (data.draft !== undefined && typeof data.draft !== "boolean") bad("draft", `is ${JSON.stringify(data.draft)}; it is true or false`);
  // The entries describe the words and the software, and say nothing possessive about the site's owner.
  if (/Dustin/.test(JSON.stringify(data))) bad("front matter", "names the site's owner; an entry says nothing possessive about him");
  return errors;
}

/**
 * The entry as the surfaces read it, in the order the page, the twin and the search record expect.
 *
 * @param {Record<string, unknown>} data a file's front matter that passed shapeProblems
 * @returns {import("../dictionary-entries.mjs").DictionaryEntry}
 */
function entryFromData(data) {
  return {
    path: String(data.path),
    term: String(data.term),
    syllables: String(data.syllables),
    ipa: String(data.ipa),
    respelling: String(data.respelling),
    partOfSpeech: String(data.partOfSpeech),
    plural: Array.isArray(data.plural) ? data.plural.map(String) : null,
    etymology: /** @type {import("../dictionary-entries.mjs").EtymologyPart[]} */ (
      /** @type {unknown[]} */ (data.etymology).map((part) => (Array.isArray(part) ? [String(part[0]), String(part[1])] : String(part)))
    ),
    senses: /** @type {[string, string]} */ (/** @type {unknown[]} */ (data.senses).map(String)),
    senseLabels: [null, SOFTWARE_LABEL],
    audio: String(data.audio),
  };
}

/**
 * @param {object} input
 * @param {string} input.key the file's name without `.md`
 * @param {string} input.raw the whole file
 * @param {{ findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> }} input.pipeline
 * @param {DictionaryHost} input.host
 * @param {OtherEntry[]} [input.others] every OTHER entry, for uniqueness
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], key: string, entry: import("../dictionary-entries.mjs").DictionaryEntry, draft: boolean,
 *       body: string, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileDictionaryEntry({ key, raw, pipeline, host, others = [] }) {
  const file = dictionaryPath(key);
  const parsed = parseDictionaryEntry({ file, raw });
  const errors = [
    ...parsed.problems,
    ...pipeline.findWideDashes(raw).map(
      (hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`,
    ),
  ];
  if (parsed.problems.length > 0) return { ok: false, errors };

  if (!KEY_PATTERN.test(key)) errors.push(`the file name "${key}" is not a lowercase kebab-case key`);
  else if (!contentIdFits(DICTIONARY_KIND, key)) errors.push(`the key "${key}" is too long for a Carrel id`);
  errors.push(...shapeProblems(parsed.data));

  const path = typeof parsed.data.path === "string" ? parsed.data.path : "";
  if (!path.startsWith("/software/") || !(/** @type {readonly string[]} */ (CONTENT_PAGE_PATHS).includes(path))) {
    errors.push(`path: "${path}" is not a registered Software page (CONTENT_PAGE_PATHS in app/lib/content-pages.mjs); an entry opens a named software page`);
  } else if (path !== `/software/${key}`) {
    errors.push(`path: ${path} belongs in ${dictionaryPath(path.slice("/software/".length))}; the file name is the entry's key`);
  }
  const taken = others.find((other) => other.path === path);
  if (path && taken) errors.push(`path: ${path} already has an entry (${taken.key}); a page opens with one entry`);

  const audio = typeof parsed.data.audio === "string" ? parsed.data.audio : "";
  if (!AUDIO_PATTERN.test(audio)) {
    errors.push(`audio: "${audio}" is not a clip under /audio/ named in lower-case letters, as /audio/name.mp3`);
  } else {
    const clip = await host.audio(audio);
    if (!clip) errors.push(`audio: ${audio} is not in the repository (public${audio}); a referenced clip must exist, and uploading one is a code change`);
    else {
      if (clip.size >= AUDIO_MAX_BYTES) errors.push(`audio: ${audio} is ${clip.size} bytes; a pronunciation clip is under ${AUDIO_MAX_BYTES}`);
      // An MPEG audio frame sync, not an HTML error page saved under an .mp3 name.
      if (clip.head && (clip.head[0] !== 0xff || ((clip.head[1] ?? 0) & 0xe0) !== 0xe0)) {
        errors.push(`audio: ${audio} does not start with an MPEG audio frame`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const entry = entryFromData(parsed.data);
  // What the twin and the JSON-LD say, each a function of the entry alone: a file that passes cannot fail the page.
  const twin = dictionaryEntryMarkdown(entry).split("\n");
  if (!twin.includes(`2. *${SOFTWARE_LABEL}.* ${entry.senses[1]}`)) errors.push("twin: sense 2 does not carry the software label in its own line");
  if (definedTermJsonLd(entry, "https://example.invalid").description !== entry.senses[1]) errors.push("JSON-LD: the DefinedTerm does not describe the software (sense 2)");
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    key,
    entry,
    draft: parsed.data.draft === true,
    body: parsed.body,
    sourcePath: file,
    sourceBlobSha: await gitBlobSha(raw),
  };
}
