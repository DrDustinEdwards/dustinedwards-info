import { useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

/**
 * A nonced module script tag for one prebuilt enhancement bundle. `type="module"`
 * gives deferred execution, so the markup a bundle upgrades exists before the
 * bundle runs, and the browser de-duplicates by URL.
 *
 * The nonce is OPTIONAL because on the error-boundary path the root loader never
 * ran and there is nothing honest to stamp. `script-src` is the nonce plus
 * `strict-dynamic` and carries no `'self'`, so the browser then refuses the
 * fetch. An error page costs its enhancements and nothing else, and the markup
 * they would have upgraded still works, which is rule 9's fallback doing its job.
 */
export function EnhancementScript({ src }: { src: string }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  return <script type="module" nonce={data?.nonce} src={src} />;
}
