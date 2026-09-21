import type { ReactNode } from "react";

/**
 * One ruled mono line of machine data, in the same slot and the same type on every page that
 * carries it. Home, the post page and the colophon each pass a different set of facts.
 *
 * ITS SHEET IS IMPORTED BY EACH CONSUMING ROUTE, not by this file, which is the house pattern and
 * is what `check:design-sheets` reads: the sheet list is gated against the route imports, so a
 * component-level import would put a sheet on the page that the gate cannot see.
 *
 * THREE OR NOTHING, AND NO CEILING. The post page passes exactly three; home passes four, because
 * its affiliation is folded in as the first fact. A page with fewer than three computable facts
 * omits the row rather than padding it, which is why this counts them rather than asking the
 * caller to decide.
 *
 * FACTS ARE NODES, NOT STRINGS. Home's three figures each link where their proof tile linked, and
 * its affiliation carries `p-org` so the h-card still parses, so a caller has to be able to hand
 * over markup. The post page hands over plain strings and they render identically.
 *
 * THE DETAIL LINE SITS UNDER THE ROW, outside the rules, and only home uses it: a health ratio is
 * only true with its read time beside it, and this page is shared-cached.
 */
export const EVIDENCE_FACTS = 3;

export function EvidenceRow({
  facts,
  detail,
}: {
  facts: ReactNode[];
  detail?: ReactNode;
}) {
  const present = facts.filter((fact) => fact !== null && fact !== undefined && fact !== false);
  if (present.length < EVIDENCE_FACTS) return null;

  return (
    <>
      <p className="evidence">
        {/* Position is a fact's only stable identity here: it is a node, not a value. */}
        {present.map((fact, i) => (
          <span key={i}>{fact}</span>
        ))}
      </p>
      {detail ? <p className="evidence-detail">{detail}</p> : null}
    </>
  );
}
