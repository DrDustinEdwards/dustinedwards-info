// PCR primer arithmetic: reverse complements, primer sites on a template, and product sizes.
//
// Dustin's protocol rule: primer sequences and reverse complements are handled by tested code and
// diffed against the cited paper, never worked out by hand on a page. Melting temperature is out of
// scope on purpose: it depends on salt, primer and Mg2+ concentrations the papers do not all give,
// so this module never computes one.
//
// COORDINATES are 1-based and inclusive, the way GenBank numbers a record, so a site or product
// reported here can be checked against the accession's own feature table without an off-by-one.
//
// IUPAC codes are honoured on both sides. A primer base and a template base MATCH when the sets of
// nucleotides they stand for share at least one member, so an `N` in either matches anything.

/** @type {Record<string, string>} each IUPAC code and the nucleotides it stands for */
const IUPAC = {
  A: "A",
  C: "C",
  G: "G",
  T: "T",
  R: "AG",
  Y: "CT",
  S: "CG",
  W: "AT",
  K: "GT",
  M: "AC",
  B: "CGT",
  D: "AGT",
  H: "ACT",
  V: "ACG",
  N: "ACGT",
};

/** @type {Record<string, string>} */
const COMPLEMENT = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  V: "B",
  D: "H",
  H: "D",
  N: "N",
};

/**
 * Uppercase, whitespace removed, RNA `U` read as `T`. Anything that is not an IUPAC nucleotide code
 * THROWS, naming the character and its position: a stray digit or dash from a pasted table would
 * otherwise shift every coordinate after it without a word.
 *
 * @param {string} seq
 * @returns {string}
 */
export function normalize(seq) {
  const out = seq.replace(/\s+/g, "").toUpperCase().replace(/U/g, "T");
  for (let i = 0; i < out.length; i += 1) {
    if (!(out.charAt(i) in IUPAC)) {
      throw new Error(`not an IUPAC nucleotide code: ${JSON.stringify(out.charAt(i))} at position ${i + 1}`);
    }
  }
  return out;
}

/**
 * @param {string} seq
 * @returns {string} the reverse complement, IUPAC-aware (R <-> Y, K <-> M, B <-> V, D <-> H; S, W, N map to themselves)
 */
export function reverseComplement(seq) {
  const s = normalize(seq);
  let out = "";
  for (let i = s.length - 1; i >= 0; i -= 1) out += COMPLEMENT[s.charAt(i)];
  return out;
}

/**
 * The first record of a FASTA file.
 *
 * @param {string} text
 * @returns {{ header: string, sequence: string }}
 */
export function parseFasta(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(">"));
  if (start === -1) throw new Error("no FASTA header line (a line starting with >)");
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith(">")) break;
    body.push(line);
  }
  return { header: (lines[start] ?? "").slice(1).trim(), sequence: normalize(body.join("")) };
}

/**
 * @param {string} a one IUPAC code
 * @param {string} b one IUPAC code
 * @returns {boolean}
 */
function compatible(a, b) {
  if (a === b) return true;
  const set = IUPAC[b] ?? "";
  for (const n of IUPAC[a] ?? "") if (set.includes(n)) return true;
  return false;
}

/**
 * @typedef {{ type: "extra-primer-base" | "missing-primer-base", primerPosition: number }} Indel
 *   `extra-primer-base`: the primer carries a base the template lacks, at `primerPosition` (1-based
 *   from the primer's 5′ end). `missing-primer-base`: the template carries a base the primer lacks,
 *   immediately 3′ of primer position `primerPosition` (0 means before the first base).
 */

/**
 * @typedef {object} Site
 * @property {"+" | "-"} strand `+`: the primer's own sequence reads on the template as given, so it
 *   primes synthesis rightward. `-`: its reverse complement reads there, so it primes leftward.
 * @property {number} start 1-based first template base the primer covers
 * @property {number} end 1-based last template base the primer covers, inclusive
 * @property {number} mismatches substitutions, not counting an indel
 * @property {number[]} mismatchPositions 1-based positions IN THE PRIMER, counted from its 5′ end
 * @property {Indel | null} indel
 * @property {string} templateSite the template bases under the primer, written 5′ to 3′ in the
 *   primer's own orientation, so it lines up with the primer character for character when there is no indel
 */

