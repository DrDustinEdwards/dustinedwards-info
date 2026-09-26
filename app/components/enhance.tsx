import { useRouteLoaderData } from "react-router";
import { ENHANCE_URLS } from "virtual:enhance";

import type { loader as rootLoader } from "~/root";

/*
 * The one way a public piece becomes interactive: <Enhance module="plate" /> where the markup it
 * enhances is rendered. The URLs come from the app build, which bundles each `app/enhance/*.ts`
 * in isolation and emits it as a self-contained asset (scripts/lib/enhance-bundle.mjs).
 * check:page-payload reads `<Enhance module="…"` in a route's source to know which bundles that
 * route serves.
 */
export { ENHANCE_URLS };

export type EnhanceModule = keyof typeof ENHANCE_URLS;

// The nonce is optional: on the error-boundary path the root loader never ran. script-src
// has no 'self', so the browser refuses the fetch and the page just loses its enhancements.
export function Enhance({ module }: { module: EnhanceModule }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  return <script type="module" nonce={data?.nonce} src={ENHANCE_URLS[module]} />;
}
