import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/llms";

const FALLBACK = `# dustinedwards.info

Personal site of Dr. Dustin Edwards, Professor of Virology at Tarleton State University.
`;

export async function loader({ context }: Route.LoaderArgs) {
  const value = await getSetting(getEnv(context), "llms.txt");

  return new Response(value ?? FALLBACK, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Served for language models, kept out of the search index.
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=3600",
    },
  });
}
