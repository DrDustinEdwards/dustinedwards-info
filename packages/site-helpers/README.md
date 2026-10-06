# @drdustinedwards/site-helpers

The helpers every Dustin Edwards site wrote for itself, once, in the form of the best of them: XML escaping and CDATA, RFC 822 dates,
RSS 2.0 / Atom 1.0 / JSON Feed 1.1 builders, the sitemap, the llms.txt skeleton, and the FTS5 query and rank-fusion code. Pure ES
modules, no dependencies, Web-standard only, so the same file runs in a Worker and in Node.

| Module | Exports |
| --- | --- |
| `xml` | `escapeXml`, `escapeXmlText`, `cdata`, `rfc822`, `isoDay`, `absolutiseUrls`, `mathToTex` |
| `feeds` | `rssDocument`, `rssItem`, `atomDocument`, `atomEntry`, `jsonFeedDocument`, `feedItem` (`itemPath` moves where a post lives) |
| `sitemap` | `sitemapDocument(entries, { layout, lastmodFormat, trailingNewline })` |
| `llms` | `llmsDocument`, `llmsLink` |
| `search` | `ftsLiteral`, `toMatchExpression`, `fuse`, `RRF_K` |

The package is held to each site's published output, byte for byte, by the fixtures in `test/fixtures/site-helpers/` of
dustinedwards-info (captured from germomics, foxhound and this site by `scripts/capture-site-helper-fixtures.mjs`, with the commits in
`PROVENANCE.json`). A change here is a change to what three sites publish, so it arrives with a re-captured fixture and a reviewed diff.

Two defects the tests exist to catch: an FTS5 term whose embedded quote is not doubled (the term escapes its quotes and the query
language reads the rest), and a fusion constant other than 60 (every ranking shifts, with no error).
