// Chunk 4: app/lib/seo.ts and workers/watchdog.ts. The SEO leaf and the second Worker.
//
// The seat raised the wave's keep share to 40 percent here, and these two files are why it had
// to move: seo.ts owns the cache-policy strings and watchdog.ts is unattended I/O, so most of
// what looks like narrative is a prohibition or a statement about what a check cannot see.
//
// WHAT WENT: the dated measurements (the 1042 probe table, the GitHub schedule counts, the
// throttle burst, the prerendered localhost), the rename stories on the three cache constants,
// and the rejected alternatives. WHAT STAYED: every "never", every "may not", the four boundary
// statements in the watchdog header, and the reason beside each number.
export default {
  "app/lib/seo.ts#0": [
    "WHY",
    "why a leaf file has an import; the rejected move of publicationsJsonLd goes to the history document",
    `THE ONE IMPORT IN THIS FILE. \`publicationsJsonLd\` decodes character references so the emitted
schema.org \`headline\` and \`name\` are the strings a human reads, and a builder that left that to
its callers would emit a wrong VALUE the first time one forgot.`,
  ],
  "app/lib/seo.ts#1": [
    "CONTRACT",
    "the boundary: which project compiles this file and what that forbids",
    `RELATIVE, not the \`~/\` alias every route uses. \`tsconfig.node.json\` carries no path mapping and
has to compile this file, so an aliased import here fails the build scripts' project while
compiling fine for the Worker.`,
  ],
  "app/lib/seo.ts#2": [
    "CONTRACT",
    "what it is, why it is fixed, and the cutover item; the prerendering measurement goes to history",
    `The canonical public origin. Every absolute URL the site emits derives from this and never from
\`request.url\`: prerendering runs in Node at build time with no request and no Worker env, and a
canonical URL should name the canonical origin whichever host served the response.

DNS cutover item: change this with BETTER_AUTH_URL and the Google redirect URI.`,
  ],
  "app/lib/seo.ts#3": [
    "WHY",
    "why it is derived rather than written out; one line",
    `The default social card, for any page without one of its own. Derived from SITE_ORIGIN rather
than written out: hardcoding the apex would point every scraper at the legacy WordPress site
until DNS moves.`,
  ],
  "app/lib/seo.ts#4": [
    "CONTRACT",
    "which fields are structured data and which are copy; the split's date goes to history",
    `The site's identity, split by the job each string does. \`role\` and \`affiliation\` are STRUCTURED
DATA, the jobTitle and worksFor a machine reads, so they stay short, literal and true. \`eyebrow\`
and \`tagline\` are the homepage's own words and are free to be sentences.`,
  ],
  "app/lib/seo.ts#5": [
    "CONTRACT",
    "the one-owner rule and the ratified precedence; the extraction date goes to history",
    `Everything a post's head tags are built from, in ONE place. The public route and the admin
preview both call this, because a preview that computed it a second way would lie the moment the
two disagreed, and it would lie silently.

The precedence is ratified and is not this function's to change: a per-post cover wins, then the
card \`build:og\` generated, then the site mark.`,
  ],
  "app/lib/seo.ts#6": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#7": [
    "WHY",
    "why the editor shows this rather than a placeholder; one line",
    `True when the card fell all the way through to the site mark. The editor shows this rather than
a placeholder, because "no cover" is a real and correct outcome the author should see.`,
  ],
  "app/lib/seo.ts#8": [
    "NUMBER",
    "why the limits are approximations; the pixel widths stay because they are what the number approximates",
    `Where a search result stops, which is NOT where the description field's own counter stops. Google
truncates by rendered PIXEL width, so any character count approximates a measure this site cannot
take, and a preview cutting at the field's counter would show text that will be clipped.`,
  ],
  "app/lib/seo.ts#9": [
    "CONTRACT",
    "the invocation, the one-builder rule and the card pairing; the five-page audit goes to history",
    `The COMPLETE social and canonical set for a hand-authored page.

ONE BUILDER, so a page cannot ship a partial set and a property added later reaches every page at
once. \`summary_large_image\` on all of them, because the image argument falls through to the site
mark and a \`twitter:card\` without an image renders as a bare link.

@param page \`path\` is site-absolute and starts with a slash.`,
  ],
  "app/lib/seo.ts#10": [
    "CONTRACT",
    "what the two values mean and the prohibition on a hand-assembled set",
    `The Open Graph type. \`website\` for a hand-written page, \`article\` for a page that IS a work.

\`check:invariants\` section 13 refuses a hand-assembled social set, so a page needing one thing
differently teaches this helper rather than exempting itself. The \`citation_*\` tags stay appended
by the route: they are not social metadata and no other page has them.`,
  ],
  "app/lib/seo.ts#11": [
    "CONTRACT",
    "what it does and what the caller can infer; already near the calibration",
    `Cuts at the last WORD boundary before the limit, the way a search engine does. Returns the text
unchanged when it fits, so the caller can tell truncation happened by comparing.`,
  ],
  "app/lib/seo.ts#12": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#13": [
    "CONTRACT",
    "what the string permits and why HTML needs no Vary; the rename and the seven-route audit go to history",
    `THE STRING THAT PERMITS SHARED CACHING, built from the lifetime below.

HTML MAY USE IT, and needs no \`Vary\` to be safe. The theme is a dimension of the cache KEY the
gateway sets in \`workers/app.ts\`, so a dark document and a light one are different entries rather
than one entry a second reader must be kept away from.

What travels with it is \`Cache-Tag\`, so a response that can be stored can also be purged.`,
  ],
  "app/lib/seo.ts#14": [
    "NUMBER",
    "why the number is declared here and the prohibition on parsing it back out",
    `THE LIFETIME ITSELF, and it is the owner rather than a copy of the string. Hard rule 17 gives a
measured value one owner, and a page typing the lifetime in prose beside a constant is two owners
that agree until the day somebody changes one.

NEVER PARSE \`s-maxage\` BACK OUT OF THE STRING. A parse that stops matching has to substitute
something, and a substituted cache lifetime is a false claim rather than a missing one.`,
  ],
  "app/lib/seo.ts#15": [
    "CONTRACT",
    "why it is exported rather than computed by its reader; one line",
    `The same lifetime in minutes, for prose that has to state it. Exported rather than computed
there, because the thing being stated is a property of the cache policy and not of the page.`,
  ],
  "app/lib/seo.ts#16": [
    "WHY",
    "the prohibition on re-adding Vary; the 2026-08-02 variant measurement goes to the history document",
    `\`HTML_VARY\` WAS \`"Cookie"\` AND WAS DELETED. The theme is a dimension of the cache key now, where
absence is not a special case: a request with no theme cookie resolves to a theme like any other.

Nothing replaced it, deliberately. Emitting \`Vary: Cookie\` here would fragment the cache on every
unrelated cookie value.`,
  ],
  "app/lib/seo.ts#17": [
    "CONTRACT",
    "the vocabulary a caller needs and the prohibition behind one owner; the ruling pointer stays",
    `Cache tags for a public HTML response. ONE OWNER of the tag vocabulary, ruling 17.

  \`post:<slug>\`  one post's page, the only per-document tag
  \`posts\`        anything whose content is a function of the corpus
  \`pages\`        the hand-authored pages that do not read the corpus

\`pages\` is inert today and is still sent, so that purgeable by name is a property of every
shared-cacheable response rather than of most of them.

A SPELLING MISTAKE HERE IS A PURGE THAT SILENTLY DOES NOTHING: \`cache.purge\` reports success for
a tag matching no stored response, because there is nothing for it to report.

@param slug when present, the post this response IS`,
  ],
  "app/lib/seo.ts#18": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#19": [
    "CONTRACT",
    "the pairing and what dropping half of it costs; the /projects defect goes to history",
    `The \`headers()\` a public HTML route returns. ONE definition, many callers: a route that returns
nothing falls through to hard rule 8's uncached default and is never edge-cached.

A copy that drops \`Cache-Tag\` is a response nothing can purge, which fails quietly rather than
visibly. \`check:headers\` asserts the pairing on every route that names the shared string, in both
directions.

@param tag the cache tag for this response, from \`cacheTags\` or \`PAGES_CACHE_TAG\``,
  ],
  "app/lib/seo.ts#20": [
    "CONTRACT",
    "why Accept stays and Cookie went; the measured wire bytes go to the history document",
    `For the routes that negotiate on Accept. \`Cookie\` left this string and \`Accept\` stays, because
the two were never the same claim: the post page and \`/search\` genuinely serve more than one
representation at one URL, and a shared cache ignoring that hands a markdown request the HTML.`,
  ],
  "app/lib/seo.ts#21": [
    "CONTRACT",
    "what it refuses and the two mechanisms that set it; the rename goes to history. The hard rule citation stays",
    `THE STRING THAT REFUSES STORAGE. Nothing may keep this response: not a shared cache, not an
intermediary, not the browser.

Its two mechanisms matter more than its callers, and both are invisible from a route file. It is
hard rule 8's default in \`workers/app.ts\` for any response declaring no \`Cache-Control\` of its
own, and it is what a cookie-bearing request gets on the HTML routes after the downgrade there.`,
  ],
  "app/lib/seo.ts#22": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#23": [
    "CONTRACT",
    "why both vocabularies read one derivation; the 2026-09-03 gap goes to history",
    `THE ARTICLE FACTS BOTH VOCABULARIES STATE, derived once. \`dateModified\` is
\`updatedAt ?? publishAt\` and the author is a shape this file owns, so a second derivation would
agree the day it was written and drift the day either rule changed.

\`articleJsonLd\` spreads this into schema.org names and \`articleOpenGraph\` maps it to \`article:*\`
names. Neither computes a value of its own, and the gate compares the two outputs field by field.`,
  ],
  "app/lib/seo.ts#24": ["CONTRACT", "what the fallback means; one line already"],
  "app/lib/seo.ts#25": [
    "CONTRACT",
    "why it returns a list and what an absent value must not become",
    `The \`article:*\` Open Graph properties, from \`articleFacts\` and nothing else. \`article:tag\`
REPEATS, one property per tag, which is why this returns a list; the JSON-LD side joins the same
array into one \`keywords\` string, and that difference belongs to the vocabularies.

An absent tag or date yields NO property rather than an empty one: an \`article:published_time\`
with no content claims the article has no publication date.`,
  ],
  "app/lib/seo.ts#26": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#27": [
    "CONTRACT",
    "why it asks postSocial rather than restating the chain; the two-statement defect goes to history",
    `ONE RESOLUTION, SHARED WITH THE CARD. Asking \`postSocial\` rather than restating its chain is
the point: the two cannot disagree, and a fallback added later reaches both.`,
  ],
  "app/lib/seo.ts#28": [
    "CONTRACT",
    "why the two vocabularies spell one array differently; trimmed to two lines",
    `Same array the OG side emits one property per entry from. Joined here because schema.org wants
one string; that difference is the vocabulary's, not a second opinion about this post's tags.`,
  ],
  "app/lib/seo.ts#29": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#30": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#31": [
    "CONTRACT",
    "separator keeps its label and the ruling pointer; the dashes and the restoration commit go",
    `Publications. Restored by ruling 63.`,
  ],
  "app/lib/seo.ts#32": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#33": [
    "CONTRACT",
    "what they are; the deletion and restoration go to the history document",
    `Authority records that identify the site owner, for schema.org sameAs.`,
  ],
  "app/lib/seo.ts#34": ["CONTRACT", "what it is; one line already"],
  "app/lib/seo.ts#35": [
    "WHY",
    "why the sameAs array exists and why the two Person nodes are not one; the merge count goes to history",
    `schema.org Person for the site owner, carrying the authority links. The sameAs array is the
point: another academic works under this name and a citation graph has already merged some of his
work into this author record, so the ORCID, the Scholar profile and the faculty page give a
consumer three ways to tell them apart without guessing from a name string.

\`personJsonLd\` above is the home page's Person and carries no \`@id\`. The two are not a duplication
to collapse: that one describes the site owner to a reader, this one joins a paper to a human.`,
  ],
  "app/lib/seo.ts#36": [
    "WHY",
    "why it matches loosely; the author positions go to the history document",
    `Match the site owner in an author list. The registries return several spellings of his name and
his position in the list varies, so this keys on surname plus a D initial rather than an exact
string.`,
  ],
  "app/lib/seo.ts#37": [
    "CONTRACT",
    "what the shape is and what collapsing it would misstate",
    `One Person node followed by a ScholarlyArticle per publication. Co-authors stay plain Person
objects and only the owner's entry becomes an \`@id\` reference: replacing the whole author array
with a single reference would drop the co-authors and misstate authorship on every other record.`,
  ],
  "app/lib/seo.ts#38": [
    "CONTRACT",
    "why the decode is here and why it does not break the escaping invariant",
    `DECODED HERE RATHER THAN AT THE CALL SITE: this function owns the node shape, and a caller that
forgot would emit an escaped string as a schema.org \`name\`, a wrong VALUE rather than a glitch.
Safe for the invariant it looks like it breaks, since \`jsonLd()\` escapes \`<\` and \`>\` on the way
into the script element.`,
  ],

  "workers/watchdog.ts#0": [
    "CONTRACT",
    "the boundary: which builder reads the path mapping and what that forbids",
    `RELATIVE IMPORTS, DELIBERATELY, where the rest of workers/ uses \`~/\`. This Worker is built by
\`wrangler deploy -c wrangler.watchdog.jsonc\`, which bundles with esbuild and does not read that
tsconfig mapping, so a \`~/\` specifier here would typecheck and fail at deploy.`,
  ],
  "workers/watchdog.ts#1": [
    "CONTRACT",
    "which Worker it names and why it is not derived; the gate binding stays",
    `The Worker the error rate is asked about: the SITE, never this watchdog. Written out rather than
derived from SITE_ORIGIN, because the origin is a hostname and this is a script name, equal today
only by naming. \`check:config\` binds it to the site config's \`name\`.`,
  ],
  "workers/watchdog.ts#2": [
    "CONTRACT",
    "the four boundary statements and the two prohibitions; the 1042 probe table, the schedule counts and the throttle burst go to the history document",
    `THE WATCHDOG. A separate Worker whose only job is to notice that this site has stopped being
healthy, repair what it can, and wake somebody otherwise.

A WORKER CANNOT \`fetch()\` THIS SITE. Cloudflare error 1042 refuses Worker-to-Worker on one zone
without a service binding, and this site has no custom domain until the DNS cutover, so
\`env.SITE.fetch\` is the only mechanism available.

WHAT THAT COSTS: the binding invokes the site Worker directly, so it proves the health suite RUNS
and that every invariant holds. It does NOT prove the site is reachable from the internet, and
\`.github/workflows/health.yml\` survives as the only instrument speaking from outside Cloudflare.

NOTHING HERE WRITES THE HEALTH SNAPSHOT, AND NOTHING MAY. It is a byproduct of a run that happened
anyway, and a watchdog that stamped it directly would be manufacturing its own alibi. The home
page's tile renders its age, so the tile's freshness IS this Worker's liveness.

WHAT IS DECIDED HERE: NOTHING. Every decision is in \`app/lib/health/repair.mjs\`, which is pure and
never fetches. This file is the I/O half and walks an action list rather than branching on a
verdict, so a step removed from the list is a step this Worker stops taking.

\`OPERATOR_TOKEN\` is a wrangler secret on THIS Worker, the same value the site Worker and the
GitHub repository secret hold, so rotation touches all three. Its absence is a NAMED state rather
than silence: \`repairPlan\` returns alert-only and the run still mails.`,
  ],
  "workers/watchdog.ts#3": [
    "CONTRACT",
    "why it is a var, why it is still out of git, and the gate that reconciles it",
    `Where the alert goes, and where the repair door is.

\`ALERT_EMAIL\` is a VAR rather than a secret: an inbox address is not a credential, so making it
one would spend \`check:secrets\`' signal on a value that grants nothing. It is still kept out of
git, because this repo is meant to be copied as a template. \`check:config\` reconciles the real
config and the tracked example in both directions.`,
  ],
  "workers/watchdog.ts#4": ["CONTRACT", "what it is and where the reason lives; one line already"],
  "workers/watchdog.ts#5": ["CONTRACT", "what it carries; one line already"],
  "workers/watchdog.ts#6": [
    "CONTRACT",
    "which is a credential and what absence means; the precedent pointer stays",
    `The account the invocations query is asked of, and the credential for it.
\`CLOUDFLARE_ACCOUNT_ID\` is a var on the \`ALERT_EMAIL\` precedent; \`CLOUDFLARE_API_TOKEN\` IS a
credential, a wrangler secret scoped to Account Analytics Read and nothing else.

BOTH OPTIONAL, and their absence is a NAMED state rather than silence, so a watchdog that lost the
ability to see errors does not look like one seeing none.`,
  ],
  "workers/watchdog.ts#7": [
    "WHY",
    "why the key is namespaced; one line",
    `Where the last firing's verdict is kept. Namespaced \`watchdog:\` because this shares the site's
KV with Better Auth sessions and the Ask answer cache, and a bare key in a shared namespace is how
two subsystems come to own one string.`,
  ],
  "workers/watchdog.ts#8": [
    "CONTRACT",
    "the two answers the signature exists to keep apart",
    `Reads the last firing's state. ABSENT AND UNREADABLE ARE DIFFERENT ANSWERS: absent means nothing
has run yet, which is a baseline and mails nothing, and unreadable means the dedupe is blind. A
blind dedupe that stays quiet is a monitor that silently stopped monitoring.`,
  ],
  "workers/watchdog.ts#9": [
    "WHY",
    "which failure is the cheap one; one line",
    `Writes the state. NEVER THROWS. A failed write costs the NEXT firing its dedupe, at worst one
duplicate mail; letting it throw would cost THIS firing its alert, which is the thing the Worker
exists to deliver.`,
  ],
  "workers/watchdog.ts#10": [
    "CONTRACT",
    "why the sender is not derived; the onboarding measurement goes to history",
    `The sender, on \`dustinedwards.info\`, which is onboarded to Email Sending. NOT derived from
\`SITE_ORIGIN\`: that is \`*.workers.dev\` until the cutover and a \`workers.dev\` sender would be
refused, because the from-domain must be one onboarded for sending.`,
  ],
  "workers/watchdog.ts#11": ["CONTRACT", "what it is; one line already"],
  "workers/watchdog.ts#12": [
    "CONTRACT",
    "never throws, keeps the cause, and why it is exported; the old catch goes to history",
    `Reads \`/api/health\` through the service binding.

NEVER THROWS. A transport failure is returned as status 0 with a null body, which
\`watchdogActions\` turns into a notify: an endpoint that could not be reached must not be a reason
for this handler to die before it can say so. AND IT KEEPS THE CAUSE, because a timeout is a site
problem and a 1042 is this Worker's binding pointed somewhere it may not go.

EXPORTED FOR ONE REASON: the worker test drives it with a \`SITE\` binding whose \`fetch\` throws,
which is the only way to observe the catch. \`scheduled\` is still the only caller in the deploy.`,
  ],
  "workers/watchdog.ts#13": [
    "CONTRACT",
    "the verdict rule and what the token may not touch",
    `One repair call through the operator API. \`miss\` is empty when it converged; \`unrepairable\`
marks a refusal that repeating this call cannot fix.

THE VERDICT IS READ, NEVER INFERRED FROM A 200, the same rule ship applies: this is an unattended
write and "the call returned" is not "the index agrees". The token goes in a header on a request
this Worker builds, and it is never logged and never echoed into the mail body.`,
  ],
  "workers/watchdog.ts#14": [
    "CONTRACT",
    "where the decision lives; trimmed to two lines",
    `The server's own sentence and the 422 rule live in the decision module, shared with
\`scripts/health-repair.mjs\`, which makes the identical call. Grounds on \`refusalMiss\`.`,
  ],
  "workers/watchdog.ts#15": [
    "WHY",
    "what the body must carry and why there is no escalation; the 2026-08-23 flap goes to history",
    `Sends the alert.

THE BODY CARRIES THE HEALTH JSON AND WHAT WAS ATTEMPTED, because a notification saying only
"unhealthy" costs the reader the entire triage. \`text\` only, no \`html\`: one reader, a JSON blob,
and an HTML part would be a second copy of the same words to keep in step.

Returns whether it sent, so a failure to notify is a log line rather than nothing at all. There is
no further escalation to reach for: what remains is the ageing health tile and the hourly run.`,
  ],
  "workers/watchdog.ts#16": [
    "CONTRACT",
    "why it is not a health check, the fail-closed rule, and what not-configured means; the latency figures go to history",
    `The site's error rate over the last window, read from Cloudflare's own numbers rather than from
anything the site says about itself.

NOT A SIXTH HEALTH CHECK. Those five are drift checks, each repairable through the operator door,
and an error rate is a SYMPTOM. Folding it in would also add a round trip to a rate-limited route,
and since \`ship\` refuses to proceed unless \`/api/health\` reports ok, an error spike would start
blocking the deploy of the fix.

NEVER THROWS, on this file's standing rule, and every failure is reported as NOT OK: a check that
could not read the error rate has not established that it is fine.

NOT CONFIGURED IS ITS OWN ANSWER and is ok, a state to report rather than an alert to send.`,
  ],
  "workers/watchdog.ts#17": [
    "WHY",
    "the trap the API's shape sets; one line",
    `A GRAPHQL 200 CARRYING ERRORS IS A FAILURE: the transport succeeded and the query did not, so a
reader that checked only the status code would sum an absent \`data\` field to zero errors and
report perfect health.`,
  ],
  "workers/watchdog.ts#18": ["CONTRACT", "what it renders; one line already"],
  "workers/watchdog.ts#19": ["WHY", "why a status 0 reading prints its cause; one line already"],
  "workers/watchdog.ts#20": ["WHY", "the second half of the line above; one line already"],
  "workers/watchdog.ts#21": [
    "WHY",
    "why the catch exists and why it rethrows",
    `One firing. WRAPPED, AND THE THROW IS RE-RAISED: everything inside is written not to throw, so
the catch means an assumption broke. A Cron Trigger that throws is recorded as a failed
invocation, and swallowing that trades the last remaining signal for a tidy log.`,
  ],
  "workers/watchdog.ts#22": [
    "CONTRACT",
    "what is deduplicated and what is not",
    `WHAT THIS FIRING CONCLUDED. THE REPAIRS STILL RUN EVERY FIRING and only the MAIL is
deduplicated, so \`alerting\` describes where the firing ENDED rather than what it first read.`,
  ],
  "workers/watchdog.ts#23": [
    "CONTRACT",
    "the order and where it comes from; the plant note goes to the history document",
    `THE ACTION LIST IS WALKED, NEVER SECOND-GUESSED. Content before Ask, because the Ask corpus is
read out of what the content repair rewrites, and the recheck runs only because the list asked.`,
  ],
  "workers/watchdog.ts#24": [
    "WHY",
    "why a refusal stops the walk",
    `A REFUSAL ABANDONS THE REST OF THE LIST. Once the content repair has been REFUSED the Ask corpus
is known-stale, and uploading it is a write on a premise the previous call just denied.`,
  ],
  "workers/watchdog.ts#25": [
    "WHY",
    "read every firing, joins failing, and is not repairable; the flap counts go to history",
    `THE ERROR RATE, FOLDED IN AS ONE MORE FAILING CHECK. READ EVERY FIRING, whatever health said:
the two are independent, and the defect this was written for had every check green while the
Worker threw for days. It joins \`failing\` rather than mailing on its own, which buys the dedupe
for free, and it IS NOT REPAIRABLE: a rebuild fired at a throwing Worker acts on a symptom whose
cause nobody has classified.`,
  ],
  "workers/watchdog.ts#26": ["CONTRACT", "why it owns the subject; one line already"],
  "workers/watchdog.ts#27": [
    "WHY",
    "why both are reported; trimmed to two lines",
    `Health already had something to say. Both are reported, on the N-1-of-N rule: a mail naming only
the drift would send somebody to re-run a sync while the Worker was crashing.`,
  ],
  "workers/watchdog.ts#28": [
    "CONTRACT",
    "where the decision lives and what this file does not decide",
    `ONE MAIL PER CHANGE OF STATE. Every decision is in \`alert-state.mjs\`, which is pure and covered
by \`check:tests\`; this reads KV, writes KV and sends, and decides nothing.`,
  ],
};
