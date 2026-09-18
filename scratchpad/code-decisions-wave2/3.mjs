// Chunk 3: scripts/check-page-payload.mjs, blocks 0-100.
//
// This gate's comments are mostly DATED MEASUREMENTS with a short argument attached: eleven
// blocks open with "MEASURED <date> through this gate on a fresh build" and then say why the
// ceiling is the number it is. Rule 17 puts the measurement in the dated record and leaves the
// argument beside the constant, so the cut here is large and mechanical: every ceiling is
// asserted by the code directly underneath its own comment.
//
// The second cut is bigger and was missed on the first pass. Several blocks RESTATE THE
// ASSERTIONS BELOW THEM as a table (what it resolves, what it refuses, four things are
// asserted). A list of what the code does is not a why, it is a second copy of the code that
// can disagree with it, and this file's own header cites rule 17 against exactly that. What
// stays from each table is the half no reader can derive: which assertions are a PAIR and why.
//
// Nothing is deleted outright. Every block carries a why under the measurement, which is the
// shape wave 1's review said not to cut.
export default {
  "scripts/check-page-payload.mjs#0": [
    "CONTRACT",
    "the boundary, the byte-equality rule and the syntax pass; both rename narratives and the dated plant cut",
    `Gate: what a reader downloads to see a public page, per route, with ceilings.

  npm run check:page-payload

OBSERVATION BOUNDARY: it reads the BUILD ON DISK and never builds, so against a stale build it
certifies the stale build, exactly as \`npm run deploy\` would ship it. It cannot see a RENDERED
page either: that half is check:browser against the preview and verify-live against the wire.

The enhancement assets are matched by BYTE EQUALITY against app/enhance/dist/ and never by
name, because a Vite hash may itself contain a dash; exactly one match is required, in both
directions.

Every .js asset is run through \`node --check\`, an instrument independent of the bundler that
produced it, because a ?url import pointed at the .ts SOURCE ships raw TypeScript that parses
nowhere.`,
  ],
  "scripts/check-page-payload.mjs#1": ["WHY", "the comment-satisfies-a-gate trap; two lines already"],
  "scripts/check-page-payload.mjs#2": ["WHY", "why the resolution is a pure module; two lines already"],
  "scripts/check-page-payload.mjs#3": [
    "NUMBER",
    "the ceilings are the constants below; the four dated bundle measurements go to the history document",
    `CEILINGS AND FLOORS. The only copies of these numbers, rule 17.

Margins are roughly fifty percent over measured: wide in relative terms because the bundles
are tiny, tight in absolute terms because the job is catching a dependency wandering in. The
palette carries ask inlined, so a growth in ask moves palette too and the ceilings absorb it.

A module missing from this map fails: a new enhancement arrives with its own measured ceiling
in the same commit, or not at all.

@type {Record<string, number>}`,
  ],
  "scripts/check-page-payload.mjs#4": [
    "NUMBER",
    "the floor is the constant below; the dated re-measurement goes to the history document",
    `Floor on the manifest walk: a walk that reads fewer files than this has lost a route or gone
vacuous, not gotten lean.`,
  ],
  "scripts/check-page-payload.mjs#5": ["WHY", "one line already; kept"],
  "scripts/check-page-payload.mjs#7": [
    "CONTRACT",
    "why stems and why the pattern anchors on the extension; the example spelling kept because it is the doc",
    `A chunk name with its content hash stripped: \`entry.client-DvLiibbQ.js\` becomes
\`entry.client\`.

Exported for verify-live, which compares the DEPLOYED page's script set to the enhancement
set. Stems rather than full names, because a standalone run may face a deploy whose hashes
predate this disk's build, and that is staleness rather than a payload defect. A Vite hash may
itself contain a dash, so the pattern anchors on the extension.

@param {string} name`,
  ],
  "scripts/check-page-payload.mjs#9": ["CONTRACT", "the fail-closed enumeration; already short"],
  "scripts/check-page-payload.mjs#11": [
    "CONTRACT",
    "the three minified spellings, which is why the regexes look the way they do",
    `Static import specifiers of one built chunk, as sibling filenames.

Minified output writes \`from"./x.js"\`, bare \`import"./x.js"\` and dynamic \`import("./x.js")\`,
any of the three quote characters.

@param {string} source
@returns {{ static: string[], dynamic: string[] }}`,
  ],
  "scripts/check-page-payload.mjs#14": ["WHY", "what the lookbehind refuses; two lines already"],
  "scripts/check-page-payload.mjs#15": [
    "CONTRACT",
    "what the set is and why it survives; the tense-bound 'no public page references it any more' made plain",
    `Every JS chunk statically reachable from the client entry, the root module and the
blog.$slug route module.

The set the framework WOULD hand a hydrating page, kept as a structural floor on the manifest
and for verify-live's stem comparison. No public page references it; the admin plane and
/login do.

@returns {{ files: string[], dynamicTargets: Set<string>, manifestFile: string }}`,
  ],
  "scripts/check-page-payload.mjs#18": ["WHY", "why the walk re-closes transitively; two lines already"],
  // Kept byte-identical rather than trimmed: its @returns line is already at the 110-column
  // limit, and the type cannot wrap without the JSDoc head resolving to a bare @returns.
  "scripts/check-page-payload.mjs#21": ["CONTRACT", "the byte-equality rule and what verify-live reads; already short"],
  "scripts/check-page-payload.mjs#23": [
    "WHY",
    "the one-walker discipline and what two copies drift into; the hoist date goes to the history document",
    `Every source file under one directory, recursively.

ONE WALKER, ONE ARGUMENT ORDER. Two inline copies of a recursive walk is the shape the
helper-signature line of hard rule 10 names: they agree until one gains an extension and the
other silently stops reading it.

@param {string} dir
@returns {string[]} absolute paths`,
  ],
  "scripts/check-page-payload.mjs#25": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#26": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#27": [
    "WHY",
    "why the sweep is not .js-only; the measurement date goes to the history document",
    `.ts AND .tsx TOO, not only .js: the plant that motivated this pass produces one, a ?url import
pointed at a .ts source emitting the raw source as \`<name>-<hash>.ts\`, so a .js-only sweep
would grade every healthy asset and skip the defective one. A TypeScript extension under
assets/ is refused outright below, since no browser parses it whatever its content.`,
  ],
  "scripts/check-page-payload.mjs#29": ["WHY", "why the copy is .mjs; two lines already"],
  "scripts/check-page-payload.mjs#30": ["WHY", "why the Error line and not a tail slice; two lines already"],
  "scripts/check-page-payload.mjs#31": [
    "WHY",
    "why this floor is outside the floors mechanism; the dated 78-against-15 reading goes to the history document",
    `DELIBERATELY NOT an \`assertFloor\`, and the reason is what the number is. It counts BUILT
CHUNKS rather than assertions this gate executed: a SCOPE floor in the sense of hard rule 10,
proving the syntax pass below has something to examine. The count is a property of the
bundler's splitting on the day, so pinning it near whatever it reads today would fail every
build that emits fewer, and \`check:floors\` would read that gap as drift. It stays out of that
mechanism rather than taking a tolerance wide enough to mean nothing.`,
  ],
  "scripts/check-page-payload.mjs#32": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#33": [
    "CONTRACT",
    "what the set is pinned to and where a public route fails first; the derivation is the code below",
    `The hydrating routes are read out of the route files, comments stripped, and pinned to
exactly admin.tsx (which covers its children) and login.tsx. A public route gaining the flag
fails HERE, by name, before check:browser has to notice the framework riding back onto a
reading page.`,
  ],
  "scripts/check-page-payload.mjs#34": [
    "CONTRACT",
    "the window and the strip rule in one sentence",
    `And root.tsx renders the framework's scripts only behind that flag. The window is the Layout
return, bounded by the two literals, and comments are stripped first because a gate reading
source can be satisfied by a comment.`,
  ],
  "scripts/check-page-payload.mjs#35": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#36": [
    "WHY",
    "the boundary, the derived criterion and the enumerated blind spots; the revisions-route account goes out",
    `A DYNAMIC IMPORT THAT SPLITS NOTHING, the shape Rolldown prints INEFFECTIVE_DYNAMIC_IMPORT
for on every build. A warning printed on every build becomes scenery, which is the failure
this assertion exists to end: the next one is a red gate rather than a line in a wall.

OBSERVATION BOUNDARY, and it is the paragraph that matters. **This does NOT read the build
log.** No gate in this repo runs the build, and a log written by the last one ages exactly like
the stale build this file's header warns about. So the bundler's criterion is derived from
SOURCE: an import is ineffective when some module in the same graph also imports that module
statically. It therefore cannot see what the resolver below cannot resolve, which is
deliberate and enumerated: bare package specifiers and virtual modules are skipped, because
this scan has no view of node_modules or of the plugin graph.

The one import it does judge is the CodeMirror lazy split, which hard rule 4 names as the
admin plane's only lazy boundary, so this doubles as the assertion that the split is one.`,
  ],
  "scripts/check-page-payload.mjs#37": [
    "CONTRACT",
    "why the finder is pure, and the cure it names; one sentence instead of a paragraph",
    `Every ineffective dynamic import in a set of {path, source} records.

Pure over its input rather than a reader of the disk, so the self-test below can run it on
synthetic sources: the documented cure for a per-item assertion whose real collection can
legitimately shrink to nothing (VERIFICATION.md, check:secrets).`,
  ],
  "scripts/check-page-payload.mjs#39": [
    "WHY",
    "what the normalisation does not match and why a resolver would be a second copy of the alias table",
    `Resolution is by NORMALISED SPECIFIER rather than by resolved path, so an alias spelling and
a relative spelling of one module do not match. Stated rather than hidden: this catches the
shape that occurs, one project alias used consistently, and a resolver would be a second copy
of the vite alias table tsconfig already owns.`,
  ],
  "scripts/check-page-payload.mjs#42": ["CONTRACT", "trailing tag on the branch it labels; one line already"],
  "scripts/check-page-payload.mjs#43": ["CONTRACT", "type annotation plus what the map is keyed by; one line already"],
  "scripts/check-page-payload.mjs#46": ["WHY", "why a type position is not a dynamic import; two lines already"],
  "scripts/check-page-payload.mjs#48": ["WHY", "why the self-test runs on every execution; three lines already"],
  "scripts/check-page-payload.mjs#49": [
    "WHY",
    "why the path is repo-relative; the fixed-depth attempt and its plant go to the history document",
    `Relative to the repo root, so the failure names a path someone can open.`,
  ],
  "scripts/check-page-payload.mjs#50": [
    "WHY",
    "why workerd refuses it, why this gate owns it, and why the weak two stay; the arrival date goes out",
    `A NATIVE BUILD-TIME DEPENDENCY MAY NOT REACH THE WORKER, in either bundle. \`sharp\` is a
native libvips binding, and \`workerd\` has no filesystem and no native modules, so an import
that reached the Worker would not be a size problem, it would be a Worker that fails to start.

This gate owns it because it is the only one that READS THE BUILD ON DISK and fails closed
when there is none.

THE THIRD ASSERTION IS THE POINT. A source scan says nobody wrote the import today and the
manifest says nobody declared it as a runtime dependency; neither is evidence about what
SHIPPED, and the artifact a deploy uploads is \`build/server/index.js\`. The weak two stay
because they name the defect at the right altitude: "you imported sharp in app/lib/x.ts" is a
fix, and "the Worker bundle mentions sharp" is a hunt.`,
  ],
  "scripts/check-page-payload.mjs#51": [
    "WHY",
    "the comment-satisfied-anchor trap, named on the block it threatens",
    `THE SOURCE SCAN, comments stripped: a comment naming the module has both satisfied and failed
an assertion in this repo before, and the paragraph above this function is full of the word.`,
  ],
  "scripts/check-page-payload.mjs#52": ["WHY", "the zero-scope class with its citation; three lines already"],
  "scripts/check-page-payload.mjs#53": [
    "CONTRACT",
    "what the artifact is and why the needle is a bare substring",
    `THE ARTIFACT. \`build/server/index.js\` is what wrangler uploads.

A bare substring rather than an import pattern, because the bundler rewrites the syntax and a
require of a native module can survive as a string, a banner or an external. Anything
mentioning it at all is worth failing on: nothing legitimate in the Worker has cause to.`,
  ],
  "scripts/check-page-payload.mjs#54": ["CONTRACT", "one line already; kept"],
  "scripts/check-page-payload.mjs#55": [
    "CONTRACT",
    "the subject, where the three sets come from and what it does not own; the resolve and refuse tables restate the code",
    `THE WHOLE PAGE, PER ROUTE. Rule 4's actual subject, which is the stylesheets and the fonts as
much as the JavaScript the gate above grades.

Resolved offline from the build on disk plus the source, per \`lib/page-payload.mjs\`:
stylesheets from React Router's browser manifest, bundles by reachability over the route's
import graph, fonts from the \`@font-face\` urls inside those stylesheets.

WHAT IT DELIBERATELY DOES NOT OWN: the speculation self-reference, which
\`test/header-speculation.test.mjs\` asserts. Two owners for one fact is rule 17 in the
direction that costs most, so it is named here only so a reader looking for it does not
conclude it is ungated.

It cannot see a RENDERED page either. Reachability over-approximates, which is the safe
direction for a ceiling, and the wire half is \`check:browser\`.`,
  ],
  "scripts/check-page-payload.mjs#56": [
    "NUMBER",
    "why both palettes ship, how a ceiling was set, and the expiry contract; the uplift bytes, the six token counts, ruling 103's account and the three self-policing rules the code asserts all go to the history document",
    `THE REDESIGN UPLIFT, and it is TEMPORARY BY CONSTRUCTION.

Both palettes ship at once, which is the whole cost. The new roles land beside the Hill
Country ones rather than replacing them: the old palette still has consumers, and deleting its
block would take every one of them with it and fail section 31's "every referenced token is
defined".

Each ceiling kept the headroom it already had: the new measurement plus the route's own
previous margin, rounded up to the nearest 100. Nothing here widens a margin, it only moves
the floor the margin sits on, and headCss and headTotal are the pre-redesign figures to come
back to.

THE DATE IS THE WHOLE CONTRACT, and a build number is the wrong one: a deadline that assumes a
schedule which is not running is not a deadline. Whatever the header becomes and whichever
builds land or do not, these ceilings come down by UPLIFT_EXPIRES or this gate fails, and
moving the date is a ruling rather than a repair. The same date governs section 31's
carried-token map, deliberately: the two are the same debt seen from two sides, one counting
bytes on the wire and one counting tokens nothing paints.`,
  ],
  "scripts/check-page-payload.mjs#57": [
    "NUMBER",
    "what the two figures mean, the margin discipline and the both-directions rule; the dated measurement goes out",
    `PER-ROUTE CEILINGS, in BROTLI bytes. The only copies, rule 17.

\`css\` is every stylesheet the route links; \`total\` adds the enhancement bundles it serves.
Fonts are excluded and asserted separately, because the normal face is shared by every route
and counting it into eight totals would say the site is eight fonts heavy.

Margins are roughly twenty percent over measured, tighter than the per-bundle ones above
because a stylesheet grows by a rule at a time rather than by a dependency at a time, so a
twenty percent jump should be a decision somebody makes in this file.

A route missing from this map FAILS, in both directions, against the derived route set below.

@type {Record<string, { id: string, css: number, total: number }>}`,
  ],
  "scripts/check-page-payload.mjs#59": ["CONTRACT", "what the extra key is; one line already"],
  "scripts/check-page-payload.mjs#60": [
    "NUMBER",
    "the one-bar argument, stated here in full because the entries below point at it; the measurement goes out",
    `The ceilings are \`/blog\`'s: the same kind of listing, rendering the same cards from the same
stylesheets, so the two pages are graded against one bar rather than drifting apart by
whichever happened to be measured later.`,
  ],
  "scripts/check-page-payload.mjs#61": [
    "NUMBER",
    "one line pointing at the argument above, rather than a third copy of it",
    `The tag archive's figure to the byte, and its ceilings for the reason above: one bar for one
kind of page.`,
  ],
  "scripts/check-page-payload.mjs#62": [
    "NUMBER",
    "which pages share this bar and why; the measurement and the repeated argument go out",
    `/privacy and /colophon to the BYTE: the same page shape, app.css plus prose.css, serving the
same single enhancement bundle. One bar for one kind of page.`,
  ],
  "scripts/check-page-payload.mjs#63": [
    "WHY",
    "the shared bar and why the largest corpus is the leanest page; the measurement and the record counts go out",
    `\`/projects\`' ceilings, within a byte on each figure and not by coincidence: app.css plus a
single route stylesheet plus theme.js is the same page shape and takes the same bar.

WHAT THIS ROUTE DOES NOT PAY FOR, and it is why the largest corpus on the site is its leanest
page: only the loader touches \`PUBLICATIONS\` and the public plane does not hydrate, so the
records render to HTML and are never serialised into a payload. The filter chips are links and
the search is a GET form, so the interactive half costs no script either.`,
  ],
  "scripts/check-page-payload.mjs#64": [
    "WHY",
    "why one sheet serves both pages and what the ceiling does not measure; the measurement and the 144-author figure go out",
    `ONE PAPER'S PAGE, on the index's ceiling because it links the same two stylesheets:
\`publications.css\` carries both, and two sheets for two pages sharing a visual language would
be two places for one decision and a second request to save nothing.

WHAT THIS PAGE DOES NOT PAY FOR: the abstract renders visible, every author is listed, and the
JSON-LD carries the full author array, so a long record renders a great many names. None of it
reaches the ceiling, which measures the SHARED cold load a browser caches once; this page's
own HTML is the variable part, and content is not a payload regression.`,
  ],
  "scripts/check-page-payload.mjs#65": [
    "NUMBER",
    "why the margin is the base route's and why it may not be widened; the dated measurement goes out",
    `THE MATH VARIANT'S CEILINGS, in BROTLI bytes. The only copies, rule 17.

The margins are \`/blog/:slug\`'s own, proportionally, which is the right bar because this IS
that route with one more sheet. A wider margin would be room for the stylesheet to grow, and
it is generated from a pinned package and cannot grow without a version bump somebody chose.`,
  ],
  "scripts/check-page-payload.mjs#66": [
    "NUMBER",
    "why a floor and not an equality; the measured face count is the constant below",
    `Floor on the faces the math stylesheet names: katex's whole woff2 set. A floor rather than an
equality, so an upstream face ADDED in a later version does not fail the gate, while the trim
in \`build-katex.mjs\` quietly dropping one does.`,
  ],
  "scripts/check-page-payload.mjs#67": [
    "WHY",
    "why an unused preload is worse than none, and who owns the argument; the face's byte size goes out",
    `Fonts that are reachable and deliberately NOT preloaded, with the reason.

A preload that goes unused within a few seconds is worse than none: the browser warns, and the
bytes compete with the ones that were needed. The per-face argument is root.tsx's; this names
the file that owns it rather than repeating it where it could drift.

@type {Record<string, string>}`,
  ],
  "scripts/check-page-payload.mjs#68": [
    "WHY",
    "why the one preload goes to Inter and what pays for the late discovery; the step citation and the CLS figure go out",
    `THE SERIF IS THE LATE FACE AND IS NOT PRELOADED ON PURPOSE. Inter sets body, UI and --t-h3,
so it owns the page's dominant metrics and gets the one preload; the serif sets a handful of
heading lines, and a second preload would put a whole face on every route's critical path to
serve them. Late discovery is the accepted cost, paid for by \`font-display: swap\` plus the
metric-override fallback app.css records.`,
  ],
  "scripts/check-page-payload.mjs#69": [
    "WHY",
    "why the palette is false everywhere and what a true would mean",
    `Which routes may serve which enhancement bundle, by the markup it upgrades.

The palette is \`false\` everywhere on purpose: \`theme.ts\` fetches it on the first search
gesture from a URL on a data attribute, so no import graph should reach it, and a route that
starts reaching it has put a search dialog back on a document.`,
  ],
  "scripts/check-page-payload.mjs#72": ["CONTRACT", "one line already; kept"],
  "scripts/check-page-payload.mjs#74": ["CONTRACT", "one line already; kept"],
  "scripts/check-page-payload.mjs#76": [
    "CONTRACT",
    "the derived rule and why it is the same one check:browser uses",
    `THE ROUTE SET IS DERIVED, then reconciled against the ceilings in BOTH directions. A route
exporting the shared cache headers is a public HTML route, the same rule \`check:browser\` uses
for its byte-identity list, so the two gates cannot disagree about what public means. The
feeds and the markdown twin are shared-cached and are not HTML, so the same pattern excludes
them.`,
  ],
  "scripts/check-page-payload.mjs#77": ["WHY", "why a widening must expire; three lines already"],
  "scripts/check-page-payload.mjs#78": [
    "WHY",
    "why the math key is not a route; the account of the gate catching its own author goes to the history document",
    `The math variant is a second grading of /blog/:slug rather than a route
of its own, so its ceiling is MATH_CEILING and not a ROUTE_CEILINGS key.`,
  ],
  "scripts/check-page-payload.mjs#80": ["CONTRACT", "why root's assets are found once; one line already"],
  "scripts/check-page-payload.mjs#82": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#83": [
    "WHY",
    "the prohibition and how the name is read instead; the two spellings of the failed guess go to the history document",
    `THE BINDING NAME IS DERIVED, NOT GUESSED. A gate that invents the name it is looking for is
testing its own spelling: a font file's stem and the name root.tsx binds it to are different
identifiers. Read instead: find root's \`?url\` import whose specifier ends in this font file,
take the local name it bound, and require that name inside a preload entry.`,
  ],
  "scripts/check-page-payload.mjs#84": [
    "WHY",
    "the intended arrangement, so a regression reads as one; the restatement of the loop above cut",
    `THE PALETTE IS NOT PART OF ANY PAGE'S COLD LOAD, asserted rather than assumed: \`theme.ts\`
fetches it on the first search gesture, so no import graph reaches it. Stating the intended
arrangement is what makes its return read as a regression rather than as a puzzle.`,
  ],
  "scripts/check-page-payload.mjs#85": [
    "CONTRACT",
    "why the route model cannot see this page and which two assertions are a pair; the other two restate the code below",
    `THE ONE PAGE THIS GATE'S ROUTE MODEL CANNOT SEE.

Everything above resolves a route's stylesheets from React Router's manifest, which is PER
ROUTE. The math stylesheet is linked PER POST, by root at render time from the loader's
\`hasMath\`, so it is in no manifest and the loop above cannot find it: without this section a
stylesheet and twenty font faces would ride on a page with no ceiling anywhere.

THE FIRST TWO ASSERTIONS BELOW ARE A PAIR. "The sheet is on no route's manifest CSS" is the
whole "posts without math ship no extra bytes" claim, and alone it passes perfectly on a build
where the stylesheet was deleted and every equation renders unstyled. "The sheet is reachable
from root" is what makes the pair a measurement.

@param {any} manifest @param {Set<string>} rootAssets @param {string} rootSource
@param {string} clientDir @param {(p: string) => string} assetFile`,
  ],
  "scripts/check-page-payload.mjs#86": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#88": [
    "WHY",
    "why a set and not a count",
    `A SET, because the two walks OVERLAP: \`blog.$slug.tsx\` and \`root.tsx\` share most of their
import graph, so a specifier reachable from both is found twice and the raw count says two
where there is one file.`,
  ],
  "scripts/check-page-payload.mjs#89": [
    "WHY",
    "why neither the name nor byte equality works, and what the anchor is instead",
    `THE BUILT ASSET IS FOUND BY CONTENT, NOT BY NAME. A name pattern is the weak form here for
the reason this file already gives for the bundles, a Vite hash may contain a dash, and byte
equality against the source is unavailable because Vite compiles the stylesheet on the way
through, which is the entire reason it is a \`?url\` import. So the anchor is a rule only this
stylesheet can contain, and the count is asserted.`,
  ],
  "scripts/check-page-payload.mjs#91": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#92": [
    "WHY",
    "the three source facts and what each one prevents; the dated check:browser failure goes to the history document",
    `THE LINK IS CONDITIONAL, AND ROOT'S ID LIST IS RECONCILED AGAINST THE ROUTES. Three source
facts, none of which any other instrument can see:

  The \`<link>\` is guarded by \`linksMath\`. Drop the guard and every page links the sheet,
  which the manifest assertion above CANNOT see: a component-rendered link is in no manifest.

  The link carries NO \`precedence\`, which would make React 19 treat it as a resource and hoist
  it above \`<meta name="color-scheme">\`. That meta is load-bearing precisely because it
  arrives before the first stylesheet request.

  Root names TWO ROUTE IDS, which is a mirror, so it is reconciled in both directions against
  the routes that return \`blogPostView(...)\`: a third route rendering a post must not render
  it unstyled with nothing complaining.`,
  ],
  "scripts/check-page-payload.mjs#93": [
    "WHY",
    "what the handle buys and why the set is derived; the count of editor routes today goes out",
    `THE EDITOR ROUTES OPT IN, and the set is derived rather than declared. A route rendering
\`<PostEditor\` copies this document's stylesheets into its preview iframe, so without the
handle an author typing an expression sees it unstyled on the one surface where this feature
is authored. A route added later would inherit that silently, so the two sets are compared.`,
  ],
  "scripts/check-page-payload.mjs#94": [
    "WHY",
    "why the discriminator is the projection call and not a name pattern",
    `THE ROUTES THAT CAN CARRY MATH ARE DERIVED, then compared with the ids root reads. A route
renders a post exactly when its loader returns the shared projection, so \`blogPostView(\` is
the discriminator rather than a name pattern: \`/preview/:token\` is not called \`blog.anything\`.`,
  ],
  "scripts/check-page-payload.mjs#95": [
    "WHY",
    "the string-on-both-sides blind spot; the mentions incident and its date go to the history document",
    `AND THE FIELD ROOT READS IS THE ONE THE PROJECTION WRITES, asserted because it is a STRING on
both sides. Root casts the loader data, so a rename in \`blog-view.ts\` leaves root reading
\`undefined\`, linking nothing, and rendering every equation unstyled with a green typecheck.`,
  ],
  "scripts/check-page-payload.mjs#96": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#97": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-page-payload.mjs#98": [
    "WHY",
    "the CSP refusal and the split failure it would cause; the face's size and the inline limit go to the history document",
    `NOT A PREFERENCE. A \`data:\` font is REFUSED by this site's CSP. \`font-src\` is \`'self'\` and
carries no \`data:\` source (only \`img-src\` does), so a face Vite inlined as base64 under its
default size limit would be refused while the others fetched: big delimiters in a fallback
serif on some equations and not others, with nothing failing.

\`vite.config.ts\` refuses to inline any \`.woff2\`. This is the assertion that says so, because a
config edit is invisible until something reads the build.`,
  ],
  "scripts/check-page-payload.mjs#99": [
    "WHY",
    "why this is the deliberate opposite of the loop's rule; the kilobyte figures go to the history document",
    `AND THEY ARE DELIBERATELY NOT PRELOADED, the opposite of the rule the loop above applies and
so stated rather than left an omission. The site's own face is used by every page, so a late
discovery costs every reader; a KaTeX face is used by an EXPRESSION, and a page with one
inline fraction touches a handful of the twenty. Preloading the set would be speculative
fetches for a page that needs a fraction of it, and the browser warns about every preload it
does not use within a few seconds.`,
  ],
};
