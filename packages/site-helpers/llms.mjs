/**
 * @typedef {object} LlmsLink
 * @property {string} title
 * @property {string} url
 * @property {string} [description]
 */

/**
 * @typedef {object} LlmsSection
 * @property {string} heading
 * @property {LlmsLink[]} links
 */

/**
 * The llms.txt skeleton (llmstxt.org): title, a blockquote summary, optional intro paragraphs, then H2 sections of link lists.
 * A link's title is Markdown link text, so `[` and `]` are escaped; everything else is kept as written, because the titles are
 * prose and the sites' own files carry quotes and ampersands in them. A section with no links is dropped rather than left a
 * bare heading.
 *
 * @param {{ title: string, summary: string, intro?: string[], sections: LlmsSection[] }} doc
 * @returns {string}
 */
export function llmsDocument(doc) {
  const blocks = [`# ${doc.title}`, `> ${doc.summary}`, ...(doc.intro ?? [])];
  for (const section of doc.sections) {
    if (section.links.length === 0) continue;
    blocks.push(`## ${section.heading}\n${section.links.map(llmsLink).join("\n")}`);
  }
  return `${blocks.join("\n\n")}\n`;
}

/** @param {LlmsLink} link */
export function llmsLink(link) {
  const title = link.title.replace(/[[\]]/g, (bracket) => "\\" + bracket);
  return `- [${title}](${link.url})${link.description ? `: ${link.description}` : ""}`;
}
