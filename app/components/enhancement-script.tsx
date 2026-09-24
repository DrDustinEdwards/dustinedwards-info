import { useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

// The nonce is optional: on the error-boundary path the root loader never ran. script-src
// has no 'self', so the browser refuses the fetch and the page just loses its enhancements.
export function EnhancementScript({ src }: { src: string }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  return <script type="module" nonce={data?.nonce} src={src} />;
}
