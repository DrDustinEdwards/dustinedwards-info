// Chunk 12: the tail. Twenty files, most carrying one block, and the export routes are almost
// entirely CONTRACT already: a feed route's header is a query, a builder pointer and a ruling it
// inherits rather than re-argues.
//
// client-ip#0 is the one block in the wave that a gate reads. `check:invariants` section 15b
// counts the literal `JUSTIFIED SUBSTITUTION` marker at its call site, so that sentence survives
// whatever else goes.
export default {
  "app/lib/auth-rate.server.ts#0": ["CONTRACT", "the binding call and nothing else, and where the rules live; at the budget"],
  "app/lib/auth-rate.server.ts#1": [
    "WHY",
    "fails closed, what that costs, and the separate key prefix; the three past catches go to history",
    `True when this request may proceed to Better Auth.

**FAILS CLOSED when the limiter binding is absent**, as \`checkAskRate\` and \`authenticateOperator\`
do. Removing the Durable Object therefore DISABLES sign-in rather than un-protecting it, and that
is the right cost: an admin who cannot sign in notices immediately, where a guard that silently
passed would not be noticed at all.

**ONE INSTANCE PER IP, under \`auth:\` rather than the \`ip:\` that Ask uses.** Sharing the prefix
would let a burst of questions from a reader's network consume the sign-in allowance for that
address, a coupling nobody would predict from either file.`,
  ],

  "app/routes/blog.rss[.xml].ts#0": [
    "CONTRACT",
    "one feed policy, the shared visibility read, the cap in the query, and who owns the escaping",
    `RSS 2.0, carrying the whole post.

ONE FEED POLICY: both feeds read the same query with the same visibility predicate and the same
cap, and only the REPRESENTATION differs, markdown for the JSON consumer and rendered HTML for the
reader. Reads through listBlogPostsRendered, so publiclyVisible() applies on the same terms as the
index, and the cap is applied IN THE QUERY rather than by slicing a full read.

The item markup is built by \`rssItem\`, where \`node:test\` can reach it, and that module is the one
owner of the XML escaping, so the two feeds' escaping can be compared.`,
  ],
  "app/routes/blog.rss[.xml].ts#1": ["CONTRACT", "the shared builder, and what a second feed would have copied; already short"],

  "app/lib/client-ip.ts#0": [
    "CONTRACT",
    "one statement of the identity, why the header is trustworthy, and the JUSTIFIED SUBSTITUTION marker a gate counts",
    `The client IP every rate limiter keys on, stated once. Several spellings of a rate-limit identity
is rule 17's shape where drift is least affordable: an edit to one copy silently changes WHO one
door counts while the others keep counting someone else.

\`cf-connecting-ip\` is set by the Cloudflare edge and cannot be spoofed by the client. It is
absent only off the edge.

JUSTIFIED SUBSTITUTION (hard rule 13): the fallback substitutes a value, and it fails CLOSED. A
missing header collapses all such traffic into one rate bucket that exhausts quickly, rather than
minting each caller a fresh identity.`,
  ],

  "app/routes/llms-full[.txt].ts#0": [
    "CONTRACT",
    "why it is composed at request time: the document depends on the clock",
    `The full-text companion to llms.txt: every published post's markdown in one document, so a model
can read the whole blog in a single fetch.

COMPOSED FROM D1 AT REQUEST TIME rather than emitted as an artifact, because THIS DOCUMENT DEPENDS
ON THE CLOCK: a post scheduled with a future publish_at must be absent today and present next week.
A generated document would either carry a timestamp, whose byte gate fails the moment a scheduled
post goes live, or ignore publish_at and leak unpublished writing. Composing here removes the
drift rather than gating it: there is no second copy that can disagree. The markdown itself is
still gated, because it comes from the same \`posts.body\` the generator wrote.`,
  ],
  "app/routes/llms-full[.txt].ts#1": ["CONTRACT", "served for models, kept out of the index; two lines already"],

  "app/routes/robots.ts#0": ["CONTRACT", "what the list is; one line already"],
  "app/routes/robots.ts#1": [
    "CONTRACT",
    "robots.txt is advisory and neither line is the control; both boundary statements stay",
    `robots.txt is ADVISORY: anything that ignores it fetches anyway, so neither line below is a
control.

\`/preview\` IS HYGIENE. THE CONTROL on draft previews is \`X-Robots-Tag: noindex, nofollow\` plus
\`Cache-Control: private, no-store\` on the route itself.

\`/search/ask\` is disallowed for a DIFFERENT reason: not private but EXPENSIVE, since every answer
spends a per-IP allowance and one of a capped number of daily generations. THE CONTROL is that the
endpoint takes POST and refuses GET with a 405, so nothing that merely follows a URL can spend
anything.`,
  ],

  "app/routes/llms.ts#0": ["CONTRACT", "the source of truth and where the note is; one line already"],
  "app/routes/llms.ts#1": [
    "CONTRACT",
    "the fallback is the content file, and .gitattributes is what keeps it byte-identical; the CRLF drift goes to history",
    `What to serve when the \`llms.txt\` settings row is absent.

THE CONTENT FILE ITSELF, inlined by Vite at build time, so the fallback cannot drift from what the
sync writes. A hand-maintained copy under a "change both" comment had already drifted invisibly,
by its line endings alone, so the site served different bytes depending on whether the row existed.

\`content/llms.txt\` is pinned to LF in .gitattributes, which keeps the inlined copy and the row
byte-identical on every platform.`,
  ],
  "app/routes/llms.ts#2": ["CONTRACT", "served for models, kept out of the index; one line already"],

  "app/lib/content/wasm.server.ts#0": ["CONTRACT", "what resolves the import and what the plugin emits; three lines already"],
  "app/lib/content/wasm.server.ts#1": [
    "CONTRACT",
    "why the Node default cannot be used in a Worker, and why the type is loose",
    `Teaches the shared pipeline how to load oniguruma inside a Worker. Import for its side effect,
before anything renders.

Workers refuse \`WebAssembly.instantiate()\` on raw bytes, which is what \`import("shiki/wasm")\` ends
up doing, so the Node default cannot be used here. A module imported STATICALLY is already
compiled, and instantiating one of those is allowed.

Typed loosely on purpose: the Worker tsconfig does not carry DOM's WebAssembly value
declarations.`,
  ],

  "app/routes/blog.$slug[.md].ts#0": ["CONTRACT", "the same visibility gate as the HTML route; already short"],
  "app/routes/blog.$slug[.md].ts#1": [
    "CONTRACT",
    "one representation, so nothing for a Cookie dimension to collapse against; the date and the grounds pointer stay",
    `PUBLICLY CACHED. This URL has exactly one representation, so there is nothing for a Cookie
dimension to collapse against; the negotiated representation under \`/blog/:slug\` genuinely must
not be stored, and the grounds are on \`markdownResponse\`.`,
  ],

  "app/routes/publications[.bib].ts#0": [
    "CONTRACT",
    "the showcase filter applies here and not per paper, and why there is no attachment disposition",
    `The whole list as BibTeX.

THE SHOWCASE FILTER APPLIES. The excluded records are conference abstracts whose papers are also in
the corpus, and a bibliography carrying both double-counts the same work in a reference manager,
which is harder to notice than a missing entry. The PER-PAPER exports are NOT filtered, because
asking for one record's BibTeX is asking for that record.

A RESOURCE ROUTE, NOT A DOWNLOAD. No \`Content-Disposition: attachment\`: people look at a citation
file as often as they save it, and reference managers key on the content type.`,
  ],

  "app/routes/api.auth.$.ts#0": [
    "CONTRACT",
    "what the limit actually caps, and why both exports are guarded; the audit date goes to history",
    `Catch-all for Better Auth. Every \`/api/auth/*\` request is handed to the auth handler, AFTER the
rate limit.

WHAT IT CAPS IS THE OUTBOUND CALL: every hit on the Google callback makes this Worker exchange a
token against Google before \`signIn.before\` can reject a non-admin address, so an unbounded
endpoint is an amplifier pointed at a third party using our OAuth client.

BOTH EXPORTS ARE GUARDED, and that is not belt-and-braces: Better Auth routes by method as well as
path, so the callback arrives as a GET and reaches \`loader\` while the sign-in and sign-out POSTs
reach \`action\`. Guarding one would leave the other open, and the callback is the expensive half.`,
  ],

  "app/routes/blog.series.$series.rss[.xml].ts#0": [
    "CONTRACT",
    "the three rules that make a series feed differ: order, no cap, and 404 agreement",
    `One series' RSS feed, through \`rssDocument\`, which owns the channel, the namespaces and the item
markup.

ORDERED BY PART, not by date, which is the one way this differs from every other feed here and is
the whole point of a series: a subscriber should receive part one first.

NO CAP. A series is a finite thing an author numbered, and truncating it would drop the later
parts, which are the ones a reader following along has not read.

404 ON AN UNKNOWN SERIES, through \`getBlogSeries\`: a feed and its page must agree about whether a
series exists.`,
  ],
  "app/routes/blog.tags.$tag.rss[.xml].ts#0": [
    "CONTRACT",
    "the shared builder and the 404 agreement",
    `One tag's RSS feed. The SAME document builder as \`/blog/rss.xml\`, so this route is a query, a
title and a self URL. A copied wrapper would be a second place the content namespace or the
version string could be wrong, and a feed reader is the last surface where that gets noticed.

404 ON AN UNKNOWN TAG, through \`getBlogTag\`: a feed and its page must agree about whether a tag
exists, or a subscriber holds a working feed URL for an archive that answers 404.`,
  ],
  "app/routes/blog.atom[.xml].ts#0": [
    "CONTRACT",
    "RSS remains advertised, and the two dialects cannot carry different posts",
    `Atom 1.0 for the blog, from the SAME rendered rows RSS reads.

RSS REMAINS THE ADVERTISED FEED and nothing points here by default. Same
\`listBlogPostsRendered\`, same visibility predicate, same cap, so the two dialects cannot carry
different posts. The dialect differences live entirely in \`atom-feed.mjs\`.`,
  ],
  "app/routes/blog.tags.$tag.feed[.json].ts#0": ["CONTRACT", "the shared envelope and the inherited content-type ruling; at the budget"],
  "app/routes/blog.series.$series.feed[.json].ts#0": ["CONTRACT", "the shared envelope, the inherited order and the inherited ruling; at the budget"],
  "app/routes/publications.$slug[.bib].ts#0": ["CONTRACT", "unfiltered, and what filtering here would break; at the budget"],
  "app/routes/publications[.ris].ts#0": ["CONTRACT", "the registered media type and what text/plain would cost; already short"],
  "app/db/auth-schema.ts#0": ["CONTRACT", "why the column names match, and what lives in KV instead; already short"],
  "app/routes/publications.$slug[.ris].ts#0": ["CONTRACT", "unfiltered, pointing at the twin; one line already"],
  "app/lib/auth-client.ts#0": ["CONTRACT", "same-origin, and what baseURL defaults to; one line already"],
};
