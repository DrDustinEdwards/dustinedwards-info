/**
 * American spelling, stated once for the fix and for `check:spelling` (Dustin, 2026-09-22: "we are
 * in Texas").
 *
 * WHOLE WORDS FROM AN EXPLICIT LIST, never stems: `organis` is also the start of `organism`. A
 * token is a maximal run of letters, so a camelCase identifier such as `serialiseTags` is one token
 * that matches nothing here and is left alone, as the job requires.
 *
 * WHAT COUNTS AS COPY. In a code file the lexer below separates code, comments and string
 * literals. Comments are prose. A string literal is copy only when it holds whitespace: a literal
 * with none (`"turbid-centre"`, `"colour"`) is a key, a kind or a file name, which code depends on.
 * Code outside comments and literals is never touched. In prose files, a backtick span with no
 * whitespace is treated the same way, because it names an identifier.
 */

/**
 * British to American, lower case. The capitalized form is derived.
 * @type {Record<string, string>}
 */
const WORDS = {
  colour: "color", colours: "colors", coloured: "colored", colouring: "coloring",
  colourful: "colorful", colourless: "colorless", colourway: "colorway", colourways: "colorways",
  recolour: "recolor", recolours: "recolors", recoloured: "recolored",
  centre: "center", centres: "centers", centred: "centered", centring: "centering",
  centrepiece: "centerpiece", centreline: "centerline",
  grey: "gray", greys: "grays", greyed: "grayed", greyish: "grayish", greyscale: "grayscale",
  behaviour: "behavior", behaviours: "behaviors", behavioural: "behavioral",
  licence: "license", licences: "licenses",
  catalogue: "catalog", catalogues: "catalogs", catalogued: "cataloged", cataloguing: "cataloging",
  favour: "favor", favours: "favors", favoured: "favored", favouring: "favoring",
  favourite: "favorite", favourites: "favorites", favourable: "favorable", unfavourable: "unfavorable",
  honour: "honor", honours: "honors", honoured: "honored", honouring: "honoring", honourable: "honorable",
  neighbour: "neighbor", neighbours: "neighbors", neighbouring: "neighboring", neighbourhood: "neighborhood",
  labour: "labor", laboured: "labored", labouring: "laboring",
  flavour: "flavor", flavours: "flavors", humour: "humor", rumour: "rumor", armour: "armor",
  endeavour: "endeavor", endeavours: "endeavors", odour: "odor", rigour: "rigor", vigour: "vigor",
  tumour: "tumor", tumours: "tumors", vapour: "vapor", harbour: "harbor",
  metre: "meter", metres: "meters", centimetre: "centimeter", centimetres: "centimeters",
  millimetre: "millimeter", millimetres: "millimeters", kilometre: "kilometer", kilometres: "kilometers",
  theatre: "theater", theatres: "theaters", fibre: "fiber", fibres: "fibers", calibre: "caliber",
  litre: "liter", litres: "liters", sombre: "somber", spectre: "specter", lustre: "luster",
  manoeuvre: "maneuver", manoeuvres: "maneuvers",
  defence: "defense", defences: "defenses", offence: "offense", offences: "offenses", pretence: "pretense",
  practise: "practice", practised: "practiced", practising: "practicing",
  analyse: "analyze", analysed: "analyzed", analysing: "analyzing", analyser: "analyzer", analysers: "analyzers",
  paralyse: "paralyze", paralysed: "paralyzed", catalyse: "catalyze", catalysed: "catalyzed",
  travelled: "traveled", travelling: "traveling", traveller: "traveler", travellers: "travelers",
  modelled: "modeled", modelling: "modeling", cancelled: "canceled", cancelling: "canceling",
  labelled: "labeled", labelling: "labeling", levelled: "leveled", levelling: "leveling",
  signalled: "signaled", signalling: "signaling", fuelled: "fueled", channelled: "channeled",
  totalled: "totaled", marshalled: "marshaled", tunnelled: "tunneled", funnelled: "funneled",
  fulfil: "fulfill", fulfils: "fulfills", fulfilment: "fulfillment", enrol: "enroll", enrols: "enrolls",
  enrolment: "enrollment", instalment: "installment", skilful: "skillful", wilful: "willful",
  judgement: "judgment", judgements: "judgments", acknowledgement: "acknowledgment",
  acknowledgements: "acknowledgments", programme: "program", programmes: "programs",
  amongst: "among", whilst: "while", learnt: "learned", sceptical: "skeptical", sceptic: "skeptic",
  ageing: "aging", artefact: "artifact", artefacts: "artifacts", analogue: "analog",
  focussed: "focused", focussing: "focusing", enquiry: "inquiry", enquiries: "inquiries",
  mould: "mold", moulds: "molds", jewellery: "jewelry",
};