/**
 * Hamming comparison of a primer (in template orientation) against the template at `at`.
 *
 * @param {string} template
 * @param {string} probe
 * @param {number} at 0-based
 * @param {number} limit give up past this many mismatches
 * @returns {number[] | null} 0-based probe indices that mismatch, or null past the limit
 */
function hamming(template, probe, at, limit) {
  /** @type {number[]} */
  const miss = [];
  for (let i = 0; i < probe.length; i += 1) {
    if (!compatible(probe.charAt(i), template.charAt(at + i))) {
      miss.push(i);
      if (miss.length > limit) return null;
    }
  }
  return miss;
}

/**
 * Every place a primer binds a template within the allowed number of edits, on both strands.
 *
 * An INDEL is opt-in (`maxIndels: 1`) and at most one is considered: a primer with one extra base
 * relative to the reference, or one base short of it. It is reported, never silently absorbed.
 *
 * Where two candidate sites on the same strand overlap, only the better is kept (fewer edits, and
 * an ungapped fit over a gapped one on a tie), because one stretch of template is one binding site.
 *
 * @param {string} template
 * @param {string} primer 5′ to 3′
 * @param {{ maxMismatches?: number, maxIndels?: number }} [options]
 * @returns {Site[]} sorted by start
 */
export function findSites(template, primer, options = {}) {
  const maxMismatches = options.maxMismatches ?? 0;
  const maxIndels = options.maxIndels ?? 0;
  if (maxIndels !== 0 && maxIndels !== 1) throw new Error("maxIndels must be 0 or 1");
  const t = normalize(template);
  const p = normalize(primer);
  if (p.length === 0) throw new Error("empty primer");

  /** @type {Site[]} */
  const found = [];
  for (const strand of /** @type {const} */ (["+", "-"])) {
    // The primer written as it appears on the + strand of the template.
    const onTemplate = strand === "+" ? p : reverseComplement(p);
    const L = onTemplate.length;
    // Map an index in `onTemplate` back to a 1-based position in the primer from its 5′ end.
    /** @param {number} i */
    const primerPos = (i) => (strand === "+" ? i + 1 : L - i);

    /**
     * @param {number} at 0-based template start
     * @param {number} span template bases covered
     * @param {number[]} miss 0-based indices into `onTemplate` that mismatch
     * @param {Indel | null} indel
     */
    const record = (at, span, miss, indel) => {
      const covered = t.slice(at, at + span);
      found.push({
        strand,
        start: at + 1,
        end: at + span,
        mismatches: miss.length,
        mismatchPositions: miss.map(primerPos).sort((a, b) => a - b),
        indel,
        templateSite: strand === "+" ? covered : reverseComplement(covered),
      });
    };

    for (let at = 0; at + L <= t.length; at += 1) {
      const miss = hamming(t, onTemplate, at, maxMismatches);
      if (miss) record(at, L, miss, null);
    }
    if (maxIndels === 0) continue;

    // One extra base in the primer: drop each primer base in turn and fit what is left.
    for (let drop = 0; drop < L; drop += 1) {
      const probe = onTemplate.slice(0, drop) + onTemplate.slice(drop + 1);
      for (let at = 0; at + probe.length <= t.length; at += 1) {
        const miss = hamming(t, probe, at, maxMismatches);
        if (!miss) continue;
        // Indices past the dropped base belong one further along in the full primer.
        const full = miss.map((i) => (i >= drop ? i + 1 : i));
        record(at, probe.length, full, { type: "extra-primer-base", primerPosition: primerPos(drop) });
      }
    }
    // One base missing from the primer: the template carries one more base than the primer does.
    for (let gap = 1; gap < L; gap += 1) {
      for (let at = 0; at + L + 1 <= t.length; at += 1) {
        const window = t.slice(at, at + gap) + t.slice(at + gap + 1, at + L + 1);
        const miss = hamming(window, onTemplate, 0, maxMismatches);
        if (!miss) continue;
        // `gap` template bases precede the skipped one. On the - strand the primer runs the
        // other way, so the skipped base sits 3′ of primer position L - gap.
        const after = strand === "+" ? gap : L - gap;
        record(at, L + 1, miss, { type: "missing-primer-base", primerPosition: after });
      }
    }
  }
  return keepBest(found);
}

/** @param {Site} s */
function edits(s) {
  return s.mismatches + (s.indel ? 1 : 0);
}

