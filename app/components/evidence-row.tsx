/**
 * One ruled mono line of machine data, in the same slot and the same type on every page that
 * carries it. Home, the post page and the colophon each pass a different three facts.
 *
 * ITS SHEET IS IMPORTED BY EACH CONSUMING ROUTE, not by this file, which is the house pattern and
 * is what `check:design-sheets` reads: the sheet list is gated against the route imports, so a
 * component-level import would put a sheet on the page that the gate cannot see.
 *
 * EXACTLY THREE, OR NOTHING. A page with fewer computable facts omits the row rather than padding
 * it, which is why this takes nulls and counts them rather than asking the caller to decide. A
 * fact that has to be typed by hand does not belong in it: every value here is computed at build
 * or at render from something the site already publishes.
 */
export const EVIDENCE_FACTS = 3;

export function EvidenceRow({ facts }: { facts: Array<string | null | undefined> }) {
  const present = facts.filter((fact): fact is string => Boolean(fact));
  if (present.length < EVIDENCE_FACTS) return null;

  return (
    <p className="evidence">
      {present.slice(0, EVIDENCE_FACTS).map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  );
}
