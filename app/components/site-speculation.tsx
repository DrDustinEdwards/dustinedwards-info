import { useLocation } from "react-router";

import { buildSpeculationRules } from "~/lib/speculation.mjs";

// No nonce: `script-src` admits the block by the hash of these exact rules, which the Worker
// computes per response from the request's pathname with the same builder (workers/csp.mjs). So
// the pathname here must stay `useLocation().pathname`, and the text must stay raw. A refused block
// fails silently. JSON-LD is not gated by `script-src` at all.
// Chrome will not prerender with CDP attached, so no gate can assert what activation did.
export function SiteSpeculation() {
  const { pathname } = useLocation();
  const rules = buildSpeculationRules({ pathname });

  return <script type="speculationrules" dangerouslySetInnerHTML={{ __html: rules }} />;
}
