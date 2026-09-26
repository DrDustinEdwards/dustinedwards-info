import { useLocation } from "react-router";

import { buildSpeculationRules } from "~/lib/speculation.mjs";

// No nonce: the rules vary by page, so they have no build-time hash, and `script-src` admits them
// through 'inline-speculation-rules' instead (workers/csp.mjs). Without that keyword the block is
// refused silently. JSON-LD is not gated by `script-src` at all.
// Chrome will not prerender with CDP attached, so no gate can assert what activation did.
export function SiteSpeculation() {
  const { pathname } = useLocation();
  const rules = buildSpeculationRules({ pathname });

  return <script type="speculationrules" dangerouslySetInnerHTML={{ __html: rules }} />;
}
