# Code-history-out wave 4 review: `review/code-history-out-wave4-draft` vs `main`

Compared `origin/main` `e3fc98a` (wave 3 merge, merge-base of this branch) to `origin/review/code-history-out-wave4-draft` `6d27299`. The branch rewrites comments in the 66 `app/**/*.tsx` files listed as `WAVE4` in `scratchpad/code-wave4.mjs`. TSV: 913 blocks, CONTRACT 828, WHY 80, NUMBER 5; 656 rewrite, 257 keep, 0 delete. Executable code is unchanged except `app/routes/admin.tools.tsx`: `auditSecrets({ ...env })` in place of `auditSecrets(env as unknown as Record<string, unknown>)`.

Dated floor logs that still have their why beside the rule are not listed. Those moved on purpose under ruling 115 and hard rule 17. What follows is meaning a reader of the new comment no longer has.

## Lost or changed meaning

### 1. `app/routes/admin.posts._index.tsx` (`readAskBudget` catch)

**Old:**

> The catch is attached AT CREATION, not at the await. A promise that rejects before anything awaits it is an unhandled rejection, and starting work early is exactly what creates that gap. `askStatusReader` resolves to null rather than throwing, so only this one needs it, and it keeps the same "a failing budget read must not take the page down" behaviour the awaited try/catch had.

**New:**

> The catch is attached AT CREATION: a promise that rejects before anything awaits it is an unhandled rejection, and starting work early creates that gap.

**Lost:** The prohibition the catch exists to keep: a failing budget read must not take the page down. The remaining comment explains unhandled rejection. It does not say the page must still render when the Durable Object read fails.

### 2. `app/routes/admin.posts._index.tsx` (bulk-delete ladder)

**Old:**

> **THE TYPED-COUNT LADDER, ENFORCED HERE AND NOT ONLY IN THE UI.** It lived entirely in `confirmDelete()`, an `onClick` handler calling `prompt()`. With scripting off the handler never ran, the button submitted, and this loop deleted every selected post with no confirmation at all. The ceremony was script-only while the destruction was not, which is exactly the defect `empty-trash` was fixed for and which survived here because that fix closed one instance and never swept for siblings. AN UNCONFIRMED DELETE IS NOT AN ERROR, IT IS THE CONFIRMATION STEP. Refusing with the slugs in hand lets the page render a real server-rendered second step, so the no-script path gets a confirmation rather than a dead end. Counted from the slugs in THIS request, never from a number the form carried, so a stale page cannot authorise a delete of a different size than the operator was shown.

**New:**

> **THE LADDER IS ENFORCED HERE, NOT ONLY IN THE UI**: with scripting off an `onClick` ceremony never runs. An unconfirmed delete is the CONFIRMATION STEP, not an error.

**Lost:** The no-script contract of *what* is counted. The typed count is taken from the slugs in this request, never from a number the form carried, so a stale page cannot authorise a different-sized delete. The remaining comment still says the ladder lives in the action and that an unconfirmed delete is a second step. It does not say the count is derived from this submission.

### 3. `app/routes/admin.posts.$slug.edit.tsx` (single-post delete)

**Old:**

> **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.** It was a `confirm()` in an `onSubmit` handler. With scripting off the handler never ran, the form posted, and the file and its rows went with no confirmation at all. `expectedHeadSha` below is CONCURRENCY, not consent: it stops a stale page overwriting a newer one, and says nothing about whether a human meant to delete anything. One post, so the count is 1. Same predicate and same field name as the bulk and empty-trash paths, because three spellings of one ceremony is how one of them ends up unchecked. An unconfirmed delete is the CONFIRMATION STEP, not an error: the route renders a server-rendered second step from this, so a reader without script gets a confirmation rather than a refusal they cannot satisfy.

**New:**

> **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.** With scripting off the handler never ran and the file went with no confirmation at all. `expectedHeadSha` is CONCURRENCY, NOT CONSENT: it stops a stale page overwriting a newer one and says nothing about whether a human meant to delete.

**Lost:** The asserted count of 1, the prohibition on a third spelling of the ceremony, and the no-script boundary that an unconfirmed delete must render a server-rendered second step rather than a refusal a scriptless reader cannot satisfy. The call is still `confirmationSatisfied(typed, 1)`. The comment no longer says why 1, or that the three delete paths share one predicate.

### 4. `app/routes/blog.$slug.tsx` (related list)

**Old:**

> THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS. `withRelated` composes the shared visibility rule at WRITE time, which is where the scheduled-post leak was fixed. That is not enough on its own: the list is stored on the row, and a post can be unpublished, or have its publish date pushed out, after a list naming it has already been written. Nothing rewrites its neighbours' related lists when that happens, so without this the stale title and its URL keep rendering on a public page. One indexed query for the whole list, composing `publiclyVisible()` like every other public read, so there is no second opinion about what public means. It is the same instrument, and the same reasoning, as the Ask replay path's citation re-check.

**New:**

> THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS. The list is stored on the row, and a post can be unpublished after a list naming it was written, so without this a stale title and URL keep rendering on a public page.

**Lost:** The visibility contract. The re-check composes `publiclyVisible()`, the same predicate as every other public read, because write-time `withRelated` is not enough once a neighbour is unpublished or has its date pushed out. The remaining comment still says why the list is re-read. It does not say which predicate, or that a second opinion about "public" is the defect.

### 5. `app/routes/blog.$slug.tsx` (prev / next)

**Old:**

> PREV AND NEXT AS TARGETS, not as a line of text. They were two inline links reading "Previous: <title>", so the label and the title were one run of text and the hit area was whatever the words happened to occupy. Each is now a bordered block carrying the label above the title, which gives it a real 24px-plus target on touch and lets the direction be read before the title rather than parsed out of the same sentence. NO IMAGE, deliberately. The verified reference carries a label and a title and nothing else, and a thumbnail here would be a third image on a page that already has a cover and a card. `rel="prev"` and `rel="next"` are kept: they are the machine-readable half and nothing about the styling replaces them.

