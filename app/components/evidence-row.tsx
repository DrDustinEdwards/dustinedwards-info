import type { ReactNode } from "react";

// Its sheet is imported by each consuming route, not here, so every sheet a page
// loads stays visible in the route's own imports.
const EVIDENCE_FACTS = 3;

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