/** -ise verbs, by stem: each takes -ise, -ised, -ises, -ising, -iser, -isers, -isation, -isations, -isable. */
const ISE_STEMS = [
  "organ", "recogn", "initial", "normal", "serial", "deserial", "summar", "priorit", "optim", "minim",
  "maxim", "custom", "final", "real", "emphas", "standard", "categor", "visual", "memor", "sanit",
  "token", "parameter", "synchron", "special", "util", "author", "capital", "material", "character",
  "stabil", "local", "random", "apolog", "critic", "general", "legitim", "central", "digit", "harmon",
  "modern", "neutral", "personal", "rational", "theor", "trivial", "vector", "virtual", "italic",
  "canonical", "formal", "penal", "symbol", "dramat", "econom", "fertil", "hospital",
  "industrial", "jeopard", "mobil", "polar", "revolution", "scrutin", "subsid", "steril", "motor",
  "uniform",
];
const ISE_SUFFIXES = ["e", "ed", "es", "ing", "er", "ers", "ation", "ations", "able"];
for (const stem of ISE_STEMS) {
  for (const suffix of ISE_SUFFIXES) WORDS[`${stem}is${suffix}`] ??= `${stem}iz${suffix}`;
}

/**
 * The American form of one token, or null when it is not on the list. Case follows the token.
 * @param {string} token
 * @returns {string | null}
 */
export function americanFor(token) {
  const lower = token.toLowerCase();
  const american = Object.hasOwn(WORDS, lower) ? WORDS[lower] : null;
  if (!american) return null;
  if (token === lower) return american;
  if (token === lower[0].toUpperCase() + lower.slice(1)) return american[0].toUpperCase() + american.slice(1);
  return null; // ALL CAPS and mixed case are constants or identifiers, not prose
}

/**
 * Split source into segments by lexical kind. Handles //, block comments, the three quote styles
 * and `${}` nesting inside template literals. Regex literals are not recognized, which is harmless
 * here: a regex that contains a quote is rare, and the worst case is a segment misread as a
 * string, which the whitespace rule then treats conservatively.
 *
 * @param {string} src
 * @param {{ css?: boolean }} [options] CSS has block comments and strings, no line comments
 * @returns {Array<{ kind: "code" | "comment" | "string", text: string }>}
 */
export function lex(src, { css = false } = {}) {
  /** @type {Array<{ kind: "code" | "comment" | "string", text: string }>} */
  const out = [];
  let i = 0;
  let start = 0;
  /** @param {"code" | "comment" | "string"} kind @param {number} end */
  const push = (kind, end) => {
    if (end > start) out.push({ kind, text: src.slice(start, end) });
    start = end;
  };
  /** Template depth stack: each entry is the brace depth at which its `${` opened. */
  const templates = [];
  let braces = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (!css && c === "/" && next === "/") {
      push("code", i);
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      push("comment", i);
    } else if (c === "/" && next === "*") {
      push("code", i);
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      push("comment", i);
    } else if (c === '"' || c === "'" || (!css && c === "`")) {
      push("code", i);
      i += 1;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") i += 2;
        else if (c === "`" && src[i] === "$" && src[i + 1] === "{") break;
        else if (c !== "`" && src[i] === "\n") break;
        else i += 1;
      }
      if (c === "`" && src[i] === "$") {
        push("string", i);
        templates.push(braces);
        braces += 1;
        i += 2;
        continue;
      }
      i += 1;
      push("string", Math.min(i, src.length));
    } else if (!css && c === "}" && templates.length > 0 && braces - 1 === templates[templates.length - 1]) {
      // The end of a ${} expression: resume the template literal's text.
      braces -= 1;
      templates.pop();
      push("code", i);
      i += 1;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "$" && src[i + 1] === "{") break;
        else i += 1;
      }
      if (src[i] === "$") {
        push("string", i);
        templates.push(braces);
        braces += 1;
        i += 2;
        continue;
      }
      i += 1;
      push("string", Math.min(i, src.length));
    } else if (!css && c === "/" && regexCanStart(src, i)) {
      // A regex literal stays code, but it is skipped whole so a quote inside it opens no string.
      i += 1;
      let inClass = false;
      while (i < src.length && src[i] !== "\n") {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === "/" && !inClass) break;
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        i += 1;
      }
      i += 1;
    } else {
      if (c === "{") braces += 1;
      else if (c === "}") braces -= 1;
      i += 1;
    }
  }
  push("code", src.length);
  return out;
}

