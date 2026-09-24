// Accessions are read only inside the data-availability statement: a bare regex over a PDF returns
// comparison phages and other outbreaks' deposits, a wrong citation. The text is the committed
// extraction, which check:machine-readable binds to each PDF's sha256.

// Case-insensitive with an optional statement: covers both ASM templates, Frontiers and MDPI.
const SECTION_START = /\bdata availability\b\.?\s*(statement)?\s*:?\s*/i;

// Cut at the next section so the sweep never reaches the reference list; MAX_SECTION bounds a
// statement with no terminator.
const SECTION_END =
  /\b(acknowledg|references|supplemental material|author contributions|conflict of interest|funding|ethics|figures?\s+s?\d)/i;

const MAX_SECTION = 900;

// Per registry because the URL differs: one builder would link an SRA run to nuccore, a 404. The version
// suffix is dropped: NCBI resolves to the current one and the statement does not pin a revision.
const GRAMMARS = [
  { kind: "bioproject", re: /\bPRJ[A-Z]{2}\d{4,}\b/g, url: "https://www.ncbi.nlm.nih.gov/bioproject/" },
  { kind: "biosample", re: /\bSAM[A-Z]\d{4,}\b/g, url: "https://www.ncbi.nlm.nih.gov/biosample/" },
  { kind: "sra", re: /\bSR[XRPS]\d{5,}\b/g, url: "https://www.ncbi.nlm.nih.gov/sra/" },
  {
    kind: "genbank",
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
      // First grammar wins; longest first, so an SRA run is claimed before the GenBank shape sees it.
      if (!found.has(id)) found.set(id, { kind, id });
    }
  }

  return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * @param {Accession} accession
 * @returns {string}
 */
export function accessionUrl(accession) {
  const grammar = GRAMMARS.find((g) => g.kind === accession.kind);
  if (!grammar) {
    // Never guess a registry: the wrong database 404s or, worse, shows a different record.
    throw new Error(`no registry URL for accession kind ${JSON.stringify(accession.kind)}`);
  }
  return `${grammar.url}${accession.id}`;
}

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
