// Chunk 4: scripts/check-publications.mjs, blocks 0-93.
//
// RE-CUT TO WAVE 1'S SEVERITY, which the seat ruled after the measurement in the previous
// commit. Wave 1's rule, read off its committed decisions rather than guessed at, which is how
// I got it wrong three times before measuring:
//
//   a surviving block is ONE LINE, around 76 bytes, statement then the because as a clause
//   a file header is six or so lines and keeps the invocation
//   a rule-padded separator keeps its label and loses the dashes
//   the justification for CHOOSING one approach over another is DELETED, not compressed
//
// That last is what I kept mistaking for a why. Wave 1 cuts "why Puppeteer and not Playwright"
// entirely and keeps only what the code does and the trap that would make a reader undo it.
export default {
  "scripts/check-publications.mjs#0": [
    "CONTRACT",
    "the boundary, the placement rule and the pairing rule, one clause each; the July build, the pipeline-only list and the topic-id incident go to the history document",
    `Gate: the publication corpus is internally consistent and its artifact is fresh.

  npm run check:publications

Pure: two committed JSON files, one generated module, and \`stat\` on the PDFs. It cannot see
whether the registry data is still true, so the assertions needing the network stay in the
pipeline; these run here because a check that runs on a refresh never runs on a clone. Every
"no record has property X" carries the count that read, since a scan that examined nothing
reports a clean sweep. Hard rule 18's shape, applied to a check.`,
  ],
  "scripts/check-publications.mjs#2": [
    "CONTRACT",
    "the argument order and the one reason for the name; section 17's mechanism and this file's own failed spelling go to the history document",
    `Condition FIRST, and named \`ok\` because five other gates name it that: a call copied between
gates is then a ReferenceError rather than a pass with the label in the condition slot.

@param {boolean} ok
@param {string} label
@param {string} [detail]`,
  ],
  "scripts/check-publications.mjs#4": ["CONTRACT", "section marker, rule padding cut", `the sources exist at all`],
  "scripts/check-publications.mjs#5": [
    "WHY",
    "the fail-closed scope rule with its citation, in one line",
    `SCOPE FIRST: every "no record does X" assertion over an empty array passes, and proving the
scope non-empty is hard rule 10's first discipline.`,
  ],
  "scripts/check-publications.mjs#6": ["CONTRACT", "section marker, rule padding cut", `the artifact is fresh`],
  "scripts/check-publications.mjs#7": [
    "WHY",
    "why it is first, in one line",
    `FIRST, because every other content assertion reads the SOURCES and only this one catches a
hand-edit of the generated file.`,
  ],
  "scripts/check-publications.mjs#8": ["CONTRACT", "section marker, rule padding cut", `identity`],
  "scripts/check-publications.mjs#9": ["CONTRACT", "section marker, rule padding cut", `the PDF set`],
  "scripts/check-publications.mjs#10": [
    "WHY",
    "the symptom, in one line",
    `A PDF the data file still advertises is a 404 on a link the page renders as though it worked.`,
  ],
  "scripts/check-publications.mjs#11": ["CONTRACT", "section marker, rule padding cut", `the extracted text, and its bytes`],
  "scripts/check-publications.mjs#12": [
    "WHY",
    "the one way it goes stale, in one line; what it makes gateable and the extraction cost go to the history document",
    `A committed derivative of a committed binary goes stale one way, the binary replaced and
nothing re-run, so the claim is about bytes rather than existence.`,
  ],
  "scripts/check-publications.mjs#13": [
    "WHY",
    "both directions, one clause each",
    `Both directions: a hosted PDF with no text loses its twin's full text, and an entry for an
unhosted record is text this site no longer serves the source of.`,
  ],
  "scripts/check-publications.mjs#14": [
    "WHY",
    "why bytes and not size, in one line",
    `Hashed, never size or mtime: a re-exported PDF of the same length is the case that slips
through, and the likely one.`,
  ],
  "scripts/check-publications.mjs#15": [
    "WHY",
    "what it catches, in one line",
    `Internally consistent, which is what catches a hand-edit of this file.`,
  ],
  "scripts/check-publications.mjs#18": [
    "NUMBER",
    "why the threshold is low; the measured smallest extraction goes to the history document",
    `A scanned PDF with no text layer extracts to nothing and every assertion above still passes.
The threshold looks for a failed extraction, not for length.`,
  ],
  "scripts/check-publications.mjs#19": [
    "WHY",
    "what the field is for, in one line",
    `\`access\` exists so a record can move between self-hosted and external without a schema
change; this stops it being moved halfway.`,
  ],
  "scripts/check-publications.mjs#20": ["CONTRACT", "section marker, rule padding cut", `external ids`],
  "scripts/check-publications.mjs#21": [
    "NUMBER",
    "which form and that it is a ruling; the oa.fcgi tally goes to the history document",
    `LANDING-PAGE form, which is a ruling: it answers for every PMCID here, including the ones the
open-access API refuses.`,
  ],
  "scripts/check-publications.mjs#22": ["CONTRACT", "section marker, rule padding cut", `abstracts`],
  "scripts/check-publications.mjs#23": [
    "WHY",
    "where the character lands and why the count is beside it; the decode history goes out",
    `These land in a \`<script type="application/ld+json">\` block, where an unescaped \`<\` ends the
element early. Counted too, because a sweep that read none reports a clean corpus.`,
  ],
  "scripts/check-publications.mjs#24": ["CONTRACT", "section marker, rule padding cut", `topics`],
  "scripts/check-publications.mjs#25": [
    "WHY",
    "why the TOPICS block, in one line; the incident's tally goes to the history document",
    `Out of the GENERATED module's TOPICS block, not the record list: a matcher anchored on indent
swept in every publication id as a topic id.`,
  ],
  "scripts/check-publications.mjs#26": ["CONTRACT", "section marker, rule padding cut", `slugs, pages and PDFs`],
  "scripts/check-publications.mjs#27": [
    "WHY",
    "what a collision costs, in one line; the worked example goes out",
    `The slug is LOSSY, so a collision means two papers sharing a URL, one unreachable and still
in the sitemap.`,
  ],
  "scripts/check-publications.mjs#28": [
    "WHY",
    "why the path is a literal and the quiet symptom; the media-library reasoning goes to the history document",
    `\`pdfPath\` stays a LITERAL because \`build:template-refs\` matches asset references as literal
strings. The drift's symptom is \`citation_pdf_url\` outside the page's directory, which Scholar
declines without saying so.`,
  ],
  "scripts/check-publications.mjs#29": [
    "WHY",
    "the property against the mechanism, in one line",
    `The PROPERTY Scholar cares about: point \`paperPdfPath\` elsewhere and the equality above still
passes while this does not.`,
  ],
  "scripts/check-publications.mjs#30": ["CONTRACT", "section marker, rule padding cut", `the redirect map`],
  "scripts/check-publications.mjs#31": [
    "WHY",
    "what a one-way check passes on, in one line",
    `BOTH DIRECTIONS: a one-way check passes on an entry pointing at nothing, which is a 301 into
a 404.`,
  ],
  "scripts/check-publications.mjs#32": ["CONTRACT", "section marker, rule padding cut", `rights`],
  "scripts/check-publications.mjs#33": [
    "WHY",
    "what the list means and the three states, which nothing else records; the ruling's date, the review it overrode and the per-record tally go to the history document",
    `AN ALLOWLIST, NOT A RULE. Every PDF stays up by ruling, so this keeps that deliberate: a
hosted PDF with no licence and no entry reds naming the DOI. Not "these are fine", "these were
looked at".

\`licenseSource\` has three states and the middle is why it exists: a licence, tdm-only for
terms that licence redistribution to nobody, or null for no terms recorded. Collapsing the
middle into the last hides that those were checked.`,
  ],
  "scripts/check-publications.mjs#34": [
    "WHY",
    "what bronze means, in one line; the per-paper tally goes out",
    `Bronze is free to read on the publisher's site with no licence at all, which the publisher
can reverse.`,
  ],
  "scripts/check-publications.mjs#35": [
    "WHY",
    "what this group is; the ruling number goes to the history document",
    `Not open access at all.`,
  ],
  "scripts/check-publications.mjs#36": ["CONTRACT", "one line already; kept"],
  "scripts/check-publications.mjs#38": [
    "WHY",
    "what a stale exemption costs, in one line",
    `THE OTHER DIRECTION: stale exemptions are how an allowlist stops meaning anything.`,
  ],
  "scripts/check-publications.mjs#39": [
    "WHY",
    "what a null source would mean, in one line",
    `A null source on an unlicensed record would mean nobody has looked, which is the state this
block prevents.`,
  ],
  "scripts/check-publications.mjs#40": ["CONTRACT", "section marker, rule padding cut", `the Highwire tag set`],
  "scripts/check-publications.mjs#41": [
    "CONTRACT",
    "why not the render, that both halves are needed, and why the builder throws; check:browser's boundary and Scholar's quoted minimum go to the history document",
    `Not against the render: \`createRoutesStub\` never mounts \`<Meta />\`, so an assertion over it
passes by finding nothing. Both halves are asserted, the builder and the route calling it,
because either alone is green while the page is wrong. The builder THROWS rather than emit a
partial set, since Scholar indexes nothing missing title, first author or year.`,
  ],
  "scripts/check-publications.mjs#43": [
    "WHY",
    "what the mistake produces, in one line",
    `ONE TAG PER AUTHOR: getting this wrong produces a single author whose name is the whole list.`,
  ],
  "scripts/check-publications.mjs#44": [
    "CONTRACT",
    "Scholar's rule and why it is on the tag, in one line",
    `Scholar's rule, asserted on the tag rather than the path helper because this is the string
that ships.`,
  ],
  "scripts/check-publications.mjs#45": [
    "WHY",
    "why comments are stripped, in one line",
    `Comments stripped: this file and the route both discuss the builder in prose.`,
  ],
  "scripts/check-publications.mjs#46": ["CONTRACT", "section marker, rule padding cut", `the plain-language line`],
  "scripts/check-publications.mjs#47": [
    "WHY",
    "what a gate can say here and why the count carries it; the tense-bound 'today every record is null' goes out",
    `SHAPE ONLY: a gate cannot check that a sentence is any good, and a green gate here must not
read as "the summaries are fine". While the field is unfilled every assertion below passes
over an empty set, so the count of non-null summaries is reported.`,
  ],
  "scripts/check-publications.mjs#48": [
    "WHY",
    "the rule and that it is deliberately loose, in one line",
    `Terminal punctuation, space, capital. Deliberately loose: a nudge toward the format, not a
grammar checker.`,
  ],
  "scripts/check-publications.mjs#49": [
    "WHY",
    "why the hook cannot reach these, in one line",
    `The PreToolUse hook cannot reach these: a person edits this JSON by hand. Written as escapes
so this file stays greppable.`,
  ],
  "scripts/check-publications.mjs#50": ["CONTRACT", "section marker, rule padding cut", `cited by`],
  "scripts/check-publications.mjs#51": [
    "WHY",
    "what a dated artifact can be checked for, in one line",
    `DATED EVIDENCE, so these assert that it describes THIS corpus, is not truncated, and says
when it was read, never its numbers.`,
  ],
  "scripts/check-publications.mjs#52": [
    "WHY",
    "what each half catches; the 52-against-50 record goes to the history document",
    `A list over the cap means the fetcher stopped honouring it; a \`total\` under the list length
means the two came from different reads.`,
  ],
  "scripts/check-publications.mjs#53": [
    "WHY",
    "what would render, in one line",
    `A BARE NAME: the page builds its own link, so a URL that slipped through renders a doubled
\`https://doi.org/\`.`,
  ],
  "scripts/check-publications.mjs#56": ["CONTRACT", "section marker, rule padding cut", `exports`],
  "scripts/check-publications.mjs#57": [
    "CONTRACT",
    "the two properties, one clause each",
    `DETERMINISTIC: a generation timestamp would defeat every byte comparison downstream, which is
why the header carries none. COMPLETE: a writer that dropped a record silently produces a file
that parses and is missing a paper.`,
  ],
  "scripts/check-publications.mjs#58": [
    "WHY",
    "the prohibition and its because, in one line",
    `Read as DATA, never by matching source text: a matcher anchored on indent matches whatever
else sits there and goes wrong by counting too much.`,
  ],
  "scripts/check-publications.mjs#59": [
    "WHY",
    "why it is stated twice and what keeps them equal, in one line",
    `Stated twice because importing the route module here would drag React along, so the route's
literal is parsed out and compared against this one.`,
  ],
  "scripts/check-publications.mjs#60": [
    "WHY",
    "what a reader would see, in one line",
    `The stored corpus keeps them escaped, and a reference manager would show a reader
\`p &lt; 0.05\`.`,
  ],
  "scripts/check-publications.mjs#61": [
    "WHY",
    "why it matters here, in one line",
    `Asserted where it MATTERS: a lowercased genus is wrong under the nomenclature codes rather
than merely ugly.`,
  ],
  "scripts/check-publications.mjs#62": [
    "WHY",
    "the prohibition and its because, in one line; the five-record tally goes out",
    `Through \`organismsIn\`, the matcher the code uses: a gate that asks a different question
reports a defect that is its own.`,
  ],
  "scripts/check-publications.mjs#63": [
    "NUMBER",
    "what a lowercasing export breaks; the count of mixed-case DOIs goes to the history document",
    `AS DEPOSITED: a lowercasing export would disagree with the registry it came from.`,
  ],
  "scripts/check-publications.mjs#64": ["CONTRACT", "section marker, rule padding cut", `preprint`],
  "scripts/check-publications.mjs#65": [
    "WHY",
    "why a count and why it is not merged; the July record goes to the history document",
    `A COUNT, so a second preprint is a decision somebody makes here. Not merged into the
published record, so every displayed citation figure matches the page a reader lands on.`,
  ],
  "scripts/check-publications.mjs#66": ["CONTRACT", "section marker, rule padding cut", `the markdown twins`],
  "scripts/check-publications.mjs#67": [
    "WHY",
    "why build product needs this most and why nothing is written first",
    `Nothing imports the twins, so a build that never ran fails no type check and the deploy
uploads a site whose llms.txt advertises 404s. Compared in this process and never written
first, because a gate that repairs its subject cannot fail.`,
  ],
  "scripts/check-publications.mjs#68": [
    "WHY",
    "what the prune failing leaves, in one line",
    `Asserts the prune ran: a corrected DOI leaves a file nothing overwrites. Not recursive; the
subdirectories hold the PDFs.`,
  ],
  "scripts/check-publications.mjs#69": [
    "WHY",
    "why both directions and why not a count; the URL count goes to the history document",
    `A hand-maintained list beside a generated set, so both directions: a twin absent from it is a
file nothing points at, a line with no file tells an agent to fetch a 404. Matched on the URL,
because a count passes on a list naming the wrong papers.`,
  ],
  "scripts/check-publications.mjs#70": [
    "WHY",
    "what a lost twin still does, in one line",
    `A twin that lost its text would still generate, match on disk, and be advertised. Compared
against the artifact's own count, so no threshold is invented.`,
  ],
  "scripts/check-publications.mjs#71": ["WHY", "why half, and what the twin does to the pages; two lines already"],
  "scripts/check-publications.mjs#72": [
    "WHY",
    "which boundary and why the needle is anchored, in one line",
    `Every boundary where text becomes something a reader reads decodes these. Anchored to the
named references, not a bare \`&\`, because frontmatter URLs carry query strings.`,
  ],
  "scripts/check-publications.mjs#73": ["CONTRACT", "section marker, rule padding cut", `search, the MCP and Ask, all three`],
  "scripts/check-publications.mjs#74": [
    "WHY",
    "what each half alone would assert, in one line",
    `Building without reading asserts that the builders work; reading without building asserts
that a file has lines in it.`,
  ],
  "scripts/check-publications.mjs#77": ["WHY", "why the URL is compared rather than assumed; two lines already"],
  "scripts/check-publications.mjs#78": [
    "WHY",
    "why full text is out of the index and why no threshold; the index size goes to the history document",
    `Classic search shows the line it matched, and two-column machine text would snippet the
mangled line the term fell on. By SIZE against the artifact's own measurement, so no threshold
is invented.`,
  ],
  "scripts/check-publications.mjs#79": [
    "WHY",
    "why over the real corpus, in one line",
    `The asymmetry between \`keyForUrl\` and \`urlForKey\` is why this runs over the real corpus: a
key that did not round-trip uploads fine and cites a 404.`,
  ],
  "scripts/check-publications.mjs#80": [
    "WHY",
    "which spelling the uploader uses, in one line",
    `Against \`paperMarkdownPath\`, which is what the build writes and the uploader fetches through,
rather than the literal the assertion above compares.`,
  ],
  "scripts/check-publications.mjs#81": [
    "WHY",
    "what the two halves own, in one line",
    `The one owner must produce a usable URL for every record, and the page must not have grown a
second copy of it.`,
  ],
  "scripts/check-publications.mjs#82": [
    "WHY",
    "the property and why it is decoded; the failed first URL goes to the history document",
    `THE QUOTED TITLE AND NOTHING ELSE, because the classic index ANDs its terms. Asserted by
DECODING the query back, not by shape: a shape test passes on any quoted string, and what must
be caught is a word creeping in beside the phrase.`,
  ],
  "scripts/check-publications.mjs#83": [
    "WHY",
    "what a quote would do; the measured 'none of the 36' goes to the history document",
    `\`query.mjs\` reads a quoted run as an exact phrase, so a title carrying its own quote would
split it and search for something else.`,
  ],
  "scripts/check-publications.mjs#84": [
    "WHY",
    "why stripped and the stripper's limit, in one line",
    `Comments stripped, because the route's own comment names \`paperAskUrl\`. Whole-line and block
only, so a trailing comment could still satisfy this.`,
  ],
  "scripts/check-publications.mjs#85": ["CONTRACT", "section marker, rule padding cut", `retractions, corrections, versions`],
  "scripts/check-publications.mjs#86": [
    "WHY",
    "why the count is in the label and what the other half is; the sweep's tally goes to the history document",
    `The count is in the label because a bare "none of them" from a scan that read nothing looks
exactly like this. The render half is \`test/publication-update-notice.test.mjs\`.`,
  ],
  "scripts/check-publications.mjs#87": [
    "WHY",
    "what it refuses when the set fills, in one line",
    `Vacuous while the set is empty, which is why the count is beside it: it refuses a malformed
notice before it renders \`https://doi.org/undefined\`.`,
  ],
  "scripts/check-publications.mjs#88": ["CONTRACT", "section marker, rule padding cut", `accessions, from the PDFs`],
  "scripts/check-publications.mjs#89": [
    "WHY",
    "why the anchor and why both directions; the per-paper accessions go to the history document",
    `THE DATA-AVAILABILITY STATEMENT IS THE ANCHOR, because a plain regex over a PDF pulls in the
COMPARISON phages' accessions, which are another paper's deposit. Both directions: one in the
text and not the corpus is a deposit nothing links, one in the corpus the statement does not
name is a claim the PDF does not support.`,
  ],
  "scripts/check-publications.mjs#91": [
    "WHY",
    "what a wrong registry URL looks like, in one line",
    `An SRA run under a nuccore URL is a 404 that looks like a working link, and the two grammars
are close enough that one builder would be the obvious mistake.`,
  ],
  "scripts/check-publications.mjs#92": ["CONTRACT", "section marker, rule padding cut", `done`],
  "scripts/check-publications.mjs#93": [
    "NUMBER",
    "the measurement rule and the slack convention; eleven dated re-measurements and both first-run findings go to the history document",
    `MEASURED BY RUNNING THIS GATE, never summed. Slack of two: this count moves only when an
assertion is written, so it needs no room to breathe.`,
  ],
};
