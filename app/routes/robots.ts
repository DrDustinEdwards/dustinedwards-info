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
   * `/preview` is HYGIENE, and saying so here matters more than the line does.
   *
   * robots.txt is advisory: it asks well-behaved crawlers not to fetch, and
   * anything that ignores it fetches anyway. The CONTROL on draft previews is
   * `X-Robots-Tag: noindex, nofollow` plus `Cache-Control: private, no-store` on
   * the route itself, which are instructions to whatever actually arrives. This
   * line exists so a compliant crawler that somehow learns a token URL does not
   * spend a request on it, and for no stronger reason than that.
   *
   * `/search/ask` is disallowed for a DIFFERENT reason, and the difference is
   * worth keeping straight. It is not private, it is EXPENSIVE: every answer
   * spends a per-IP allowance and one of a capped number of daily generations.
   * The control is that the endpoint takes POST and refuses GET with a 405, so
   * nothing that merely follows a URL can spend anything. This line is the
   * courtesy on top, and on its own it would be worth very little.
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
