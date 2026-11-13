/**
 * The attributes every `.prose` wrapper carries: Capsomer's reading context (capsomer/prose-blocks.css), in the
 * manual's look. Each h2 is a numbered part of the page, tables have the heavy rule and mono capitals, and a
 * details is ruled with a plus and minus. The site's sizes are tokens on `.prose` (app/styles/prose.css).
 */
export const PROSE = {
  "data-context": "prose",
  "data-headings": "parts",
  "data-tables": "manual",
  "data-details": "ruled plus",
} as const;
