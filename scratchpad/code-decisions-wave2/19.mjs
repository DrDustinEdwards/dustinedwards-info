// Chunk 19: check-guidelines 0-4, bootstrap-config 0-3, lib/capsid 0-5, lib/design-sheets 0-5,
// lib/sql-literals 0-1, build-capsid-guidelines 0-2, mint-smoke-token 0.
//
// The wave's last chunk and its smallest. Written at wave 1's rate.
export default {
  "scripts/check-guidelines.mjs#0": [
    "CONTRACT",
    "what drift it sees, the tier limitation, the credential rule and why the glob is checked; the ruling goes to the history document",
    `Gate: the Capsid documents handed to the design agent are not stale, and the guidelines the
glob ships actually exist.

THE DEFECT: an export is a copy, and a copy has no way of knowing its source moved. Without an
instrument the canvas would be handed a ruling reversed a week ago and nothing would say so.
Every exported file carries the stamp it was taken at and this compares it to Capsid's CURRENT
value, which is hard rule 18's shape: the export is derived, the repair is re-running the
derivation, and the gate sees the DRIFT rather than policing how the copy got there.

NETWORK TIER, AND IT CANNOT BE OTHERWISE: the current value lives in Capsid, so there is no disk
to read. THE CREDENTIAL FAILS CLOSED rather than skipping, an unchecked export not being an
export known to be current.

WHY IT ALSO CHECKS THE GLOB: a stamp check over an empty directory passes, every export it found
being in step and it having found none, which is the zero-scope vacuity class.`,
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
    `Bootstrap the local wrangler configs so a fresh clone can install and typecheck.

The real configs are gitignored portfolio-wide, which leaves a fresh clone with no config at
all, and typegen is the first thing postinstall runs, so \`npm install\` itself fails before the
tree is usable.

This copies each committed example into place once. It NEVER overwrites: the existence check and
the exclusive copy flag both guard that, so a file appearing between the two still cannot be
clobbered and a real config carrying live values survives any number of reinstalls.

The copied files carry placeholder values, which is enough for typegen, since that reads binding
names and types and ignores the values. It is NOT enough to deploy or to run against real
resources.

TWO PAIRS, AND THIS IS A LOOP rather than a second copy of the same twenty lines. A missing
example is fatal for EITHER pair, because a clone that silently ends up without one fails later
and further from the cause.`,
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

WHY THE DOCUMENT LIST LIVES HERE: one script exports these documents and a gate asserts the
exports are current. If each carried its own list, the gate would eventually be checking a set
the exporter no longer writes and would still pass, every document it knew about being in step.
That is the alias-blind failure hard rule 10 names.

WHAT IS DELIBERATELY NOT HERE: credential handling. The caller reads the token and decides what
absent means, because the two callers decide differently.`,
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

Both callers must read the SAME array out of its one owner (hard rule 17). Two hand-rolled
parsers would be a second and third place for the shape of that array to be known, and the gate
exists precisely because a hand-maintained second copy went stale. Hard rule 10, one helper
name and one argument order: both callers use these and no local variant.`,
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
statement again.

EXTRACTED so it can be tested without importing the gate, which runs its whole suite at module
load and cannot be imported for one function. The gate and the test import the same code, so a
test cannot pass against a copy of the rule.

**This is what the sync script needed, and without it that file was the last hole in the section
that reads write paths.** It builds its SQL as literal text but concatenates fragments, and
every extraction in that section needs a WHOLE statement: the INSERT column list is matched up
to its closing paren and that paren is several fragments away, so the largest write path in the
repo was invisible while the file still appeared in the scan.

Joining is safe for the same reason it is necessary: it can only make a literal LONGER, and a
longer literal that is not SQL still fails the looks-like-SQL test.

@param {string} source
@returns {string}`,
  ],
  "scripts/lib/sql-literals.mjs#1": ["WHY", "why repeated; one line already"],
  "scripts/build-capsid-guidelines.mjs#0": [
    "CONTRACT",
    "why a copy is forced, what makes it honest and the credential rule; the rejected alternative goes to the history document",
    `Export the Capsid documents the canvas needs into the guidelines directory.

WHY A COPY EXISTS AT ALL, when hard rule 17 says one owner per fact: the glob can only point at
files inside the workspace and drops anything whose realpath escapes it, while Capsid documents
are database rows. So the design agent cannot be handed a pointer, only text, and a copy is
forced.

The honest version of a forced copy is a DERIVED one: Capsid stays the owner, this writes a
gitignored export, every file carries the stamp it was taken at, and the gate fails when the
source has moved. Same shape as hard rule 18, the store derived and the repair a re-run.

THE CREDENTIAL is machine-local and not a wrangler secret, being read by a Node program here
rather than by deployed code. Absent, this REFUSES rather than writing a partial directory: a
half-exported guidelines set that still globs is worse than none.`,
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

WHY IT IS SILENT: one line on stdout makes the output a VALUE rather than a transcript, so every
safe way of handling it is a one-liner into a file or a secret store. A banner or a label would
land in the file alongside the token and produce a credential that is silently wrong; the
instructions live in the documents, where they can be read without being executed.

**IT NEVER TOUCHES A COMMAND LINE AND NEVER TOUCHES A LOG.** The token is not an argument to
anything, so it cannot appear in a process listing or a shell history.

THE SIZE is deliberately well clear of the Worker's floor, which exists to catch a
misconfiguration rather than to describe a sensible secret. \`randomBytes\` is the CSPRNG, and
that distinction is the whole value of this file.`,
  ],
};
