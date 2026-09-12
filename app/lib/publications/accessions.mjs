/**
 * Sequence accessions, read out of a paper's own data-availability statement.
 *
 * ## THE CONTEXT ANCHOR IS THE WHOLE OF THIS MODULE
 *
 * Ruling 63 asked for GenBank accessions and the first attempt was REFUTED, in
 * a way worth keeping written down: the accessions are not in the abstracts,
 * they are in the PDFs, and a plain accession regex over a PDF returns other
 * people's deposits. Measured on this corpus:
 *
 *   - the Godfather announcement yields seven accessions to a bare regex, one
 *     of which is Godfather's; the rest are the comparison phages in its
 *     similarity table
 *   - the 2022 REV announcement names `DQ387450` in its second sentence, which
 *     is the isolate sequenced during a DIFFERENT outbreak ten years earlier
 *   - the Tripl3t and Zeuska paper names `NC_022070` for Wheeler, a phage the
 *     paper is comparing itself to
 *
 * Every one of those would have been published on this site as "the data behind
 * this paper", which is a wrong citation rather than a missing one.
 *
 * A journal requires the authors to name what THIS work deposited in one
 * place: the data-availability statement. So the anchor is that section, and
 * accessions are read from inside it and nowhere else. The cost is that a paper
 * whose journal has no such requirement contributes nothing, which is the right
 * direction to fail in.
 *
 * ## WHY IT READS THE EXTRACTED TEXT AND NOT THE PDF
 *
 * `data/publications.text.json` is the committed extraction, bound to each
 * PDF's sha256 by `check:publications`. Reading the PDF here would put a parser
 * in the gate and in the build; reading the artifact means the accessions are
 * derived from bytes the gate has already proven are the bytes on disk.
 */

/**
 * Where a data-availability statement begins.
 *
 * Both spellings are in this corpus and they are not interchangeable: ASM's
 * older template writes `Data availability.` and the 2023 redesign writes
 * `DATA AVAILABILITY` as a heading, while Frontiers and MDPI write
 * `Data availability statement`. Case-insensitive with an optional `statement`
 * covers all four without matching the phrase inside a sentence, because the
 * anchor is followed by the statement itself rather than by prose about one.
 */
const SECTION_START = /\bdata availability\b\.?\s*(statement)?\s*:?\s*/i;

/**
 * Where it ends.
 *
 * A statement runs to the next section, and the sections that follow it in this
 * corpus are acknowledgments, references, a funding note or a figure. Cutting
 * at the first of those is what stops the sweep running on into a reference
 * list, which is where the densest concentration of other people's accessions
 * lives.
 *
 * A statement with none of these after it (the last thing on the last page) is
 * bounded by `MAX_SECTION` instead, so a missing terminator cannot silently
 * turn the anchor into "the rest of the paper".
 */
const SECTION_END =
  /\b(acknowledg|references|supplemental material|author contributions|conflict of interest|funding|ethics|figures?\s+s?\d)/i;

/** How far a statement may run before it is treated as unterminated. */
const MAX_SECTION = 900;

/**
 * The accession grammars this corpus actually contains, longest first.
 *
 * NAMED PER REGISTRY rather than matched as one shape, because the URL differs
 * per registry and a single builder would put an SRA run under a nuccore URL,
 * which is a 404 that looks like a working link.
 *
 * The version suffix (`.1`, `.2`) is matched and DROPPED: NCBI resolves the
 * unversioned accession to the current version, and a version pinned here would
 * be a claim about which revision the paper deposited that the statement does
 * not make.
 */
const GRAMMARS = [
  { kind: "bioproject", re: /\bPRJ[A-Z]{2}\d{4,}\b/g, url: "https://www.ncbi.nlm.nih.gov/bioproject/" },
  { kind: "biosample", re: /\bSAM[A-Z]\d{4,}\b/g, url: "https://www.ncbi.nlm.nih.gov/biosample/" },
  { kind: "sra", re: /\bSR[XRPS]\d{5,}\b/g, url: "https://www.ncbi.nlm.nih.gov/sra/" },
  {
    kind: "genbank",
    /*
     * RefSeq (`NC_022070`) and the three INSDC shapes: one letter and five
     * digits, two letters and six, two letters and eight for WGS. Anchored on
     * both sides so a digit run inside a longer token is not a partial match.
     */
    re: /\b(?:NC_\d{6}|[A-Z]\d{5}|[A-Z]{2}\d{6}|[A-Z]{2}\d{8})(?:\.\d+)?\b/g,
    url: "https://www.ncbi.nlm.nih.gov/nuccore/",
  },
];

/**
 * @typedef {object} Accession
 * @property {string} kind one of the GRAMMARS kinds
 * @property {string} id unversioned
 */

/**
 * Every accession a paper's data-availability statement names.
 *
 * @param {string[]} pages the extracted text, one string per page
 * @returns {Accession[]} sorted, so the output is a property of the paper
 */
export function accessionsInText(pages) {
  const flat = (Array.isArray(pages) ? pages : []).join(" ").replace(/\s+/g, " ");
  const start = SECTION_START.exec(flat);
  if (!start) return [];

  const after = flat.slice(start.index + start[0].length, start.index + start[0].length + MAX_SECTION);
  const end = SECTION_END.exec(after);
  const section = end ? after.slice(0, end.index) : after;

  /** @type {Map<string, Accession>} */
  const found = new Map();
  for (const { kind, re } of GRAMMARS) {
    for (const match of section.matchAll(re)) {
      const id = match[0].replace(/\.\d+$/, "");
      // First grammar wins: they are ordered longest first, so an SRA run is
      // claimed by `sra` before the GenBank shape could see part of it.
      if (!found.has(id)) found.set(id, { kind, id });
    }
  }

  return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The registry URL for one accession.
 *
 * @param {Accession} accession
 * @returns {string}
 */
export function accessionUrl(accession) {
  const grammar = GRAMMARS.find((g) => g.kind === accession.kind);
  if (!grammar) {
    // Throws rather than guessing a registry. A link to the wrong database
    // resolves to a 404 or, worse, to a different record with the same id.
    throw new Error(`no registry URL for accession kind ${JSON.stringify(accession.kind)}`);
  }
  return `${grammar.url}${accession.id}`;
}

/** What each kind is called beside the link. */
const KIND_LABEL = {
  genbank: "GenBank",
  sra: "SRA",
  bioproject: "BioProject",
  biosample: "BioSample",
};

/**
 * @param {string} kind
 * @returns {string}
 */
export function accessionLabel(kind) {
  const label = KIND_LABEL[/** @type {keyof typeof KIND_LABEL} */ (kind)];
  if (!label) {
    throw new Error(
      `no label for accession kind ${JSON.stringify(kind)}. Add one here, or ` +
        `the page and the registry would disagree about what it is.`,
    );
  }
  return label;
}
