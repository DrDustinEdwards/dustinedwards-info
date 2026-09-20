// Chunk 19: check-guidelines 0-4, bootstrap-config 0-3, lib/capsid 0-5, lib/design-sheets 0-5,
// lib/sql-literals 0-1, build-capsid-guidelines 0-2, mint-smoke-token 0.
//
// The wave's last chunk and its smallest. Written at wave 1's rate.
export default {
  "scripts/check-guidelines.mjs#0": [
    "CONTRACT",
    "what drift it sees, the tier limitation, the credential rule and why the glob is checked; the ruling goes to the history document",
    `Gate: the Capsid documents handed to the design agent are not stale, and the guidelines the glob
ships actually exist.

  npm run check:guidelines

BOUNDARY: it compares each export's stamp against Capsid's current value, which is the shape of
hard rule 18, the export being derived and the gate seeing DRIFT rather than policing how the
copy got there. NETWORK TIER and it cannot be otherwise, the current value living in Capsid.`,
  ],
  "scripts/check-guidelines.mjs#1": ["NUMBER", "what the floor counts; one line already"],
  "scripts/check-guidelines.mjs#4": [
    "CONTRACT",
    "what each glob entry must resolve to",
    `Every literal glob entry must resolve to a file that exists, and every wildcard entry to a
directory with something in it: a glob that matches nothing ships nothing and says nothing.`,
  ],
  "scripts/bootstrap-config.mjs#0": [
    "CONTRACT",
    "what it copies, the never-overwrite rule and what the copies are enough for; the measurement, the exit code and the dates go to the history document",
    `Bootstrap the local wrangler configs so a fresh clone can install and typecheck, the real ones
being gitignored and typegen being the first thing postinstall runs.

  node scripts/bootstrap-config.mjs

BOUNDARY: it copies each committed example into place once and NEVER overwrites, so a real
config carrying live values survives any number of reinstalls. The copies carry placeholders,
which is enough for typegen and is NOT enough to deploy or to run against real resources.`,
  ],
  "scripts/bootstrap-config.mjs#1": [
    "CONTRACT",
    "why the advice is per pair",
    `Every gitignored config and the tracked example it is bootstrapped from. The \`what\` string is
what a reader is told to fill in, per pair, because "placeholder resource ids" is wrong advice
for a config whose placeholder is an inbox address.

@type {ReadonlyArray<{ dest: string, src: string, what: string }>}`,
  ],
  "scripts/bootstrap-config.mjs#2": [
    "CONTRACT",
    "why narrowed and why this path is expected",
    `Narrowed rather than asserted: under checkJs a catch binding is \`unknown\`, and the exclusive
copy failing this way is the expected path when the config already exists.`,
  ],
  "scripts/lib/capsid.mjs#0": [
    "CONTRACT",
    "why the document list has one owner and what is deliberately absent",
    `One client for Capsid's MCP endpoint, and one list of the documents the canvas is given.

BOUNDARY: the list has one owner here, because an exporter and a gate each carrying their own
would eventually check a set the exporter no longer writes and still pass, which is the
alias-blind failure hard rule 10 names. Credential handling is deliberately the caller's.`,
  ],
  "scripts/lib/capsid.mjs#1": [
    "CONTRACT",
    "what earns a place and the two exclusions",
    `The Capsid documents the design agent is given, and why each one earns a place in a budget the
canvas actually reads. Deliberately NOT here: the inventory that answers what to build rather
than how it should look, and the runbook, which is operational procedure with no design content.`,
  ],
  "scripts/lib/capsid.mjs#2": [
    "CONTRACT",
    "why the last data line; one line already",
    `One JSON-RPC call against Capsid's MCP endpoint. The endpoint may answer as SSE and this takes
the LAST \`data:\` line, because a stream can carry progress frames ahead of the result.

@param {string} token
@param {string} name
@param {Record<string, unknown>} args`,
  ],
  "scripts/lib/capsid.mjs#3": [
    "CONTRACT",
    "what the stamp is for; the mechanism kept in one line",
    `The stamp an exported file carries, and the parser that reads it back. The gate compares it to
Capsid's CURRENT value, which is the whole mechanism: an export is a copy, a copy has no way of
knowing its source moved, and hard rule 18's stamp is what makes the drift visible rather than
silent.`,
  ],
  "scripts/lib/design-sheets.mjs#0": [
    "CONTRACT",
    "why a lib rather than two copies",
    `One reader for the design-sync sheet list, and one parser for a stylesheet's comment blocks.

BOUNDARY: both callers read the SAME array out of its one owner (hard rule 17) through these
names and no local variant, which is hard rule 10's one helper name and one argument order.`,
  ],
  "scripts/lib/design-sheets.mjs#1": [
    "CONTRACT",
    "why it throws rather than returning empty",
    `The sheet array, parsed from its owner. Throws rather than returning an empty list: a search
over an empty scope reports exactly what a clean sweep reports, so a broken parse must be a
refusal and never a quiet zero.

@param {string} repo absolute path to the repo root
@returns {string[]} repo-relative stylesheet paths, in cascade order`,
  ],
  "scripts/lib/design-sheets.mjs#2": [
    "CONTRACT",
    "what it returns and why the line number; one line already",
    `Every comment block in a stylesheet, with the 1-indexed line it starts on so an extract can
point back at its owner.

@param {string} css
@returns {{ text: string, line: number }[]}`,
  ],
  "scripts/lib/design-sheets.mjs#4": [
    "WHY",
    "why the simple count; one line already",
    `Counting newlines before the match is linear per block and the sheets are small; a running
index would be faster and easier to get wrong.`,
  ],
  "scripts/lib/design-sheets.mjs#5": [
    "CONTRACT",
    "what furniture is removed; one line already",
    `A comment block's prose, with the comment furniture removed: the opening and closing markers,
the leading star on each continuation line, and the rule bars some sections use as dividers.

@param {string} block
@returns {string}`,
  ],
  "scripts/lib/sql-literals.mjs#0": [
    "CONTRACT",
    "why extracted, what it unblocked and why joining is safe; the date, the named siblings and the quoted fragment go to the history document",
    `Joining adjacent string literals across \`+\`, so a SQL statement split for line length is one
statement again and an extractor that needs a WHOLE statement can see it.

BOUNDARY: joining can only make a literal LONGER, so a longer literal that is not SQL still
fails its reader's own looks-like-SQL test. Extracted so it can be tested without importing the
gate, which runs its whole suite at module load.

@param {string} source
@returns {string}`,
  ],
  "scripts/lib/sql-literals.mjs#1": ["WHY", "why repeated; one line already"],
  "scripts/build-capsid-guidelines.mjs#0": [
    "CONTRACT",
    "why a copy is forced, what makes it honest and the credential rule; the rejected alternative goes to the history document",
    `Export the Capsid documents the canvas needs into the guidelines directory, a copy being forced
because the glob can only point at files inside the workspace while these are database rows.

  node scripts/build-capsid-guidelines.mjs

BOUNDARY: the honest version of a forced copy is a DERIVED one, so hard rule 17's owner stays
Capsid, every file carries the stamp it was taken at, and the drift is the gate's to see, which
is hard rule 18's shape. Absent a credential it REFUSES rather than writing a partial directory.`,
  ],
  "scripts/build-capsid-guidelines.mjs#2": [
    "CONTRACT",
    "why rebuilt; one line already",
    `Rebuild, so a document dropped from the list cannot survive as a stale file the glob still
ships.`,
  ],
  "scripts/mint-smoke-token.mjs#0": [
    "CONTRACT",
    "why silent, the no-command-line rule and why the size; the three one-liners kept as the reason",
    `Mints a SMOKE_TOKEN. Prints it once, on stdout, and outputs nothing else.

  node scripts/mint-smoke-token.mjs

BOUNDARY: one line on stdout makes the output a VALUE rather than a transcript, so a banner
would land in the file or the secret alongside the token. **IT NEVER TOUCHES A COMMAND LINE AND
NEVER TOUCHES A LOG**, so it cannot appear in a process listing or a shell history.`,
  ],
};
