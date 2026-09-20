// Chunk 8: projects.tsx (0-18), publications.$slug.tsx (0-16), search.tsx (0-23),
// preview-links.tsx (0-10), colophon.tsx (0-12), preview.$token.tsx (0-9). 94 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370.
//
// TWO HEADERS ARE OVER, named so the exceptions stay visible.
//
// preview.$token #0 is the most load-bearing comment in the wave: the route's PLACEMENT is the
// security control. A preview reader carries no cookie, which is exactly the request shape the
// cookieless downgrade does not fire for, so sharing a route with the public post would have
// stored an unpublished draft in a shared cache. That, the one-404 rule, and the real-path
// claim are three different prohibitions and none covers the others.
//
// search.tsx #3 is the other: a measured "do not optimise this back", where the failure is a
// reader with a theme cookie receiving the wrong document. The measurement goes to the history
// document; the prohibition and the mechanism stay.
export default {
  "app/routes/projects.tsx#0": [
    "CONTRACT",
    "header: the no-script property, the two provenances and the card licence; the slogan correction goes to the history document",
    `/projects, the portfolio index.

NO SCRIPT AT ALL, which is stronger than hard rule 9 asks for and is a property
of this route: no loader, no client state, no enhancement, so it is a pure
function from committed data to markup.

TWO PROVENANCES ARE POSSIBLE AND A METRIC DECLARES EXACTLY ONE: a DATED
observation, whose date is rendered because an undated number rots silently, or
a DERIVATION this build ran, which cannot rot and carries no date. A dated
number that is also derivable is a second copy, which is what hard rule 17
refuses.

CARDS ON THE CANVAS ARE LEGAL HERE: binding rule 7 reserves them for indexes,
and this is one.`,
  ],
  "app/routes/projects.tsx#1": [
    "CONTRACT",
    "header: why a union and not two optional fields",
    `A metric is DATED or DERIVED, never both. Modelled as a union rather than two
optional fields, so a card cannot be written with a value and a derivation and
quietly render one of them.`,
  ],
  "app/routes/projects.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/projects.tsx#3": [
    "CONTRACT",
    "header: why neither input is measured here",
    `Both are already in this Worker. Neither is a measurement taken here, which is
the whole property that makes a derived metric worth more than a dated one.`,
  ],
  "app/routes/projects.tsx#4": [
    "CONTRACT",
    "the one-owner rule and what it prevents",
    `The title, description, intro and anchors come from \`projects-page.mjs\`, the
module the INDEXER also reads, so a search result's title cannot drift from the
heading it lands on and a record cannot cite a fragment this page does not
render.`,
  ],
  "app/routes/projects.tsx#5": [
    "CONTRACT",
    "header: what omitting the export cost; the citation stays on one line",
    `Exporting no \`headers()\` falls through to hard rule 8's uncached default, so
every reader paid an origin hit for a page whose body is identical for all of
them. Using the shared helper rather than a fifth copy is what stops the Vary
line being dropped here later.`,
  ],
  "app/routes/projects.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/projects.tsx#7": [
    "CONTRACT",
    "header: why it is un-nonced",
    `UN-NONCED, deliberately: \`script-src\` does not gate \`application/ld+json\`,
because it is data rather than an executable script. A nonce here would imply a
protection that is not the one doing the work.`,
  ],
  "app/routes/projects.tsx#8": [
    "WHY",
    "the closed vocabulary; the six-of-seven story goes to the history document",
    `THE TYPE IS DECLARED PER ENTRY. A roster page is a page, and telling a machine
it is an application is a lie that costs nothing to avoid. The vocabulary is
closed and the gate holds it closed.`,
  ],
  "app/routes/projects.tsx#9": [
    "CONTRACT",
    "header: one transformation in one place, and the fail-closed rule",
    `THE THREE KINDS DIFFER ONLY IN HOW THE HREF IS BUILT. A post ref is a SLUG, not
a path, because the gate checks the slug against the built corpus.

FAILS CLOSED on an unknown kind: rendering the bare label would leave a citation
on the page pointing nowhere.`,
  ],
  "app/routes/projects.tsx#10": [
    "CONTRACT",
    "header: why it is its own component; the type-error account goes to the history document",
    `ITS OWN COMPONENT so the union narrows: written inline, TypeScript could not
discriminate the two shapes through a property of a property. SAME ELEMENT CLASS
EITHER WAY, because the two forms are one channel.`,
  ],
  "app/routes/projects.tsx#11": ["CONTRACT", "already at size"],
  "app/routes/projects.tsx#12": ["CONTRACT", "already at size"],
  "app/routes/projects.tsx#13": [
    "CONTRACT",
    "the silent failure this prevents",
    `The id IS the search record's anchor, from the one definition in
\`projects-page.mjs\`. A record citing a fragment the page does not render still
returns a hit and scrolls nowhere, silently.`,
  ],
  "app/routes/projects.tsx#14": ["CONTRACT", "already at size; carries the ordering argument"],
  "app/routes/projects.tsx#15": [
    "CONTRACT",
    "the two forms and why the derived one carries no date",
    `A dated metric gets a \`<time>\`. A DERIVED metric carries no date: the value
was computed by this build, so a date would only record when a human last
looked, which rots while the number beside it stays true.`,
  ],
  "app/routes/projects.tsx#16": [
    "CONTRACT",
    "why the field is optional",
    `Optional on purpose: several projects here are documented nowhere public, so a
card with no notable list is the honest shape rather than sentences
reconstructed from memory.`,
  ],
  "app/routes/projects.tsx#17": [
    "CONTRACT",
    "the binding rule and the empty-list rule",
    `Bare-text links, so binding rule 2 applies and they underline. A card with
neither link renders no list at all rather than an empty row.`,
  ],
  "app/routes/projects.tsx#18": [
    "CONTRACT",
    "why the heading exists and why it is an h3",
    `A heading rather than a bare list, because this is a claim about the card above
it and an unlabelled row of links reads as navigation. An h3 under the card's
h2, so the outline stays ordered.`,
  ],
  "app/routes/publications.$slug.tsx#0": [
    "CONTRACT",
    "header: the slash rule and the DOI slug; Scholar's expectation goes to the history document",
    `ONE PAGE PER PAPER, which is the whole reason this route exists: a browse page
listing many papers is explicitly not a unique URL for each.

THE URL ENDS IN A SLASH, AND IT IS NOT A STYLE CHOICE. \`citation_pdf_url\` must
refer to a file in the same subdirectory as the HTML abstract, and only the
trailing-slash spelling puts the PDF there.

THE SLUG IS THE DOI, NOT A CURATED ID: a name somebody chose can be chosen
again, and a publication URL that is re-decidable will be re-decided after
Scholar has indexed it.`,
  ],
  "app/routes/publications.$slug.tsx#1": ["CONTRACT", "already at size"],
  "app/routes/publications.$slug.tsx#2": [
    "CONTRACT",
    "why the 404 costs nothing",
    `404 out of the loader. There is no database read to save: the map above is the
corpus, so an unknown slug is known to be unknown before anything is fetched.`,
  ],
  "app/routes/publications.$slug.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/publications.$slug.tsx#4": [
    "CONTRACT",
    "why the list is committed and why both numbers travel; the credit cost goes to the history document",
    `From the committed artifact rather than from OpenAlex at request time, and it
carries the date it was read rather than pretending to be current.

\`total\` and the list length are BOTH carried, because one paper exceeds the cap
and the page has to be able to say so.`,
  ],
  "app/routes/publications.$slug.tsx#5": [
    "CONTRACT",
    "header: the no-exemption rule and the description; the refused first attempt goes to the history document",
    `\`pageMeta\` FOR THE SOCIAL HALF. Five pages once ended up with five different
partial social sets, each missing a different edge, and every one was a page
whose author thought it was special. The repair was to teach \`pageMeta\` the one
thing this page needed, not to take an exemption.

The citation tags stay here: they are not social metadata and they are built by
a module \`check:features\` calls.

THE DESCRIPTION IS THE ABSTRACT'S OPENING, cut at a word boundary. Hand-writing
36 of them would produce 36 worse ones.`,
  ],
  "app/routes/publications.$slug.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/publications.$slug.tsx#7": [
    "CONTRACT",
    "why no collapse here",
    `EVERY AUTHOR, VISIBLE. It is what \`citation_author\` asserts, and a page whose
visible content disagrees with its own meta tags is the thing Scholar
penalises.`,
  ],
  "app/routes/publications.$slug.tsx#8": ["CONTRACT", "already at size"],
  "app/routes/publications.$slug.tsx#9": ["CONTRACT", "already at size"],
  "app/routes/publications.$slug.tsx#10": [
    "CONTRACT",
    "the no-script property and why the query is the title; the gate reference stays",
    `ASK, AS A LINK. \`/search\` renders classic results from its loader and mounts
Ask as an enhancement, so a link with the query in \`q\` works with scripting and
without it. The query is the quoted title alone, because the classic index ANDs
its terms. \`check:publications\` asserts this route calls that function.`,
  ],
  "app/routes/publications.$slug.tsx#11": [
    "CONTRACT",
    "the provenance rule and the zero rule",
    `LABELLED with its source and the date it was read: a bare number is a claim
with no provenance and no age, and this one moves without a deploy. Rendered only
at 1 or more, so a cold cache shows nothing rather than a zero that looks
measured.`,
  ],
  "app/routes/publications.$slug.tsx#12": [
    "CONTRACT",
    "why the cap is stated and why the link is conditional",
    `Newest first and capped, and the cap is STATED when it bites: a list that
silently showed 50 of 52 would be claiming completeness it does not have. The
link is conditional because a few records have no DOI.`,
  ],
  "app/routes/publications.$slug.tsx#13": [
    "CONTRACT",
    "the placement rule and the role choice; the dark-path reasoning goes to the history document",
    `ABOVE EVERYTHING IT APPLIES TO, because a reader who stops after the first
paragraph must not stop before this one. \`role="status"\` rather than \`alert\`:
an alert interrupts a screen reader mid-sentence. The link goes to the NOTICE,
not the paper's landing page.`,
  ],
  "app/routes/publications.$slug.tsx#14": [
    "CONTRACT",
    "why it sits above the abstract",
    `ABOVE THE ABSTRACT, because it is for the reader who will not read the
abstract. Not styled as a quotation: it is the author speaking plainly about his
own work, and a decorative frame would make it look lifted from somewhere else.`,
  ],
  "app/routes/publications.$slug.tsx#15": [
    "CONTRACT",
    "why it is never inside a details",
    `VISIBLE, never inside a \`details\`: this page exists to BE the abstract, and a
crawler that has to open a disclosure to find the text is a crawler that does not
find it.`,
  ],
  "app/routes/publications.$slug.tsx#16": [
    "CONTRACT",
    "the placement reason and the refusal rule",
    `Under the abstract rather than in the link row: the link row is where a reader
goes to READ the paper, this is where they go to check it. \`accessionUrl\`
refuses a kind it has no registry for rather than guessing one, because a wrong
registry is a 404 that looks like a working link.`,
  ],
  "app/routes/search.tsx#0": [
    "CONTRACT",
    "header: why the facets are parameters too",
    `\`type\`, \`tag\` and \`year\` are separate parameters as well as query operators,
so a facet chip can be an ordinary link rather than a second filter language only
the form knows how to speak.`,
  ],
  "app/routes/search.tsx#1": [
    "CONTRACT",
    "header: why middleware, and what the representation is; the measurement goes to the history document",
    `A document route's loader cannot return a raw Response: React Router hands it
to the component as \`loaderData\` and the first property read 500s. Middleware is
the layer allowed to short-circuit.

The JSON representation is the SAME query against the SAME index. It is an agent
affordance, not a second search.`,
  ],
  "app/routes/search.tsx#2": [
    "CONTRACT",
    "why the flag rides on the response",
    `The palette reads it off the response it already makes, so the Ask affordance
costs no extra request and vanishes with the binding rather than needing a second
switch.`,
  ],
  "app/routes/search.tsx#3": [
    "WHY",
    "kept long: a measured prohibition whose failure is the wrong document served to a cookied reader",
    `NEVER STORED, and this is not a performance oversight. Do not "optimise" this
back to a shared cache-control.

\`/search\` varies on Accept and Cookie. With only the HTML representation in
play, a cookie-bearing request correctly bypasses and is downgraded. After ONE
request for this JSON representation, that same request gets a HIT and \`public\`
instead, because the edge answers from the stored cookieless variant and the
Worker never runs: a reader with \`theme=dark\` then receives the light document.
Accept separates storage correctly; the Cookie dimension is what collapses once
a second variant exists under the key.

A response that is never stored cannot become that second variant. The trigger
is advertised, because llms.txt tells agents this URL returns JSON.`,
  ],
  "app/routes/search.tsx#4": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#5": [
    "CONTRACT",
    "when a zero state is warranted",
    `Only when there is a query that found nothing. A blank \`/search\` is a search
box, not a failure, and does not need consoling; a filter that matched nothing
is a failure and does.`,
  ],
  "app/routes/search.tsx#6": [
    "CONTRACT",
    "the prohibition on waiting for the AI layer",
    `A boolean computed from the binding's presence. NOT an AI call: the loader that
renders classic results must never wait on the AI layer, so all the server does
here is say whether the affordance exists.`,
  ],
  "app/routes/search.tsx#7": [
    "CONTRACT",
    "the cache dimension, why Accept stays, and the tag",
    `The theme is a dimension of the cache key rather than a Vary. \`Accept\` STAYS,
because this URL really does serve a JSON representation and a cache that ignored
that would hand one to the other. Tagged \`posts\`: the results are the corpus.`,
  ],
  "app/routes/search.tsx#8": [
    "CONTRACT",
    "header: why the canonical drops the query; the hand-written history goes to the history document",
    `THE CANONICAL IS \`/search\`, WITHOUT THE QUERY, DELIBERATELY. Every distinct
\`?q=\` is a distinct URL for what is one page of the site, and there are
unboundedly many. Pointing all of them at the bare path says "this is the search
page" rather than minting a canonical per query.

\`noindex, follow\` is still the ruling: results pages are not content, and the
links out of them are worth following.`,
  ],
  "app/routes/search.tsx#9": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#10": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#11": [
    "CONTRACT",
    "why a filter change resets the page",
    `Changing a filter always returns to the first page. Staying on page 4 of a
narrower result set is how a filter appears to return nothing.`,
  ],
  "app/routes/search.tsx#12": [
    "CONTRACT",
    "header: why the union keying is better than a gate; the colophon defect goes to the history document",
    `Keyed by the UNION, not by \`string\`, and there is deliberately no fallback: the
\`Record<string, string>\` shape is what shipped the colophon defect, where a new
enum member typechecked clean and rendered the raw value to readers.
Hard rule 13.

Adding a reason without a label here is a TYPECHECK failure at the point of the
omission, which cannot be skipped and fails before anything is built.`,
  ],
  "app/routes/search.tsx#13": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#14": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#15": ["CONTRACT", "already at size; carries the escaping grounds"],
  "app/routes/search.tsx#16": [
    "CONTRACT",
    "what isEmpty does and does not mean",
    `\`isEmpty\` means no matchable TEXT, which is not the same as no request: a bare
year or a tag chip clicked from an empty box is a real query answered by the
browse path.`,
  ],
  "app/routes/search.tsx#17": ["CONTRACT", "already at size; carries the no-script statement"],
  "app/routes/search.tsx#18": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#19": ["CONTRACT", "already at size"],
  "app/routes/search.tsx#20": [
    "CONTRACT",
    "the no-script guarantee and the absent-binding case",
    `An empty container and a script tag. With scripting off it stays empty and the
page is byte-identical to the pre-Ask page apart from these two inert elements.
With the binding absent it is not rendered at all.`,
  ],
  "app/routes/search.tsx#21": [
    "WHY",
    "the prohibition on offering a control with nothing to do; the empty-string path goes to the history document",
    `ASK NEEDS A QUESTION, NOT A FILTER. On a filter-only query the affordance was
handed an empty string, so the button appeared and returned immediately: a
control that looks live and does nothing. The honest fix for a control with
nothing to do is not to offer it.`,
  ],
  "app/routes/search.tsx#22": [
    "CONTRACT",
    "the one-query rule",
    `Facets are links, never click handlers, and their counts come from the same
query that produced the list, so a chip only ever promises results a click would
actually return.`,
  ],
  "app/routes/search.tsx#23": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#0": [
    "CONTRACT",
    "header: the capability rule and the two gate-visible shapes; the nesting account goes to the history document",
    `The drawer's preview-link section.

THE TOKEN IS A CAPABILITY, so it is never printed. The list prints SIX
characters, enough to tell two links apart, and the whole value leaves the page
only through the copy control: a list that printed the URL would put every live
capability for this post on screen at once.

ONE FORM PER LINK, each carrying its token as a hidden field, so every revoke
submission is IDENTICAL in shape and the fixture describes the requests the page
can issue rather than how many rows it holds.

THE INTENT IS ON THE BUTTON, because \`check:admin-ui\` records a hidden field's
NAME and not its value.`,
  ],
  "app/components/admin/preview-links.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#4": [
    "CONTRACT",
    "header: why this is not rule 13's class, and why the marker is absent; the gate exchange goes to the history document",
    `NOT HARD RULE 13'S CLASS. That rule names a fallback substituting a PLAUSIBLE
value for a failure, so the failure stops being visible. This does the opposite:
it says out loud that the date could not be read, nothing downstream consumes it,
and no decision is taken on it.

The marker is deliberately not repeated here, since the gate counts files
carrying it.

The substitution lives HERE and not inside \`longDateUTC\` because the blog pages
want the null: they omit the whole line when there is no date.`,
  ],
  "app/components/admin/preview-links.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#6": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#7": [
    "CONTRACT",
    "keeps the measured bound and the asymmetry; the production measurement goes to the history document",
    `THE REVOKE CLAUSE IS A MEASURED BOUND, NOT A FIGURE OF SPEECH. \`APP_KV.get\`
takes an edge read cache and KV is eventually consistent, so a colo that has
already read the record keeps serving it until that cache lapses. The sentence
said "the moment you revoke it", which was measurably false.

PUBLICATION IS STILL IMMEDIATE, and for a different reason: the read path
re-asks D1 for \`status = 'draft'\` on every request, and that read is not
KV-cached.`,
  ],
  "app/components/admin/preview-links.tsx#8": [
    "CONTRACT",
    "why it is shown once",
    `The one place the full URL is VISIBLE rather than merely copyable, shown once
on the response that minted it: an author who cannot see what they just made has
to trust a copy button that may have failed.`,
  ],
  "app/components/admin/preview-links.tsx#9": ["CONTRACT", "already at size"],
  "app/components/admin/preview-links.tsx#10": [
    "CONTRACT",
    "header: why it is not the shared button, and the stated difference; the rename goes to the history document",
    `Copies the URL, and says so. SCRIPT ONLY, which the admin plane is exempt to
be.

NOT \`media-copy-button\`, and not merged into it: pointing this at the shared one
would import the media page's keyboard and toast module into the editor to get a
glyph styled for a grid this panel does not have.

STATED DIFFERENCE, not fixed here because it is a change to how the editor
behaves: the shared button announces through a live region and resets, and this
one changes its own label permanently.`,
  ],
  "app/routes/colophon.tsx#0": ["CONTRACT", "already at size"],
  "app/routes/colophon.tsx#1": [
    "CONTRACT",
    "header: the four standing rules; the ruling citation and the evidence go to the history document",
    `The colophon.

THE URL IS /colophon AND THE TITLE IS "How this site is built". A colophon is an
IndieWeb convention and machines expect the conventional path, but the word is
one many readers do not know, so the title takes the legibility. Do not swap
them.

EVERYTHING HERE IS READ FROM A GENERATED ARTIFACT. Nothing on this page is typed
out. If you find yourself adding a fact here, it belongs in \`stack-notes.json\`
where the gate can reconcile it.

FLAT: no filtering, no facets, no taxonomy.

NOTHING CLIENT-SIDE, and there is nothing to enhance. Hard rule 9 makes every
public reading route server-complete without script; this one is server-complete
because it is static markup over a build artifact, so the fallback and the page
are the same thing.`,
  ],
  "app/routes/colophon.tsx#2": [
    "CONTRACT",
    "header: the silent failure this prevents",
    `The heading and lead BOTH read from the descriptor. \`recordsForPage\` reads the
same list, so a record can never point at a fragment the page does not render.
That failure would be silent: the hit still appears and scrolls nowhere.`,
  ],
  "app/routes/colophon.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/colophon.tsx#4": [
    "CONTRACT",
    "what the flag means and why it is not hand-kept",
    `False when an anonymous GET does not produce a page: the anchor still NAMES the
route, it just stops pretending to be a destination. \`check:features\` derives
the same answer and refuses a declaration that disagrees.`,
  ],
  "app/routes/colophon.tsx#5": [
    "CONTRACT",
    "header: why a Map, and why there is no taxonomy",
    `A Map preserves insertion order, so the grouping is the author's rather than
alphabetical. That is deliberately all the structure this page has: facets over a
few dozen entries are decoration, and the right axes will be obvious from having
the data.`,
  ],
  "app/routes/colophon.tsx#6": [
    "CONTRACT",
    "header: the page's best property, and why a gate anchor is not a link",
    `Every claim links to its evidence. A route anchor becomes a real link. A gate
anchor NAMES the script rather than linking, because the scripts are not served,
and \`check:features\` guarantees the name still resolves. A decision anchor is
context and says so.`,
  ],
  "app/routes/colophon.tsx#7": [
    "CONTRACT",
    "the two reasons and the prohibition; the audit measurement goes to the history document",
    `TWO REASONS A ROUTE IS NOT A DESTINATION. A PARAMETER SEGMENT is a declaration
with no one URL it stands for. AN ANONYMOUS GET THAT IS NOT A PAGE is the other.

A link a reader cannot follow is worse than no link: it reads as evidence until
you click it. The path is still NAMED.`,
  ],
  "app/routes/colophon.tsx#8": [
    "CONTRACT",
    "the one-owner rule for the title",
    `THE TITLE IS READ, NOT TYPED. This h1 was the one place it was a literal, so
renaming the page would have changed the tab, the search record and the social
card while the heading kept the old words.`,
  ],
  "app/routes/colophon.tsx#9": [
    "CONTRACT",
    "one constant, and why it is prose",
    `Rendered from the SAME constant the search record is built from, so the page
cannot describe it one way and the index another. Prose, not a table: it is an
argument.`,
  ],
  "app/routes/colophon.tsx#10": [
    "CONTRACT",
    "one constant, and why it reads as prose",
    `Rendered from the SAME constant the search index is built from. Plain
paragraphs: this is the section a reader is most likely to have arrived for, and
it should read as prose rather than a compliance notice.`,
  ],
  "app/routes/colophon.tsx#11": [
    "CONTRACT",
    "the never-hue-alone rule",
    `The status is spelled out in TEXT, not carried by colour or position. Usage
rule 1: hue is never the sole channel.`,
  ],
  "app/routes/colophon.tsx#12": [
    "CONTRACT",
    "why each page names the other",
    `The colophon says how the site is BUILT; /privacy says what it RECORDS. A
reader who found either is likely looking for the other, so each names the other
rather than leaving it to the footer.`,
  ],
  "app/routes/preview.$token.tsx#0": [
    "CONTRACT",
    "header, kept long: the placement IS the control, plus the one-404 rule and the real-path claim",
    `A draft, shown to whoever holds the link.

WHY THIS ROUTE IS TOP LEVEL, AND WHY THAT IS THE SECURITY DESIGN. Workers Cache
sits in front of this Worker and THE CACHE KEY DOES NOT INCLUDE COOKIES. What
makes the public post route safe is the cookieless-only downgrade: a request
carrying a cookie is never stored. A REVIEWER HOLDING A PREVIEW LINK CARRIES NO
COOKIE, so they are exactly the request shape the downgrade does not fire for.
Had the preview shared a route with the public post, one unauthenticated preview
fetch would have been stored under a public cache entry and served to anyone
asking for that path. So the placement is the control, and \`PREVIEW_HEADERS\` has
no public branch to reach.

The token is a lookup key, not a claim: the slug comes out of the KV record it
names and never out of the URL.

EVERY failure returns the same 404, byte for byte. Unknown, expired, revoked,
malformed, deleted, published: one response, so a caller cannot learn whether a
token ever existed.

The page renders through the REAL path: the same component, the same projection,
the same stored column. There is no preview-shaped approximation, which is the
only thing that makes "this is what will publish" true rather than hopeful.`,
  ],
  "app/routes/preview.$token.tsx#1": [
    "CONTRACT",
    "header: why the values are literals",
    `ONE declaration read by \`headers()\` and by the 429. \`check:headers\` parses
this constant and compares it against its own transcription, which is why the
values are literals rather than imported constants: importing the shared one is
the exact mistake a copy-paste from \`blog.$slug.tsx\` would make.`,
  ],
  "app/routes/preview.$token.tsx#2": [
    "CONTRACT",
    "header: why middleware, and what the ordering buys",
    `A document route's loader cannot return a raw Response, and throwing would
reach the ErrorBoundary and lose the headers.

It runs BEFORE anything is looked up, so a refusal reveals nothing: at this point
the Worker has not read KV, has not read D1, and does not know whether the token
means anything.`,
  ],
  "app/routes/preview.$token.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/preview.$token.tsx#4": ["CONTRACT", "already at size; carries the one-refusal rule"],
  "app/routes/preview.$token.tsx#5": ["CONTRACT", "already at size"],
  "app/routes/preview.$token.tsx#6": ["CONTRACT", "already at size; carries the whole prohibition"],
  "app/routes/preview.$token.tsx#7": [
    "WHY",
    "keeps why the field is passed and where the grounds live; the 500 and its dates go to the history document",
    `\`mentions: []\`, AND ITS ABSENCE WAS A 500 ON EVERY PREVIEW. The component reads
\`mentions.length\` to decide whether to render the section, and \`blogPostView\`
deliberately does not carry the field: a draft has no readers and therefore no
approved mentions.`,
  ],
  "app/routes/preview.$token.tsx#8": [
    "CONTRACT",
    "the belt-and-control split, and the two deliberate absences",
    `NOINDEX IN THE MARKUP AS WELL AS ON THE WIRE. The header is the control,
because a crawler that never renders still sees it; the meta tag is the belt.

NO CANONICAL: pointing at \`/blog/<slug>\` would name a URL that 404s while the
post is a draft, and pointing here would be asking to have this indexed. No
\`og:\` tags either: a link unfurling an unpublished title in a chat window is the
leak this feature exists to control.`,
  ],
  "app/routes/preview.$token.tsx#9": [
    "CONTRACT",
    "header: why it is re-exported rather than wrapped",
    `THE SAME COMPONENT, re-exported rather than imported and wrapped, so there is
exactly one function on this site that renders a post page. A wrapper would be a
second place for the two to differ, and the whole claim of a preview is that they
cannot.`,
  ],
};
