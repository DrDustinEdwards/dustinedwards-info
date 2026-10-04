// The closed lists a procedure's `method`, `organism` and `course` are chosen from, so the protocol library can
// filter by them (docs/PROCEDURES.md): a value is an id from here or the save is refused, which keeps "PCR" from
// being "pcr", "PCR" and "polymerase chain reaction" on three pages. A procedure's `target` (the gene or region it
// amplifies, the sample it works on) is free text, because targets are as many as the experiments.
//
// The organism ids are the phages' host keys (app/lib/phages/compile.mjs HOSTS) where a host exists, so a protocol's
// organism and a phage's host are the same word. When the lab registry holds host strains, these become records
// and this list is read from them.

/** What a procedure is mostly doing: the library's "method" facet. */
export const METHODS = Object.freeze({
  pcr: "PCR",
  plating: "Plating and titering",
  culture: "Culture",
  extraction: "Nucleic acid extraction",
  sequencing: "Sequencing",
  annotation: "Genome annotation",
  media: "Media and reagents",
  microscopy: "Microscopy",
});

/** The organism a procedure works with or on. */
export const ORGANISMS = Object.freeze({
  smegmatis: "Mycobacterium smegmatis",
  foliorum: "Microbacterium foliorum",
  avian: "Birds",
});

/** The courses a procedure is taught in, each with the page that describes it. */
export const COURSES = Object.freeze({
  "phage-discovery": { label: "Phage Discovery Program", path: "/teaching/phage-discovery" },
  "virus-isolation": { label: "Virus Isolation Course", path: "/teaching/virus-isolation" },
  "phage-bioinformatics": { label: "Phage Bioinformatics Course", path: "/teaching/phage-bioinformatics" },
});

/**
 * The phage workflow the library draws as a strip, in the order a phage takes through the lab: each stage is the
 * methods that carry it out. A stage with no protocol yet is drawn without a link, so the strip is the lab's own
 * path and a protocol appears under its stage the moment one is saved.
 */
export const PHAGE_PIPELINE = Object.freeze([
  { id: "isolate", label: "Isolate and purify", methods: ["plating", "culture"] },
  { id: "extract", label: "Extract DNA", methods: ["extraction"] },
  { id: "sequence", label: "Sequence", methods: ["sequencing"] },
  { id: "annotate", label: "Annotate", methods: ["annotation"] },
]);

/**
 * The tabs above the library: the lab's two kinds of work, each the methods that make it up. "All" is implied. A tab
 * is a link to the library narrowed to its methods, so it is also what the method facet would give.
 */
export const LIBRARY_TABS = Object.freeze([
  { id: "phage", label: "Phage work", methods: PHAGE_PIPELINE.flatMap((stage) => stage.methods) },
  { id: "pcr", label: "PCR and primers", methods: ["pcr"] },
]);

/** The words for an id in a closed list, or the id itself when the list does not know it. */
export function methodLabel(/** @type {string} */ id) {
  return /** @type {Record<string, string>} */ (METHODS)[id] ?? id;
}
export function organismLabel(/** @type {string} */ id) {
  return /** @type {Record<string, string>} */ (ORGANISMS)[id] ?? id;
}
export function courseLabel(/** @type {string} */ id) {
  return /** @type {Record<string, { label: string }>} */ (COURSES)[id]?.label ?? id;
}

/** The protocol library's address; its filters are query parameters on it, so the canonical stays this path. */
export const LIBRARY_PATH = "/research/protocols";