/**
 * Whether a `/` at `at` opens a regex literal rather than dividing: true after an operator,
 * an opening bracket, a comma, or a keyword that takes an expression.
 * @param {string} src @param {number} at
 */
function regexCanStart(src, at) {
  let j = at - 1;
  while (j >= 0 && /\s/.test(src[j])) j -= 1;
  if (j < 0) return true;
  if ("(,=:[!&|?{};+-*%<>~^".includes(src[j])) return true;
  const word = src.slice(0, j + 1).match(/[A-Za-z]+$/)?.[0];
  return word === "return" || word === "typeof" || word === "case" || word === "in" || word === "of";
}

/**
 * JSX text in a code segment: the run after a `>` or a closing `}` and before the next `<` or `{`,
 * when it holds whitespace, is what a reader sees. Used for `.tsx` only; an identifier this
 * misreads as text is caught by the typecheck, since only words on the list ever change.
 * @param {string} seg @param {(text: string) => string} rewrite
 */
function rewriteJsxText(seg, rewrite) {
  return seg.replace(/([>}])([^<>{}]*\s[^<>{}]*)(?=[<{])/g, (whole, open, text) => `${open}${rewrite(text)}`);
}

const TOKEN = /[A-Za-z]+/g;

/**
 * Rewrite the prose in one run of text, leaving identifier-shaped backtick spans alone.
 * @param {string} text
 * @param {(hit: { british: string, american: string }) => void} onHit
 */
function rewriteProse(text, onHit) {
  // A JSDoc tag's NAME is the parameter or property it documents, so it is an identifier.
  const tagName = /@(?:param|property|prop|arg|argument|typedef)\s+(?:\{[^}]*\}\s*)?\[?[A-Za-z_$][\w$]*/;
  const pattern = new RegExp(`${tagName.source}|\`[^\`\\s]*\`|[A-Za-z]+`, "g");
  return text.replace(pattern, (match) => {
    if (match.startsWith("`") || match.startsWith("@")) return match;
    const american = americanFor(match);
    if (!american) return match;
    onHit({ british: match, american });
    return american;
  });
}

/**
 * The American rewrite of a file, and what changed and what was left.
 *
 * @param {string} src
 * @param {"code" | "css" | "prose"} mode
 * @param {{ jsx?: boolean }} [options] rewrite JSX text in code segments, for `.tsx`
 * @returns {{ text: string, changed: Array<{ british: string, american: string }>, left: Array<{ british: string, where: string }> }}
 */
export function americanize(src, mode, { jsx = false } = {}) {
  /** @type {Array<{ british: string, american: string }>} */
  const changed = [];
  /** @type {Array<{ british: string, where: string }>} */
  const left = [];
  const onHit = (/** @type {{ british: string, american: string }} */ hit) => changed.push(hit);
  if (mode === "prose") return { text: rewriteProse(src, onHit), changed, left };

  const segments = lex(src, { css: mode === "css" });
  const text = segments
    .map(({ kind, text: seg }) => {
      if (kind === "comment") return rewriteProse(seg, onHit);
      if (kind === "string") {
        // Copy has whitespace. A literal with none is a key, a kind or a path.
        if (/\s/.test(seg.slice(1, -1))) return rewriteProse(seg, onHit);
        for (const t of seg.match(TOKEN) ?? []) if (americanFor(t)) left.push({ british: t, where: `literal ${seg}` });
        return seg;
      }
      const code = jsx ? rewriteJsxText(seg, (t) => rewriteProse(t, onHit)) : seg;
      for (const t of code.match(TOKEN) ?? []) if (americanFor(t)) left.push({ british: t, where: "code" });
      return code;
    })
    .join("");
  return { text, changed, left };
}

/** @param {string} path @returns {"code" | "css" | "prose" | null} */
export function modeFor(path) {
  if (/\.(mjs|js|ts|tsx|json)$/.test(path)) return "code";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".md")) return "prose";
  return null;
}
