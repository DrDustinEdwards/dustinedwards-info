import { useLocation, useRouteLoaderData } from "react-router";

import { buildSpeculationRules } from "~/lib/speculation.mjs";

import type { loader as rootLoader } from "~/root";

// The nonce is required: `script-src` gates `type="speculationrules"` but not JSON-LD, and an
// un-nonced block is refused silently. Do not "consistently" add or remove nonces on either.
// Chrome will not prerender with CDP attached, so no gate can assert what activation did.
export function SiteSpeculation() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();
  const rules = buildSpeculationRules({ pathname });

  return (
    <script
      type="speculationrules"
      nonce={data?.nonce}
      dangerouslySetInnerHTML={{ __html: rules }}
    />
  );
}
