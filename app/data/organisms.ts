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

/**
 * Every listed name as one global pattern, whole words only. ORGANISMS is ordered longest first and
 * alternation takes the first branch that matches, so the trinomial wins over the binomial. Global,
 * so read it with `matchAll` or `replace`, which do not leave `lastIndex` behind.
 */
export const ORGANISM_PATTERN = new RegExp(
  `\\b(${ORGANISMS.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "g",
);
