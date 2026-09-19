import type { ReactNode } from "react";

import { ORGANISMS } from "~/data/organisms";

/**
 * Render-time italicization of organism names. Stored strings are never touched:
 * titles and abstracts stay byte-identical to what the registries returned, which
 * is what keeps the search haystack, the JSON-LD headline and the meta description
 * working off plain text.
 */

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ORGANISMS is ordered longest first, and regex alternation takes the first
// branch that matches at a position, so the trinomial wins over the binomial. Word
// boundaries stop a bare genus matching inside a longer word.
const ORGANISM_PATTERN = new RegExp(
  `\\b(${ORGANISMS.map(escapeRegExp).join("|")})\\b`,
  "g",
);

/**
 * Returns React nodes, never markup, so nothing here needs
 * `dangerouslySetInnerHTML` and the input is never parsed as HTML.
 */
export function italicizeOrganisms(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  // matchAll does not disturb ORGANISM_PATTERN.lastIndex.
  for (const match of text.matchAll(ORGANISM_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(<em key={`${start}-${match[0]}`}>{match[0]}</em>);
    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
