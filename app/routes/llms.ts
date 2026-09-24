import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
import llmsTxt from "../../content/llms.txt?raw";
import type { Route } from "./+types/llms";

/**
 * The content file itself, inlined by Vite, so the fallback cannot drift from what the sync writes.
 * .gitattributes pins it to LF, so the inlined copy and the row are byte-identical on every platform.
 */
const FALLBACK = llmsTxt;

export async function loader({ context }: Route.LoaderArgs) {
  const value = await getSetting(getEnv(context), "llms.txt");

  return new Response(value ?? FALLBACK, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=3600",
    },
  });
}
