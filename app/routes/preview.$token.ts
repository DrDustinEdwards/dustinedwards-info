import { handleCarrelPreviewLink } from "~/lib/carrel/site-api.server";

import type { Route } from "./+types/preview.$token";

/**
 * A preview link Carrel made (site-api v0.17.0): no key, the token is the address. Inside the Renderer, as Carrel's
 * own route is, so the post renders through the blog route; the package's answer is private, no-store and noindex, so
 * nothing stores it.
 */
export const loader = ({ request, context }: Route.LoaderArgs) => handleCarrelPreviewLink(request, context);
