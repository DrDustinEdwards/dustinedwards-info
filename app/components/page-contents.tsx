/** Below this, a contents list is furniture rather than a map. */
export const CONTENTS_MIN = 2;

export type ContentsEntry = { id: string; text: string };

/**
 * A page's parts as the manual's index (capsomer/manual.css .cap-leader-index): number and name, numbered as
 * prose.css numbers the h2s they point at. A page shows it from `CONTENTS_MIN` parts.
 */
export function PageContents({
  sections,
  label = "On this page",
  className,
}: {
  sections: ContentsEntry[];
  label?: string;
  className?: string;
}) {
  return (
    <nav className={className ? `page-contents ${className}` : "page-contents"} aria-labelledby="page-contents-label">
      <p className="page-contents-label" id="page-contents-label">
        {label}
      </p>
      <ol className="cap-leader-index">
        {sections.map((entry, i) => (
          <li key={entry.id}>
            <a className="cap-leader-index-link" href={`#${entry.id}`}>
              <span className="cap-leader-index-no">{i + 1}</span>
              <span className="cap-leader-index-name">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** The h2s of rendered page HTML, by their ids, with the heading's anchor link left out. */
export function contentsOf(html: string): ContentsEntry[] {
  const out: ContentsEntry[] = [];
  for (const [, id = "", inner = ""] of html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    const text = inner
      .replace(/<a class="heading-anchor"[\s\S]*?<\/a>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
      .trim();
    if (text) out.push({ id, text });
  }
  return out;
}
