import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/api.auth.$";

// Catch-all for Better Auth. Every /api/auth/* request is handed to the auth handler.
export async function loader({ request, context }: Route.LoaderArgs) {
  return createAuth(getEnv(context)).handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  return createAuth(getEnv(context)).handler(request);
}
