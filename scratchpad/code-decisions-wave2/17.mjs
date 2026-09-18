// Chunk 17: lib/pending-migrations 0-12, uptime-ensure 0-13, lib/mark 0-8, build-stack 0-9,
// check-search 0-26, build-guidelines 0-13, lib/page-payload 0-12, operator-roundtrip 0-33,
// check-llms 0-13, ae-probe 0-11, lib/decisions-volumes 0-7, health-repair 0-12.
//
// Written at wave 1's rate. The separator runs in check-search and operator-roundtrip keep
// their labels and lose their dashes, which is most of what makes those two files long.
export default {
  "scripts/lib/pending-migrations.mjs#0": [
    "CONTRACT",
    "what it is pure over, why it refuses and the three outcomes; the ship window, the migration and the dates go to the history document",
    `Does the deployed database have every migration this repo carries?

PURE: it takes what \`wrangler d1 migrations list\` printed plus the files on disk and returns a
verdict, which is what lets the RULE be unit tested against recorded output.

Authoring a migration created an obligation nowhere: ship applies none and compares no schema,
\`check:migrations\` compares FILES to a manifest, and the gate that would have caught it is in
neither tier ship runs. IT REFUSES RATHER THAN APPLYING, because a deploy that silently mutates
the production schema is worse than one that stops and ship cannot classify SQL.

THREE OUTCOMES, NOT TWO, because a parser that reads "nothing pending" from output it did not
understand is the danger: pending names refuse, a positive clean marker proceeds, and anything
unrecognised refuses as unreadable. An empty match set is never evidence of a clean database.`,
  ],
  "scripts/lib/pending-migrations.mjs#1": ["CONTRACT", "what it matches; one line already"],
  "scripts/lib/pending-migrations.mjs#2": ["CONTRACT", "what it matches; one line already"],
  "scripts/lib/pending-migrations.mjs#3": [
    "CONTRACT",
    "why anchored on the prefix",
    `A migration filename, as it appears both on disk and in wrangler's table, anchored to the
four-digit prefix so a stray word in a warning banner cannot be mistaken for one.`,
  ],
  "scripts/lib/pending-migrations.mjs#4": ["CONTRACT", "the verdict shape; type annotation only"],
  "scripts/lib/pending-migrations.mjs#5": [
    "CONTRACT",
    "what it reads; one line already",
    `Reads a \`wrangler d1 migrations list\` run.

@param {object} input
@param {number} input.code    the process exit code
@param {string} input.text    stdout and stderr, combined
@returns {MigrationVerdict}`,
  ],
  "scripts/lib/pending-migrations.mjs#6": [
    "WHY",
    "why a non-zero exit is not clean",
    `A NON-ZERO EXIT IS NOT "NOTHING PENDING": network down, auth expired or the database renamed
all exit non-zero and print no names, and treating that as clean is how a guard becomes
decoration.`,
  ],
  "scripts/lib/pending-migrations.mjs#7": [
    "WHY",
    "why the whole output is the scope and why an unscoped match is safe here",
    `SCOPED-BY the whole command output, there being no narrower region: these markers are
wrangler's own sentinel sentences. The vacuity is handled by the design instead, since neither
marker matching means \`unreadable\` rather than clean, so an unscoped match can only ever
produce a MORE cautious verdict.`,
  ],
  "scripts/lib/pending-migrations.mjs#8": ["CONTRACT", "scope note; one line already"],
  "scripts/lib/pending-migrations.mjs#9": ["CONTRACT", "scope note; one line already"],
  "scripts/lib/pending-migrations.mjs#10": [
    "WHY",
    "why names win; one line",
    `NAMES WIN OVER THE CLEAN MARKER: if both appeared, the safe reading is that something is
pending, and resolving the ambiguity toward proceed would be choosing the outcome that ships.`,
  ],
  "scripts/lib/pending-migrations.mjs#11": [
    "WHY",
    "which unreadable case is worth naming",
    `Everything else is UNREADABLE, and the case worth naming is nothing matching at all: an empty
parse of changed output looks identical to a clean database.`,
  ],
  "scripts/lib/pending-migrations.mjs#12": [
    "WHY",
    "why the exact invocation; one line already",
    `The remedy sentence, with the database name filled in: a refusal that says "apply your
migrations" and makes the operator go looking is a refusal that gets worked around.

@param {string} database
@returns {string}`,
  ],
  "scripts/uptime-ensure.mjs#0": [
    "CONTRACT",
    "why an external monitor, why two, and the idempotency and contact rules; the measurements, the ids and the dates go to the history document",
    `Brings the external uptime monitors into step with this repo, idempotently.

  node scripts/uptime-ensure.mjs            create or update, write the manifest
  node scripts/uptime-ensure.mjs --dry-run  say what it would do, change nothing

WHY AN EXTERNAL MONITOR AT ALL: everything else watches this site from inside Cloudflare or
does not reliably run. This is the off-platform half, run by somebody else's computer.

TWO MONITORS, ANSWERING DIFFERENT QUESTIONS. The home page can be served from the edge cache
long after the Worker stops answering, so it proves REACHABILITY and is a weak liveness signal;
\`/api/health\` bypasses the cache and runs its checks, so it proves the Worker is ALIVE.

IDEMPOTENT, AND MATCHED BY URL RATHER THAN BY NAME, the URL being what makes two monitors the
same monitor; a friendly name is a label a human edits. The manifest is written from what the
API RETURNED, never from what this intended. THE ALERT CONTACT IS RESOLVED, NEVER INVENTED, and
an account with no active contact REFUSES rather than alerting nobody.

@see scripts/check-uptime.mjs the gate that refuses when this has not run
@see scripts/lib/uptimerobot.mjs the measured v3 contract`,
  ],
  "scripts/uptime-ensure.mjs#1": ["CONTRACT", "section marker, rule padding cut", `the alert contact`],
  "scripts/uptime-ensure.mjs#2": [
    "WHY",
    "why active only; one line",
    `ACTIVE EMAIL CONTACTS ONLY: an unconfirmed contact exists in the list and receives nothing, so
assigning one produces a monitor that alerts into a void while every panel says it is configured.`,
  ],
  "scripts/uptime-ensure.mjs#4": ["CONTRACT", "section marker, rule padding cut", `reconcile`],
  "scripts/uptime-ensure.mjs#7": [
    "WHY",
    "why the contact travels with every write",
    `THE ALERT CONTACT TRAVELS WITH EVERY WRITE, create and update alike: a monitor that lost its
contact is the silent-failure shape again, and re-asserting it costs nothing.`,
  ],
  "scripts/uptime-ensure.mjs#8": ["CONTRACT", "from the response; one line already"],
  "scripts/uptime-ensure.mjs#9": [
    "WHY",
    "why only the compared fields",
    `WHAT ACTUALLY DIFFERS, so a run that changes nothing says so: comparing the whole object would
report a difference every run, the API returning fields this program never sets.`,
  ],
  "scripts/uptime-ensure.mjs#11": [
    "WHY",
    "why resume is its own call; the API's refusal goes to the history document",
    `RESUMED SEPARATELY, because \`status\` is NOT writable through the update verb. A paused monitor
is one somebody switched off, and this program's whole job is that the two are on.`,
  ],
  "scripts/uptime-ensure.mjs#12": ["CONTRACT", "section marker, rule padding cut", `manifest`],
  "scripts/uptime-ensure.mjs#13": [
    "WHY",
    "why sorted and newline-terminated",
    `SORTED AND NEWLINE-TERMINATED, so a re-run that changed nothing is byte-identical and shows up
as no diff: a manifest that churned on key order would make every ship a spurious commit.`,
  ],
  "scripts/lib/mark.mjs#0": [
    "CONTRACT",
    "the seam and why no path data is stated here; the deleted harness and the session history go to the history document",
    `The site mark, as anything rendering it at build time embeds it.

ONE definition with TWO readers, and the second is the point: nothing in this repo looks at the
SHAPE of a rendered raster, so a satori or resvg upgrade that resampled the embedded svg would
pass every gate. This is a real seam rather than an export added for a test: the build builds
its card from \`markElement()\` and \`check:logo\` renders that same node against the fixture.

NO PATH DATA IS STATED IN THIS FILE. The mark's single source is the component the Worker
renders, and the four \`public/*.svg\` are the fixtures \`check:logo\` binds it to in both
directions. A Node script cannot import the .tsx without a build step, so it reads those
fixtures: the same source one hop along a link something else keeps honest.`,
  ],
  "scripts/lib/mark.mjs#1": ["CONTRACT", "what everything else is derived from; one line already"],
  "scripts/lib/mark.mjs#2": [
    "WHY",
    "why resolved and why the light block",
    `The brand fill, RESOLVED from app.css rather than restated. The light block is the one a card
takes: a card is rendered once and served into a feed with no idea which theme a reader prefers.`,
  ],
  "scripts/lib/mark.mjs#4": [
    "CONTRACT",
    "how the brand paths are derived and the four fail-closed conditions",
    `The mark, on brand surface, sized and framed for an embedded render.

WHICH PATHS ARE THE BRAND PATHS IS DERIVED, NOT LISTED: the light and dark fixtures are
identical except for the fills on the purple paths, so the paths whose fill DIFFERS are exactly
the ones that take a brand colour. Nothing here restates a hex or a path index.

It fails closed on every way the fixtures could stop agreeing: a different viewBox, a different
path count, differing geometry, or no differing fill at all, which would silently paint the mark
in asset colours.

@returns {Mark}`,
  ],
  "scripts/lib/mark.mjs#6": [
    "WHY",
    "why the header crop; one line",
    `The HEADER crop, because the band this sits in is the header: the square master would sit in a
taller band surrounded by its own whitespace.`,
  ],
  "scripts/lib/mark.mjs#7": [
    "WHY",
    "why the viewBox is padded to the box; the measured letterboxing and its date go to the history document",
    `SIZED FROM THE viewBox, AND THE viewBox PADDED TO THE BOX, never guessed. A width that is not
the viewBox's aspect times the height is a squashed mark and satori will not say so. The subtler
failure is measured: satori LAYS OUT at integer pixels and writes the embedded svg at the exact
aspect, so resvg letterboxes the difference and the mark renders fractionally short and off
centre, which is invisible and is enough to stop it matching the fixture pixel for pixel, which
is how this mark is now proved. So the CROP is padded symmetrically until its aspect is exactly
the integer box's: only the empty margin moves and no path is touched.`,
  ],
  "scripts/lib/mark.mjs#8": [
    "CONTRACT",
    "why JSX-free and what satori does with the node; the version measured goes to the history document",
    `The mark as one satori element node, JSX-free so no caller needs a build step.

satori takes an inline \`svg\` node and emits it as an \`<image>\` whose href is the same markup
URL-encoded, so the path data reaches resvg VERBATIM: no re-fitting, no simplification, no
reinterpretation of the arcs. Asserted by \`check:logo\` against a rasterisation of the fixture
rather than believed.

@param {Record<string, unknown>} [style] layout only. The caller owns where
  the mark sits; it does not own how the mark is drawn.
@returns {any}`,
  ],
  "scripts/build-stack.mjs#0": [
    "CONTRACT",
    "what is derived, from which config, and what deliberately is not; the ruling, its date and the published-claims count go to the history document",
    `Emits the colophon's STACK half from the repo's own configuration.

  npm run build:stack

The stack half of that page is DERIVABLE, so it is derived: bindings from the wrangler example,
pinned versions from package.json, migrations from \`drizzle/\`, gates from the \`check:*\`
scripts. A hand-written reference page goes wrong because manual regeneration means nobody
regenerates, and a page whose subject is what the site is built from is the densest surface for
that failure.

THERE IS NO LIST IN THIS FILE. A generator carrying its own copy is a mirror, and a mirror goes
stale in the direction that fails silently. The binding surface comes from the same enumerator
\`check:config\` uses, so a kind neither knows about is invisible to both rather than to one.

THE EXAMPLE CONFIG, NOT THE REAL ONE, which is gitignored: a generated artifact that only
regenerates on one machine is worse than none, and \`check:config\` keeps the example honest.

WHAT IS NOT DERIVED is the prose for each layer, which is a MEASUREMENT rather than a fact about
the config; \`check:stack\` reconciles the two in both directions.`,
  ],
  "scripts/build-stack.mjs#1": [
    "WHY",
    "why devDependencies are excluded",
    `The runtime dependencies worth naming, derived from \`dependencies\` rather than listed:
a colophon describes what SERVES the site, and the split is package.json's own.

@param {any} pkg`,
  ],
  "scripts/build-stack.mjs#2": [
    "WHY",
    "why the directory is read from the config",
    `Migrations, in applied order, from the directory D1 is pointed at, read out of the config's
\`migrations_dir\` rather than assumed, so a repo that moved them does not report zero.

@param {string} migrationsDir`,
  ],
  "scripts/build-stack.mjs#3": [
    "WHY",
    "why a set rather than a comparison; the date and the miscount go to the history document",
    `The \`check:\` scripts that RUN gates rather than being one. A named set rather than a
comparison, because the comment here already said "the runners" in the plural while the filter
compared against exactly one name, so the second one would have been counted as a gate.`,
  ],
  "scripts/build-stack.mjs#4": [
    "WHY",
    "one definition, and why derived at all; the date goes to the history document",
    `Every gate, derived from package.json's \`check:*\` scripts. ONE DEFINITION, imported by
\`check-all.mjs\` rather than restated there: two derivations of one rule agree until the day one
gains a case. A hardcoded list is how the next gate gets forgotten.

@param {any} pkg`,
  ],
  "scripts/build-stack.mjs#5": ["CONTRACT", "why stable; one line already"],
  "scripts/build-stack.mjs#6": ["CONTRACT", "reconciled both directions; one line already"],
  "scripts/build-stack.mjs#7": [
    "CONTRACT",
    "what the version means; one line already",
    `Bumped when the SHAPE of this file changes, so a consumer written against an older shape fails
loudly rather than reading undefined.`,
  ],
  "scripts/build-stack.mjs#8": ["CONTRACT", "what the entries are; one line already"],
  "scripts/build-stack.mjs#9": [
    "WHY",
    "why pathToFileURL; the Windows measurement goes to the history document",
    `\`pathToFileURL\` rather than string surgery: on Windows the hand-built form never equals
\`import.meta.url\`, so the generator silently did nothing when run directly.`,
  ],
  "scripts/check-search.mjs#0": [
    "CONTRACT",
    "the boundary and the paired-negative rule; the worked example goes to the history document",
    `Gate for the query parser and rank fusion.

  npm run check:search

BOUNDARY: pure functions only, the parser and the fusion. It runs no SQL, so it cannot see an
index that is empty, drifted, or tokenising differently from what the parser assumes. It imports
the parser the Worker actually runs rather than a restatement of its rules.

EVERY RULE HAS A PAIRED NEGATIVE: a rule that has only ever been seen matching has not been
verified, because a rule that fires on everything passes every positive test there is.`,
  ],
  "scripts/check-search.mjs#4": ["CONTRACT", "why fixed; one line already"],
  "scripts/check-search.mjs#5": ["CONTRACT", "section marker, rule padding cut", `Rule 1: quoted phrases`],
  "scripts/check-search.mjs#6": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#7": [
    "CONTRACT",
    "the negative and the ordering it forces; one line",
    `NEGATIVE: an operator inside quotes stays literal text, which is why the phrase rule runs first.`,
  ],
  "scripts/check-search.mjs#8": ["CONTRACT", "section marker, rule padding cut", `Rule 2: field operators`],
  "scripts/check-search.mjs#9": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#10": ["CONTRACT", "section marker, rule padding cut", `Rule 3: bare year`],
  "scripts/check-search.mjs#11": [
    "WHY",
    "why this negative matters most",
    `NEGATIVE, and the one that matters most: a four-digit number outside the corpus range is a
search term, and without this a query of one would filter every result away and read as a broken
site.`,
  ],
  "scripts/check-search.mjs#12": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#13": [
    "CONTRACT",
    "the negative and its ordering; one line",
    `NEGATIVE: ordering. A tag that looks like a year is a tag, because the operator rule consumed it.`,
  ],
  "scripts/check-search.mjs#14": ["CONTRACT", "section marker, rule padding cut", `Empty and filter-only queries`],
  "scripts/check-search.mjs#15": ["CONTRACT", "section marker, rule padding cut", `MATCH expression building`],
  "scripts/check-search.mjs#16": ["CONTRACT", "why everything is quoted; one line already"],
  "scripts/check-search.mjs#17": ["CONTRACT", "section marker, rule padding cut", `Rank fusion`],
  "scripts/check-search.mjs#18": [
    "CONTRACT",
    "the property RRF exists for; one line already",
    `A document ranked second in BOTH lists beats one ranked first in only one, which is the point
of RRF and why the two indexes can disagree without one dominating.`,
  ],
  "scripts/check-search.mjs#19": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#20": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#21": [
    "CONTRACT",
    "section marker plus the pair of facts it pins; the live finding and its date go to the history document",
    `Rule: the browse path, filters with nothing to match on. A bare year leaves no text, so the
expression builder returns null and the index path has nothing to run: these pin the pair a
caller has to act on, that there is no MATCH expression AND that there is still a query.`,
  ],
  "scripts/check-search.mjs#22": ["CONTRACT", "what the parameter form renders; one line already"],
  "scripts/check-search.mjs#23": ["CONTRACT", "the negative; one line already"],
  "scripts/check-search.mjs#24": ["CONTRACT", "what an out-of-range number is; one line already"],
  "scripts/check-search.mjs#25": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-search.mjs#26": [
    "NUMBER",
    "what a loose floor cannot catch and how this one was measured; the old value, the dates and the sibling gates go to the history document",
    `EXECUTED-COUNT FLOOR. The old value caught a run that did NOTHING and could not catch the
failure that actually happens, which is partial: it left a third of this gate free to stop
running while reporting itself satisfied. MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING
it, never summed, and floored close, since every assertion is a pure case over inline fixtures
and the count moves only when a case is written.`,
  ],
  "scripts/build-guidelines.mjs#0": [
    "CONTRACT",
    "why the strip stays and the discard goes, what is dropped and why the cap is loud; the ruling, the quoted lines and the shipped defect go to the history document",
    `Extract the stylesheets' reasoning into guidance the canvas can read.

THE DEFECT: the bundle strips CSS comments on the way to the design canvas, and one of the
stripped comments was a warning not to simplify a deliberately specific selector. The redesign
simplified it away and shipped a wordmark in the wrong colour, because the canvas never saw it.

THE STRIP STAYS: it exists for its own measured reason, the converter's validator greping the
bundle for \`@import\` without stripping comments, which a stylesheet's prose about a removed
\`@import\` failed twice. The repair is not to stop stripping, it is to stop DISCARDING, and this
is where the reasoning goes instead.

IT IS NOT A GATE AND MAKES NO ASSERTION. Output is gitignored, a committed copy being a second
owner of prose the stylesheets already own (hard rule 17).

WHAT IT DOES NOT SHIP: build-only narration, which tells a design agent nothing and spends the
budget the rules it CAN break need. A block is dropped when it reads as build talk and carries
no design signal, never on the build needle alone.

THE CAP IS HONEST RATHER THAN SILENT: blocks are emitted strongest first and anything that does
not fit is NAMED with its source and line, a truncation nobody can see being the same class of
defect as a search over an empty scope.`,
  ],
  "scripts/build-guidelines.mjs#1": ["CONTRACT", "what the cap is; one line already"],
  "scripts/build-guidelines.mjs#2": ["CONTRACT", "what the floor separates; one line already"],
  "scripts/build-guidelines.mjs#3": [
    "CONTRACT",
    "why the order decides placement",
    `The four destinations, in priority order: a block lands in the FIRST file whose needles it
hits, so this order decides where an overlapping block goes.`,
  ],
  "scripts/build-guidelines.mjs#4": [
    "WHY",
    "why a design needle wins",
    `Build talk. Present on its own a block is dropped; present alongside a design needle the design
needle wins, because a comment often explains a design rule BY naming the gate that holds it.`,
  ],
  "scripts/build-guidelines.mjs#6": [
    "WHY",
    "why the singletons are described and why the mapping is hand-written; the quoted note and the redesign go to the history document",
    `The page singletons: real parts of the site the sync cannot ship as components, described so
the canvas at least knows what they ARE. They are excluded from the component sync because
nothing there is composable, which is true about INSTANTIATION and says nothing about
visibility. The component-to-sheet mapping is HAND-WRITTEN, because nothing in the repo declares
it: a sheet does not name the component it styles.`,
  ],
  "scripts/build-guidelines.mjs#7": [
    "WHY",
    "which sheet and what the wrong one would have sent; the rename and the date go to the history document",
    `The footer's sheet, not the chrome one: it was renamed and moved sheets, so mapping it there
would have sent the canvas the HEADER's tokens as the footer's.`,
  ],
  "scripts/build-guidelines.mjs#8": [
    "WHY",
    "why hand-written; one line",
    `HAND-WRITTEN: the rulings that bind the singletons cannot be derived from the source, the code
carrying a ruling's effect rather than its authority.`,
  ],
  "scripts/build-guidelines.mjs#9": [
    "CONTRACT",
    "what it reads and why; one line already",
    `A module's leading doc comment: the reasoning a component carries about itself, which the
stylesheet extractor never sees because it reads only CSS.

@param {string} source`,
  ],
  "scripts/build-guidelines.mjs#10": [
    "CONTRACT",
    "what it returns; one line already",
    `Literal className values, which are the vocabulary the canvas composes with.

@param {string} source`,
  ],
  "scripts/build-guidelines.mjs#11": [
    "CONTRACT",
    "what it returns; one line already",
    `Every custom property a sheet READS, which is what the singleton consumes.

@param {string} css`,
  ],
  "scripts/build-guidelines.mjs#13": ["CONTRACT", "what the shortlist is for; one line already"],
  "scripts/lib/page-payload.mjs#0": [
    "CONTRACT",
    "why derived, from which two sources, and what the walk cannot see",
    `What a cold load of one public route actually fetches, resolved offline.

Split out of the gate because the DECISION is a pure function over a manifest and a set of
source files, and a pure function can be driven by tests. The gate supplies the disk.

WHY DERIVED AND NOT DECLARED: a hand-kept list goes stale in the direction that hides bytes from
the gate. STYLESHEETS come from React Router's own browser manifest, root's plus the route's,
which is what the document carries. ENHANCEMENT BUNDLES come from a reachability walk over the
route's import graph, following \`~/\` and relative imports inside \`app/\`.

WHAT THE WALK CANNOT SEE, stated because it bounds every count: reachability is not rendering,
so a bundle imported inside a branch the route never takes still counts, which over-approximates
in the safe direction for a ceiling. Nor can it see a bundle fetched at runtime rather than
imported, which is correctly not part of any page's cold load.`,
  ],
  "scripts/lib/page-payload.mjs#1": [
    "CONTRACT",
    "what it returns; one line already",
    `Module specifiers a source file imports, normalised to absolute paths inside \`app/\`, plus the
raw \`?url\` specifiers, which are assets rather than modules.

@param {string} source @param {string} file @param {string} appDir`,
  ],
  "scripts/lib/page-payload.mjs#4": [
    "WHY",
    "why an import is not a fetch and which component decides; the named module goes to the history document",
    `A \`?url\` IMPORT IS NOT A FETCH, and conflating the two was this walk's first bug: a component
imports the palette bundle's URL so it can put it on a data attribute, and a gesture fetches it,
so counting the import made every route look like it served a search dialog. What puts a bundle
on a page is the component that renders the script tag, so an \`enhance/dist\` asset counts only
when the file naming it also renders that component. Every other \`?url\` asset is collected
unconditionally and the callers filter.`,
  ],
  "scripts/lib/page-payload.mjs#5": [
    "CONTRACT",
    "cycle safety and why an unresolved specifier is skipped",
    `Every \`?url\` asset specifier reachable from \`entry\`, following imports inside \`app/\`.
Cycle-safe by construction, and a specifier that resolves to nothing is SKIPPED rather than
thrown on, the walk deliberately not knowing about node_modules or the vite alias table.

@param {string} entry absolute path to a route or root module
@param {string} appDir
@param {(path: string) => string | null} read returns source or null`,
  ],
  "scripts/lib/page-payload.mjs#8": [
    "CONTRACT",
    "what it resolves; one line already",
    `A specifier to a real file, trying the extensions a TypeScript project omits.

@param {string} path @param {(path: string) => string | null} read`,
  ],
  "scripts/lib/page-payload.mjs#9": [
    "CONTRACT",
    "why the order is the manifest's",
    `The stylesheets a route's document links, root's first then its own. The order is the
manifest's: root is the parent match, which is the cascade the site depends on since the split.

@param {any} manifest React Router's browser manifest
@param {string} routeId`,
  ],
  "scripts/lib/page-payload.mjs#10": ["CONTRACT", "why deduplicated; one line already"],
  "scripts/lib/page-payload.mjs#11": [
    "WHY",
    "why only @font-face",
    `Font files a set of stylesheets reference from \`@font-face\`, deliberately only there: a
\`url()\` elsewhere is fetched only if something matches, while a face is fetched whenever the
family is used, which on this site is every page.

@param {string[]} cssText`,
  ],
  "scripts/operator-roundtrip.mjs#0": [
    "CONTRACT",
    "why two phases, the token rule, what it checks against and the dash fixture",
    `The operator publish round trip, run against a deployed Worker.

  node scripts/operator-roundtrip.mjs a          steps 1 and 2
  node scripts/operator-roundtrip.mjs b          steps 3 to 9

Two phases because step 3 is a HUMAN action: the first publication of a post is reserved to the
admin, so the round trip cannot be driven end to end by the thing it is testing, which is the
point of the test.

The token is read from a file named by an environment variable and is never printed, logged or
included in an error. Every assertion that matters is checked against GitHub and the public
surfaces, never against the API's own report: an endpoint saying "created" is not evidence that
a commit exists.

THE DASH FIXTURE is built from its CODE POINT rather than typed, so this file contains no wide
dash of its own and stays clean under the house rule.`,
  ],
  "scripts/operator-roundtrip.mjs#1": ["CONTRACT", "what it is; one line already"],
  "scripts/operator-roundtrip.mjs#4": [
    "CONTRACT",
    "what it calls and the logging rule; one line already",
    `Calls one operator tool. Never logs the Authorization header.

@param {string} name
@param {Record<string, unknown>} [args]
@returns {Promise<{status: number, body: any}>}`,
  ],
  "scripts/operator-roundtrip.mjs#8": [
    "CONTRACT",
    "what it asks; one line already",
    `Is the slug visible anywhere a reader or an agent would find it?

@returns {Promise<Record<string, any>>}`,
  ],
  "scripts/operator-roundtrip.mjs#10": [
    "WHY",
    "why whole-document scope and why one loop",
    `SCOPED-BY the whole document on all six surfaces, deliberately: a slug present ANYWHERE on an
index, a feed or a manifest is exactly the propagation being asserted. Collapsed into one loop
so there is ONE assertion site to annotate, \`check:assertions\` reading one line up.`,
  ],
  "scripts/operator-roundtrip.mjs#12": ["CONTRACT", "scope note; one line already"],
  "scripts/operator-roundtrip.mjs#13": [
    "WHY",
    "why the search assertion is narrowed",
    `Scope the search assertion to the results themselves: the zero state renders a recent-writing
list carrying the same links, so a page-wide match would pass against a zero-result page.`,
  ],
  "scripts/operator-roundtrip.mjs#15": ["CONTRACT", "section marker, rule padding cut", `1. Operator creates a draft`],
  "scripts/operator-roundtrip.mjs#16": ["CONTRACT", "section marker, rule padding cut", `verified against GitHub, not against the API's own report`],
  "scripts/operator-roundtrip.mjs#19": [
    "WHY",
    "what a second file in a save commit would mean; the artifact arc goes to the history document",
    `INVERTED with the artifact arc: git holds markdown only now, so a second file in a save commit
is a regression to the two-writer world.`,
  ],
  "scripts/operator-roundtrip.mjs#20": ["CONTRACT", "section marker, rule padding cut", `D1 row and draft exclusion`],
  "scripts/operator-roundtrip.mjs#21": ["CONTRACT", "section marker, rule padding cut", `2. The refusal, which is a required pass`],
  "scripts/operator-roundtrip.mjs#22": ["CONTRACT", "section marker, rule padding cut", `3. The human published it`],
  "scripts/operator-roundtrip.mjs#23": ["CONTRACT", "section marker, rule padding cut", `4. Operator edits the live post`],
  "scripts/operator-roundtrip.mjs#24": ["CONTRACT", "why the needle is a whole sentence; one line already"],
  "scripts/operator-roundtrip.mjs#25": ["CONTRACT", "section marker, rule padding cut", `5. Unpublish, then republish`],
  "scripts/operator-roundtrip.mjs#26": ["CONTRACT", "section marker, rule padding cut", `6. Forgery`],
  "scripts/operator-roundtrip.mjs#27": ["CONTRACT", "section marker, rule padding cut", `7. Wide dash`],
  "scripts/operator-roundtrip.mjs#28": ["CONTRACT", "section marker, rule padding cut", `8. Rate limit, CONCURRENT`],
  "scripts/operator-roundtrip.mjs#29": [
    "WHY",
    "why concurrent; the measured sequential run goes to the history document",
    `Sequential is the recorded trap: a sequential burst against the same limit produced ZERO
refusals, the loop straddling the window boundary, which reads exactly like a dead limiter.`,
  ],
  "scripts/operator-roundtrip.mjs#32": ["CONTRACT", "section marker, rule padding cut", `9. Delete`],
  "scripts/operator-roundtrip.mjs#33": [
    "WHY",
    "why the wait; one line already",
    `The burst may have consumed the window, so wait it out rather than reporting a rate-limit
refusal as a delete failure.`,
  ],
  "scripts/check-llms.mjs#0": [
    "CONTRACT",
    "the boundary, the three assertions and the fail-closed rule; the stale row, the drifted copy and the byte counts go to the history document",
    `Gate: \`content/llms.txt\` is the source of truth for the \`llms.txt\` settings row.

  npm run check:llms                 pure checks only
  npm run check:llms -- --local      also compare against the local D1 row
  npm run check:llms -- --remote     also compare against the remote D1 row

BOUNDARY: it compares the committed file against the row it seeds, and does not fetch
\`/llms.txt\`, so it cannot see the route failing to serve what the row holds.

WHY THIS EXISTS: the only thing that ever wrote that row was the initial migration, seeding copy
later retired, so a rebuilt site would have served a stale llms.txt with nothing to notice. The
route carried a second copy too, which had already drifted by its line endings alone, so the
site served different bytes depending on whether the row existed.

  1. the tracked file exists, is non-empty, and is LF-only
  2. the route does not carry its own copy: it imports the file
  3. with --local or --remote, the D1 row is byte-identical to the file

FAILS CLOSED on a missing file, an unparseable result or a wrangler failure.`,
  ],
  "scripts/check-llms.mjs#3": [
    "WHY",
    "why bytes and an explicit decode; one line already",
    `Read as BYTES and decode explicitly: this file is compared byte for byte and the platform text
layer is not UTF-8 on this host.`,
  ],
  "scripts/check-llms.mjs#4": ["CONTRACT", "section marker, rule padding cut", `1. the file itself`],
  "scripts/check-llms.mjs#5": ["WHY", "the anti-vacuity rule; one line already"],
  "scripts/check-llms.mjs#6": ["CONTRACT", "section marker, rule padding cut", `2. the route does not keep its own copy`],
  "scripts/check-llms.mjs#7": [
    "CONTRACT",
    "what shape is refused; one line already",
    `The specific shape that rotted: a multi-line template literal holding the document. One line is
fine; sixty is the bug.`,
  ],
  "scripts/check-llms.mjs#8": ["CONTRACT", "section marker, rule padding cut", `3. the D1 row`],
  "scripts/check-llms.mjs#9": [
    "WHY",
    "why retried once; the error code and the occurrences go to the history document",
    `RETRIED ONCE: remote D1 reads have failed transiently and been clean immediately after. Read
only.`,
  ],
  "scripts/check-llms.mjs#11": [
    "NUMBER",
    "why slack of zero and why one floor covers both tiers; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed.
Slack of ZERO, and the zero is the point: this gate is SMALL, so one skipped assertion is a
sixth of it and there is no natural movement to absorb. The remote tier only ADDS a comparison,
so a floor set on the offline figure holds for both.`,
  ],
  "scripts/check-llms.mjs#12": [
    "WHY",
    "what the binding is for and what is deliberately not checked; the wrong host goes to the history document",
    `THE CONTACT URL IS BOUND TO SITE_ORIGIN, in both directions. A tracked literal cannot import
anything, so its contact line was typed by hand and pointed the one machine-readable file whose
whole audience is crawlers at a host this site is not served from. The gate is the binding a
literal file cannot express, and at DNS cutover it goes red until llms.txt follows, which is the
point. The heading is deliberately NOT checked: it is the site's NAME, not a claim about where
anything is served from.`,
  ],
  "scripts/check-llms.mjs#13": [
    "NUMBER",
    "why named per branch even with one value; the two readings and their date go to the history document",
    `NAMED PER BRANCH even though one VALUE covers both, the offline figure being the stricter of
the two and kept for both: a single name would let whichever branch ran last be judged against
the other's reading.`,
  ],
  "scripts/ae-probe.mjs#0": [
    "CONTRACT",
    "the question, the three fetches, the weighting rule and the observation boundary; the file and line references go to the history document",
    `Does a CACHED serve reach the Worker, and therefore Analytics Engine?

  npm run ae-probe

With the platform cache on, an edge HIT may never invoke the Worker, in which case the traffic
panel is counting ORIGIN REQUESTS rather than reads and has to say so. It needs a read-only
analytics token, fails closed without it, and NEVER PRINTS THE TOKEN, any request header, or any
URL carrying a credential.

METHOD. Three fetches, each followed by its own poll, so a point is attributable to the fetch
that caused it: a plain GET to warm the edge, a second expected to HIT, and one sent with the
bypass header. The first exists because a cache-eligible fetch that MISSES reaches the origin by
definition and proves nothing; only the second answers the question. THE BYPASS MECHANISM IS NOT
INVENTED HERE, it is read from the live gate.

EVERY COUNT IS SAMPLING WEIGHTED, the documented way to count events, because a raw count
silently undercounts the moment sampling engages; the row count is carried as a diagnostic.

BOUNDARY: the write is fire and forget and a throw is swallowed, so a point that APPEARS is
strong evidence the Worker ran while one that does NOT is weaker evidence that it did not. The
report states that ambiguity whenever a fetch produces no point.`,
  ],
  "scripts/ae-probe.mjs#1": [
    "WHY",
    "why both are read rather than written here; the date goes to the history document",
    `NEITHER OF THESE IS WRITTEN OUT HERE. The origin is imported from its one owner, a second copy
being the one that goes stale at the DNS cutover and then probes a host nobody is serving. The
account id is read off the environment and refused if absent, on the portfolio rule that
account-scoped identifiers stay out of git: an identifier rather than a credential, which is why
it is a config var and not a secret, and \`check:config\` refuses to find it anywhere tracked.`,
  ],
  "scripts/ae-probe.mjs#2": ["NUMBER", "stated rather than implied; one line already"],
  "scripts/ae-probe.mjs#3": ["NUMBER", "what counts as settled; one line already"],
  "scripts/ae-probe.mjs#4": [
    "CONTRACT",
    "what it runs; one line already",
    `Runs one read-only statement against the SQL API.

@param {string} query
@returns {Promise<Array<Record<string, unknown>>>}`,
  ],
  "scripts/ae-probe.mjs#5": ["WHY", "why the echo is safe; one line already"],
  "scripts/ae-probe.mjs#6": [
    "CONTRACT",
    "what it returns; one line already",
    `Sampling-weighted origin requests for PATH, plus the raw row count.

@returns {Promise<{ weighted: number, rows: number }>}`,
  ],
  "scripts/ae-probe.mjs#7": [
    "CONTRACT",
    "why the baseline settles first; one line already",
    `Polls until the weighted count settles, so the experiment does not start mid flight.

@returns {Promise<{ weighted: number, rows: number, waited: number }>}`,
  ],
  "scripts/ae-probe.mjs#8": [
    "CONTRACT",
    "what one fetch does; one line already",
    `One fetch. \`bypass\` sends the verify-live no-cache header.

@param {string} label
@param {boolean} bypass
@returns {Promise<string>} the cf-cache-status`,
  ],
  "scripts/ae-probe.mjs#10": [
    "CONTRACT",
    "what it waits for; one line already",
    `Polls until the weighted count rises above \`from\`, or the cap elapses.

@param {number} from
@returns {Promise<{ weighted: number, rows: number, lag: number | null }>}`,
  ],
  "scripts/lib/decisions-volumes.mjs#0": [
    "CONTRACT",
    "why the limit is read, why the highest number is the signal and why history is not checked; the volumes, the byte counts and the dates go to the history document",
    `WHICH DECISIONS VOLUME IS ACTIVE, AND HAS IT PASSED ITS OWN FREEZE POINT. Pure, so the replay
proof can drive it without a network; the fetching lives in the gate.

THE DEFECT: every volume's header states its own limit, and one ran well past it for days.
Nothing gated it, the limit being a sentence inside the artifact it limited, enforced by whoever
happened to read it.

THE LIMIT IS READ, NEVER HARD-CODED, hard rule 17: the number lives in the volume that owns it,
this parses it, and a volume that wants a different limit says so in its own header.

"ACTIVE" IS THE HIGHEST NUMBER, NOT THE TITLE, AND THAT IS MEASURED: volumes frozen for days
still carry "(active)" in their titles, and the platform's own status field is no better. A
title is a written record read as a current property. The highest number is true by
construction, a new volume being opened by taking the next one.

Everything below the highest is history and is NOT checked: failing on a frozen volume over its
limit would red the gate forever over something nobody can now change.`,
  ],
  "scripts/lib/decisions-volumes.mjs#1": [
    "CONTRACT",
    "why stated once; one line already",
    `KB as 1024 bytes. Stated once, here, because two readings of "KB" would be two owners of the
threshold.`,
  ],
  "scripts/lib/decisions-volumes.mjs#2": [
    "CONTRACT",
    "what is matched and what is not; one line already",
    `\`decisions-vol-<n>.md\`. The unnumbered volume is long frozen, is not matched, and cannot be
the highest number.`,
  ],
  "scripts/lib/decisions-volumes.mjs#3": [
    "CONTRACT",
    "what it returns; one line already",
    `The limit a volume states for itself.

@param {string} body
@returns {number | null} bytes, or null when the volume states no limit`,
  ],
  "scripts/lib/decisions-volumes.mjs#4": [
    "WHY",
    "why anchored on the words; the two spellings go to the history document",
    `Anchored on the words, not on the emphasis: two volumes write the phrase with different markup
around it, and matching that would make the gate care about styling, which is the kind of needle
that silently stops matching.`,
  ],
  "scripts/lib/decisions-volumes.mjs#5": [
    "CONTRACT",
    "the returned shape; type annotation only",
    `@param {Array<{path: string, title?: string, body: string}>} docs
@returns {{
  volumes: Array<{path: string, n: number, bytes: number}>,
  active: {path: string, n: number, bytes: number, limit: number | null} | null,
  staleTitles: string[],
}}`,
  ],
  "scripts/lib/decisions-volumes.mjs#6": [
    "WHY",
    "why reported rather than failed; the count goes to the history document",
    `REPORTED, NOT FAILED. A volume below the top that still says "(active)" is a stale title, and
failing on it would red the gate over history nobody is going to retitle; naming them is how the
next reader learns the titles cannot be trusted.`,
  ],
  "scripts/lib/decisions-volumes.mjs#7": [
    "WHY",
    "why the looser anchor; the counts it moved go to the history document",
    `The looser word boundary rather than the exact parenthesis: four volumes are titled with a word
after "active", and the tighter needle missed all of them, which is hard rule 10's
anchor-every-needle discipline arriving as a number.`,
  ],
  "scripts/health-repair.mjs#0": [
    "CONTRACT",
    "the two exit codes, why one re-poll and the token rule; the Windows measurement and the dates go to the history document",
    `SELF-REPAIR FOR A FAILING HEALTH RUN. The I/O half.

  node scripts/health-repair.mjs --origin <origin> --body body.json

Called by the health workflow when \`/api/health\` reports unhealthy. Decides through the shared
decision module, performs the repairs that decision allows, re-polls ONCE, and exits.

EXIT CODES ARE THE ALERT: 0 means something drifted, this repaired it and the re-poll came back
healthy; 1 means a person is emailed. There is no third state.

**\`process.exitCode\`, NEVER \`process.exit()\`**, measured: exiting immediately after a fetch
terminated node with a Windows exception rather than with the code, because the exit raced the
socket teardown, and an exit code nobody can explain is a bad thing to hand a monitor.

ONE RE-POLL, NOT A LOOP. Both repairs derive their own converged verdict, so a successful call
has ALREADY proved the index agrees; the re-poll confirms the endpoint agrees too. A loop would
be a monitor arguing with itself. Ship polls because it reads counts back within milliseconds of
an upload; this runs at least one scheduled interval later.

THE TOKEN is read from the environment, never logged, never an argument, and its ABSENCE is
reported as a named configuration state rather than as a failure to repair.`,
  ],
  "scripts/health-repair.mjs#2": ["CONTRACT", "what it renders as; one line already"],
  "scripts/health-repair.mjs#4": [
    "CONTRACT",
    "what the two fields mean; one line already",
    `One repair call.

@returns {Promise<{ miss: string, unrepairable: boolean }>} \`miss\` is empty
when the tool converged. \`unrepairable\` marks a refusal that repeating this
call cannot fix, which is a different thing from a repair that did not work.`,
  ],
  "scripts/health-repair.mjs#8": [
    "WHY",
    "why the rule lives in the decision module",
    `The server's own sentence and the status rule both live in the decision module, because the
watchdog makes the identical call and the two copies of this had already drifted.`,
  ],
  "scripts/health-repair.mjs#9": ["CONTRACT", "the verdict is read; one line already"],
  "scripts/health-repair.mjs#10": ["CONTRACT", "what main returns; type annotation only"],
  "scripts/health-repair.mjs#11": [
    "WHY",
    "why a refusal abandons the rest; the date and the two refusals go to the history document",
    `A REFUSAL ABANDONS THE REST OF THE PLAN: the Ask upload reads the store the content repair
rewrites, so when the content repair REFUSED the store is not merely stale, it is known-stale,
and uploading it is a write made on a premise the previous call just denied.`,
  ],
  "scripts/health-repair.mjs#12": [
    "CONTRACT",
    "what the re-poll adds; one line already",
    `THE RE-POLL. The repair proved its own index; this proves the ENDPOINT is healthy, which is a
wider claim and the one the workflow reports on.`,
  ],
};
