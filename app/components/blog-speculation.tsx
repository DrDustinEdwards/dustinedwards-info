/**
 * Speculation Rules for blog navigation.
 *
 * A declarative JSON payload, not executable script: browsers that do not
 * support it ignore the element entirely, and nothing on the page depends on
 * it. Scoped to /blog links so the browser never speculates about the admin
 * plane or the retired PDF URLs.
 *
 * `moderate` eagerness prefetches on hover rather than eagerly on render, which
 * keeps this from becoming a crawler that costs the reader bandwidth.
 */
const RULES = JSON.stringify({
  prerender: [
    {
      where: {
        and: [
          { href_matches: "/blog/*" },
          { not: { href_matches: "/blog/*.md" } },
        ],
      },
      eagerness: "moderate",
    },
  ],
});

export function BlogSpeculation() {
  return (
    <script
      type="speculationrules"
      dangerouslySetInnerHTML={{ __html: RULES }}
    />
  );
}
