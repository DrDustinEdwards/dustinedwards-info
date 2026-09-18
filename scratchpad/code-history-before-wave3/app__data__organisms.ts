/**
 * Organism names to italicize when rendering publication titles and abstracts.
 *
 * A reviewed allowlist, not a pattern. Matching on "Capitalized lowercase"
 * pairs would italicize Rio Grande, Cancer Handbook, Phage Therapy and dozens
 * of ordinary sentence openings, so every entry here was read in context first.
 * Derived by auditing the stored titles and abstracts, not from memory.
 *
 * Order matters: longest first. The matcher takes the first alternative that
 * fits, so "Meleagris gallopavo intermedia" has to precede "Meleagris
 * gallopavo" or the subspecies epithet is left upright.
 *
 * Matching is case sensitive, so the genus capital is required. That is what
 * keeps the bare genus "Mycobacterium" from colliding with ordinary prose.
 *
 * Deliberately NOT included:
 *
 * - Virus agent names: reticuloendotheliosis virus, fowlpox virus,
 *   lymphoproliferative disease virus, human T-cell leukemia virus. ICTV
 *   italicizes formal taxa, not vernacular agent names, and these titles use
 *   the agent form throughout.
 * - Phage isolate names: Arlo, Fizzles, Finny, Loca, Godfather, Ryadel,
 *   Zeuska, Tripl3t, IndyLu, MrAaronian, Joy99, Didgeridoo, Quaker, Squash.
 *   Those are strain names, which stay upright.
 * - "Rhesus macaques", a common name rather than a binomial, and "Rho family",
 *   which is a protein family.
 * - "Siphoviridae", which appears 3 times. It is a formal ICTV family-rank
 *   taxon rather than an agent name, so it arguably belongs here, but that is
 *   a judgement call left open rather than made silently.
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
