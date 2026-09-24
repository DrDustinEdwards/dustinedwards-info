import { useRouteLoaderData } from "react-router";

import askUrl from "~/enhance/dist/ask.js?url";
import blogUrl from "~/enhance/dist/blog.js?url";
import headerUrl from "~/enhance/dist/header.js?url";
import paletteUrl from "~/enhance/dist/palette.js?url";
import plateUrl from "~/enhance/dist/plate.js?url";
import podcastUrl from "~/enhance/dist/podcast.js?url";
import searchUrl from "~/enhance/dist/search.js?url";
import themeUrl from "~/enhance/dist/theme.js?url";
import type { loader as rootLoader } from "~/root";

/*
 * The one way a public piece becomes interactive: <Enhance module="plate" /> where the markup it
 * enhances is rendered. The bundles must be prebuilt, since `?url` serves a file verbatim and
 * pointed at the `.ts` source would serve raw TypeScript. check:page-payload reads
 * `<Enhance module="…"` in a route's source to know which bundles that route serves.
 */
export const ENHANCE_URLS = {
  ask: askUrl,
  blog: blogUrl,
  header: headerUrl,
  palette: paletteUrl,
  plate: plateUrl,
  podcast: podcastUrl,
  search: searchUrl,
  theme: themeUrl,
} as const;

export type EnhanceModule = keyof typeof ENHANCE_URLS;

// The nonce is optional: on the error-boundary path the root loader never ran. script-src
// has no 'self', so the browser refuses the fetch and the page just loses its enhancements.
export function Enhance({ module }: { module: EnhanceModule }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  return <script type="module" nonce={data?.nonce} src={ENHANCE_URLS[module]} />;
}
