import type { ReactNode } from "react";

import { ORGANISM_PATTERN } from "~/data/organisms";

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
