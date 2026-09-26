import { getEnv } from "~/lib/context";
import { SITE_ORIGIN } from "~/lib/seo";
import { isWorkerPreview } from "~/lib/worker-preview";
import type { Route } from "./+types/robots";

const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
];

export function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;

  // A Worker Preview is a PR's draft of the site: nothing on it is for crawling. The gateway's
  // X-Robots-Tag: noindex is the real control; this is the advisory half.
  if (isWorkerPreview(getEnv(context))) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  /*
   * Advisory only. The real controls: `X-Robots-Tag` and `no-store` on /preview, and POST-only on
   * /search/ask, which is disallowed because every answer is billed.
   */
  const block = (agent: string) =>
    `User-agent: ${agent}\nAllow: /\nDisallow: /admin\nDisallow: /preview\nDisallow: /search/ask\n`;

  const body = [
    ...AI_AGENTS.map(block),
    block("*"),
    `Sitemap: ${origin}/sitemap.xml`,
    `# LLM guide: ${origin}/llms.txt`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
