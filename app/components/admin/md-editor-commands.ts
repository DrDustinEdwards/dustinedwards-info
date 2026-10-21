// The site's own blocks for the markdown editor's slash menu and toolbar. The editing commands themselves
// are Capsomer's (capsomer/behaviour/markdown-editor).

// Alt is mandatory on :::chart and :::diagram and the build fails without it, so the cursor lands inside alt="".
export const SCAFFOLDS = {
  chart: {
    label: "Chart",
    hint: "Bar, line, dot or area from inline CSV",
    text: [
      ':::chart{type=bar x=name y=value title="" alt=""}',
      "```csv",
      "name,value",
      "first,1",
      "```",
      "An optional caption.",
      ":::",
    ].join("\n"),
    cursor: ':::chart{type=bar x=name y=value title="" alt="'.length,
  },
  diagram: {
    label: "Diagram",
    hint: "Mermaid, rendered by build:diagrams",
    text: [
      ':::diagram{title="" alt=""}',
      "```mermaid",
      "flowchart LR",
      "  A[Start] --> B[End]",
      "```",
      "An optional caption.",
      ":::",
    ].join("\n"),
    cursor: ':::diagram{title="" alt="'.length,
  },
  figure: {
    label: "Figure",
    hint: "An image with a caption",
    text: [':::figure{src="" alt=""}', "A caption.", ":::"].join("\n"),
    cursor: ':::figure{src="'.length,
  },
} as const;

/** The figure the editor inserts for a dropped or pasted image. The URL's quote, space, parentheses and angle brackets
 *  are percent-encoded, which keeps it the same address and cannot end the attribute; the alt's quotes become
 *  entities. Carrel writes the same markup (carrel app/lib/site-markdown.ts). */
export function figureMarkdown(url: string, alt: string): string {
  const src = url.replace(/["\s()<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  return `:::figure{src="${src}" alt="${alt.trim().replace(/"/g, "&quot;")}"}\n:::`;
}