**New:**

> Each is a bordered block carrying the label above the title, which gives it a real touch target and lets direction be read before the title. `rel="prev"` and `rel="next"` are the machine-readable half and are kept.

**Lost:** The asserted 24px-plus target, the prohibition on a thumbnail (third image on a page that already has a cover and a card), and that label-plus-title in one run of text was the old hit area. "Real touch target" is not the same number.

### 6. `app/routes/home.tsx` (writing tile)

**Old:** the three numbers are read at render; then, separately, writing is `total` from `listHomeStartHere`, the same `publiclyVisible()` predicate the blog index counts with, in the same batch.

**New:** the three numbers are read at render from the instruments that own them, never typed into this file. The cached-page and health-run prohibitions stay.

**Lost:** Which instrument owns the writing count, and that it is the same `publiclyVisible()` predicate as the blog index. Changing the tile to a different count now looks like copy, not a visibility bug.

### 7. `app/routes/about.tsx` (build-time markdown)

**Old:**

> The grounds for rendering it at build time rather than in the Worker are on `buildAbout` in `scripts/build-content.mjs`: the public plane must not grow a second markdown renderer and must not pay for the first one on a static page.

**New:** why the prose is in markdown (taste, not a file a reader can check) and why JSON-LD is the home page's `personJsonLd`. No renderer sentence.

**Lost:** Two prohibitions: the public plane must not grow a second markdown renderer, and must not pay for the first one on a static page. The remaining comment still says why the author edits markdown. It does not say why the Worker must not render it.

### 8. `app/components/enhancement-script.tsx` (optional nonce)

**Old:**

> The nonce is the same read Layout does, and it is OPTIONAL for the same reason: on the error-boundary path the root loader never ran, there is nothing honest to stamp, and under the enforcing CSP (script-src is nonce plus strict-dynamic, no 'self') the browser then refuses the fetch. An error page costs its enhancements and nothing else; the markup they would have upgraded still works, which is rule 9's fallback doing its job.

**New:**

> The nonce is OPTIONAL because on the error-boundary path the root loader never ran and there is nothing honest to stamp; the browser then refuses the fetch. An error page costs its enhancements and nothing else, and the markup they would have upgraded still works.

**Lost:** Why the browser refuses: `script-src` is nonce plus `strict-dynamic` and has no `'self'`. Without that, "the browser then refuses the fetch" reads as a browser quirk rather than the CSP this tag is built for. The hard rule 9 citation went with it. The fallback (markup still works) stays.

### 9. `app/components/admin/media-grid.tsx` (`role="grid"`)

**Old:**

> A plain list. NOT role="grid": positional information is meaningless to a screen reader here, because the number of columns depends on the container width, and directional navigation does not help anyone find a specific picture. Semantic elements first; the only ARIA on this page is the nav label above and aria-current on the active chip.

**New:**

> NOT `role="grid"`: positional information is meaningless to a screen reader here, because the column count depends on the container width and directional navigation does not help anyone find a picture.

**Lost:** The accessibility inventory and the prohibition that follows from it: semantic elements first, and the only ARIA on this page is the nav label and `aria-current` on the active chip. The remaining comment still forbids `role="grid"`. It does not say what ARIA is allowed, so a later `aria-*` on a tile looks like an improvement.

### 10. `app/components/admin/post-editor.tsx` (`useBlocker` pathname comparison)

**Old:** every save is a POST followed by a redirect the router performs, which is a navigation and would otherwise be blocked; comparing pathnames lets an edit through (same path, new search params). `onSubmit` already clears `dirty` before the request leaves, so this is the second guard, and it is the one that survives a new post's save, which redirects from `/admin/posts/new` to a different path.

**New:**

> An ENHANCEMENT, not a gate: nothing here refuses a save, and with scripting off none of it runs. The pathname comparison lets a save's own redirect through, which the flag it is about to clear would otherwise block.

**Lost:** That a new post's save navigates to a *different* path, so the pathname comparison does not let that save through; `dirty` has to be cleared first. The remaining comment still says the comparison is for the save's own redirect. A reader who only has the new text will think pathname equality is enough for every save.

## Comment-stripped identity

`stripComments` from `scripts/lib/strip-comments.mjs` (comment becomes a space), then drop whitespace-only lines (`codeOnly` in `scratchpad/code-history-apply.mjs`). Compared each of the 66 WAVE4 files to `origin/main` `e3fc98a`. Control: flip the first alphabetic byte of `app/routes/admin.posts._index.tsx`; `codeOnly` then disagrees.

| check | result |
|---|---|
| WAVE4 file count | 66 |
| raw `stripComments` vs `origin/main` | 24 of 66 differ (leftover empty lines from shortened own-line comments, same class as waves 2 and 3) |
| `codeOnly` vs `origin/main` | **65 of 66 identical** |
| `codeOnly` vs snapshot (`WAVE=4 prove`) | 65 identical; 1 DIFFERS |
| control discriminates | yes |
| citations / JSDoc heads / `JUSTIFIED SUBSTITUTION` | unchanged on every file |

The one `codeOnly` mismatch is `app/routes/admin.tools.tsx`, the named assertion fix: `auditSecrets({ ...env })` instead of the `as unknown as Record<string, unknown>` cast. `Env` is an interface and has no implicit index signature; the spread is a shallow copy the audit only reads. Prove reports that file as DIFFERS and exits 1. That is the exception the branch stated, not a silent code change.

On the other 65 files, comment-stripped source (whitespace-only lines dropped) is byte-identical to `main`.