/**
 * @param {Site} a
 * @param {Site} b
 * @returns {number} negative when `a` is the better fit
 */
function better(a, b) {
  return edits(a) - edits(b) || (a.indel ? 1 : 0) - (b.indel ? 1 : 0) || a.start - b.start;
}

/**
 * @param {Site[]} sites
 * @returns {Site[]}
 */
function keepBest(sites) {
  /** @type {Site[]} */
  const kept = [];
  for (const s of [...sites].sort(better)) {
    const overlaps = kept.some((k) => k.strand === s.strand && k.start <= s.end && s.start <= k.end);
    if (!overlaps) kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start || (a.strand < b.strand ? -1 : 1));
}

/**
 * @typedef {object} Product
 * @property {number} start 1-based template position of the 5′ end of the + strand primer
 * @property {number} end 1-based template position of the 5′ end of the - strand primer
 * @property {number} templateLength end - start + 1: the span on the reference
 * @property {number} length the product as synthesised. Each primer is copied into the product
 *   whole, so a primer with an extra base adds one and a primer missing a base removes one. With no
 *   indel it equals `templateLength`.
 * @property {number} forwardMismatches
 * @property {number} reverseMismatches
 * @property {Site} forward
 * @property {Site} reverse
 */

/**
 * @param {Site} site
 * @returns {number} product length change the primer causes relative to the template
 */
function indelShift(site) {
  if (!site.indel) return 0;
  return site.indel.type === "extra-primer-base" ? 1 : -1;
}

/**
 * Every product a forward and a reverse primer make on a template: a + strand site of one primer
 * upstream of a - strand site of the other, the two pointing at each other. Both pairings are
 * tried, so a reference filed in the opposite orientation to the primers still gives its product.
 *
 * Measured from the forward primer's 5′ end to the reverse primer's 5′ end, inclusive.
 *
 * @param {string} template
 * @param {string} forward 5′ to 3′
 * @param {string} reverse 5′ to 3′
 * @param {{ maxMismatches?: number, maxIndels?: number, maxLength?: number }} [options]
 *   `maxLength` (default 10000) drops products longer than a PCR run would make.
 * @returns {Product[]} best first: fewest edits, then shortest
 */
export function amplicons(template, forward, reverse, options = {}) {
  const maxLength = options.maxLength ?? 10000;
  const f = findSites(template, forward, options);
  const r = findSites(template, reverse, options);
  /** @type {Product[]} */
  const out = [];
  /**
   * @param {Site[]} plusFrom
   * @param {Site[]} minusFrom
   * @param {boolean} forwardIsPlus
   */
  const pair = (plusFrom, minusFrom, forwardIsPlus) => {
    for (const plus of plusFrom) {
      if (plus.strand !== "+") continue;
      for (const minus of minusFrom) {
        if (minus.strand !== "-" || minus.end < plus.start) continue;
        const templateLength = minus.end - plus.start + 1;
        if (templateLength > maxLength) continue;
        const fwd = forwardIsPlus ? plus : minus;
        const rev = forwardIsPlus ? minus : plus;
        out.push({
          start: plus.start,
          end: minus.end,
          templateLength,
          length: templateLength + indelShift(plus) + indelShift(minus),
          forwardMismatches: fwd.mismatches,
          reverseMismatches: rev.mismatches,
          forward: fwd,
          reverse: rev,
        });
      }
    }
  };
  pair(f, r, true);
  pair(r, f, false);
  return out.sort(
    (a, b) =>
      edits(a.forward) + edits(a.reverse) - (edits(b.forward) + edits(b.reverse)) ||
      a.length - b.length ||
      a.start - b.start,
  );
}

/**
 * The best product (fewest edits, then shortest). THROWS when the pair makes none within the
 * allowed edits: a missing product is an answer the caller must see, not a length of zero.
 *
 * @param {string} template
 * @param {string} forward
 * @param {string} reverse
 * @param {{ maxMismatches?: number, maxIndels?: number, maxLength?: number }} [options]
 * @returns {Product}
 */
export function amplicon(template, forward, reverse, options = {}) {
  const best = amplicons(template, forward, reverse, options)[0];
  if (!best) {
    throw new Error(
      `no product within ${options.maxMismatches ?? 0} mismatch(es) and ${options.maxIndels ?? 0} indel(s) per primer`,
    );
  }
  return best;
}
