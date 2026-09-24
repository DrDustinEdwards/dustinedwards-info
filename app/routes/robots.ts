import { SITE_ORIGIN } from "~/lib/seo";

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
