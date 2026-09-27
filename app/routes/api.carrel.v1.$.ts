import { handleCarrelRequest } from "~/lib/carrel/site-api.server";

import type { Route } from "./+types/api.carrel.v1.$";

/**
 * Carrel's site API (carrel/design.md section 4). Its key reaches only this prefix; the operator API
 * is untouched.
 *
 * A resource route inside the Renderer, as the operator API is, so a save's cache purge reaches the
 * cache the public pages live in: a purge is scoped to the entrypoint that calls it.
 */

export const loader = ({ request, context }: Route.LoaderArgs) => handleCarrelRequest(request, context);
export const action = ({ request, context }: Route.ActionArgs) => handleCarrelRequest(request, context);
