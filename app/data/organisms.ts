/**
 * Organism names to italicize in publication titles and abstracts. A reviewed allowlist, not a
 * pattern: a "Capitalized lowercase" match would italicize Rio Grande and ordinary sentence openings.
 * Longest first, because the matcher takes the first alternative that fits and would otherwise leave
 * a subspecies epithet upright. Virus agent names and phage isolate names are left out on purpose:
 * they are not formal taxa.
 */

export const ORGANISMS: readonly string[] = [
  "Meleagris gallopavo intermedia",
  "Meleagris gallopavo silvestris",
  "Tympanuchus cupido attwateri",
  "Arthrobacter globiformis",
  "Microbacterium foliorum",
  "Mycobacterium smegmatis",
  "Meleagris gallopavo",
  "Tympanuchus cupido",
  "Cairina moschata",
  "Gallus gallus",
  // Bare genus: only Mycobacterium occurs unbound in the corpus.
  "Mycobacterium",
];
