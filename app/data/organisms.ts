/**
 * Organism names to italicize when rendering publication titles and abstracts.
 *
 * A REVIEWED ALLOWLIST, NOT A PATTERN. Matching "Capitalized lowercase" pairs would italicize Rio
 * Grande, Cancer Handbook and dozens of ordinary sentence openings, so every entry was read in
 * context first.
 *
 * ORDER MATTERS: longest first, because the matcher takes the first alternative that fits, or a
 * subspecies epithet is left upright. Case sensitive, so the genus capital is required, which keeps
 * the bare genus from colliding with ordinary prose.
 *
 * Deliberately NOT included: virus AGENT names, because ICTV italicizes formal taxa rather than
 * vernacular agent names; PHAGE ISOLATE names, which are strain names; common names and protein
 * families; and "Siphoviridae", a formal family-rank taxon that arguably belongs here, left open
 * rather than decided silently.
 */

export const ORGANISMS: readonly string[] = [
  // Trinomials, longest first so the subspecies epithet is covered.
  "Meleagris gallopavo intermedia",
  "Meleagris gallopavo silvestris",
  "Tympanuchus cupido attwateri",
  // Binomials.
  "Arthrobacter globiformis",
  "Microbacterium foliorum",
  "Mycobacterium smegmatis",
  "Meleagris gallopavo",
  "Tympanuchus cupido",
  "Cairina moschata",
  "Gallus gallus",
  // Bare genus. Only Mycobacterium occurs unbound in the corpus, in the
  // Tripl3t and Zeuska title. The other genera appear only with an epithet
  // and are already covered by the binomials above.
  "Mycobacterium",
];
