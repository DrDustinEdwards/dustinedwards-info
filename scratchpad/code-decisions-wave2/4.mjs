// Chunk 4: scripts/check-publications.mjs, blocks 0-93.
//
// The heaviest single block in the wave so far is this file's floor comment, and it is pure
// chronology: eleven re-measurements of one number, each with its date and the assertions that
// moved it. The floor is the constant on the line below it, so all of it goes but the part
// that is not history at all, the two blocks that FOUND something on their first run. That is
// the standing argument for writing the gate rather than reasoning about the data.
//
// One thing this file does that the three before it did not: several comments record a
// REFUTED first attempt, a regex at the wrong indent, a substring matcher where the code uses
// longest-first, a query the classic index returned nothing for. Those read as history and are
// not: each says why the assertion asks the question it asks rather than the obvious one,
// which is the thing a reader would otherwise undo. They stay, cut to the prohibition and its
// because, and the tallies beside them go.
export default {
  "scripts/check-publications.mjs#0": [
    "CONTRACT",
    "the boundary, the placement rule and the pairing rule; the July build's count, the list of what stayed in the pipeline and the topic-id incident go to the history document",
    `Gate: the publication corpus is internally consistent and its artifact is fresh.

  npm run check:publications

OBSERVATION BOUNDARY. Pure: two committed JSON files, one generated TypeScript module, and
\`stat\` on the PDFs. It CANNOT see whether the registry data is still true, which is a
human-initiated refresh rather than a gate, because a gate that fetches Crossref goes red on
Crossref's bad day rather than on ours. The assertions needing the network or the PDFs'
internals stay in the pipeline for that reason.

THE REST RUN HERE RATHER THAN BESIDE THE PIPELINE, Hard rule 18's shape applied to a check:
one that runs when somebody refreshes the data never runs on a clone.

THE PAIRED COUNT IS NOT DECORATION. "0 violations" from a scan that examined nothing looks
exactly like a clean sweep, so every "no record has property X" carries the count that read.`,
  ],
  "scripts/check-publications.mjs#2": [
    "CONTRACT",
    "why three reporter shapes coexist and what section 17 can compare; this file's own failed spelling goes to the history document",
    `\`assertThat(ok, label, detail)\`, the condition FIRST.

THE PARAMETER IS NAMED \`ok\` BECAUSE FIVE OTHER GATES NAME IT \`ok\`. Three reporter shapes
coexist across the gates on purpose, so a call copied from one into another is a
ReferenceError rather than a silent pass with the label sitting in the condition slot, truthy,
incrementing the count. \`check:invariants\` section 17 compares the first parameter's NAME
across every definition of a helper name, because a name is all a static scan can compare.

@param {boolean} ok
@param {string} label
@param {string} [detail]`,
  ],
  "scripts/check-publications.mjs#4": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#5": [
    "WHY",
    "the fail-closed scope rule with its citation, in three lines",
    `SCOPE FIRST, and it fails CLOSED. Every "no record does X" assertion over an empty array
passes, so proving the scope is non-empty before reading anything out of it is hard rule 10's
first discipline.`,
  ],
  "scripts/check-publications.mjs#6": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#7": [
    "WHY",
    "why it is one assertion and why it is first",
    `A byte comparison between the committed module and a fresh generation, kept as one assertion
because that is what it is. FIRST, because every other content assertion reads the SOURCES and
this is the only one that catches a hand-edit of the generated file.`,
  ],
  "scripts/check-publications.mjs#8": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#9": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#10": [
    "WHY",
    "what it catches and what the symptom is, in two lines",
    `Every hosted path resolves to a real file: a rename or a \`git rm\` of a PDF the data file
still advertises is a 404 on a link the page renders as though it worked.`,
  ],
  "scripts/check-publications.mjs#11": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#12": [
    "WHY",
    "the one way a committed derivative goes stale, and what it makes gateable; the 27 MB figure and the pointer to the extractor go out",
    `THE TEXT ARTIFACT IS BOUND TO THE PDF IT CAME FROM BY HASH.

A committed derivative of a committed binary goes stale in exactly one way: the binary is
replaced and nothing re-runs the extractor. So the assertion is not "the file exists" but "the
bytes it claims to describe are the bytes on disk". It is also what makes the markdown twins
gateable, because comparing them byte for byte is worth something only if the text underneath
belongs to the PDF the page links to.`,
  ],
  "scripts/check-publications.mjs#13": [
    "WHY",
    "both directions and what each one loses, in three lines",
    `One entry per hosted record, and no entry for anything else: a hosted PDF with no text is a
twin that silently loses its full text, and an entry for a record no longer hosted is text
this site no longer serves the source of.`,
  ],
  "scripts/check-publications.mjs#14": [
    "WHY",
    "why bytes and not size or mtime",
    `THE HASH COMPARISON, the one that can actually go red. Read as BYTES, never compared by size
or mtime: a re-exported PDF of the same length is the case that would slip through, and it is
the likely one, because these files are replaced by re-running the pipeline.`,
  ],
  "scripts/check-publications.mjs#15": [
    "WHY",
    "what it catches, in two lines",
    `The entry is INTERNALLY consistent: the page count matches the array it carries and the char
count matches the text. Cheap, and it is what catches a hand-edit of this file.`,
  ],
  "scripts/check-publications.mjs#18": [
    "NUMBER",
    "why the threshold is low; the measured smallest extraction goes to the history document",
    `NO SILENTLY EMPTY EXTRACTION. A scanned PDF with no text layer extracts to nothing, the twin
carries a heading with no body under it, and every assertion above still passes. The threshold
is deliberately low: it looks for a failed extraction, it does not judge length.`,
  ],
  "scripts/check-publications.mjs#19": ["WHY", "why the field exists and what this stops; three lines already"],
  "scripts/check-publications.mjs#20": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#21": [
    "NUMBER",
    "which form is required and that the form is a ruling; the July oa.fcgi tally goes to the history document",
    `\`pmcUrl\` in LANDING-PAGE form, which is a ruling: the landing page answers for every PMCID
in this corpus, including the ones the open-access API refuses. This is what holds the form.`,
  ],
  "scripts/check-publications.mjs#22": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#23": [
    "WHY",
    "where the character lands and why the pairing is the assertion; the decode history goes out",
    `NO STORED ABSTRACT CONTAINS \`<\`, PAIRED WITH THE COUNT THAT READ THEM, and the pairing is
the assertion. These land in a \`<script type="application/ld+json">\` block, where an
unescaped \`<\` is the character that ends a script element early; a sweep that found none
because it read none reports what a clean corpus reports.`,
  ],
  "scripts/check-publications.mjs#24": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#25": [
    "WHY",
    "why the TOPICS block and not the record list; the incident stays as the prohibition, its tally goes",
    `Every topic a record claims is declared, parsed out of the GENERATED module's TOPICS block
rather than the record list: an earlier version matched on indentation instead, swept in every
publication id as though it were a topic id, and would have passed with an undeclared topic.`,
  ],
  "scripts/check-publications.mjs#26": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#27": [
    "WHY",
    "what the slug collapses and what a collision costs; the worked example goes out",
    `THE SLUG IS LOSSY AND THIS IS WHERE THAT IS MADE SAFE. \`doiSlug\` collapses every run of
non-alphanumerics to one hyphen, so a collision would mean two papers sharing a URL, one of
them unreachable and still in the sitemap.`,
  ],
  "scripts/check-publications.mjs#28": [
    "WHY",
    "why the path is a literal and what the quiet symptom is; the 31-PDF figure goes out",
    `THE PDF SITS WHERE THE PAGE CLAIMS IT DOES, AND \`paperPdfPath\` IS THE OWNER.

\`pdfPath\` stays a LITERAL because \`build:template-refs\` matches asset references as literal
strings, and a templated path would make every PDF read as unreferenced beside a delete
button. This binds the literal to the function that owns the rule; the drift's symptom is the
quiet one, \`citation_pdf_url\` pointing outside the page's directory, which Scholar declines
without saying so.`,
  ],
  "scripts/check-publications.mjs#29": [
    "WHY",
    "the property against the mechanism, in three lines",
    `EVERY PDF IS INSIDE ITS OWN PAPER'S DIRECTORY, stated separately because it is the PROPERTY
Scholar cares about and the equality above is only the mechanism that currently delivers it.
Point \`paperPdfPath\` somewhere else and the equality still passes while this does not.`,
  ],
  "scripts/check-publications.mjs#30": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#31": ["WHY", "why both directions and what a one-way check passes on; four lines already"],
  "scripts/check-publications.mjs#32": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#33": [
    "WHY",
    "the ruling as a standing constraint, what the list means, and the three states; the ruling's date, the review it overrode and the per-record tally go to the history document",
    `WHICH PDFs MAY BE HOSTED, AND WHY THIS IS AN ALLOWLIST RATHER THAN A RULE.

A review asked for hosting only what a licence permits; Dustin ruled they all stay up, and
this gate does not relitigate it. It keeps the decision DELIBERATE instead: every record
hosted WITHOUT a redistribution licence is named individually, so a new one with no licence
and no entry reds naming the DOI. The list is not "these are fine", it is "these were looked
at".

THE THREE STATES, WHICH IS WHY \`licenseSource\` EXISTS:

  a licence          the record carries redistribution terms
  crossref:tdm-only  terms WERE deposited and they are text-mining terms,
                     which licence redistribution to nobody
  null               neither registry recorded any terms

Collapsing the middle into the last would hide that those were checked and found wanting.`,
  ],
  "scripts/check-publications.mjs#34": [
    "WHY",
    "what bronze means, which is why these are on the list; the per-paper tally goes out",
    `Open access per Unpaywall, no licence recorded. Bronze means free to read on the
publisher's site with no licence at all, which the publisher can reverse.`,
  ],
  "scripts/check-publications.mjs#35": [
    "WHY",
    "what this group is; the ruling number goes to the history document",
    `Not open access at all.`,
  ],
  "scripts/check-publications.mjs#36": ["CONTRACT", "one line already; kept"],
  "scripts/check-publications.mjs#38": [
    "WHY",
    "what a stale exemption costs, in two lines",
    `THE OTHER DIRECTION: a DOI on the list that is no longer hosted without a licence is a stale
note about a decision nobody is taking, and stale exemptions are how an allowlist stops
meaning anything.`,
  ],
  "scripts/check-publications.mjs#39": [
    "WHY",
    "what a null source would mean, in two lines",
    `\`licenseSource\` IS RECORDED FOR EVERY HOSTED RECORD, the unlicensed ones included: a null
source there would mean nobody has looked, which is the state this block exists to prevent.`,
  ],
  "scripts/check-publications.mjs#40": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#41": [
    "CONTRACT",
    "why not against markup, why both halves, and why the builder throws; the check:browser aside folded into one clause",
    `THE CITATION TAGS, PER RECORD, THROUGH THE BUILDER THE ROUTE CALLS.

NOT AGAINST RENDERED MARKUP, because it cannot be done offline: \`route-render.mjs\` mounts a
route's COMPONENT through \`createRoutesStub\`, which never mounts the root layout's \`<Meta />\`,
so a render returns a page with no meta tags and an assertion over it passes by finding
nothing.

Both halves are therefore needed: a correct builder nobody calls and a call to a builder that
emits nothing are each green on one half. The wire is \`check:browser\`'s.

\`buildCitationTags\` THROWS rather than emitting a partial set, because Scholar's named minimum
is the title, the first author's full name and the year, and a page missing one is not indexed
badly, it is not indexed.`,
  ],
  "scripts/check-publications.mjs#43": [
    "WHY",
    "what the commonest mistake produces; the two author counts go to the history document",
    `ONE TAG PER AUTHOR, not one joined string: the commonest way to get this wrong produces a
single author whose name is the whole list.`,
  ],
  "scripts/check-publications.mjs#44": [
    "CONTRACT",
    "Scholar's rule and why it is asserted on the tag; the quotation trimmed to its clause",
    `SAME SUBDIRECTORY AS THE ABSTRACT PAGE, which is Scholar's rule: "it must refer to a file in
the same subdirectory as the HTML abstract." Asserted on the tag rather than on the path
helper, because this is the string that ships.`,
  ],
  "scripts/check-publications.mjs#45": [
    "WHY",
    "why comments are stripped here, in two lines",
    `AND THE ROUTE ACTUALLY CALLS IT. Comments stripped first, because this file and the route
both discuss the builder in prose and a raw match would read the explanation as the code.`,
  ],
  "scripts/check-publications.mjs#46": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#47": [
    "WHY",
    "what a gate can and cannot say about this field, and why the count carries it; the tense-bound 'today every record is null' made conditional",
    `\`summary\` is hand-written and null until somebody writes one. These assertions are about SHAPE
deliberately: a gate can check that a sentence is one sentence and short enough, and cannot
check that it is any good. Saying so is the point, because a green gate here must not read as
"the summaries are fine".

While the field is unfilled every assertion below passes over an empty set, so the count of
non-null summaries is reported rather than assumed.`,
  ],
  "scripts/check-publications.mjs#48": [
    "WHY",
    "what counts as a second sentence and that the looseness is deliberate; the worked example goes out",
    `ONE SENTENCE, counted as terminal punctuation followed by a space and a capital, which is
what a second sentence looks like. Deliberately loose: a nudge toward the format, not a
grammar checker.`,
  ],
  "scripts/check-publications.mjs#49": [
    "WHY",
    "why the hook cannot reach these strings and why the escapes",
    `THE HOUSE DASH RULE, which the PreToolUse hook cannot reach: these strings live in a JSON
data file that a person edits, and the hook guards writes made through the agent's tools.
Written as escapes so this file stays clean and greppable.`,
  ],
  "scripts/check-publications.mjs#50": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#51": [
    "WHY",
    "what a dated artifact can and cannot be checked for",
    `THE CITED-BY ARTIFACT IS DATED EVIDENCE, so these assertions are about the ways a dated
artifact goes wrong rather than about the numbers in it. The numbers are OpenAlex's; what a
gate can check is that the file describes THIS corpus, is not truncated, and says when it was
read.`,
  ],
  "scripts/check-publications.mjs#52": [
    "WHY",
    "what each half of the cap assertion catches; the 52-against-50 record goes to the history document",
    `THE CAP IS RESPECTED AND THE TRUE TOTAL SURVIVES IT, which is the only reason a page can say
"50 of 52". A list longer than the cap means the fetcher stopped honouring it; a \`total\` below
the list length means the two came from different reads.`,
  ],
  "scripts/check-publications.mjs#53": [
    "WHY",
    "what a URL that slipped through would render as",
    `A DOI HERE IS A BARE NAME, NOT A URL. The fetcher strips OpenAlex's prefix because the page
builds its own link, and one that slipped through would render a doubled \`https://doi.org/\`.`,
  ],
  "scripts/check-publications.mjs#56": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#57": [
    "CONTRACT",
    "the two properties and what each failure looks like, one paragraph each",
    `THE EXPORTS ARE BYTE-GATED, which means two things and both are asserted.

DETERMINISTIC: an export that differed between two downloads of an unchanged corpus would look
modified when nothing about the work changed, and would defeat every byte comparison
downstream. The commonest cause is a generation timestamp, which is why the header carries
none.

COMPLETE: a writer that silently dropped a record produces a file that parses, imports, and is
missing a paper.`,
  ],
  "scripts/check-publications.mjs#58": [
    "WHY",
    "why it is read as data; the indent trap stays as the prohibition, the count of times it happened goes",
    `Read as DATA, by importing the generated module, rather than by parsing its source text for
\`type: "..."\` lines. That was the first draft and it is the indent trap: a line matcher
anchored on indentation matches whatever else sits at that indent, and goes wrong silently by
counting too much.`,
  ],
  "scripts/check-publications.mjs#59": [
    "WHY",
    "why the set is stated twice and what keeps the two equal",
    `THE SHOWCASE SET IS STATED TWICE AND THIS IS WHAT KEEPS THEM EQUAL. The route declares it for
the page and \`export-response.mjs\` declares it for the exports, because importing a route
module into an export route would drag React and a loader along with it. So the route's
literal is parsed out of its source and compared against the imported set.`,
  ],
  "scripts/check-publications.mjs#60": ["WHY", "what a reference manager would show a reader, and the pairing; four lines already"],
  "scripts/check-publications.mjs#61": ["WHY", "why it is asserted where it matters; four lines already"],
  "scripts/check-publications.mjs#62": [
    "WHY",
    "the prohibition and its because: a gate must ask the question the code answers; the five-record tally goes out",
    `ASKED THROUGH \`organismsIn\`, the matcher the code uses, NOT through
\`ORGANISMS.some((o) => title.includes(o))\`. A gate that asks a different question from the one
the code answers reports a defect that is its own: the substring form failed records whose
output was correct, because "Mycobacterium smegmatis" also contains "Mycobacterium".`,
  ],
  "scripts/check-publications.mjs#63": [
    "NUMBER",
    "what a lowercasing export would break; the count of mixed-case DOIs goes to the history document",
    `DOIs AS DEPOSITED: a lowercasing export would disagree with the registry it came from.`,
  ],
  "scripts/check-publications.mjs#64": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#65": [
    "WHY",
    "why a count and not a name, and why the preprint is not merged; the July record goes to the history document",
    `A COUNT rather than a name, so a second preprint arriving is a decision somebody makes in
this file. The bioRxiv record is deliberately NOT merged into the published record, so that
every displayed citation figure matches the OpenAlex page a reader would land on.`,
  ],
  "scripts/check-publications.mjs#66": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#67": [
    "WHY",
    "why gitignored build product needs this most, and why nothing is written first",
    `THE TWINS ON DISK ARE THE TWINS THIS CORPUS PRODUCES, BYTE FOR BYTE.

They are gitignored build product served as static assets, the combination that needs this
most: nothing imports them, so a build that never ran breaks no build and fails no type check,
and the deploy uploads a site whose llms.txt advertises URLs that answer 404.

GENERATED IN THIS PROCESS AND COMPARED, never written to disk first, for the reason
\`build-publications.mjs\` carries in full: a gate that repairs its subject cannot fail.`,
  ],
  "scripts/check-publications.mjs#68": [
    "WHY",
    "what the prune failing leaves behind, and why not recursive",
    `NO TWIN THIS CORPUS DOES NOT PRODUCE, which is what asserts the build's prune ran: a
corrected DOI leaves a file behind that nothing overwrites, nothing compares, and the next
deploy uploads. Directly under the directory only; the per-paper subdirectories hold the PDFs.`,
  ],
  "scripts/check-publications.mjs#69": [
    "WHY",
    "why both directions and why URLs rather than a count; the file's 36 URLs go to the history document",
    `EVERY TWIN IS ADVERTISED, AND EVERYTHING ADVERTISED EXISTS. \`content/llms.txt\` lists them by
URL, which is the only reason an agent reading it knows they are there, and a hand-maintained
list beside a generated set is the mirror this repo refuses everywhere else. So both
directions: a twin absent from llms.txt is a file nothing points at, and a line with no file
behind it is this site telling an agent to fetch a 404.

Matched on the URL, not a count: a count passes on a list naming the wrong papers.`,
  ],
  "scripts/check-publications.mjs#70": [
    "WHY",
    "what a twin that lost its text would still do, and why the comparison is relative",
    `THE FULL TEXT REACHES THE TWIN, which is what the whole extracted artifact exists for: one
that quietly lost its text would still generate, still match on disk, and still be advertised.
Compared against the artifact's own character count rather than a fixed threshold, because the
claim is that this paper's text is in this paper's twin, not that the twin is long.`,
  ],
  "scripts/check-publications.mjs#71": ["WHY", "why half, and what the twin does to the pages; two lines already"],
  "scripts/check-publications.mjs#72": [
    "WHY",
    "which boundary this is and why the needle is anchored",
    `NO TWIN CARRIES A CHARACTER REFERENCE. The stored corpus keeps \`&lt;\` on purpose and every
boundary where text becomes something a reader reads decodes it; a twin handing an agent
\`p &lt; 0.05\` hands it the markup instead of the sentence. Anchored to the named references
rather than a bare \`&\`, because frontmatter URLs carry query strings.`,
  ],
  "scripts/check-publications.mjs#73": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#74": [
    "WHY",
    "why the pair, and what each half alone would assert",
    `ONE SEARCH RECORD PER PAPER, IN THE ARTIFACT THAT BECOMES \`search_docs\`. Built here from the
modules the build uses and compared against what \`sync:content\` materialises into D1. Building
without reading asserts that the builders work; reading without building asserts that a file
has lines in it. The pair is what says the site's own search will serve these papers.`,
  ],
  "scripts/check-publications.mjs#77": ["WHY", "why the URL is compared rather than assumed; two lines already"],
  "scripts/check-publications.mjs#78": [
    "WHY",
    "why full text is kept out of the index and why the comparison needs no threshold; the index size goes to the history document",
    `NO PAPER RECORD CARRIES THE EXTRACTED TEXT, the half of the split that would rot quietly.
Classic search shows the line it matched, and machine-read two-column text would match on
running heads and snippet the mangled line the term fell on; the full text belongs to the
twins, which Ask and the MCP read. Asserted by SIZE against the artifact's own measurement, so
no threshold has to be invented.`,
  ],
  "scripts/check-publications.mjs#79": [
    "WHY",
    "why the round trip is asserted over the real corpus, and what a broken key looks like",
    `THE ASK KEY ROUND-TRIPS, for every paper, through the module both the upload path and the
citation renderer use. The asymmetry between \`keyForUrl\` and \`urlForKey\` is exactly why it is
asserted over the real corpus: a key that did not round-trip would upload fine and cite a URL
that 404s, a failure only a reader who clicked a citation would ever see.`,
  ],
  "scripts/check-publications.mjs#80": [
    "WHY",
    "what the second spelling is and which one the uploader fetches",
    `AND THE KEY IS THE TWIN'S ACTUAL PATH. The assertion above compares against a literal
spelling of the key; this compares against \`paperMarkdownPath\`, which is what the build writes
and what the uploader fetches through.`,
  ],
  "scripts/check-publications.mjs#81": [
    "WHY",
    "the two-part shape and what each half owns",
    `THE ASK LINK: the URL builder is exercised over the whole corpus and the route is asserted to
call it, the same two-part shape as the Highwire tag set above and for a related reason, that
this is a value the route interpolates. What is checked is that the one owner produces a
usable URL for every record, and that the page has not grown a second hand-built copy of it.`,
  ],
  "scripts/check-publications.mjs#82": [
    "WHY",
    "the prohibition and its because; the failed first URL stays as the reason, the measurement goes",
    `THE QUERY IS THE QUOTED TITLE AND NOTHING ELSE, which is what makes the scriptless half of the
link work at all: the classic index ANDs its terms, so an earlier phrasing of this URL
returned ZERO results because its question words appear in no record.

Asserted by DECODING the query back and comparing it to the title, not by matching a shape: a
shape test passes on any quoted string, and what must be caught is a word creeping back in
beside the phrase.`,
  ],
  "scripts/check-publications.mjs#83": [
    "WHY",
    "what a quote in a title would do to the classic half; the measured 'none of the 36' goes to the history document",
    `NO TITLE CARRIES A QUOTATION MARK, which is what lets the question quote the title at all.
\`query.mjs\` reads a quoted run as an exact phrase, so a title containing its own quote would
split the phrase in two and the classic half of that link would search for something else.`,
  ],
  "scripts/check-publications.mjs#84": [
    "WHY",
    "why comments are stripped, and the limit of this stripper",
    `COMMENTS STRIPPED BEFORE MATCHING: the route's own comment beside the link names
\`paperAskUrl\`, and a gate in this repo has gone green on prose that explained what the code
used to do. Whole-line and block comments only, the limit \`check:policy\` states for the same
stripper, so a trailing comment could still satisfy this.`,
  ],
  "scripts/check-publications.mjs#85": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#86": [
    "WHY",
    "why the count is in the label and what the other half of the proof is; the sweep's dated tally goes to the history document",
    `THE DARK PATH IS ASSERTED DARK, WITH THE COUNT BESIDE IT, because a bare "none of them" from a
scan that read nothing looks exactly like this. The other half of the proof is
\`test/publication-update-notice.test.mjs\`, which drives the render path with a real retracted
DOI: a path with no data behind it is a path nothing exercises.`,
  ],
  "scripts/check-publications.mjs#87": [
    "WHY",
    "why a vacuous assertion is paired with the count, and what it refuses",
    `AND EVERY ONE THAT DOES IS USABLE. Vacuous by construction while the set is empty, which is
the point of pairing it with the count above: the day a notice arrives, this refuses a
malformed one before it renders \`https://doi.org/undefined\` on the most serious sentence this
site prints.`,
  ],
  "scripts/check-publications.mjs#88": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#89": [
    "WHY",
    "why the anchor is the data-availability statement and why both directions; the per-paper accessions go to the history document",
    `THE CURATED ACCESSIONS ARE THE ONES THE DATA-AVAILABILITY STATEMENT NAMES.

The accessions are in the PDFs rather than the abstracts, and a plain regex over a PDF pulls
in the COMPARISON phages' accessions and previous isolates', which are other papers' deposits
for other outbreaks. The anchor is the statement, where a journal requires the authors to name
what THIS work deposited; \`accessions.mjs\` owns that reading.

Both directions: an accession in the text and not the corpus is a deposit the site does not
link, and one in the corpus the statement does not name is a claim the PDF does not support.`,
  ],
  "scripts/check-publications.mjs#91": ["WHY", "what a wrong registry URL looks like and why one builder would be the mistake; four lines already"],
  "scripts/check-publications.mjs#92": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-publications.mjs#93": [
    "NUMBER",
    "the measurement rule, the slack convention, and the two blocks that found something on their first run; eleven dated re-measurements go to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, never summed from the assertion list
above. Slack of two, the convention \`check:secrets\` records: this count moves only when an
assertion is written, so it does not need room to breathe.

TWO BLOCKS EARNED THEIR PLACE ON THEIR FIRST RUN, which is the standing argument for writing
the gate rather than reasoning about the data. The rights block found \`licenseSource: null\`
carrying checked-and-empty and never-checked at once, on exactly the closed records where the
difference decides whether a hosting decision was made or merely inherited. The accession
block's plant, which removes the data-availability anchor and sweeps the whole paper,
reproduces every refuted case by name: a comparison phage's accession, a previous outbreak's,
another paper's deposit entirely.`,
  ],
};
