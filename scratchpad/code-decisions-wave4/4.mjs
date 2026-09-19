// Chunk 4: app/routes/blog.$slug.tsx (0-36) and app/root.tsx (0-22). The public post and the
// document shell. 60 blocks.
//
// Same rule: every contract at 180 bytes or less, headers at ~370.
//
// These are the wave's two highest-stakes files and the protected class is at its densest:
// the visibility re-check on the related list (#4), the escaped-vs-injected distinction that
// is the whole of the mention rule (#16), hydration being opt-in by route (root #12), the
// colour-scheme meta arriving before any stylesheet (root #15), and the crossorigin preload
// (root #9). None of those is description; each forbids something.
//
// Where a block carried several prohibitions the LOAD-BEARING one stays, named so the loss is
// visible: blog #27 keeps absent-not-empty and the LCP eagerness, losing the srcset ladder
// reasoning; root #13 keeps the React-hoisting defect, losing the useMatches probe; root #9
// keeps crossorigin and normal-face-only, losing the measured byte counts.
export default {
  "app/routes/blog.$slug.tsx#0": [
    "CONTRACT",
    "header: why negotiation is middleware; the 2026-07-28 measurement goes to the history document",
    `Content negotiation runs as middleware rather than in the loader: a document
route's loader cannot return a raw Response, because React Router hands it to
the component as \`loaderData\`. Middleware is the layer allowed to
short-circuit.`,
  ],
  "app/routes/blog.$slug.tsx#1": ["CONTRACT", "already at size; carries the visibility statement"],
  "app/routes/blog.$slug.tsx#2": [
    "CONTRACT",
    "the never-stored prohibition",
    `NEVER STORED. This representation shares a cache key with the HTML document,
so a stored copy here is the second variant that collapses the Cookie dimension
for both.`,
  ],
  "app/routes/blog.$slug.tsx#3": [
    "CONTRACT",
    "the one-projection rule",
    `The projection lives in \`blogPostView\`, so the two routes that render a post
cannot drift in what they hand the component.`,
  ],
  "app/routes/blog.$slug.tsx#4": [
    "WHY",
    "the visibility re-check, which is the prohibition; the write-time history goes to the history document",
    `THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS. The list is stored on the
row, and a post can be unpublished after a list naming it was written, so
without this a stale title and URL keep rendering on a public page.`,
  ],
  "app/routes/blog.$slug.tsx#5": [
    "CONTRACT",
    "why the read is not in the shared projection",
    `READ HERE AND NOT IN \`blogPostView\`: \`/preview/:token\` shares that
projection, and a draft preview must not grow a mentions section. A 404 above
means this never runs.`,
  ],
  "app/routes/blog.$slug.tsx#6": [
    "CONTRACT",
    "the header shape and the one-origin rule",
    `TWO VALUES IN ONE \`Link\`, comma-joined, which is how RFC 8288 spells a header
carrying more than one relation. Both are built from \`SITE_ORIGIN\`, so they
cannot come to name different hosts.`,
  ],
  "app/routes/blog.$slug.tsx#7": [
    "CONTRACT",
    "why the tag is built in the loader",
    `THE CACHE TAG IS SET IN THE LOADER, and that is forced rather than chosen:
\`HeadersArgs\` carries no \`params\`, so the slug is not in scope down there.`,
  ],
  "app/routes/blog.$slug.tsx#8": [
    "CONTRACT",
    "the cache dimension and the two tags",
    `The theme is a dimension of the cache KEY rather than a \`Vary\`. \`Accept\`
STAYS, because this URL really does serve a markdown representation too.

TWO TAGS, and this is the only route with a per-document one.`,
  ],
  "app/routes/blog.$slug.tsx#9": ["CONTRACT", "already at size; carries the forwarding rule"],
  "app/routes/blog.$slug.tsx#10": [
    "CONTRACT",
    "the one-owner rule; the editor-preview history goes to the history document",
    `Built by \`postSocial\` and not here: a preview whose job is to show what this
route emits must not compute it a second way, because the day the two disagree
the preview lies.`,
  ],
  "app/routes/blog.$slug.tsx#11": [
    "CONTRACT",
    "the card contract",
    `A card type and its image travel together or neither is worth setting. The
value is \`postSocial\`'s, so this is not a second opinion about which image a
post has.`,
  ],
  "app/routes/blog.$slug.tsx#12": [
    "CONTRACT",
    "why they are spread rather than written out",
    `Spread from \`articleOpenGraph\` rather than written out, so the four values
cannot come apart from \`articleJsonLd\`'s. \`article:tag\` repeats once per tag,
which is why this is a list.`,
  ],
  "app/routes/blog.$slug.tsx#13": ["CONTRACT", "already at size"],
  "app/routes/blog.$slug.tsx#14": [
    "CONTRACT",
    "why both are emitted",
    `A sender looks in two places and stops at the first, so both are emitted: one
that found only one would have to decide which this site meant.
\`WEBMENTION_URL\` is the constant the header is built from.`,
  ],
  "app/routes/blog.$slug.tsx#15": [
    "NUMBER",
    "header: why one day",
    `The threshold is one day: a post synced the same day it was published has not
been revised, it has just been deployed. Without it every post would carry an
"Updated" line from the moment it shipped.`,
  ],
  "app/routes/blog.$slug.tsx#16": [
    "WHY",
    "header: the escaped-vs-injected rule, which is the whole of it",
    `THE ONE PLACE ON THIS PAGE WHERE THE TEXT IS NOT OURS.

Every string in a mention was read out of a page this site does not control, so
it is RENDERED AS TEXT: React children, escaped by React, no
\`dangerouslySetInnerHTML\`, no image, and no source-supplied attribute except
one \`href\` that \`safeHttpHref\` has re-parsed.

First-party markup is injected because we wrote it; third-party text is escaped
because we did not. Reading this as "the body is injected, so this could be too"
is the moment the rule is gone.

@param mention one approved row, as \`approvedMentionsFor\` selected it`,
  ],
  "app/routes/blog.$slug.tsx#17": [
    "CONTRACT",
    "the ordering and the still-renders rule",
    `The author's own URL first, the source page second, neither if neither parses.
A row whose URLs BOTH fail still renders as plain text: dropping it would hide
something the admin approved while the queue still showed it as published.`,
  ],
  "app/routes/blog.$slug.tsx#18": [
    "WHY",
    "hard rule 13's distinction, on a public page",
    `THE NAME FALLS BACK TO THE SOURCE URL, not to a word like "Someone": it
substitutes a FACT rather than a placeholder, which is hard rule 13's
distinction, in a spot where an invented value would be attributed to a real
person.`,
  ],
  "app/routes/blog.$slug.tsx#19": [
    "CONTRACT",
    "what each token is for",
    `\`ugc\` is what this link IS, \`nofollow\` is what it must not pass on, and the
other two are this site's default on every outbound anchor.`,
  ],
  "app/routes/blog.$slug.tsx#20": [
    "CONTRACT",
    "why it is called here rather than threaded",
    `ONE \`postSocial\` call, here rather than threaded through the loader, which
would be a third place the same rule could be stated. Pure, so calling it twice
cannot disagree with itself.`,
  ],
  "app/routes/blog.$slug.tsx#21": [
    "CONTRACT",
    "derived rather than queried",
    `Derived from the list already on the page rather than queried: a second read
would be a second answer to what "the next part" means, and it would have to
agree with the list rendered beneath it.`,
  ],
  "app/routes/blog.$slug.tsx#22": [
    "CONTRACT",
    "why classes and not a second representation; the ruling citation stays on one line",
    `Every microformats2 class here is a CLASS on markup that was already present.
Annotating the first copy cannot go out of step with itself, where a third copy
of the same facts would be a third thing to keep true. Ruling 50 as amended.`,
  ],
  "app/routes/blog.$slug.tsx#23": [
    "CONTRACT",
    "the same-string rule",
    `The SAME STRING the meta tag carries. \`postSocial\` falls back to the site
description where a post has none, so the raw column would put a different
sentence on the page than in the head.`,
  ],
  "app/routes/blog.$slug.tsx#24": [
    "CONTRACT",
    "keeps the conditional prohibition; the element's history goes to the history document",
    `STILL CONDITIONAL, deliberately: a post nobody has revised has no updated date,
and emitting the row's \`updatedAt\` regardless would publish a sync timestamp as
if it were an edit.`,
  ],
  "app/routes/blog.$slug.tsx#25": [
    "CONTRACT",
    "keeps hidden-not-sr-only, which is the accessibility half; the byline argument goes to the history document",
    `\`hidden\` and not \`.sr-only\`: \`.sr-only\` is still announced, and a screen
reader gaining a name and a link on every post IS a change to the page. Every
mf2 parser reads the markup rather than the computed style.`,
  ],
  "app/routes/blog.$slug.tsx#26": ["CONTRACT", "already at size; carries the one-owner rule"],
  "app/routes/blog.$slug.tsx#27": [
    "CONTRACT",
    "keeps absent-not-empty and the LCP eagerness; the srcset ladder and the dimensions history go to the history document",
    `ABSENT, NOT EMPTY, when there is no cover: an empty figure is a landmark a
screen reader announces and a box the layout reserves, for nothing.

EAGER AND HIGH PRIORITY, against the usual advice: this is the LCP element when
present, so lazy-loading it would defer the paint the metric measures.`,
  ],
  "app/routes/blog.$slug.tsx#28": [
    "CONTRACT",
    "why both controls exist; the roadmap quotation goes to the history document",
    `THE LIST AND THE PAIR DO DIFFERENT JOBS: the ordered list is the table of
contents, the previous and next targets are the page turn and carry the LABEL so
direction can be read without counting.`,
  ],
  "app/routes/blog.$slug.tsx#29": ["CONTRACT", "already at size; carries the first-party grounds"],
  "app/routes/blog.$slug.tsx#30": [
    "CONTRACT",
    "the no-script property of all three",
    `Every one is a plain link, so all three work with scripting off. The
enhancement script upgrades the first to a clipboard copy.`,
  ],
  "app/routes/blog.$slug.tsx#31": [
    "CONTRACT",
    "keeps the no-script permalink argument; the Bluesky removal goes to the history document",
    `THE PERMALINK IS THE COPY-LINK, and it needs no script at all. A clipboard
button does nothing for a reader without JavaScript and looks identical to one
that works; an anchor is visible, focusable, right-clickable and long-pressable.
NO enhancement is registered for it.`,
  ],
  "app/routes/blog.$slug.tsx#32": [
    "CONTRACT",
    "why the class landed on this anchor; the ruling 50 account goes to the history document",
    `The permalink is also the h-entry's \`u-url\`: this anchor already holds the
canonical absolute URL, it is visible, and it is the one a reader copies. One
element for a consumer and a human.`,
  ],
  "app/routes/blog.$slug.tsx#33": [
    "CONTRACT",
    "absent not empty, and the pointer to the mention rule",
    `ABSENT, NOT EMPTY: an empty section is a landmark a screen reader announces and
a heading a reader scrolls to, for nothing. The escaping grounds are on the
\`Mention\` component.`,
  ],
  "app/routes/blog.$slug.tsx#34": [
    "CONTRACT",
    "the one-owner rule for the stack facts",
    `ONE LINE, in the template. The colophon carries the facts; a post carries a
pointer to them, because twelve post footers restating them is eleven that go
stale.`,
  ],
  "app/routes/blog.$slug.tsx#35": [
    "CONTRACT",
    "why it degrades rather than renders empty",
    `Rendered only when the row HAS one: rows written before the field existed carry
no description, so this degrades to the title rather than to an empty paragraph.
The ranking above is untouched.`,
  ],
  "app/routes/blog.$slug.tsx#36": [
    "CONTRACT",
    "the target size and the machine-readable half; the old inline shape goes to the history document",
    `Each is a bordered block carrying the label above the title, which gives it a
real touch target and lets direction be read before the title. \`rel="prev"\` and
\`rel="next"\` are the machine-readable half and are kept.`,
  ],
  "app/root.tsx#0": [
    "CONTRACT",
    "header: the ordering prohibition; the Tailwind-hoisting story goes to the history document",
    `THE COMPONENT SHEETS, IN CASCADE ORDER. They were nine \`@import\` statements
in app.css, and CSS requires \`@import\` before every other rule and drops a late
one, so here they are ordinary module imports.

THE ORDER IS LOAD-BEARING and is the order they were cut out of the original
app.css. Do not sort this list.`,
  ],
  "app/root.tsx#1": [
    "CONTRACT",
    "why the position is kept; the header suspension goes to the history document",
    `LAST, and it no longer contains a header. The position is kept because the
order of this list is load-bearing and shell.css still needs to win where it and
page-shell.css touch the same thing.`,
  ],
  "app/root.tsx#2": [
    "CONTRACT",
    "the one-owner rule for the hashed name",
    `Imported rather than written out: the filename carries a content hash, and a
hand-written path would be a second statement of it that goes stale the day the
font is replaced. Rule 17.`,
  ],
  "app/root.tsx#3": [
    "CONTRACT",
    "what `?url` buys; the katex build grounds go to the history document",
    `\`?url\` IS WHAT MAKES IT CONDITIONAL. A bare import would fold these bytes into
root's own stylesheet, which every page links; \`?url\` emits a standalone
content-hashed asset a document can decide at render time to ask for.`,
  ],
  "app/root.tsx#4": [
    "CONTRACT",
    "header: the whole flash fix",
    `Reads the theme cookie so the attribute is server-rendered. This is the entire
flash-of-wrong-theme fix: there is no inline script and nothing to correct after
paint. Cookie parsing only, no binding and no I/O.`,
  ],
  "app/root.tsx#5": [
    "CONTRACT",
    "header: the opt-in property and the middleware requirement",
    `THE TIMING COLLECTOR, created ONCE per request, for every route on the site.

\`?timing=1\` opts in and nothing else does, so an uninstrumented response is
byte-identical to what shipped before this existed.

MIDDLEWARE, NOT THE LOADER, and that is load-bearing: a loader runs alongside
its siblings, so a collector created in one is not visible to another.`,
  ],
  "app/root.tsx#6": [
    "CONTRACT",
    "why the nonce travels this way",
    `The nonce is generated in \`workers/app.ts\` BEFORE the render, because the same
value has to appear in the CSP header and on every script. Carried through the
loader because \`Layout\` cannot reach the request context.`,
  ],
  "app/root.tsx#7": [
    "CONTRACT",
    "the merge asymmetry, which is why these live here",
    `\`links\` from every matched route are merged and \`meta\` is NOT, which is why
these ride on every page and why the default social card is a constant each
public route names for itself.`,
  ],
  "app/root.tsx#8": [
    "CONTRACT",
    "why the type stays; the every-page history goes to the history document",
    `The \`type\` on the JSON one stays \`application/feed+json\` even though the
response travels as \`application/json\`: a reader scans autodiscovery links for
the FEED types, so this is what the resource is.`,
  ],
  "app/root.tsx#9": [
    "CONTRACT",
    "keeps crossorigin and normal-face-only; the measured bytes and timings go to the history document",
    `THE NORMAL FACE ONLY. The italic's \`unicode-range\` already makes the browser
fetch it on demand, and a preload not used within a few seconds is worse than
none.

\`crossorigin\` IS MANDATORY AND IS NOT ABOUT CORS HERE: fonts are fetched in
anonymous CORS mode whatever their origin, so a preload without it is a
DIFFERENT request and the file is fetched twice.`,
  ],
  "app/root.tsx#10": [
    "CONTRACT",
    "the error-boundary path",
    `Layout also renders the error boundary, where the root loader may not have run,
so this reads the optional route data. No data means no attribute, which is the
system path and always safe.`,
  ],
  "app/root.tsx#11": [
    "CONTRACT",
    "keeps the no-fallback prohibition; the discharged note goes to the history document",
    `\`undefined\` is the honest value and is deliberately not given a fallback: a
made-up nonce would satisfy the markup while matching nothing in the header.`,
  ],
  "app/root.tsx#12": [
    "CONTRACT",
    "the opt-in law and the gate that pins it",
    `HYDRATION IS OPT-IN BY ROUTE. A route that needs React in the browser exports
\`handle = { hydrate: true }\`; no public reading route does, so a public page
ships NO framework script and its only script tags are the nonced enhancement
bundles.

\`check:page-payload\` pins the opt-in set and that \`<Scripts>\` renders only
behind this guard.`,
  ],
  "app/root.tsx#13": [
    "CONTRACT",
    "keeps the React-hoisting defect and the mirror gate; the useMatches probe goes to the history document",
    `LINKED ONLY BY A PAGE THAT HAS MATH. A CSS import would put the math bytes and
a twenty-face font set on every post to serve the one that needs them, which is
hard rule 4's question answered the wrong way.

NOT React's stylesheet hoisting, which was tried: a \`precedence\`-managed sheet
is lifted to the TOP of \`<head>\`, above the colour-scheme meta, and that signal
is load-bearing exactly because it arrives BEFORE the first stylesheet request.

THE ID LIST IS A MIRROR, and \`check:page-payload\` reconciles it in both
directions.`,
  ],
  "app/root.tsx#14": [
    "CONTRACT",
    "why unconditional, and the stated cost",
    `Unconditional, because the condition would be wrong: the flag is a property of
what has been SAVED and an author is typing something that has not been. A real
cost taken on purpose, in the plane rule 4 exempts.`,
  ],
  "app/root.tsx#15": [
    "CONTRACT",
    "keeps the ordering contract and what the gate asserts; the frame measurement goes to the history document",
    `COLOUR SCHEME, BEFORE ANY STYLESHEET, and the position is the point. This is
the only thing telling the BROWSER, as opposed to the stylesheet, which palette
the page is: \`data-theme\` means nothing until the CSS reading it has been
parsed.

\`check:browser\` asserts that relation and deliberately does not assert an
index, which would be pinning React's internals.`,
  ],
  "app/root.tsx#16": [
    "CONTRACT",
    "the merge reason and the second-copy gate",
    `Here rather than in a \`meta\` export because \`meta\` is NOT merged across
matched routes. The two values are written out rather than read from a var(),
because browser chrome does not resolve a custom property, so \`check:contrast\`
asserts they still match the palette.`,
  ],
  "app/root.tsx#17": [
    "CONTRACT",
    "why it is not removable; the measured bytes go to the history document",
    `\`<Links>\` takes a nonce from the framework context and has no opt-out. That
context exists to nonce react-router's two STREAMING scripts, including on the
error-boundary path, so the attribute here is a side effect of a mechanism that
is load-bearing elsewhere.`,
  ],
  "app/root.tsx#18": [
    "CONTRACT",
    "the cascade position and the precedence prohibition",
    `AFTER \`<Links />\`, so the math rules land last and a site rule wins over the
upstream katex rule it overrides. No \`precedence\`: that attribute makes React
lift the element above the colour-scheme meta.`,
  ],
  "app/root.tsx#19": ["CONTRACT", "already one line; carries the skip-link reason"],
  "app/root.tsx#20": ["CONTRACT", "already at size; carries the not-nonced statement"],
  "app/root.tsx#21": [
    "WHY",
    "why the strings are deliberate; the four originals go to the history document",
    `All four strings are deliberate rather than scaffold. Nothing renders them on a
healthy site, so the only reader who sees them is one whose page has just
failed, which is the worst moment to sound like a starter kit.`,
  ],
  "app/root.tsx#22": [
    "CONTRACT",
    "keeps the a-404-is-still-the-site rule and why the header is safe; the Tailwind classes go to the history document",
    `A 404 IS STILL THE SITE. This page had no header, no footer and no \`id="main"\`,
so the most likely page a stranger reaches by a broken link had no navigation off
it and a skip link pointing at nothing.

SiteHeader is SAFE HERE and that is not an assumption: it reads the root loader
NOT AT ALL, so there is no loader value for the error-boundary path to be
missing.`,
  ],
};
