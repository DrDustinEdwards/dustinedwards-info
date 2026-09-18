# Code-history-out wave 2 review: `review/code-history-out-wave2-draft` vs `main`

Compared `origin/main` `9f929da` to `origin/review/code-history-out-wave2-draft` `03390f5`. The branch rewrites comments in the remaining 93 files under `scripts/` (wave 1's ten excluded), then recuts every file header to invocation, purpose and a BOUNDARY line. Three HISTORY blocks are deleted. Executable code is unchanged.

Dated floor logs that still have their why beside the rule are not listed. Those moved on purpose under ruling 115 and hard rule 17. What follows is meaning a reader of the new comment no longer has.

The three HISTORY deletes (policy deferred-map story, trailing-`//` plant, `site-header.tsx` rename) restated facts the remaining comments or the code still carry, and are not listed.

## Lost or changed meaning

### 1. `scripts/check-stack.mjs` (header)

**Old:**

> Second, and easier to miss: this gate reads `wrangler.jsonc.example`, which is not what is deployed. [...] The single thing binding it to the Worker that actually runs is `check:config`, which compares the example against the real `wrangler.jsonc`. That file is gitignored, so `check:config` can only run where it exists, which is one machine, and CI CANNOT CLOSE THIS GAP. That is measured, not assumed: a checkout has no real config and `postinstall` bootstraps one by copying the example, so real equals example by construction and the gate cannot pass. It is in `CI_EXCLUDED`. A green `check:stack` therefore says the artifact matches the example. It says the artifact matches PRODUCTION only as far as someone remembered to run `check:config` on the machine that holds the real config.

**New:**

> BOUNDARY, TWO LIMITS: it cannot tell whether the hand-written PROSE is true, only that the binding it describes exists, and it reads the EXAMPLE config, which is not what is deployed.

**Lost:** That CI cannot close the example-versus-production gap, because a checkout bootstraps the real file from the example and the two then compare equal by construction. A green `check:stack` on CI now reads as if the artifact matched production.

### 2. `scripts/restore-drill.mjs` (header)

**Old:**

> D1 TIME TRAVEL IS THE OTHER PATH AND CANNOT BE DRILLED HERE
>
> Time Travel is on for this database (a bookmark reads back today) and is the first thing to reach for at 2am, which is why `docs/RUNBOOK.md` puts it ahead of this. It restores a database IN PLACE to a bookmark; there is no form of it that targets a different database. So a non-destructive drill cannot exercise it, and no gate here can.

**New:**

> BOUNDARY: it takes its OWN export, so the claim is that the path round-trips rather than that a kept artifact is restorable, and it never touches production, enforced by one guarded writer.

**Lost:** Time Travel cannot be drilled here, and the runbook puts it first for that reason. The remaining header explains the export-round-trip claim and the production guard. It does not say the other restore path is untestable.

### 3. `scripts/check-migrations.mjs` (header)

**Old:**

> RULE 12 CANNOT BE SATISFIED HERE, and that is stated rather than papered over. A new gate is supposed to be tested by replaying the defect it was written for. No such defect exists: no migration in this repo has ever been edited after being applied. So this gate is verified by PLANTS ONLY, which the rule warns are written to match the implementation rather than the bug. If an edited migration is ever discovered, replay it against this gate before trusting the plants.

**New:**

> BOUNDARY: IT PROVES THE FILES MATCH THE MANIFEST. Nothing more. It does not prove the manifest was honest when written, and it does not know what the LIVE database applied, which is `check:invariants --remote`'s half.

**Lost:** This gate is plants-only, and a real edited-after-apply must be replayed before the plants are trusted. The remaining boundary still says the manifest can be regenerated in the same commit; `--force` still refuses a changed hash. The rule-12 hole is gone.

### 4. `scripts/lib/strip-comments.mjs` (header)

**Old:**

> Three JSONC readers and check:logo's SVG path keep their own weak strippers. [...] moving a weak reader onto this one is a decision that needs a measurement rather than a tidy-up.
>
> `app/lib/media/template-refs.mjs` is string-aware; `check-urls.mjs` strips blocks only, on purpose, because it needs `//host` inside strings to survive; `check-contrast.mjs` and `scripts/lib/tokens.mjs` are CSS, where `//` is never a comment. Unifying different jobs is the wrong cut and is not done here.

**New:**

> BOUNDARY: it is a JAVASCRIPT TOKENIZER, so it reads an apostrophe in SVG text as opening a string and a slash after an operator as opening a regex, and the CSS readers, where `//` is never a comment, are not this job.

**Lost:** The named list of jobs that must not be folded in, and the prohibition on moving a weak JSONC or SVG reader onto this tokenizer without a measurement. `check-urls.mjs` still says it strips blocks only; the other names are gone from this file.

### 5. `scripts/check-policy.mjs` (header)

**Old:**

> EVERY RULE HAS A PAIRED NEGATIVE, on the same principle as check:search. A policy that only refuses has not been shown to permit anything, and a policy that only permits is not a policy. The case that matters most is the FORGERY pair: an operator submitting its own first_published must not be able to assert the fact the gate is checking, and the admin must still be able to publish the same post.

**New:**

> BOUNDARY: the decision function in isolation, and pure. It proves what the policy DECIDES, never that a caller consults it before writing.

**Lost:** The standing rule for adding a case. The forgery cases and "The paired positives" comments remain; the requirement that every new rule come with both arms does not.

### 6. `scripts/build-og.mjs` (the measure)

**Old:**

> 72px of side padding leaves a 1056px measure, which is what the ladder in og-card-text.mjs was measured against; changing it invalidates those breakpoints and is not a cosmetic edit. 64px top and bottom is the smallest margin at which the mark still reads as placed rather than as cropped.

**New:**

> THE MEASURE: the side padding sets the width og-card-text.mjs's ladder was measured against.

**Lost:** Why `PAD_Y` is 64. The constants are still `PAD_Y = 64` and `PAD_X = 72`. Changing the side padding still has its why; changing the top and bottom now looks cosmetic.

## Comment-stripped source

The stripper is `stripComments` from `scripts/lib/strip-comments.mjs` (the gates' tokenizer), default options: each comment becomes a space, no `preserveLines`. All 93 files in `WAVE2` were compared from `origin/main` to the draft.

Raw strip is not byte-identical in 48 of the 93. Those 48 are smaller on the draft side, by leftover empty lines: a deleted or shortened own-line comment leaves a whitespace-only line in the stripped original and no line in the stripped draft.

Dropping whitespace-only lines, all 93 files are byte-identical. The same holds after also stripping trailing blanks on remaining lines. Mismatch count on either comparison: 0. No inserts.

Tag table on the draft: CONTRACT 1295, WHY 730, NUMBER 84, HISTORY 3; rewrite 1202, keep 907, delete 3.
