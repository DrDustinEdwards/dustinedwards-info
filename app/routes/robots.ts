import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/robots";

// AI crawlers we explicitly welcome for training and search.
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
];

export function loader() {
  const origin = SITE_ORIGIN;

  const block = (agent: string) =>
    `User-agent: ${agent}\nAllow: /\nDisallow: /admin\n`;

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
