import { useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

/**
 * A nonced module script tag for one prebuilt enhancement bundle.
 *
 * This is how every public enhancement loads since the public plane stopped
 * hydrating React (2026-08-26): the four modules in app/enhance/ are bundled
 * by build-enhance.mjs into self-contained files under app/enhance/dist/, a
 * `?url` import turns each bundle into a hashed asset URL, and this renders
 * the tag that fetches it. `type="module"` gives deferred execution, so the
 * markup a bundle upgrades exists before the bundle runs, and the browser
 * de-duplicates by URL, so two placements of one bundle execute once.
 *
 * The nonce is the same read Layout does, and it is OPTIONAL for the same
 * reason: on the error-boundary path the root loader never ran, there is
 * nothing honest to stamp, and under the enforcing CSP (script-src is nonce
 * plus strict-dynamic, no 'self') the browser then refuses the fetch. An
 * error page costs its enhancements and nothing else; the markup they would
 * have upgraded still works, which is rule 9's fallback doing its job.
 */
export function EnhancementScript({ src }: { src: string }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  return <script type="module" nonce={data?.nonce} src={src} />;
}
