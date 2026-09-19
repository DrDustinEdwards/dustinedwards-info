import { SITE_ORIGIN } from "~/lib/seo";

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

  /*
   * robots.txt is ADVISORY: anything that ignores it fetches anyway, so neither line below is a
   * control.
   *
   * `/preview` IS HYGIENE. THE CONTROL on draft previews is `X-Robots-Tag: noindex, nofollow` plus
   * `Cache-Control: private, no-store` on the route itself.
   *
   * `/search/ask` is disallowed for a DIFFERENT reason: not private but EXPENSIVE, since every answer
   * spends a per-IP allowance and one of a capped number of daily generations. THE CONTROL is that the
   * endpoint takes POST and refuses GET with a 405, so nothing that merely follows a URL can spend
   * anything.
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
