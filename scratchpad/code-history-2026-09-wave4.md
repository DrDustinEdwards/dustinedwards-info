# Code comment history, 2026-09, wave 4

Extracted under ruling 115, from e3fc98a. Every comment block this wave
deleted or shortened is here VERBATIM, with the file and line it had at
e3fc98a, its tag, and why it moved. Wave 4 takes the 66 files under app/ ending in .tsx.
The files keep only the short why and the contract; this is where the
measurements, dates and the story went.

## app/routes/admin.posts._index.tsx

### app/routes/admin.posts._index.tsx:40 (CONTRACT, shortened)

header: the derived state and why it is computed in the loader.

```tsx
/**
 * The pill's three states out of the two the database stores.
 *
 * "scheduled" is derived, not a column: `status` is only ever draft or
 * published, and a published row whose `publish_at` is still ahead of now is
 * live to the admin and invisible to the public. The test is deliberately the
 * same one `publiclyVisible()` runs, so the pill cannot claim a post is on the
 * site when the public query would hide it.
 *
 * Derived in the LOADER rather than in the component, because it reads the
 * clock. Computed during render it would be evaluated once on the server and
 * again on the client, and a post scheduled for the next few seconds would
 * hydrate into a different word than it rendered with.
 */
```

### app/routes/admin.posts._index.tsx:64 (CONTRACT, shortened)

header: stated once, and what a mismatch costs.

```tsx
/**
 * The id tying a row's button to the form it submits, STATED ONCE.
 *
 * The button and the form are rendered in two different places, hundreds of
 * lines apart, and a browser resolves the pair by string equality alone: a
 * mismatch produces a button that submits the whole page's default form or
 * nothing at all, silently, with no error anywhere. One function means the two
 * spellings cannot drift.
 *
 * Slugs match `SLUG_PATTERN`, so the result is always a valid HTML id.
 */
```

### app/routes/admin.posts._index.tsx:82 (CONTRACT, shortened)

header: why the state is in the URL; the example names the failure.

```tsx
/**
 * The filter state, read from the URL and normalized.
 *
 * URL-driven rather than component state, which is what makes it work with
 * scripting off and makes a filtered list a LINK. `status` is validated against
 * the three states the pill can show, so a hand-typed `?status=banana` degrades
 * to "no status filter" rather than silently matching nothing and looking like
 * an empty corpus.
 */
```

### app/routes/admin.posts._index.tsx:100 (WHY, shortened)

header: the rounding direction and the prohibition it protects.

```tsx
/**
 * Days from now until a scheduled post goes live, rounded UP.
 *
 * Ceiling rather than round, because a post going live in 30 hours is "in 2
 * days" and never "in 1 day": the author must not read a number that has
 * already passed. Computed in the LOADER for the same reason `statusOf` is;
 * see the note there.
 */
```

### app/routes/admin.posts._index.tsx:113 (WHY, shortened)

tagged by what STAYS; the date, the median and the misdirected fixes go to the history document.

```tsx
/*
   * INSTRUMENTED 2026-08-22, and this route is why the session exists.
   *
   * It cost 1,420ms median with NOT ONE `timed()` call, while its two D1
   * queries measure 0.33 to 0.47ms IN D1. Roughly 1,400ms was unattributed, and
   * three previous fixes landed on the 90ms layout because the layout was the
   * only thing marked. Every await below now has a name.
   */
```

### app/routes/admin.posts._index.tsx:126 (CONTRACT, shortened)

the independence and what it buys; the twelve samples go to the history document.

```tsx
/*
   * THREE INDEPENDENT READS, STARTED TOGETHER.
   *
   * MEASURED on production 2026-08-22, twelve samples, and the marks tiled
   * `loader_total` with a residual of EXACTLY ZERO on all twelve, which is what
   * proved they were strictly serial: d1_admin_posts 80ms + ask_status_uncached
   * 182ms + ask_budget_do 50ms = loader_total 314ms at the median.
   *
   * None of the three reads anything the others write. D1, AI Search and a
   * Durable Object are three different backends. So the loader's floor is the
   * SLOWEST of them, not their sum.
   *
   * This is the third instance of one shape in this repo: the admin layout's
   * drift and nav counts were serial, and the editor awaits five times inside
   * its returned object literal. Started here, awaited below, in the order the
   * work downstream actually needs them.
   */
```

### app/routes/admin.posts._index.tsx:146 (WHY, shortened)

the prohibition: a rejection before the await is unhandled, and what the catch keeps.

```tsx
/*
   * The catch is attached AT CREATION, not at the await. A promise that rejects
   * before anything awaits it is an unhandled rejection, and starting work
   * early is exactly what creates that gap. `askStatusReader` resolves to null
   * rather than throwing, so only this one needs it, and it keeps the same
   * "a failing budget read must not take the page down" behaviour the awaited
   * try/catch had.
   */
```

### app/routes/admin.posts._index.tsx:162 (CONTRACT, shortened)

why it joins the group and why it needs no catch.

```tsx
/*
   * A FOURTH INDEPENDENT READ, started here with the other three. Roadmap G.
   *
   * Analytics Engine is a fourth backend and shares nothing with D1, AI Search
   * or the budget Durable Object, so it belongs in the same concurrent group
   * and the loader's floor stays the SLOWEST of the four rather than their sum.
   * That is the property the comment above this block measured and it is why
   * this is a promise rather than an await.
   *
   * `fetchPostReadership` never rejects: it returns the error arm of
   * `SourceResult`, which is what the column renders as an absence with a
   * reason. So there is no catch here, unlike the budget read.
   */
```

### app/routes/admin.posts._index.tsx:197 (CONTRACT, shortened)

the hydration boundary, which is why the number is computed here.

```tsx
// Only a scheduled post has one, and it is a NUMBER by the time the
      // component sees it. Rendering "in N days" from a date in the component
      // would read the clock during render, which is the trap `statusOf`
      // already documents: the server and the hydration would disagree for any
      // post near a day boundary.
```

### app/routes/admin.posts._index.tsx:221 (WHY, shortened)

the prohibition on public routes awaiting the AI layer, and the one-listing rule.

```tsx
// Ask index drift, shown because the editor's Ask sync is allowed to fail
  // without failing the save. This is an ADMIN page, so it may await the AI
  // layer; no public route ever does.
  //
  // The status now comes from the reader the admin layout's middleware put on
  // the context, because the Posts nav badge wants the same fact and a listing
  // per consumer would be two. It still arrives in THIS route's loader data:
  // the alert owns the repair, and check:admin-ui fabricates `ask` here.
```

### app/routes/admin.posts._index.tsx:229 (WHY, shortened)

tagged by what STAYS; the measured variance range goes to the history document.

```tsx
/*
   * THE PRIME CANDIDATE, now a measurement instead of an argument.
   *
   * This is the UNCACHED Ask reader. `askDriftCount` gave the nav badge a
   * short-TTL KV cache precisely because this call's per-call variance is 46 to
   * 2,055ms measured, and that fix took it off the LAYOUT's path. This page
   * still makes it, on every load, and nothing named it until now.
   */
```

### app/routes/admin.posts._index.tsx:239 (WHY, shortened)

why a DO read is a candidate; the diagnosis story goes to the history document.

```tsx
/*
   * A SECOND UNMARKED AWAIT, which the diagnosis did not name: this reads the
   * ASK_BUDGET Durable Object. A DO read is a network hop and a cold object has
   * to be woken, so it is a candidate on the same footing as the Ask reader and
   * it had no more instrumentation than the other did.
   */
```

### app/routes/admin.posts._index.tsx:258 (CONTRACT, shortened)

the prohibition: the count must not follow the filter.

```tsx
/**
     * The scheduled queue's headline number, counted over the WHOLE corpus and
     * not the filtered view. What is scheduled is a fact about the site, and it
     * must not disappear because the author happened to be searching.
     */
```

### app/routes/admin.posts._index.tsx:264 (CONTRACT, shortened)

one array for count and list; the media library's defect goes to the history document.

```tsx
/**
     * THE TAB COUNTS, off the SAME array the list is drawn from.
     *
     * Not a second query, which is the media library's recorded defect: its
     * Unused chip counted with one predicate and filtered with another, so the
     * chip and the grid disagreed. Counted over `all` rather than `posts`,
     * because a tab's job is to say how many are behind it, and a count that
     * shrank to the current filter would say nothing.
     */
```

### app/routes/admin.posts._index.tsx:281 (CONTRACT, shortened)

why the whole report travels; the ruling citation stays on one line.

```tsx
/**
     * Origin requests by path, or the reason there are none. Roadmap G.
     *
     * The WHOLE report rather than a per-row number, because the column has to
     * tell a measured zero from an unasked question and only `complete` and the
     * error arm carry that. Flattening it to `readership[slug] ?? 0` in the
     * loader would throw away the distinction ruling 2 turns on.
     */
```

### app/routes/admin.posts._index.tsx:303 (CONTRACT, shortened)

why the actor is required rather than defaulted.

```tsx
/*
   * WHO IS ASKING, read once for every branch below. The layout middleware put
   * it here; `savePost` and `deletePost` require it rather than defaulting to
   * the most privileged principal, so the bulk paths say it explicitly.
   */
```

### app/routes/admin.posts._index.tsx:328 (WHY, shortened)

the destructive semantics and why the typed count is 1.

```tsx
/*
     * **THE CONFIRMATION, CHECKED HERE. Ruled 2026-08-17.**
     *
     * "Sync" reads as additive and is not: `pruneAskCorpus` DELETES every AI
     * Search record whose key is not in the set this run uploaded, and the run
     * also drops cached answers. So a sync against a partial artifact prunes
     * the index to whatever that artifact contained, and the button sat one
     * item below Regenerate in the same menu with nothing between a mis-click
     * and that outcome.
     *
     * The count is 1 rather than the number of records at risk, for the same
     * reason as the media rebuild: how many a prune removes is not knowable
     * without running it, so a typed count would be invented precision. The
     * step states the corpus size instead, which is what is actually at stake.
     */
```

### app/routes/admin.posts._index.tsx:367 (CONTRACT, shortened)

header: the by-construction guarantee; section F and the title reasoning go to the history document.

```tsx
/*
   * DUPLICATE AS TEMPLATE. Section F item 3.
   *
   * Reads the committed file, gives it a free slug, and re-enters `savePost` as
   * a NEW post. There is no second write path and no copy of the frontmatter
   * logic: the copy is serialized by the same `serializePost` the editor uses,
   * so anything the editor round-trips, this round-trips.
   *
   * ## IT CANNOT BE A BACK DOOR TO A FIRST PUBLICATION, BY CONSTRUCTION
   *
   * The copy is written with `draft: true`, so `decide()` sees `wantsPublished`
   * false and cannot classify the write as `published-first` whatever the
   * source post's state was. That is the structural half. The stamping half is
   * the same call: `priorRaw` is null for a new slug and the post is a draft,
   * so `forceFirstPublished` REMOVES the key rather than carrying the original
   * one across. Clearing it here as well is belt and braces and is written down
   * as such, because a reader looking for the guarantee should find it in the
   * policy module rather than in this route's good manners.
   *
   * ## WHAT IS COPIED, AND WHY THE TITLE IS NOT TOUCHED
   *
   * Everything except the publication state. Section F asks for the same body
   * and frontmatter, and a route that also invented a title would be making an
   * editorial decision on the author's behalf in the one place they are about
   * to look anyway: the copy opens in the editor. The list tells the two apart
   * by slug, which is the field that had to change.
   */
```

### app/routes/admin.posts._index.tsx:400 (WHY, shortened)

the derived-store rule; the citation keeps the original spelling.

```tsx
/*
     * The first candidate with no committed file wins. Probed against the
     * repository rather than against the loader's D1 rows, because D1 is a
     * DERIVED store (rule 18) and the file is what `savePost` will refuse on.
     * Asking the derived copy would let a row that had drifted hand out a slug
     * the commit then rejects.
     */
```

### app/routes/admin.posts._index.tsx:441 (CONTRACT, shortened)

keeps the load-bearing prohibition; read-modify-write and no-confirmation go to the history document.

```tsx
/*
   * UNPUBLISH FROM THE LIST. Section F item 4.
   *
   * THE SAME TRANSITION THE EDITOR'S "Revert to draft" MAKES, reached without
   * opening the post. No new policy and no new writer: read the committed file,
   * flip one flag, and go back through `savePost`, which is the door every
   * other write in this repo uses.
   *
   * ## WHY IT IS A READ-MODIFY-WRITE AND NOT A POST TO THE EDIT ROUTE
   *
   * The editor's unpublish carries the whole post in its payload, because the
   * author may have edited the body in the same breath. A list row carries a
   * slug and nothing else, so posting that payload to the edit route would
   * serialize a post with an empty body and destroy it. The file is the only
   * thing that knows what the post says, so the file is what gets read.
   *
   * ## NO CONFIRMATION, DELIBERATELY, and the ladder is the reason
   *
   * Bulk delete types the count and single delete confirms, because both are
   * recoverable only through git. This is reversible by its own inverse, in one
   * click, and the message says how. A ladder whose every rung is the same
   * height has no rungs, which is the argument the delete path already makes
   * here in as many words.
   *
   * `expectedHeadSha` IS OMITTED, the same no-optimistic-check path the bulk
 * operations below take and for a weaker version of the same reason. The window
 * is between this read and the commit, and what it costs is one concurrent edit
 * to the body being overwritten with the copy this action read. `commitFiles`
 * re-reads head itself, so nothing is lost from another POST; only a save this
 * action never saw could be. On a single-admin site with one editor open that
 * is a window nobody has hit, and carrying a sha from a list page rendered
 * minutes ago would refuse ordinary unpublishes for a fact the list never
 * displayed. Stated rather than left for a reader to notice.
 *
 * REPUBLISH IS NOT OFFERED ON THE LIST. `first_published` is frontmatter and
   * not a D1 column, so this loader cannot tell a never-published draft from a
   * withdrawn one without reading every file from GitHub. A republish control
   * that could not make that distinction would be a one-click first publication
   * on the rows where it is wrong, which is exactly what the ceremony reserves
   * to the editor. Republishing stays where the fact lives.
   */
```

### app/routes/admin.posts._index.tsx:487 (CONTRACT, shortened)

the committed file is the authority.

```tsx
// The COMMITTED file decides, not the row the page was rendered from. A
    // list open in another tab can be describing a post that has already been
    // withdrawn, and writing an identical file would cost a commit that changes
    // nothing.
```

### app/routes/admin.posts._index.tsx:512 (CONTRACT, shortened)

keeps the omitted sha; partial failure and the file-and-line citations go to the history document.

```tsx
/*
   * BULK OPERATIONS.
   *
   * Each one ITERATES the existing per-post write function, serially, one
   * commit per post. There is no bulk commit variant and no second write path:
   * `deletePost` and `savePost` stay the only mutators, so every gate, policy
   * and side effect that guards a single post guards each of these too.
   *
   * expectedHeadSha is OMITTED, which `commitFiles` documents as the
   * no-optimistic-check path (`github.server.ts:190` treats a falsy value as
   * "do not compare"). That is correct here rather than lax: each successful
   * commit ADVANCES head, so one captured sha would refuse on iteration two by
   * construction, and `commitFiles` re-reads head itself on every call
   * (`:188`), so each iteration already builds on the current tree. Re-reading
   * `currentHead` per iteration would add a round trip and protect against
   * nothing a single-admin bulk action can hit.
   *
   * PARTIAL FAILURE IS THE DESIGN CENTRE. There is no transaction across
   * posts, so the loop continues past a failure and reports per slug. That is
   * safe because each post is an independent commit and `deletePost` throws
   * before `commitFiles` when the file is missing, so a refused post leaves
   * nothing half-written.
   */
```

### app/routes/admin.posts._index.tsx:549 (WHY, shortened)

the no-script prohibition, what the count is taken from, and the rule that follows; the sibling-defect story goes to the history document.

```tsx
/*
       * **THE TYPED-COUNT LADDER, ENFORCED HERE AND NOT ONLY IN THE UI.**
       *
       * It lived entirely in `confirmDelete()`, an `onClick` handler calling
       * `prompt()`. With scripting off the handler never ran, the button
       * submitted, and this loop deleted every selected post with no
       * confirmation at all. The ceremony was script-only while the destruction
       * was not, which is exactly the defect `empty-trash` was fixed for and
       * which survived here because that fix closed one instance and never
       * swept for siblings.
       *
       * AN UNCONFIRMED DELETE IS NOT AN ERROR, IT IS THE CONFIRMATION STEP.
       * Refusing with the slugs in hand lets the page render a real
       * server-rendered second step, so the no-script path gets a confirmation
       * rather than a dead end.
       *
       * Counted from the slugs in THIS request, never from a number the form
       * carried, so a stale page cannot authorise a delete of a different size
       * than the operator was shown.
       */
```

### app/routes/admin.posts._index.tsx:593 (CONTRACT, shortened)

the blast-radius statement.

```tsx
// Retag ADDS or REMOVES one tag. It never replaces the set, so a post's
    // other tags are untouched and a mistake costs one tag rather than all.
```

### app/routes/admin.posts._index.tsx:608 (WHY, shortened)

why a no-op is skipped rather than committed.

```tsx
// A no-op post is SKIPPED rather than committed. Writing it anyway
        // would cost a commit that changes nothing, and would rewrite the
        // frontmatter of the two posts whose key order is not yet canonical.
```

### app/routes/admin.posts._index.tsx:651 (CONTRACT, shortened)

header: why tabs and what All is.

```tsx
/**
 * The status facet, which is FIXED and therefore tabs rather than a select.
 *
 * `key` indexes the loader's counts and `value` is the URL parameter. "All" is
 * the ABSENCE of the parameter rather than a fifth value, so the unfiltered
 * list and the All tab are one URL by construction.
 */
```

### app/routes/admin.posts._index.tsx:668 (CONTRACT, shortened)

header: what the prop is for and the gate that needs it.

```tsx
/**
   * The selection this page starts with. Empty in production, always: React
   * Router passes only loaderData, actionData, params and matches, so nothing
   * on the wire can set this.
   *
   * It exists for `check:admin-ui`, which renders one static pass and never
   * dispatches an event. Without a way to declare an initial selection the bulk
   * bar never mounts under the harness, and the three bulk intents contribute
   * no payload at all, which is how session D shipped with that gap stated.
   * scripts/lib/route-render.mjs spreads declared props last; the reasoning for
   * a prop over a fabricated loaderData field is recorded there.
   */
```

### app/routes/admin.posts._index.tsx:684 (CONTRACT, shortened)

the fixture contract.

```tsx
/* Defaulted for the same reason `readership` is: check:admin-ui renders this
     component against fabricated loader data, and a fixture written before this
     field existed must render zeros rather than throw. */
```

### app/routes/admin.posts._index.tsx:694 (CONTRACT, shortened)

header: the three-outcome prohibition.

```tsx
/**
   * Origin requests for one post's public route, or the reason there is none.
   *
   * THREE OUTCOMES AND THEY ARE NOT INTERCHANGEABLE. A number, a measured zero,
   * or an absence with a sentence. Ruling 2 of the blog roadmap: where the data
   * source cannot answer, the number is ABSENT and the panel says why, never a
   * zero and never a dash a reader could read as one.
   *
   * The measured zero is a real answer and is rendered as one: the source was
   * live, the result was complete, and this path had no origin requests in the
   * window. What it does NOT mean is that nobody read the post, which is what
   * the caveat under the table is for.
   *
   * `readership` is defaulted because `check:admin-ui` renders this component
   * against fabricated loader data, and a state written before this field
   * existed must render an honest absence rather than throw.
   */
```

### app/routes/admin.posts._index.tsx:729 (CONTRACT, shortened)

the pending contract; the contrast with /admin/media goes to the history document.

```tsx
/*
   * PENDING STATE, from the router. Every control on this page changes which
   * rows come back, so unlike /admin/media there is no display-only case to
   * exclude: any navigation here is a real fetch and all of them get the mark.
   * One attribute the stylesheet dims plus `aria-busy`. No spinner, no timer.
   */
```

### app/routes/admin.posts._index.tsx:739 (CONTRACT, shortened)

the hard rule 9 exemption and the keying prohibition.

```tsx
/*
   * Selection lives in the client, which the admin plane is allowed (hard rule
   * 9 exempts it, and /login with it). The public plane's law is untouched.
   *
   * Keyed by slug rather than by row index so a re-render, a sort or a filter
   * change cannot silently re-point a selection at a different post. The
   * selection is deliberately NOT persisted across a filter change either: the
   * bulk bar can only ever act on what the author can currently see.
   */
```

### app/routes/admin.posts._index.tsx:758 (WHY, shortened)

the defect the parameter carry closed, stated as the rule.

```tsx
/**
   * WHERE CANCEL GOES, and it carries the filter the operator was looking at.
   *
   * The confirmation used to send Cancel to a bare `/admin/posts`, which
   * silently dropped a status or tag filter the reader had set: they backed out
   * of one delete and lost the view they were working in.
   */
```

### app/routes/admin.posts._index.tsx:772 (CONTRACT, shortened)

the hydration boundary, which is the whole point of the flag.

```tsx
/**
   * Whether the client is running, for the two controls that must differ.
   *
   * Initialised false so the hydration render matches the server's. The bulk
   * bar's count is meaningless without script (nothing updates it) and the
   * server is the only thing that knows how many slugs a submission carried.
   */
```

### app/routes/admin.posts._index.tsx:793 (CONTRACT, shortened)

the agreement rule; the drifted wording goes to the history document.

```tsx
/*
          THE ONE STATUS SENTENCE, and it AGREES WITH THE NOTICE below it.

          Ruling 54 makes that a rule because the two drifted: the panel's
          description read "Every post, drafts included" while a drift alert
          under it said search was answering from stale text. The description
          was about the page; this is about the site right now.
        */
```

### app/routes/admin.posts._index.tsx:809 (CONTRACT, shortened)

why the create action is separated.

```tsx
/* New post is the only thing in this row that CREATES. The other three
          intents repair, so they sit behind the overflow on the far side
          rather than beside the primary action wearing the same weight. Every
          one of them submits the identical form it did before: same method,
          same intent value, same action. */
```

### app/routes/admin.posts._index.tsx:833 (WHY, shortened)

why the duplicate exists: the alert does not render when clean.

```tsx
/* Kept here as well as in the drift alert. The alert owns the repair
              when there is something to repair, but it does not render when the
              index is clean, and an intent that exists only while it is needed
              cannot be run pre-emptively. */
```

### app/routes/admin.posts._index.tsx:866 (CONTRACT, shortened)

the no-script contract; the fixture-regeneration note goes to the history document.

```tsx
/*
        SEARCH AND FILTER, as a GET form.

        A GET form is the whole design: the filter state lives in the URL, so it
        survives a reload, is linkable, is what the back button restores, and
        works with scripting off with no enhancement at all. That is also why
        this is a plain <form> rather than react-router's <Form>: the browser's
        own submission already produces exactly the navigation wanted.

        It is a NEW SUBMISSION on this page and therefore a real change to
        check:admin-ui's fixture. Regenerated deliberately, with the before and
        after triples reported, per the queue's standing rule.
      */
```

### app/routes/admin.posts._index.tsx:879 (CONTRACT, shortened)

keeps the scriptless tag facet; the no-Filter-button reasoning goes to the history document.

```tsx
/*
        ONE FILTER ROW: the search box on the left, then the status tabs.

        THE STATUS SELECT BECAME TABS because status is a FIXED vocabulary of
        four, and a select hides three of them behind a click while a tab row
        shows all four and how many are behind each. Tag stays a select: its
        vocabulary is whatever the corpus happens to contain, so it is not a
        fixed facet and a tab per tag would grow without limit.

        NO "Filter" BUTTON. The text input submits on Enter, the tabs are links,
        and the tag select carries the visually hidden submit below, which is
        what keeps the tag facet usable with scripting off: a select cannot
        submit its own form without either a button or script, and dropping the
        button entirely would have taken the tag filter with it.
      */
```

### app/routes/admin.posts._index.tsx:907 (CONTRACT, shortened)

the link and aria contract.

```tsx
/* Links, so the filtered view is a URL: it survives a reload, it is
            linkable, the back button restores it, and it needs no script.
            `aria-current` is what announces which one is on. */
```

### app/routes/admin.posts._index.tsx:926 (CONTRACT, shortened)

why zero renders and why it is announced as words.

```tsx
/* A count of ZERO renders. "Scheduled 0" is a real answer to
                    the question the tab poses; hiding it would make an empty
                    facet look like a missing one. Announced as words, because
                    a bare numeral beside a label reads as a position. */
```

### app/routes/admin.posts._index.tsx:1015 (CONTRACT, shortened)

the no-script path is the reason this step exists.

```tsx
/*
        THE SERVER-RENDERED CONFIRMATION STEP.

        Reached when the action refused an unconfirmed bulk delete, which is the
        no-script path: the handler that would have prompted never ran, so the
        request arrived with an empty confirmation and nothing was deleted. This
        is the second step, and it exists so the refusal is a confirmation
        rather than a dead end.

        It re-carries each slug as a hidden field, so the selection survives a
        round trip it never made as URL state, and it is an ordinary form: no
        script participates at any point.
      */
```

### app/routes/admin.posts._index.tsx:1028 (CONTRACT, shortened)

same shape, one line.

```tsx
/*
        THE SYNC-ASK CONFIRMATION. Same shape as the bulk-delete step below: the
        action refuses an unconfirmed run and returns what is at stake, and this
        renders it as an ordinary form so the no-script path reaches it too.
      */
```

### app/routes/admin.posts._index.tsx:1068 (WHY, shortened)

the disabled-submitter prohibition.

```tsx
/* THE INTENT IS A FIELD, not the submitter's value. The button is
              disabled until the count matches, and a disabled submitter sends
              neither its name nor its value. */
```

### app/routes/admin.posts._index.tsx:1078 (WHY, shortened)

why there is nowhere else to report it.

```tsx
/* Ask index drift. Surfaced here because a save is allowed to succeed
          when the Ask sync behind it fails, and the save then redirects, so
          there is nowhere else a failure could be reported. Nothing renders
          when the index is clean; the count still reaches the meta line under
          the table, where it is reference rather than a demand. */
```

### app/routes/admin.posts._index.tsx:1084 (CONTRACT, shortened)

the live-region prohibition.

```tsx
/*
          A STANDING CONDITION, so a named region and never a live one. It is
          rendered into the first byte of HTML on every visit; announcing it as
          news each time would interrupt a reader who came to do something else,
          and it is not news, it is a state the site is in.

          The words say what it means for a READER of the site rather than what
          it means for the index: ruling 54 keeps "Ask index" and "corpus" off
          the operator's page.
        */
```

### app/routes/admin.posts._index.tsx:1127 (CONTRACT, shortened)

the two-nothings prohibition.

```tsx
/* Two different nothings, and they must not read the same. An empty
           corpus is a state of the site; an empty RESULT is a state of the
           question just asked, so it repeats the question and offers the way
           back out. Reporting "no posts yet" to someone who mistyped a slug
           would be the system lying about itself. */
```

### app/routes/admin.posts._index.tsx:1147 (CONTRACT, shortened)

the nesting prohibition, which is why the form sits here.

```tsx
/* One Form around the bar AND the table, so the checkboxes are its
              own controls. Nesting a form inside another is invalid, which is
              why this sits here rather than wrapping the toolbar above. */
```

### app/routes/admin.posts._index.tsx:1151 (WHY, shortened)

the no-script defect and its repair; the measurement date goes to the history document.

```tsx
/*
              ALWAYS IN THE DOCUMENT, revealed by CSS. Ruling 54, and it closes
              a measured defect rather than a preference.

              It used to render only when `chosen.length > 0`, which is CLIENT
              state. With scripting off `onChange` never runs, `chosen` stays
              empty, and the bar never rendered at all: measured 2026-09-09 on
              the server render, `posts-bulk` absent, `bulk-delete` absent. So a
              scriptless operator could tick every checkbox and had no control
              to act on them, and the server-rendered confirmation step behind
              that control was unreachable from this page.

              `:has(.posts-check input:checked)` in admin-posts.css reveals it
              instead, which is the browser answering a question about its own
              checkboxes with no script involved. The row still submits `slug`
              per ticked box exactly as before.
            */
```

### app/routes/admin.posts._index.tsx:1169 (CONTRACT, shortened)

why the count is absent rather than wrong.

```tsx
/*
                  THE COUNT IS SCRIPT-ONLY, and says so by not appearing.
                  Nothing updates it without script, and a bar reading
                  "0 selected" above two ticked boxes is worse than a bar that
                  does not claim a number. The heading names the group either
                  way; the server counts the slugs the submission actually
                  carried, and the confirmation states that count.
                */
```

### app/routes/admin.posts._index.tsx:1215 (CONTRACT, shortened)

the keyboard contract; the 582px coincidence goes to the history document.

```tsx
/*
              THE SCROLLPORT, and the table scrolls inside it so the DOCUMENT
              does not. Measured on the deployed build once the topbar stopped
              being the widest thing on the page: this table's own min-content
              is 582px, the same number the topbar had, so for as long as both
              were 582 the table was invisible behind the bar. Two independent
              defects wearing one number.

              `tabindex` and the region role are what make a scrollable box
              usable rather than merely contained: without them a keyboard
              reader can see the clipped columns and has no way to reach them.
              The label names what scrolls, because "region" alone announces
              nothing.
            */
```

### app/routes/admin.posts._index.tsx:1231 (CONTRACT, shortened)

the one-owner rule and the SSR prohibition; the caption reasoning goes to the history document.

```tsx
/*
                THE CAVEAT, and it is `CACHE_SENTENCE` itself rather than a
                second telling of it. `app/lib/admin/origin-requests.mjs` owns
                that sentence and records the probe that produced it; a
                paraphrase here would be a second copy of a measured claim,
                free to drift from the measurement. Rule 17.

                IN THE CAPTION, matching the origin-requests panel, and for the
                same reason its own gate records: a caption is the element whose
                job is to say what a number is and is not, so it is the one
                place allowed to name the thing the column is being contrasted
                against. Every label surface stays plain.

                ONE STRING, not interpolated children, because React SSR splices
                comment nodes between adjacent text nodes and anything reading
                the markup back would have to strip them first.
              */
```

### app/routes/admin.posts._index.tsx:1268 (CONTRACT, shortened)

the gated copy law, which forbids four words.

```tsx
/*
                    THE LABEL IS "Reads counted", and it is where two rulings meet.

                    Ruling 54 takes "origin requests" off the operator's page. The
                    copy law gated in check-admin-ui.mjs forbids "views", "visits",
                    "visitors" and "traffic" here, because a cached read never
                    reaches the Worker and any of those words would overstate
                    readership by whatever the edge served. The participle is what
                    satisfies both: plain words that CLAIM only what was counted.
                    What is not counted is the disclosure under the table.
                  */
```

### app/routes/admin.posts._index.tsx:1303 (CONTRACT, shortened)

the forced-colors contract; the placement ruling goes to the history document.

```tsx
/* Rule 1: the state is a WORD first. Colour separates the
                          three at a glance and border-style separates them again,
                          so the pill still says three different things once
                          forced-colors has taken the fill and the tint away.

                          ON the title row since ruling 54, rather than in a
                          column of its own. The reader scans titles; the state
                          they want is the state of the title they just found,
                          and a column two cells away makes them track back. */
```

### app/routes/admin.posts._index.tsx:1315 (CONTRACT, shortened)

the forced-colors and screen-reader prohibition.

```tsx
/*
                        THE HERO, MARKED. The public index promotes one featured
                        post above the others and this list could not say which,
                        so the only way to find it was to read the markdown.

                        A WORD, for the same reason the status pill is a word:
                        rule 1, and a mark carried only by colour or an icon says
                        nothing under forced-colors and nothing to a screen
                        reader. It sits beside the state rather than in it,
                        because it is orthogonal: a featured post can be draft,
                        scheduled or published.
                      */
```

### app/routes/admin.posts._index.tsx:1335 (CONTRACT, shortened)

the no-clock-in-render contract.

```tsx
/* The queue, per post: a scheduled row says WHEN in
                        readable terms as well as in ISO. The number arrived
                        from the loader already computed, so nothing here reads
                        the clock. */
```

### app/routes/admin.posts._index.tsx:1345 (CONTRACT, shortened)

the three outcomes, short form.

```tsx
/*
                    ORIGIN REQUESTS for this post's public route. Roadmap G.
                    A number, a measured zero, or an absence carrying its own
                    sentence: never a bare dash, which reads as zero.
                  */
```

### app/routes/admin.posts._index.tsx:1358 (CONTRACT, shortened)

the tooltip prohibition, which is an accessibility statement.

```tsx
// The reason is the content, not a tooltip: a title
                        // attribute is invisible to touch and to a screen
                        // reader that does not announce it, and this sentence
                        // is the whole point of the cell.
```

### app/routes/admin.posts._index.tsx:1367 (CONTRACT, shortened)

the form-attribute contract; the fifty-odd-controls story goes to the history document.

```tsx
/*
                      ONE MENU PER ROW. It used to be up to four loose buttons
                      per row, which across fifteen rows is fifty-odd controls
                      competing with the fifteen names the reader came to find.

                      Every item still submits exactly what it submitted before:
                      same method, same intent value, same form. The buttons are
                      associated by the `form` ATTRIBUTE because this cell sits
                      inside the bulk selection form and forms cannot nest; the
                      row forms themselves sit below the table.
                    */
```

### app/routes/admin.posts._index.tsx:1398 (WHY, shortened)

the first-publication prohibition.

```tsx
/*
                        UNPUBLISH, on the rows where it is a real transition. A
                        draft has nothing to withdraw, and a never-published
                        draft must not be offered anything that changes public
                        state from here: first publication has a ceremony and it
                        lives in the editor.
                      */
```

### app/routes/admin.posts._index.tsx:1438 (CONTRACT, shortened)

the nesting and submitter prohibitions; the no-confirmation clause goes to the history document.

```tsx
/*
            THE ROW-ACTION FORMS, one pair per post, OUTSIDE the bulk form.

            They cannot live in the cells that hold their buttons: those cells
            are inside the selection form, a form cannot nest inside another,
            and a browser drops the inner one. Same resolution the editor's
            delete button already uses, by the `form` attribute.

            ## WHY THE SLUG IS A HIDDEN FIELD AND NOT THE BUTTON'S VALUE

            One shared form per intent with `name="slug"` on each button would
            be two forms in total instead of two per row, and it would put the
            slug in the SUBMITTER. `check:admin-ui` reads a submitter's name and
            value as the intent, so the page's submission tuple set would then
            grow by one entry per post and the fixture would be describing the
            corpus rather than the request surface. The gate's media pages
            already record that trap in as many words. With the slug as a field,
            every row contributes the identical tuple and the distinct set stays
            one wide however many posts exist.

            No confirmation on either: duplicate creates a draft and changes
            nothing public, and unpublish is reversible by its own inverse. The
            typed-count ladder is reserved for what only git can undo.
          */
```

### app/routes/admin.posts._index.tsx:1485 (CONTRACT, shortened)

the screen-reader reason the caption became a disclosure.

```tsx
/*
            THE CAVEAT, AS A DISCLOSURE. It was the table's `<caption>`, which a
            screen reader announces before every row and which spent five
            sentences at the top of the page explaining a column. The closed
            summary is enough to act on; the body is for whoever wants to know
            why the number is what it is.
          */
```

## app/components/admin/post-editor.tsx

### app/components/admin/post-editor.tsx:33 (CONTRACT, shortened)

header: the three regions and the payload contract; the checkbox era and the baseline move go to the history document.

```tsx
/**
 * The three-region post editor: a sticky command bar, a writing canvas, and a
 * settings drawer holding everything that is not writing.
 *
 * The body is still a textarea. CodeMirror, the exact preview and media
 * insertion are the next session; this one is the shell they land in.
 *
 * The payload was held unchanged from the checkbox era through the redesign,
 * asserted by check:admin-ui against a baseline generated before it. It CHANGED
 * on 2026-09-03, deliberately and for one reason: the `draft` field is gone and
 * the transition rides in the submitter's `intent`, because a payload assembled
 * by click handlers cannot be sent by a browser that is not running them. The
 * baseline moved in the same commit and the reasoning is in
 * publish-transition.mjs.
 */
```

### app/components/admin/post-editor.tsx:49 (CONTRACT, shortened)

the ruling 6 boundary and what the no-script reader keeps.

```tsx
/**
 * CodeMirror, in its own chunk.
 *
 * Ruling 6: editor machinery never reaches a public-plane bundle. This dynamic
 * import is the chunk boundary that makes that true, and the build output is
 * what proves it rather than this comment. It also means the editor's first
 * paint is the textarea below, which is what a reader with no script keeps.
 */
```

### app/components/admin/post-editor.tsx:65 (NUMBER, shortened)

why this interval and not a second.

```tsx
/**
 * How often the buffer age re-renders while dirty.
 *
 * Thirty seconds against a value that only ever reads in whole minutes: the
 * label can therefore lag its own truth by at most half the smallest unit it
 * shows, and a one-second tick would re-render the bar sixty times to change
 * the text once.
 */
```

### app/components/admin/post-editor.tsx:77 (CONTRACT, shortened)

header: the adjacency rule that stops it reading as a save.

```tsx
/**
 * Ruling 3's copy, as a pure function of two inputs so it is readable in one
 * place and cannot drift into the JSX.
 *
 * The wording is the ruling's own, "last written N minutes ago", and it is
 * rendered ONLY beside "Unsaved changes". That adjacency is what stops it
 * reading as a save: the buffer is local and uncommitted, the sentence next to
 * it already says so, and nothing here uses the word saved.
 *
 * Under a minute is "just now" rather than "0 minutes ago", which is both the
 * ruling's phrasing and the honest one for a value that rounds down.
 */
```

### app/components/admin/post-editor.tsx:98 (CONTRACT, shortened)

header: why it strips rather than transliterates.

```tsx
/**
 * Title to slug, matching the shape the save gate accepts and nothing more.
 *
 * Deliberately conservative: it strips rather than transliterates, because a
 * wrong guess at what a non-ASCII character should become lands in a permanent
 * URL. The field stays editable, so anything this gets wrong is one keystroke
 * from being right.
 */
```

### app/components/admin/post-editor.tsx:160 (CONTRACT, shortened)

the no-script property: server state, so the step is in the first byte.

```tsx
/**
   * Whether the action refused an unconfirmed first publication and this render
   * is the second step. Server state, so the step exists in the first byte of
   * HTML and needs nothing to run to appear.
   */
```

### app/components/admin/post-editor.tsx:169 (CONTRACT, shortened)

header: the prohibition on rewriting a chosen slug.

```tsx
/**
   * Whether the author has taken the slug over.
   *
   * Until they do, it tracks the title, which is what makes the new-post flow
   * one field instead of two. The moment they type in it, it stops moving:
   * silently rewriting a slug somebody chose, because the title was edited
   * afterwards, would change a URL they had already decided on.
   */
```

### app/components/admin/post-editor.tsx:186 (CONTRACT, shortened)

why a second input is needed; the unused-savedAt story goes to the history document.

```tsx
/**
   * The clock the buffer age is measured against, ticked ONLY while dirty.
   *
   * `savedAt` has been set on every persist since the buffer shipped and read by
   * nothing, so ruling 3's "last written N minutes ago" was the one part of the
   * autosave mechanism with no surface. A relative time needs a second input
   * that changes on its own, which is this.
   */
```

### app/components/admin/post-editor.tsx:195 (CONTRACT, shortened)

the two nulls that must not read the same.

```tsx
/**
   * Whether a persist has been ATTEMPTED, which `savedAt` alone cannot say.
   *
   * `writeBuffer` returns null both before it has ever run and when storage
   * refuses it (private mode, quota, storage disabled), and its own comment has
   * always said that saying so beats pretending. Nothing said so until now.
   */
```

### app/components/admin/post-editor.tsx:205 (CONTRACT, shortened)

why the editor states it.

```tsx
/**
   * The sha a revision was loaded from, or null.
   *
   * Stated in the editor because loading old content changes what the buffer
   * and the save mean, and an author who walked away mid-task must not come
   * back to a document that silently is not the current one. Cleared by a save,
   * along with the dirty flag.
   */
```

### app/components/admin/post-editor.tsx:234 (CONTRACT, shortened)

the bit that separates a failure from a first run.

```tsx
// `bufferTried` is the one bit that separates "the net failed" from "the net
    // has not run yet". Both leave `savedAt` null, and only the first is worth
    // telling the author about; without this the bar would have to stay silent
    // through a real storage failure to avoid crying wolf before the first
    // persist.
```

### app/components/admin/post-editor.tsx:249 (WHY, shortened)

the prohibition on automatic restore.

```tsx
// Offer a recovery only when the buffer says something different from what
  // the server just handed back. Restoring is never automatic: silently
  // replacing committed content with older local text is exactly the surprise
  // this is supposed to prevent.
```

### app/components/admin/post-editor.tsx:285 (CONTRACT, shortened)

keeps enhancement-not-a-gate, the pathname comparison and the save it does not cover; the beforeunload half goes to the history document.

```tsx
/**
   * THE OTHER HALF OF THE LEAVE GUARD. Section F item 8.
   *
   * `beforeunload` above is the browser's, and it only fires on a real document
   * unload: closing the tab, a reload, or following a link out of the site. In
   * a hydrated admin plane, clicking "Posts" in the nav or a row's Edit link is
   * a CLIENT-SIDE navigation that never unloads anything, so the guard that was
   * here covered the way an author is least likely to lose work and missed the
   * way they are most likely to.
   *
   * ## IT IS AN ENHANCEMENT, NOT A GATE, and the difference is load bearing
   *
   * Nothing here refuses a save, and with scripting off nothing here runs: the
   * public law (rule 9) exempts the admin plane, but the editor still has to
   * behave for a reader without script, and it does, because a blocker is a
   * router-level intercept on a navigation the router is performing. A scriptless
   * browser is doing full document navigations, where `beforeunload` is the
   * mechanism and it is the browser's rather than ours. So the two halves cover
   * the two worlds and neither is required for a save to land.
   *
   * ## WHY THE PATHNAME COMPARISON, and it is not cosmetic
   *
   * Every save is a POST to this route followed by a redirect the router
   * performs, which IS a navigation and would otherwise be blocked by the very
   * flag the save is about to clear. Comparing pathnames lets the save through:
   * an edit redirects to its own path with new search params. `onSubmit` already
   * clears `dirty` before the request leaves, so this is the second guard rather
   * than the only one, and it is the one that survives a new post's save, which
   * redirects from /admin/posts/new to a DIFFERENT path.
   */
```

### app/components/admin/post-editor.tsx:320 (WHY, shortened)

why a stale block is released.

```tsx
/*
   * A block that is no longer warranted is RELEASED rather than left standing.
   *
   * The state is held by the router, not by this component, so a `dirty` that
   * goes false underneath a blocked navigation (a save landing in another tab's
   * response, the buffer offer being accepted) would otherwise leave the author
   * looking at a question about changes that no longer exist, with the
   * navigation they asked for still parked.
   */
```

### app/components/admin/post-editor.tsx:333 (WHY, shortened)

the overlap this avoids; the dependency reasoning goes to the history document.

```tsx
/*
   * Tick the buffer age, ONLY while dirty.
   *
   * A clean editor's bar already reads "Saved <sha>", and adding a second
   * freshness line there would recreate exactly the overlap the preview pane's
   * own note records removing: two indicators describing freshness at one
   * glance, with the reader left to work out which is about the file. So this
   * runs when there is something uncommitted to qualify, and stops otherwise.
   *
   * `savedAt` is a dependency as well as `dirty`, so each persist re-syncs the
   * clock rather than waiting up to a full interval to catch up.
   */
```

### app/components/admin/post-editor.tsx:352 (CONTRACT, shortened)

the hydration boundary and where the preference lives.

```tsx
// The layout choice is a browser preference, not a fact about the post, so it
  // lives in localStorage and never reaches the server. Read after mount rather
  // than during render, so the server and the first client paint agree.
```

### app/components/admin/post-editor.tsx:373 (CONTRACT, shortened)

header: the one-renderer claim and the stale-response guard.

```tsx
/**
   * The exact preview, debounced.
   *
   * It posts the body to an admin-only route that renders it through
   * `pipeline.mjs`, the module the build and the Worker import, and returns the
   * fragment unmodified. So this is not an approximation of the published page;
   * it is the published markup, produced by the one renderer.
   *
   * A sequence number guards the response, because a fast typist can have two
   * renders in flight and the slower one can land last. Same trap the command
   * palette recorded: a fetch that resolves after its context has moved on will
   * happily paint a stale answer.
   */
```

### app/components/admin/post-editor.tsx:410 (CONTRACT, shortened)

header: the explicit intent and hard rule 13; the 2026-08-01 discovery goes to the history document.

```tsx
/**
   * Cmd+S / Ctrl+S. It SAVES, and it can never do anything else.
   *
   * It used to click the primary button, on the reasoning that the button's own
   * handler arms the `draft` field for the transition it names. That was wrong
   * in the one case that mattered: on a post that has never been published the
   * primary button is the publish CEREMONY trigger, so the universal save
   * shortcut opened the publish dialog, one Return away from making a draft
   * public. Found on the live deploy 2026-08-01.
   *
   * Now it submits the form directly, naming the transition that preserves
   * publication status rather than changing it.
   *
   * **IT SENDS THE IN-PLACE INTENT EXPLICITLY**, by enabling a disabled hidden
   * field just before submitting. `saveInPlaceIntent(state)` picks it off the
   * transition table: `save-draft` on a draft, `save` on anything already
   * public. That replaced arming a `draft` field to the post's current
   * committed state, which was the same intent expressed in the mechanism this
   * change removed; the shortcut is the one submit with no submitter, so it is
   * also the one place a hidden field is still the honest carrier.
   *
   * `requestSubmit()` with no submitter sends no `intent` at all, and
   * this path used to rely on the server defaulting an absent intent to "save".
   * That default was removed 2026-08-09: an absent intent on a WRITE path meant
   * a malformed POST performed a write instead of failing, which is hard rule
   * 13. The one legitimate caller now says what it means, so the server can
   * refuse everything else.
   *
   * The field is DISABLED at rest, so a normal button submit is unaffected: a
   * disabled control is not part of the submission set, and the submitter's own
   * `intent` is the only one sent.
   *
   * The ceremony is now reachable only by pointer or by focusing its trigger
   * and activating it deliberately. No keyboard shortcut opens it.
   */
```

### app/components/admin/post-editor.tsx:485 (CONTRACT, shortened)

keeps ruling 1 and the buffer rewrite; the dismissed-offer hazard goes to the history document.

```tsx
/**
   * Ruling 1: a revision LOADS into the editor. It does not write.
   *
   * Everything below is `setState`. There is no request here, and the fetch
   * that produced these fields was a GET to a route that exports no action, so
   * no path through this function can commit anything. What it produces is a
   * dirty editor holding old content, which Dustin then saves or abandons; a
   * save takes the ordinary write path and lands a new commit on top, exactly
   * as an edit typed by hand would.
   *
   * **The draft buffer is handled explicitly, and it has to be.** Two hazards,
   * both real:
   *
   * 1. A pending recovery OFFER is dismissed. The banner describes a buffer
   *    written before this load, so leaving it up would let one click silently
   *    replace the revision the author just chose with older local text, which
   *    is the exact surprise the offer exists to prevent.
   * 2. The buffer is rewritten IMMEDIATELY rather than on the usual idle
   *    timer. Otherwise a tab closed in the seconds after a restore would leave
   *    a buffer describing the pre-restore document, and the next load would
   *    offer to "recover" the author out of the revision they had just loaded.
   *
   * `persist` reads the FORM, so it runs after paint rather than inline: the
   * inputs are controlled and still hold the previous values until React has
   * committed this state.
   */
```

### app/components/admin/post-editor.tsx:541 (CONTRACT, shortened)

the modality prohibition, which is the accessibility half.

```tsx
/*
        THE LEAVE GUARD'S QUESTION, rendered rather than confirm()ed.

        A `confirm()` here would be shorter and would be the wrong shape twice
        over: it cannot be styled to say which post is at stake, and this repo
        has twice found a `confirm()` standing in for a server check that was
        not there. This one guards nothing on the server by design, so it is
        allowed to be pure interface, and being pure interface it should look
        like the rest of the interface.

        `role="alert"` rather than a `<dialog>`: the author's navigation is
        already stopped by the router, so nothing needs modality to hold them
        here, and a modal would trap focus around a question they can answer by
        continuing to type.
      */
```

### app/components/admin/post-editor.tsx:617 (CONTRACT, shortened)

why the value is carried at all.

```tsx
/*
          Server-owned, carried through only so a browser save PRESERVES it.
          serializePost writes exactly the keys it is handed, so a value this
          form did not carry would be dropped on the next edit and a published
          post would read as never published. Forging it achieves nothing: the
          save path overwrites it from the committed file.
        */
```

### app/components/admin/post-editor.tsx:625 (CONTRACT, shortened)

why this one stays hidden; the B004 relay list goes to the history document.

```tsx
/*
          `updated` is the LAST of the relayed B004 keys, and it stays a hidden
          input because it is the one the author does not own: the build derives
          it from the last commit touching the file and the editor stamps the
          current UTC date on save. Offering a control would invite an author to
          disagree with the two writers that already own it.

          The other six moved to `PostMetadata` below and are real controls now.
          They are still carried on every submission, which is what B004 asks
          for; what changed is that the value comes from something the author
          can see. `featured` in particular is still an explicit "true"/"false"
          and still never travels by presence alone.
        */
```

### app/components/admin/post-editor.tsx:639 (WHY, shortened)

the no-script defect the absence fixes.

```tsx
/*
          THERE IS NO `draft` FIELD, and its absence is the fix.

          It was a hidden input rendered enabled on a draft and disabled on a
          public post, flipped through a ref by each transition button's
          onClick. That is a payload decided by a handler, so with scripting off
          the request carried the post's current state instead of the transition
          the author pressed, and all three publication transitions were wrong.
          The flag rides in the submitter's `intent` now; `fieldsFromForm`
          derives it through `draftForIntent`, and publish-transition.mjs
          carries the account.
        */
```

### app/components/admin/post-editor.tsx:652 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---- Region 1: the command bar ---------------------------------- */
```

### app/components/admin/post-editor.tsx:679 (CONTRACT, shortened)

the required-and-hidden prohibition, which is why the two conditions are one.

```tsx
/*
            CENTRE: the layout toggle, and nothing else.

            Gated on CodeMirror having mounted, and not only for tidiness. In
            the preview layout the write pane is display:none, and a REQUIRED
            control that is not displayed blocks submission with a validation
            message the author can neither see nor reach. The textarea drops
            `required` exactly when CodeMirror takes over, so the two conditions
            have to be the same one.

            The wrapper renders either way so the three groups keep their
            positions whether or not script ran.
          */
```

### app/components/admin/post-editor.tsx:711 (CONTRACT, shortened)

why it is an element rather than prose; the wrapping measurement goes to the history document.

```tsx
/*
              Dirty state as a first-class element rather than a line of prose
              at the bottom of a form. It is the one thing the author checks
              before closing the tab. Short enough to sit on one line at 32px,
              because the bar is a single row now: the longer phrasing wrapped
              it to three rows at 1280px.
            */
```

### app/components/admin/post-editor.tsx:729 (CONTRACT, shortened)

the render conditions and the harness property.

```tsx
/*
              Ruling 3's buffer age, QUALIFYING the line above rather than
              competing with it. It renders only while dirty and only once a
              persist has actually happened, so the clean state keeps saying
              "Saved <sha>" alone.

              Nothing renders on the server: `savedAt` starts null and only the
              client's persist sets it, so the static harness render is
              unchanged and this adds no submission. That is also the truthful
              first render, since before the first persist there is no buffer to
              report an age for.
            */
```

### app/components/admin/post-editor.tsx:746 (CONTRACT, shortened)

the absent-safety-net rule and the tint budget.

```tsx
/*
                The crash net FAILED, and an absent safety net must say so. Same
                principle as the bar's own "Saving unavailable" when there is no
                headSha: the author is about to trust something that is not
                there.

                MUTED, not warning, and that is the tint budget rather than a
                judgement about severity. Its neighbour is already
                warning-tinted whenever this renders, because this only appears
                while dirty, and two warning-coloured items side by side read as
                two problems rather than one fact qualifying another. The weight
                is carried by "Unsaved changes"; this says what is missing.

                The word "saved" does not appear, deliberately: the buffer never
                saved anything, and the committed state is the bar's other job.
              */
```

### app/components/admin/post-editor.tsx:767 (CONTRACT, shortened)

the no-script path and why it is removed rather than hidden.

```tsx
/*
              The zero-JS render, removed the moment CodeMirror takes over, on
              the same principle as the textarea it sits beside: with no script
              the layout toggle cannot render and this form submit is the ONLY
              way to see rendered output, so it stays for that reader and goes
              for everyone else.

              It is REMOVED rather than hidden because, unlike the textarea, it
              carries no value the save path needs. check:admin-ui renders
              server-side, where `richBody` is false, so `intent=preview` is
              still in the submission set and the fixture does not move.
            */
```

### app/components/admin/post-editor.tsx:835 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---- Region 2: the canvas --------------------------------------- */
```

### app/components/admin/post-editor.tsx:848 (CONTRACT, shortened)

the live-region guarantees.

```tsx
/*
              THE FEEDBACK SLOT, unchanged in every guarantee it carried: always
              in the DOM so the live region exists before its content does,
              polite because every message follows a submit the author just
              made, and persistent until the next action.
            */
```

### app/components/admin/post-editor.tsx:858 (CONTRACT, shortened)

keeps the two-meanings prohibition; the delete-confirmation contrast goes to the history document.

```tsx
/*
              THE SERVER-RENDERED CEREMONY, reached when the action refused an
              unconfirmed first publication.

              INSIDE the editing form, unlike the delete confirmation, and the
              difference is what each step needs to carry. A delete needs the
              slug, which is in the URL, so it gets a form of its own. A publish
              has to re-send the whole post, because the save serialises a file
              out of the submitted fields. Sitting inside the form means the
              second submit is the first one again with the confirmed intent,
              and nothing has to be duplicated into hidden inputs where it could
              drift from the controls that own it.

              ONE CHOICE, deliberately, where the dialog offers two. The dialog
              converts its datetime-local through Date.parse IN THE BROWSER, so
              the value means the author's local time; with no script the server
              does that parse and a Worker reads the same string as UTC. Identical
              markup, two meanings, nothing on the page to say which. Scheduling
              is script-only rather than silently wrong, which costs a no-script
              author nothing they had: every other scheduling control lives in
              the settings drawer, which is a <dialog> and needs script to open.
            */
```

### app/components/admin/post-editor.tsx:919 (CONTRACT, shortened)

ruling 1 made visible; the tint reasoning goes to the history document.

```tsx
/*
              Ruling 1 made visible. The editor is holding old content and
              nothing has been written, so it says both: an author who came back
              to this tab an hour later must not mistake a loaded revision for
              the live post. Neutral, not tinted: this is a state of the editor,
              not a problem, and rule 4 spends the one tint per view on the
              feedback slot above.
            */
```

### app/components/admin/post-editor.tsx:974 (CONTRACT, shortened)

the one-spelling rule; the shipped no-op goes to the history document.

```tsx
/*
                     * DERIVED FROM SLUG_PATTERN, never a third spelling, and
                     * the stripping of the anchors is done at the constant
                     * rather than here. The first version did it inline and
                     * shipped a no-op; the docblock on the constant is the
                     * whole story.
                     */
```

### app/components/admin/post-editor.tsx:982 (CONTRACT, shortened)

why the bound is its own attribute, which is the no-script half.

```tsx
/* The other half of the rule, from the same module. An
                     * HTML pattern cannot carry a length without a lookahead
                     * whose anchors the attribute strips, so the bound is its
                     * own attribute, which is also what makes it work with
                     * scripting off. */
```

### app/components/admin/post-editor.tsx:1012 (CONTRACT, shortened)

the no-script path and the required-and-hidden prohibition.

```tsx
/*
                  THE SUBMITTED FIELD, always. CodeMirror does not replace it,
                  it drives it: the editor pushes every change into `body`
                  state, which is this textarea's value, which is what the form
                  serialises. So the payload is the same field carrying the same
                  bytes it carried when this was the only control, and
                  check:admin-ui's fixture does not move.

                  It stays in the DOM rather than being swapped out, because it
                  is also the no-script path: with nothing loaded, this IS the
                  editor. `required` is dropped once CodeMirror mounts, since a
                  hidden required control blocks submission with a validation
                  message the author cannot see or reach. The server gate is the
                  authority on an empty body either way.
                */
```

### app/components/admin/post-editor.tsx:1058 (CONTRACT, shortened)

the zero-JS image path and the payload guarantee.

```tsx
/*
              The zero-JS image path, and ONLY that. Once CodeMirror is mounted
              the same job is done by drag-drop, paste, the toolbar and the
              slash commands, and leaving a native file input plus a second alt
              field under the canvas made the editor look like two editors
              stacked. Removed on mount, exactly as the Render button and the
              textarea are.

              It contributes nothing to the payload in either state: the file
              input and the alt input carry no `name`, and the button is
              type="button". check:admin-ui renders server-side where richBody
              is false, so it is still in that render and the fixture holds.
            */
```

### app/components/admin/post-editor.tsx:1084 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---- Region 2b: the frontmatter controls --------------------- */
```

### app/components/admin/post-editor.tsx:1085 (CONTRACT, shortened)

the no-script reason these are not in the drawer.

```tsx
/*
            IN THE PAGE, not in the drawer, because the drawer is a <dialog>
            that only opens with script and these have to be usable without it.
            The component's own docblock carries the argument.
          */
```

### app/components/admin/post-editor.tsx:1105 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---- Region 3: the settings drawer ------------------------------ */
```

### app/components/admin/post-editor.tsx:1162 (CONTRACT, shortened)

header: the untouched-HTML claim and the frame isolation; the 2026-08-01 measurement goes to the history document.

```tsx
/**
 * The live preview, in a sandboxed frame.
 *
 * The HTML is passed through UNTOUCHED, because the whole claim of ruling 3 is
 * that what you see is what publishes. Sanitising it here would make the
 * preview differ from the stored output and quietly void that claim.
 *
 * So the isolation is the frame, not the markup. `sandbox` with no
 * `allow-scripts` and no `allow-same-origin` means nothing inside can execute,
 * reach this document, or navigate the parent. That is not belt and braces:
 * measured 2026-08-01, the pipeline strips raw `<script>`, `<iframe>` and
 * `onerror=` (remark-rehype drops raw HTML) but PASSES `javascript:` URLs
 * through from ordinary markdown links, so a body can contain one and the
 * author would otherwise be one click from running it inside the admin origin.
 *
 * The site stylesheets are copied in by href so the preview is styled the way
 * the published page is, and the theme attribute is mirrored so tokens resolve
 * to the mode the author is actually working in.
 */
```

### app/components/admin/post-editor.tsx:1196 (CONTRACT, shortened)

the no-second-copy rule.

```tsx
// `.post` is the blog's own article wrapper and carries the 44rem measure;
    // `.prose` is the blog's own body typography. Both come from the site
    // stylesheet linked above, so the preview cannot drift from the published
    // page: there is no second copy of either rule to keep in step. The only
    // thing declared here is the frame's own padding.
```

### app/components/admin/post-editor.tsx:1212 (CONTRACT, shortened)

the division of labour; the overlap story goes to the history document.

```tsx
/*
        The pane says only what the command bar cannot.

        It used to read "Up to date" beside a bar that already said
        "Saved <sha>", so two indicators described overlapping freshness at one
        glance and the reader had to work out which was about the file and which
        was about the render. The save state lives in the bar; this reports only
        the two TRANSIENT conditions the bar has no way to know about, and says
        nothing at rest.
      */
```

### app/components/admin/post-editor.tsx:1248 (CONTRACT, shortened)

header: both ways out are explicit.

```tsx
/**
 * The recovery banner.
 *
 * Both ways out are explicit and neither is the default. An automatic restore
 * would overwrite committed content with older local text; an automatic discard
 * would throw away the thing this exists to save.
 */
```

### app/components/admin/post-editor.tsx:1300 (CONTRACT, shortened)

header: why every state carries the sha.

```tsx
/**
 * The four things a save can have done, said in words.
 *
 * Every state carries the commit sha, because that is the fact that makes the
 * claim checkable: the author can look the save up in `git log` rather than
 * take the page's word for it. A published state carries the public URL as a
 * real link, so "it is live" can be confirmed in one click instead of trusted.
 */
```

### app/components/admin/post-editor.tsx:1316 (CONTRACT, shortened)

why a location is shown only when present.

```tsx
/*
            WHERE, when the refusal knows. `EditorError` has carried `field` and
            `line` since it was written and nothing rendered them: the richest
            validation on the site was the part the author could not see. Each
            is shown only when present, because most refusals carry neither and
            a location invented for the ones that do not would be worse than
            none. Rendered as a second line rather than folded into the message,
            so the message stays the sentence the gate wrote.
          */
```

### app/components/admin/post-editor.tsx:1447 (CONTRACT, shortened)

header: why alt is required at insert time.

```tsx
/**
 * Uploads an image to R2 and hands back a markdown snippet.
 *
 * Unchanged from the checkbox era. Alt text is required at insert time rather
 * than left for later, because an image inserted without it is the one that
 * ships without it.
 */
```

## app/routes/admin.tsx

### app/routes/admin.tsx:19 (CONTRACT, shortened)

header: the payload boundary; the 109,318 built bytes go to the history document.

```tsx
/*
 * THE ADMIN PLANE'S CSS, and this import is what keeps it off the public plane.
 *
 * `app/app.css` used to import all sixteen stylesheets, so every reader of the
 * home page downloaded the media library and the post editor: 109,318 built
 * bytes, 62% of them admin. This route is the layout every `/admin/*` child
 * nests under, so importing here covers the whole subtree exactly once. Vite
 * emits a separate chunk and React Router links it only on matched routes.
 *
 * `/login` imports it too and is the one other place that may; see app/admin.css.
 */
```

### app/routes/admin.tsx:36 (CONTRACT, shortened)

the hydration boundary and the rule 9 exemption.

```tsx
/**
 * The admin plane HYDRATES, and this is the one flag that says so for the
 * whole /admin subtree: root's Layout renders <Scripts> only when a match
 * carries it, and a layout match covers every child. The public plane stopped
 * hydrating 2026-08-26; the admin plane is rule 9's stated exemption and its
 * cockpit is real client UI (editor, media library, bulk actions).
 */
```

### app/routes/admin.tsx:45 (CONTRACT, shortened)

header: the one gate, and the two doors with only one writer.

```tsx
/**
 * One gate for the whole /admin subtree. Runs before every child loader and
 * action; anyone without the single-admin session is 302'd to the login
 * screen. The verified session is stashed on the context so children read it
 * without a second lookup.
 *
 * **TWO WAYS IN SINCE 2026-08-24, and only one of them may write.** The human
 * admin arrives with a Better Auth session and is unchanged. A machine may
 * instead present the read-only SMOKE bearer token, which gets GET and HEAD and
 * is refused every other method here, before any child runs. That refusal is
 * the enforcement point for the whole plane's action surface, because route
 * actions do not consult a policy module; the capability table covers the
 * publish path and this covers the rest. Grounds: `app/lib/smoke.server.ts`.
 */
```

### app/routes/admin.tsx:63 (WHY, shortened)

keeps resource routes, the ordering and the absent-Origin exemption; the React Router measurement goes to the history document.

```tsx
/*
     * ORIGIN, BEFORE THE SESSION LOOKUP, on every mutating method.
     *
     * This middleware is already the one place every `/admin/*` action must
     * pass through, which is what makes it the right place for this: route
     * actions do not consult a policy module, and an Origin check written into
     * each of them would be a check the next action silently lacks.
     *
     * ## THE AUDIT'S CLAIM WAS HALF TRUE AT HEAD, and the half that is false
     * ## is worth writing down because it decides what this line is FOR
     *
     * The claim was that no admin action has an Origin check. MEASURED against
     * React Router 8 on 2026-08-28: `throwIfPotentialCSRFAttack` in
     * `react-router/dist/.../lib/actions.js` compares the `origin` header's
     * HOST against the request's host on every mutating DOCUMENT request and
     * refuses with 400 before `staticHandler.query` runs, which is before this
     * middleware. So `/admin/posts/new` with `Origin: https://evil.example`
     * already answered 400, and still does.
     *
     * WHAT IT DOES NOT REACH IS RESOURCE ROUTES. A route with no default
     * export is not a document request, so that check never runs for it, and
     * three of this plane's mutating surfaces are exactly that:
     * `admin.logout.tsx`, `admin.media.upload.ts` and `admin.preview.ts`. All
     * three answered a foreign `Origin` before this line and answer 403 after
     * it. `/theme` is the same shape outside this subtree and carries its own
     * call to the same predicate.
     *
     * So this is not a duplicate of the framework's check. It covers the half
     * the framework's check is not shaped to see, and it puts both halves under
     * one predicate this repo owns rather than one the framework may change.
     *
     * BEFORE the session lookup because refusing costs nothing and the lookup
     * is a KV read: a cross-origin caller should not be able to make this
     * Worker do work. That ordering is the same cheapest-first discipline hard
     * rule 19 states for the money paths.
     *
     * GET IS UNTOUCHED. A cross-origin GET of an admin page is answered by the
     * session gate below, which redirects anyone without the single-admin
     * session, and reading is not the thing an Origin check is for.
     *
     * AN ABSENT ORIGIN IS ALLOWED, per the predicate. The admin plane is React
     * and every form here posts through it, so in practice an admin request
     * always carries one; the exemption exists for the public no-script forms
     * and is not narrowed here, because two spellings of the rule is exactly
     * what this consolidation removed.
     */
```

### app/routes/admin.tsx:119 (WHY, shortened)

why the collector is read rather than created.

```tsx
/*
     * INSTRUMENTATION, READ RATHER THAN CREATED, since 2026-08-27.
     *
     * This middleware used to make its own collector. Root's middleware makes
     * one for every route on the site now, and root runs first, so creating a
     * second here would REPLACE the array root had already put in the context
     * and discard anything recorded before this point. Reading it keeps one
     * owner and keeps the auth gate's marks in the same list as everything
     * else, which is the whole reason this was the one cost worth measuring:
     * no child loader can see it.
     */
```

### app/routes/admin.tsx:136 (CONTRACT, shortened)

the ordering that leaves the human path untouched.

```tsx
/*
       * THE SMOKE DOOR, and it is only reachable with no admin session.
       *
       * Ordered this way so the human path is untouched: a browser request
       * carries no `Authorization` header, `authenticateSmoke` returns `absent`
       * without reading the secret or touching the limiter, and the redirect
       * below is the same redirect as before this existed.
       */
```

### app/routes/admin.tsx:146 (WHY, shortened)

why a presented credential gets an answer.

```tsx
/*
         * A PRESENTED CREDENTIAL GETS AN ANSWER, not a login page. Whoever set
         * SMOKE_TOKEN in CI is entitled to know whether it was rejected, not
         * configured, or rate limited, because those need three different
         * repairs and a 302 to /login names none of them.
         *
         * `no-store` and `noindex` on the same grounds as the operator API: it
         * is an authenticated surface behind a secret.
         */
```

### app/routes/admin.tsx:167 (WHY, shortened)

keeps the allowlist inversion and the ordering; the capability-table inventory goes to the history document.

```tsx
/*
       * READ ONLY, AND THIS IS WHERE IT IS ENFORCED FOR THE WHOLE PLANE.
       *
       * The capability table in `publish-policy.mjs` refuses the smoke actor
       * from `decide()` and `decideDelete()`, which covers the publish path. It
       * does NOT cover the eleven media intents, the tag writes, the trash, the
       * rebuild, or any action added tomorrow: those are route actions that
       * never consult a policy module. So the method itself is the gate, at the
       * one place every `/admin/*` action must pass through.
       *
       * **A METHOD ALLOWLIST, NOT A DENYLIST.** GET and HEAD are named and
       * everything else is refused, so a route that starts answering PUT or
       * DELETE tomorrow is refused on the day it is written rather than on the
       * day someone remembers to add it here. That inversion is the whole
       * point: hard rule 19's chain is ordered for the same reason, and this
       * repo's recorded failure shape is a fix landing in N-1 of N sites.
       *
       * Refused BEFORE `next()`, so no child loader, action, or middleware runs
       * and nothing has read a row by the time the refusal is written.
       */
```

### app/routes/admin.tsx:203 (CONTRACT, shortened)

why the real email is the stated residue.

```tsx
/*
       * THE SAME EMAIL THE ADMIN SEES, and it is the stated residue rather than
       * an oversight. The topbar's binding constraint at narrow widths IS this
       * string; a placeholder here would silently change the measurement the
       * whole credential exists to take. Grounds on the `smoke` capability row.
       */
```

### app/routes/admin.tsx:211 (CONTRACT, shortened)

one listing per request; the removed artifact reader goes to the history document.

```tsx
// Lazy and memoized: this layout's loader wants a drift COUNT for the nav
    // badge and /admin/posts wants the full status for its alert. Sharing the
    // reader means one listing per request rather than two, and a route that
    // never asks for it never pays for it.
    //
    // The per-request ARTIFACT reader that used to be installed beside it is
    // gone with the committed artifact itself: the citation scan reads
    // `posts.body` out of D1 now, so there is no 600KB GitHub round trip left
    // to deduplicate.
```

### app/routes/admin.tsx:226 (WHY, shortened)

tagged by what STAYS; the measured gap goes to the history document.

```tsx
/*
   * THE LAYOUT LOADER RUNS ON EVERY ADMIN REQUEST, and until now nothing in it
   * was measured. A trivial admin route costs ~1150ms against 233ms for a
   * public one, and `auth_getsession` accounts for 57ms of that gap; the rest
   * is these two calls and neither had a name.
   */
```

### app/routes/admin.tsx:234 (WHY, shortened)

why they run in parallel; the object-literal diagnosis goes to the history document.

```tsx
/*
   * IN PARALLEL, because they were strictly serial and share nothing.
   *
   * `ask` was awaited on its own line and `counts` was awaited inside the
   * returned object literal, and an object literal evaluates its properties in
   * order. So the D1 nav-count query did not start until the Ask drift check
   * had finished, and the drift check is the slow one. Neither reads the
   * other's result; the only reason for the ordering was where the lines
   * happened to sit.
   */
```

### app/routes/admin.tsx:244 (CONTRACT, shortened)

keeps the cached-vs-fresh split; the measured variance goes to the history document.

```tsx
/*
   * THE BADGE READS A CACHED COUNT, NOT THE INDEX.
   *
   * `askDriftCount` returns from KV on a hit and never touches AI Search.
   * That is the fix: the listing's cost is per-call variance of 46 to 2055ms,
   * measured, so removing the call from the read path is the only thing that
   * moves the tail. Making it cheaper does not: both pages of the pagination
   * cost about 72ms and dropping one leaves the tail where it was.
   *
   * The layout wants ONE INTEGER. `/admin/posts` still calls the full reader
   * on `askStatusContext` for its repair alert, uncached, because the page
   * that fixes drift must not act on a number up to five minutes old. The
   * reader stays on the context for exactly that caller.
   */
```

### app/routes/admin.tsx:259 (CONTRACT, shortened)

why the context is required rather than optional.

```tsx
/*
     * The ExecutionContext travels with the env because the miss path finishes
     * its cache write on `waitUntil`. It is required rather than optional so
     * this call site cannot quietly go back to a floating write.
     */
```

### app/routes/admin.tsx:271 (CONTRACT, shortened)

the prohibition on badging a hardcoded array; the mockup's four go to the history document.

```tsx
/**
     * THE NAV COUNTS, and there are TWO of them rather than the mockup's four.
     *
     * The mockup badged four: Sites, Content, Posts and Media. Two of those
     * sections no longer exist. Both were stubs that could only ever have
     * badged the length of a hardcoded array, and a numeral in the sidebar is
     * read as a measurement, so they were deleted rather than finished.
     *
     * Posts and Media are real rows in D1, so these two are real numbers. The
     * nav carries exactly the counts something has counted.
     */
```

### app/routes/admin.tsx:283 (CONTRACT, shortened)

why one number, and what it counts.

```tsx
/**
     * ONE number, not the status object. The badge is a count and the repair
     * lives on /admin/posts, so shipping the key lists to every admin page
     * would be payload the shell has no use for.
     *
     * Drift counts in BOTH directions, exactly as the alert reports it: an item
     * the corpus does not know about is as much a defect as a record the index
     * lacks.
     */
```

### app/routes/admin.tsx:292 (CONTRACT, shortened)

the honest rendering of no evidence.

```tsx
/*
     * NULL BECOMES 0, which renders NO BADGE rather than a clean one.
     *
     * `navName` treats 0 as "nothing to report" and omits the count entirely,
     * so an unavailable index and an index in agreement look the same to a
     * reader. That was already true before the cache and is the honest
     * rendering of "no evidence": the alternative is a numeral asserting
     * agreement nobody measured.
     */
```

### app/routes/admin.tsx:302 (CONTRACT, shortened)

tier 1.5, and why the number travels to the UI.

```tsx
/**
     * How stale that number may be, in seconds, for the reader.
     *
     * TIER 1.5 FORBIDS ADDING A CACHE TO HIDE A SLOW PATH WITHOUT SAYING SO,
     * and a comment in the source says it to the next engineer, not to the
     * operator looking at the badge. So the number travels to the UI and the
     * badge's own title states it. The repair lives on /admin/posts, which
     * computes fresh.
     */
```

### app/routes/admin.tsx:314 (CONTRACT, shortened)

why the total exists; the 2026-08-21 measurement goes to the history document.

```tsx
/*
   * THE LAYOUT'S OWN TOTAL, and it is what makes the other routes' arithmetic
   * close.
   *
   * The layout's marks ride along on EVERY admin response, because `timings`
   * is one array shared through context. So a breakdown of `/admin/posts.data`
   * that adds up the marks it can see was adding LAYOUT time to ROUTE time and
   * calling the total attributed. Worse, the layout's two big marks run in
   * PARALLEL and `drift_cache_read` NESTS inside `layout_ask_drift`, so summing
   * them overcounts twice over.
   *
   * MEASURED 2026-08-21 against production: summing the layout marks on
   * /admin.data gave 313ms against a 283ms TTFB, which is arithmetic claiming
   * more time than the request took. With this mark, every admin route reads
   * as `layout_total` + its own `loader_total` + whatever is left, and the
   * leftover is the response path rather than a rounding error.
   */
```

### app/routes/admin.tsx:336 (CONTRACT, shortened)

header: where the state lives and the consequence that follows.

```tsx
/**
 * Where the collapsed state lives, and the attribute the stylesheet reads.
 *
 * localStorage per the ruling: not server state and not a cookie, because the
 * rail is a per-device preference rather than a fact about the account. That
 * choice has one consequence and it is the whole reason for the script below:
 * the server cannot know the state, so without help the shell would render
 * expanded and snap narrow after hydration.
 */
```

### app/routes/admin.tsx:348 (CONTRACT, shortened)

header: the paint boundary, the plane boundary and the hydration property.

```tsx
/**
 * Sets the attribute BEFORE the sidebar is painted.
 *
 * The stylesheet keys the rail's width off an attribute on the document
 * element, so the width is decided by the time the first pixel lands and
 * nothing is corrected afterwards. It is a blocking inline script, which this
 * site otherwise avoids: the theme toggle reaches the same no-flash result with
 * a cookie read in the root loader, and that option is ruled out here.
 *
 * It lives in the ADMIN layout, not in root, so the public plane never carries
 * it. It is also why the React tree renders identically in both states: the
 * markup does not branch, so there is nothing for hydration to disagree about.
 */
```

### app/routes/admin.tsx:381 (WHY, shortened)

the silhouette argument goes to the history document.

```tsx
/**
   * A speech bubble, which is what a mention from another site is.
   *
   * Chosen against the five already here for the same reason `traffic` was:
   * Overview is a grid of rectangles, Posts is a stack of lines, Traffic is a
   * bar chart, Media is a picture and Tools is a slider row. A rounded bubble
   * with a tail shares no silhouette with any of them at 20px, which is the
   * size the collapsed rail renders at.
   */
```

### app/routes/admin.tsx:395 (WHY, shortened)

the silhouette argument goes to the history document.

```tsx
/**
   * Ascending bars on a baseline, which is what the panel draws.
   *
   * Chosen against the six already here: Content is a document, Posts is a
   * stack of lines, Sites is a globe, Media is a picture and Tools is a slider
   * row. A bar chart shares no silhouette with any of them at 20px.
   */
```

### app/routes/admin.tsx:408 (WHY, shortened)

the silhouette argument goes to the history document.

```tsx
/**
   * A picture: frame, horizon, sun.
   *
   * Chosen against the five already here rather than in isolation. Overview is
   * rectangles, Sites a globe, Content a document, Posts stacked lines, Tools
   * sliders, so a framed image collides with none of them at rail size. Not a
   * pencil and not a stack of photos: the pencil reads as compose, which is
   * Posts' job, and a stack reads as "copies" rather than "the library".
   */
```

### app/routes/admin.tsx:424 (WHY, shortened)

keeps the one distinction that changed the drawing.

```tsx
/**
   * Sliders, not the pencil this used to draw.
   *
   * A pencil reads as COMPOSE, which is what Posts does, so two adjacent items
   * were claiming the same job and the one that actually writes was not the one
   * holding the pen. Sliders say "settings and switches", which is what Tools
   * holds.
   */
```

### app/routes/admin.tsx:444 (CONTRACT, shortened)

the two claims are different.

```tsx
// `drift` is the ALARM, and it is a fact about the post corpus with its
  // repair on this page. `count` is the neutral size of the section. They are
  // different claims and they render differently; see `navName` below.
```

### app/routes/admin.tsx:448 (WHY, shortened)

the ordering reason; the unlinked-library story goes to the history document.

```tsx
// After Posts and before Tools, because it is content the posts consume
  // rather than an admin control. Until now /admin/media existed and loaded but
  // NOTHING linked to it: the sidebar had five items, none of them Media, and
  // no item even marked itself active while the page was open, so the library
  // was reachable only by typing the URL.
```

### app/routes/admin.tsx:454 (CONTRACT, shortened)

why the label is the long one.

```tsx
// Reading rather than editing, so it sits after the content items and before
  // the controls. The label matches the panel heading exactly: this counts
  // origin requests, and calling the nav item anything shorter would put a
  // claim in the sidebar that the page spends a caption correcting.
```

### app/routes/admin.tsx:459 (CONTRACT, shortened)

why there is no third query.

```tsx
// Beside Origin requests and before Tools, because both are things other
  // people did to this site rather than things the admin authors. NO COUNT
  // BADGE: the counts here are `posts` and `media`, both computed by
  // `adminNavCounts` in the layout loader on every admin request, and a pending
  // mention is not urgent enough to make every admin page pay for a third
  // query. The page itself is where the queue is read.
```

### app/routes/admin.tsx:469 (CONTRACT, shortened)

header: the count is announced as words.

```tsx
/**
 * The accessible name for a nav item, count included as WORDS.
 *
 * A badge that is only a numeral announces "Posts 3", which names no unit and
 * reads as a position as easily as a quantity. The digits are decoration over
 * this string, so the numeral itself is aria-hidden and this is what is
 * actually announced. It doubles as the `title`, which is how the count keeps a
 * text equivalent for a SIGHTED reader in the collapsed rail, where the badge
 * has room for the number but not for what the number counts.
 */
```

### app/routes/admin.tsx:479 (CONTRACT, shortened)

header: tier 1.5 stated to the operator, and why only on the drifted branch.

```tsx
/**
 * The nav item's accessible name, and where the CACHING IS STATED TO THE READER.
 *
 * Tier 1.5 forbids adding a cache to hide a slow path without saying so. A
 * source comment says it to the next engineer; this says it to the operator
 * looking at the badge, which is the person who would otherwise act on a number
 * without knowing how old it can be.
 *
 * Only on the drifted branch, deliberately. A badge showing nothing has nothing
 * to qualify, and appending an age to every nav item would be noise on five
 * links that carry no cached value at all.
 *
 * The wording names the authority as well as the age, because "up to 5 minutes
 * old" invites the question this sentence should already answer: the repair
 * page recomputes, so that is where to go and what to trust.
 */
```

### app/routes/admin.tsx:529 (CONTRACT, shortened)

header: one owner, and the no-script property of the folded control.

```tsx
/**
 * Sign out, in the two places the topbar renders it: the wide bar, and the
 * overflow menu it folds into below 640px.
 *
 * ONE STATEMENT OF THE FORM, because both sites are the same action and the
 * responsive fold is the only reason there are two. A copied `<Form>` is a
 * second owner of the logout route and of the fact that this must be a POST;
 * the two would drift on the day one of them gained a confirmation or a
 * redirect target.
 *
 * A REAL FORM in both branches, deliberately. `menu` changes the presentation
 * and nothing else: it is still `method="post"` to the same action, so the
 * folded control works with scripting off exactly as the wide one does, which
 * is what rule 9 requires of a door on a page a reader can reach.
 */
```

### app/routes/admin.tsx:547 (CONTRACT, shortened)

the accessible-name defect and its repair; the measurement goes to the history document.

```tsx
/*
        THE NAME IS "Sign out" IN BOTH VARIANTS, and it took an explicit label
        to make that true. The hint below is a CHILD of the button, so name-from-
        content swallowed it: measured 2026-08-26 by check:browser, the folded
        button's accessible name was "Sign outEnds this session. You will need to
        sign in again with Google." A submit control named with a whole sentence
        is a defect on its own, and it also broke the property the fold exists to
        have, which is that the menu holds the SAME control the bar does rather
        than a second one that has drifted.

        `aria-describedby` keeps the sentence, as a DESCRIPTION, which is what it
        always was: announced after the name, after a pause, and skippable. No
        pixel moves, because the span stays exactly where the design put it.
      */
```

### app/routes/admin.tsx:601 (CONTRACT, shortened)

why the read is optional; the un-nonced history goes to the history document.

```tsx
/*
   * The CSP nonce, from the root loader through useRouteLoaderData, the same
   * channel Layout and BlogSpeculation use. Read OPTIONALLY for the reason they
   * do: on the error boundary path the root loader never ran, and a made-up
   * fallback nonce would be worse than none.
   *
   * The inline script below was UN-NONCED until 2026-08-11, found by the
   * external audit. workers/app.ts said the shared-cache nonce lifetime was THE
   * ONLY thing blocking CSP enforcement; this was a second blocker, sitting on
   * an admin page that a Report-Only window walking public routes would never
   * have reported.
   */
```

### app/routes/admin.tsx:614 (CONTRACT, shortened)

the hydration boundary and what it actually keeps honest.

```tsx
/**
   * Mirrors the attribute the inline script already set.
   *
   * Initialised to `false` so the hydration render matches the server's, then
   * corrected in a LAYOUT effect, which runs before the browser paints. The
   * width never depended on this (the stylesheet reads the attribute), so what
   * this actually keeps honest is `aria-expanded`.
   */
```

### app/routes/admin.tsx:631 (CONTRACT, shortened)

the focus contract.

```tsx
/**
   * The toggle. It writes the attribute and the store, and it does NOT move
   * focus: the button is the same node before and after, never unmounted, so
   * the browser keeps focus on it across the transition with nothing to
   * restore.
   */
```

### app/routes/admin.tsx:672 (WHY, shortened)

why it spans both columns; the old placement goes to the history document.

```tsx
/*
        THE FULL-WIDTH HEADER, above both columns.

        It used to live inside .admin-main, which put it in the right-hand
        column and made the mark's position a function of the sidebar's width.
        Spanning both columns is what lets the mark land at the same
        coordinates as the public header by construction rather than by tuning.
      */
```

### app/routes/admin.tsx:681 (CONTRACT, shortened)

the imported-never-copied rule and the gate it buys.

```tsx
/*
          The identity block, at the public header's treatment. The component is
          imported, never copied, so check:logo covers this instance too.

          It links to /admin, the home of the plane you are on, mirroring the
          public mark's link to / rather than copying its destination. Crossing
          planes is what View site in the sidebar foot is for.
        */
```

### app/routes/admin.tsx:693 (CONTRACT, shortened)

why the wrapper exists.

```tsx
/* WRAPPED so it can truncate. A bare text node cannot carry
              `text-overflow`, and below 576px the wordmark is the widest thing
              in the bar that is safe to give up: the mark beside it still
              identifies the plane and the link keeps its accessible name. */
```

### app/routes/admin.tsx:725 (CONTRACT, shortened)

why the two classes are split.

```tsx
/* `.muted` is the colour and `.admin-topbar-email` is the box. Split
              because the truncation below needs a selector that means THIS
              element, and `.muted` is used all over the admin plane. */
```

### app/routes/admin.tsx:730 (CONTRACT, shortened)

keeps the no-script arrangement and the a11y-tree property; the OverflowMenu account goes to the history document.

```tsx
/*
            THE FOLD, below 640px. Grounds: decisions vol 8, 2026-08-25.

            The wide bar above and this menu below are BOTH in the document and
            CSS picks one, which is the only arrangement that works with no
            script: a JS-measured breakpoint would leave a scriptless reader
            with whichever branch the server guessed. `display: none` takes the
            hidden branch out of the accessibility tree too, so exactly one
            email and one Sign out are ever exposed.

            The menu is the EXISTING OverflowMenu, not a new pattern, and the
            sign-out inside it is a real `<Form method="post">` submit button,
            so rule 9 holds on the folded side as well: the menu opens with no
            script because it is a `<details>`, and the button posts with no
            script because it is a form.
          */
```

### app/routes/admin.tsx:748 (CONTRACT, shortened)

why the address stays visible.

```tsx
/* The signed-in address, as INFORMATION. It is the one thing the
                  wide bar shows that is not a control, so it stays visible
                  rather than being dropped: knowing which account you are in is
                  the reason it was ever in the bar. */
```

### app/routes/admin.tsx:760 (WHY, shortened)

the placement consequence.

```tsx
/* The brand moved to the topbar, which spans both columns now, so the
            mark sits at the same coordinates on both planes. The rail's top
            gains the space it used to occupy. */
```

### app/routes/admin.tsx:766 (CONTRACT, shortened)

the null-is-not-zero prohibition.

```tsx
/* `null` means this section HAS no count, which is not the same as
               a count of zero and must not render as one. Sites and Content are
               stubs; see the loader. */
```

### app/routes/admin.tsx:778 (CONTRACT, shortened)

the accessible name survives the label being hidden.

```tsx
/*
                  The accessible name is on the element, always, so it survives
                  the label being hidden in the rail. `title` is the sighted
                  tooltip the ruling asks for; it is redundant beside a visible
                  label and native, which is the trade taken rather than a
                  custom tooltip that would have to reimplement dismissal.
                */
```

### app/routes/admin.tsx:790 (CONTRACT, shortened)

the two claims and the zero rule; the collapsing alternative goes to the history document.

```tsx
/*
                  THE COUNT AND THE DRIFT BADGE ARE DIFFERENT CLAIMS, so they
                  are different elements and they can both be present.

                  The count is how big the section is: quiet, plain, always
                  true. The badge is an alarm that something needs repairing,
                  and it keeps the warning fill it has always had. Collapsing
                  them into one numeral was the alternative and it is worse in
                  both directions: styling the count like an alarm cries wolf on
                  every page, and hiding the count whenever drift appeared would
                  remove a fact exactly when somebody is looking at the section.

                  A count of ZERO still renders, unlike the badge. "0" is a real
                  and useful answer to "how many posts are there"; a badge of
                  zero is an alarm about nothing.
                */
```

### app/routes/admin.tsx:811 (CONTRACT, shortened)

why zero renders nothing here.

```tsx
/* Zero renders NOTHING, rather than a 0 badge: a count of
                    nothing is not news, and a permanent badge stops being a
                    signal. aria-hidden because the name above already says it
                    in words. */
```

### app/routes/admin.tsx:825 (WHY, shortened)

what the zone means.

```tsx
/*
          The foot is a ZONE, not two more sections. Both items leave the list
          of places you can be: one crosses to the public plane, the other
          changes the rail itself. A hairline above the group says that, and is
          why they take the nav item's shape without joining the nav's list.
        */
```

### app/routes/admin.tsx:832 (CONTRACT, shortened)

the accessible name carries what the glyph cannot.

```tsx
/*
            The nav item treatment, per the polish ruling, so it stops reading
            as a footnote under the sections. The glyph carries the signal that
            this leaves the plane; the accessible name says it in words, because
            an arrow leaving a box is not a name.
          */
```

### app/routes/admin.tsx:861 (CONTRACT, shortened)

the direction rule and the verb rule; the centring argument goes to the history document.

```tsx
/*
            Persistent, never hover-only, and the chevron points at what
            pressing it DOES: left to collapse, right to expand. One glyph
            rotated by CSS off the same attribute, so the markup does not branch
            and the node is never replaced.

            It takes the standard item shape rather than centring itself: as a
            lone centred glyph it lined up with nothing above it and read as a
            decoration on the rail's floor rather than a control. Its label is
            the VERB, so expanded it reads "Collapse" beside the arrow and the
            rail hides the word exactly as it hides every other one.
          */
```

### app/routes/admin.tsx:910 (CONTRACT, shortened)

what the id is for; the gate that found it goes to the history document.

```tsx
/* id="main" for root's unconditional skip link. The admin plane had
            the same dead hash as /login and the error boundary; found by
            check:invariants section 12 rather than by the audit. */
```

## app/routes/blog.$slug.tsx

### app/routes/blog.$slug.tsx:42 (CONTRACT, shortened)

header: why negotiation is middleware; the 2026-07-28 measurement goes to the history document.

```tsx
/**
 * Content negotiation runs as middleware rather than in the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData`, which 500s on the first property read.
 * Measured 2026-07-28, not assumed. Middleware is the layer that is allowed to
 * short-circuit with a Response, which is the same mechanism the /admin gate
 * uses.
 */
```

### app/routes/blog.$slug.tsx:58 (CONTRACT, shortened)

the never-stored prohibition.

```tsx
/*
     * NEVER STORED, and the grounds are on `markdownResponse`. This is the
     * representation that shares a cache key with the HTML document, so a
     * stored copy here is the second variant that collapses the Cookie
     * dimension for both. The twin at its own URL is a different situation and
     * passes a different policy.
     */
```

### app/routes/blog.$slug.tsx:79 (CONTRACT, shortened)

the one-projection rule.

```tsx
// The projection moved to `blogPostView` when /preview/:token landed, so the
  // two routes that render a post cannot drift in what they hand the component.
  // Output-neutral here by construction: this route's payload is unchanged.
```

### app/routes/blog.$slug.tsx:84 (WHY, shortened)

the visibility re-check, which is the prohibition; the write-time history goes to the history document.

```tsx
/*
   * THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS.
   *
   * `withRelated` composes the shared visibility rule at WRITE time, which is
   * where the scheduled-post leak was fixed. That is not enough on its own: the
   * list is stored on the row, and a post can be unpublished, or have its
   * publish date pushed out, after a list naming it has already been written.
   * Nothing rewrites its neighbours' related lists when that happens, so
   * without this the stale title and its URL keep rendering on a public page.
   *
   * One indexed query for the whole list, composing `publiclyVisible()` like
   * every other public read, so there is no second opinion about what public
   * means. It is the same instrument, and the same reasoning, as the Ask replay
   * path's citation re-check.
   */
```

### app/routes/blog.$slug.tsx:104 (CONTRACT, shortened)

why the read is not in the shared projection.

```tsx
/*
   * THE APPROVED MENTIONS, READ HERE AND NOT IN `blogPostView`.
   *
   * `/preview/:token` shares that projection, and a draft preview must not grow
   * a mentions section: the projection's whole claim is that a reviewer sees
   * what a reader would see, and a draft has no readers and therefore no
   * approved mentions to see. Putting the read in the projection would also put
   * a second D1 query on every preview render to return an empty array every
   * time. So it sits beside the view rather than inside it, which is the one
   * place these two routes are allowed to differ.
   *
   * AFTER the post resolves, which is not merely ordering: a 404 above means
   * this never runs, and `approvedMentionsFor` composes `publiclyVisible()`
   * itself besides. Both halves are stated on that function.
   */
```

### app/routes/blog.$slug.tsx:131 (CONTRACT, shortened)

the header shape and the one-origin rule.

```tsx
/*
       * TWO VALUES IN ONE `Link`, comma-joined, which is how RFC 8288 spells a
       * header carrying more than one relation. The markdown twin has been here
       * since the twin shipped; the webmention endpoint joins it because a
       * sender reads discovery out of this header before it parses anything.
       *
       * Both are built by a named function from `SITE_ORIGIN`, so the two
       * values cannot come to name different hosts.
       */
```

### app/routes/blog.$slug.tsx:142 (CONTRACT, shortened)

why the tag is built in the loader.

```tsx
/*
         * THE CACHE TAG IS SET IN THE LOADER, not in `headers()`, and that is
         * forced rather than chosen: `HeadersArgs` carries `loaderHeaders` and
         * no `params`, so the slug is not in scope down there. The loader is
         * where the post is known, so it is where the tag is built, and
         * `headers()` forwards it exactly as it forwards `Link`.
         */
```

### app/routes/blog.$slug.tsx:157 (CONTRACT, shortened)

the cache dimension and the two tags.

```tsx
// Publicly cacheable for EVERY reader since 2026-09-05: the theme is a
    // dimension of the cache key rather than a Vary. `Accept` STAYS, because
    // this URL really does serve a markdown representation as well as HTML.
    //
    // TWO TAGS, and this is the only route that gets a per-document one.
    // Approving a mention on THIS post purges `post:<slug>` and nothing else;
    // a publish purges `posts` and moves every page that lists the corpus,
    // this one included. Grounds on cacheTags in seo.ts.
```

### app/routes/blog.$slug.tsx:183 (CONTRACT, shortened)

the one-owner rule; the editor-preview history goes to the history document.

```tsx
// Built by `postSocial` and not here. The per-post social overrides, the
  // description fallback and the cover/card/mark precedence all moved into that
  // one function on 2026-08-02, when the editor gained SERP and social-card
  // previews: a preview whose job is to show what this route emits must not
  // compute it a second way, because the day the two disagree the preview lies
  // and nothing renders both at once to catch it.
```

### app/routes/blog.$slug.tsx:204 (CONTRACT, shortened)

the card contract.

```tsx
/*
     * `twitter:image`, ADDED 2026-08-27. Without it this page declared
     * `summary_large_image` and gave the card nothing to put in it, which is
     * the same defect `pageMeta` was built to stop the other six pages
     * repeating: a card type and its image travel together or neither is worth
     * setting. The value is `postSocial`'s, so the cover/card/mark precedence
     * is stated once and this is not a second opinion about which image a post
     * has.
     */
```

### app/routes/blog.$slug.tsx:214 (CONTRACT, shortened)

why they are spread rather than written out.

```tsx
/*
     * THE `article:*` PROPERTIES, from the same inputs the JSON-LD below uses.
     *
     * `og:type` has said "article" since this page existed and nothing said
     * anything about the article: a crawler reading Open Graph and not JSON-LD
     * saw a typed article with no date, no author and no tags, while the same
     * page carried all three in a script tag beside it.
     *
     * Spread from `articleOpenGraph` rather than written out, so the four
     * values cannot come apart from `articleJsonLd`'s. `article:tag` repeats
     * once per tag, which is why this is a list.
     */
```

### app/routes/blog.$slug.tsx:244 (CONTRACT, shortened)

why both are emitted.

```tsx
/*
     * THE WEBMENTION ENDPOINT, beside the twin because both are discovery.
     *
     * A sender looks in two places and stops at the first: the `Link` header,
     * which the loader above sets, and this element. Both are emitted, because
     * a sender that finds one and not the other has to decide which this site
     * meant, and the protocol's answer to that is that the header wins, which
     * is not a decision worth making it take.
     *
     * `WEBMENTION_URL` is the same constant the header is built from.
     */
```

### app/routes/blog.$slug.tsx:259 (NUMBER, shortened)

header: why one day.

```tsx
/**
 * Shows a revision date only when it is meaningfully later than publication.
 *
 * The threshold is one day: a post synced the same day it was published has not
 * been revised, it has just been deployed. Without this every post would carry
 * an "Updated" line from the moment it shipped, which tells a reader nothing.
 */
```

### app/routes/blog.$slug.tsx:268 (WHY, shortened)

header: the escaped-vs-injected rule, which is the whole of it.

```tsx
/**
 * THE ONE PLACE ON THIS PAGE WHERE THE TEXT IS NOT OURS.
 *
 * The body two hundred lines below is injected with `dangerouslySetInnerHTML`,
 * and the comment there says why: it is rendered at build time from markdown we
 * author, it contains no third-party input, and injecting it is the point of
 * having a pipeline at all.
 *
 * A mention is the exact inverse. Every string in it was read out of a page
 * this site does not control, by a Worker that fetched a URL a stranger chose.
 * So it is RENDERED AS TEXT: React children, escaped by React, with no
 * `dangerouslySetInnerHTML` anywhere in this section, no image, no attribute
 * carrying a source-supplied value except one `href` that `safeHttpHref` has
 * re-parsed at render time.
 *
 * The two sit on one page and the distinction between them is the whole of the
 * rule. First-party markup is injected because we wrote it. Third-party text is
 * escaped because we did not. Neither half is a precaution against the other
 * going wrong; they are two different kinds of thing that happen to render
 * beside each other, and the moment somebody reads this section as "the body is
 * injected, so this could be too" is the moment the rule is gone.
 *
 * @param mention one approved row, as `approvedMentionsFor` selected it
 */
```

### app/routes/blog.$slug.tsx:297 (CONTRACT, shortened)

the ordering and the still-renders rule.

```tsx
/*
   * THE AUTHOR'S OWN URL FIRST, THE SOURCE PAGE SECOND, and neither if neither
   * parses. `readAuthor` stores an `author_url` only when the source publishes
   * an h-card carrying one, so most rows fall through to the source, which is
   * the page that did the linking and the more useful destination anyway.
   *
   * A row whose URLs BOTH fail the check still renders: the name becomes plain
   * text with no anchor. Dropping the mention instead would hide something the
   * admin approved from the reader while the moderation queue kept showing it
   * as published, which is a disagreement between two surfaces about what is
   * live.
   */
```

### app/routes/blog.$slug.tsx:311 (WHY, shortened)

hard rule 13's distinction, on a public page.

```tsx
/*
   * THE NAME FALLS BACK TO THE SOURCE URL, not to a word like "Someone".
   *
   * H1's verifier already falls back to the source's hostname, so a row written
   * by the endpoint always carries a name. This covers a row written any other
   * way, and it substitutes a FACT rather than a placeholder: hard rule 13's
   * distinction, in a spot where the invented value would be attributed to a
   * real person on a public page.
   */
```

### app/routes/blog.$slug.tsx:326 (CONTRACT, shortened)

what each token is for.

```tsx
/*
         * `nofollow ugc noopener noreferrer`. `ugc` is what this link IS,
         * `nofollow` is what it must not pass on, and the other two are this
         * site's default on every outbound anchor. A validated href in a React
         * element is not injected HTML.
         */
```

### app/routes/blog.$slug.tsx:351 (CONTRACT, shortened)

why it is called here rather than threaded.

```tsx
/*
   * ONE `postSocial` CALL for the two things this component needs from it: the
   * dek's text and the canonical URL the share links point at. Called here
   * rather than passed down from `meta`, because the two run independently and
   * a value threaded through the loader would be a third place the same rule
   * could be stated. Pure, so calling it twice on one request costs a string
   * concatenation and cannot disagree with itself.
   */
```

### app/routes/blog.$slug.tsx:361 (CONTRACT, shortened)

derived rather than queried.

```tsx
/*
   * THE NEIGHBOURING PARTS, off the list already on the page.
   *
   * `seriesParts` arrives ordered by part, so the reading path is this post's
   * position in it plus or minus one. Derived rather than queried: a second
   * read would be a second answer to what "the next part" means, and it would
   * have to agree with the list rendered directly beneath it.
   *
   * `findIndex` returns -1 when the post is not in its own series list, which
   * cannot happen for a visible post, and the two lookups below both yield
   * undefined in that case rather than wrapping to the wrong end.
   */
```

### app/routes/blog.$slug.tsx:414 (CONTRACT, shortened)

why classes and not a second representation; the ruling citation stays on one line.

```tsx
/*
          THE h-entry, and every microformats2 class on this page is a CLASS on
          markup that was already here. Item I, ruling 50 as amended:
          microformats only, no `rel="me"`, no social links.

          WHY CLASSES AND NOT A SECOND REPRESENTATION. This page already emits
          Article JSON-LD a few lines up, and the two are not redundant with
          each other: JSON-LD is a separate document a crawler reads, and mf2 is
          an annotation of the markup a reader is already being served, which is
          what a webmention sender, a feed reader and an IndieWeb consumer parse.
          Adding a third copy of the same facts would be a third thing to keep
          true; annotating the first copy cannot go out of step with itself.

          `check:microformats` renders this component and parses the result with
          `microformats-parser`, and it compares `dt-published` against the
          FRONTMATTER date rather than against anything this route computed.
        */
```

### app/routes/blog.$slug.tsx:434 (CONTRACT, shortened)

the same-string rule.

```tsx
/*
              THE DEK, and it is the SAME STRING the meta tag carries.

              `postSocial(post).description` rather than `post.description`,
              because the two are not the same value: `postSocial` falls back to
              the site description when a post has none, and that fallback is
              the one the `<meta name="description">` above already emits. Using
              the raw column here would put a different sentence on the page
              than in the head for any post that ever hits the fallback, which
              is exactly the drift `postSocial` was extracted to end.
            */
```

### app/routes/blog.$slug.tsx:453 (CONTRACT, shortened)

keeps the conditional prohibition; the element's history goes to the history document.

```tsx
/*
                THE UPDATED DATE GAINED AN ELEMENT, and it is the one element
                this arc adds. It was bare text: the label was rendered and the
                machine-readable timestamp behind it was not, so `dt-updated`
                had nothing to take a class from.

                Rendered text is UNCHANGED. `<time>` has no default styling and
                `revisedLabel` is the same string it was, so the only difference
                on the wire is the element and its `datetime`.

                STILL CONDITIONAL, and deliberately: `revisedLabel` is null
                unless the revision is further from publication than
                `REVISED_THRESHOLD_MS`, so most posts carry no `dt-updated` at
                all. That is the correct reading of "when the post has one": a
                post nobody has revised has no updated date, and emitting the
                row's `updatedAt` regardless would publish a sync timestamp as
                if it were an edit.
              */
```

### app/routes/blog.$slug.tsx:481 (CONTRACT, shortened)

keeps hidden-not-sr-only, which is the accessibility half; the byline argument goes to the history document.

```tsx
/*
              THE AUTHOR, and it is HIDDEN, which is a real cost and is stated
              rather than glossed.

              This page has never carried a byline. Every post here is Dustin's,
              the footer says so on every page and the Person JSON-LD says so to
              a machine, so a visible byline would be new furniture on a page
              whose design nobody asked to change; the constraint on this arc is
              that nothing visual moves. `p-author` is not optional in an
              h-entry that wants to be consumed, so the h-card goes in `hidden`.

              `hidden` and not `.sr-only`: `.sr-only` is still announced, and a
              screen reader gaining a name and a link on every post IS a change
              to the page, just not one a screenshot catches. `hidden` removes
              it from the render AND from the accessibility tree, and every mf2
              parser reads the markup rather than the computed style, which is
              the same reason the JSON-LD above works.

              WHAT WOULD RETIRE THIS: a visible byline. If one ever lands, move
              these two classes onto it and delete this block, because a hidden
              copy beside a visible one is two owners of the same fact.
            */
```

### app/routes/blog.$slug.tsx:522 (CONTRACT, shortened)

keeps absent-not-empty and the LCP eagerness; the srcset ladder and the dimensions history go to the history document.

```tsx
/*
            THE COVER, drawn at last. It has been stored, read by `postSocial`
            for the card and by `articleJsonLd` for the structured data, and
            never once shown to a reader on the page it belongs to.

            ABSENT, NOT EMPTY, when there is no cover. The whole `<figure>` is
            conditional rather than a figure wrapping a missing image: an empty
            figure is a landmark a screen reader announces and a box the layout
            reserves, for nothing.

            RESPONSIVE ONLY FOR `/media/` KEYS, which is the rule the body
            images already follow and the reason `coverSrcSet` is a helper
            rather than an inline expression. An R2 object can be transformed to
            the closed width ladder; a static asset under `public/` is served
            straight from the assets host and never passes the transform route,
            so advertising widths for one would offer URLs that 404.

            EAGER AND HIGH PRIORITY, deliberately against the usual advice. This
            is the first image on the page and, when present, the LCP element:
            lazy-loading it would defer the very paint the metric measures.
            Every image inside the body keeps the pipeline's own loading rules.

            WIDTH AND HEIGHT COME FROM THE KEY, since 2026-09-11. This block
            used to say they could not: "D1 stores `cover_image` and
            `cover_alt` and no dimensions, so nothing here can state an
            intrinsic size without a schema change and a second read." The
            premise was right and the conclusion was not, because an uploaded
            object's key spells its own dimensions and `coverDimensions` reads
            them back out of the string D1 already holds. See that function for
            what it still cannot do, which is a static cover under `public/`.
          */
```

### app/routes/blog.$slug.tsx:567 (CONTRACT, shortened)

why both controls exist; the roadmap quotation goes to the history document.

```tsx
/*
            THE SERIES BLOCK. The list of parts is not new; what is new is that
            the series NAME is now a link, and that the reading path has its own
            two controls.

            The roadmap's own summary of this gap reads "`series`/`part`:
            in-post navigation, no hub URL". The navigation was here and the
            name was inert text, so a reader could see the set and could not
            reach it. `seriesPath` is the one owner of that address.

            THE LIST AND THE PAIR DO DIFFERENT JOBS, which is why both are here
            rather than one replacing the other. The ordered list is the table
            of contents: every part, with the current one marked. The previous
            and next targets are the page turn, and they carry the LABEL as well
            as the title, so a reader can tell direction without counting. Part
            one shows no previous and the last shows no next, because there is
            nothing to offer rather than something to disable.
          */
```

### app/routes/blog.$slug.tsx:659 (CONTRACT, shortened)

the no-script property of all three.

```tsx
/*
            Agent actions. Every one is a plain link, so all three work with
            scripting off: the first navigates to the markdown twin, the other
            two open an assistant with the twin's URL in the prompt. The
            enhancement script upgrades the first to a clipboard copy.
          */
```

### app/routes/blog.$slug.tsx:693 (CONTRACT, shortened)

keeps the no-script permalink argument; the Bluesky removal goes to the history document.

```tsx
/*
            SHARING, and every one of these is an ordinary anchor.

            BESIDE the agent row rather than merged into it, because they answer
            different questions: that row is "take this post elsewhere to read
            it", this one is "point somebody else at it". The agent row is
            unchanged.

            THE PERMALINK IS THE COPY-LINK, and it needs no script at all. The
            usual shape is a button that writes to the clipboard, which is a
            control that does nothing for a reader without JavaScript and looks
            identical to one that works. An anchor to the canonical URL is the
            honest version: it is visible, focusable, right-clickable, and on
            touch it is long-pressable, which is how a link gets copied on a
            phone anyway. NO enhancement is registered for it. The bundle is
            near its measured ceiling and this page's whole point is that it
            works without script; adding bytes to reimplement what the browser
            already does would trade both away for nothing.

            The remaining intent is a plain GET link to LinkedIn's own share
            endpoint, with `rel="noopener noreferrer"` and no `target`, so it
            behaves like every other outbound link on the page. It read "the two
            intents" until 2026-09-10, when the Bluesky one left under ruling 50
            and the sentence describing it would have gone on being read as a
            statement about a link that was not there.
          */
```

### app/routes/blog.$slug.tsx:720 (CONTRACT, shortened)

why the class landed on this anchor; the ruling 50 account goes to the history document.

```tsx
/*
              THE PERMALINK IS ALSO THE h-entry's `u-url`, and that is why the
              class landed here rather than on a new hidden element: this anchor
              already holds the canonical absolute URL, it is visible, and it is
              the one a reader copies. A microformats consumer and a human now
              read the same element.

              SHARE ON BLUESKY LEFT ON 2026-09-10, ruling 50: no Mastodon, no
              Bluesky, ever. It was a share intent rather than a profile link,
              which is why it survived the ruling's first pass, but the ruling's
              subject is the site's relationship with those networks and an
              intent button is this site inviting readers into one.
            */
```

### app/routes/blog.$slug.tsx:755 (CONTRACT, shortened)

absent not empty, and the pointer to the mention rule.

```tsx
/*
            MENTIONS FROM OTHER SITES, and the grounds are on the `Mention`
            component above: this is the one block on the page whose text is not
            ours, and it is therefore escaped text where the body is injected
            markup. Read that comment beside the body's.

            ABSENT, NOT EMPTY, on the cover figure's grounds a few hundred lines
            up: an empty section is a landmark a screen reader announces and a
            heading a reader scrolls to, for nothing. Most posts have no
            approved mention and should render no trace of the feature.
          */
```

### app/routes/blog.$slug.tsx:777 (CONTRACT, shortened)

the one-owner rule for the stack facts.

```tsx
/*
            ONE LINE, in the template, for every post. Ratified in
            colophon-page.md: not a section, and not per-article text. Twelve
            post footers each restating what the site runs on is twelve places
            to update and eleven that go stale, which is the rot the duplication
            rule exists to prevent, and they would compete with each other for
            the same search intent besides. The colophon carries the facts; a
            post carries a pointer to them.
          */
```

### app/routes/blog.$slug.tsx:795 (CONTRACT, shortened)

why it degrades rather than renders empty.

```tsx
/*
                THE DESCRIPTION, so a related list stops being three bare
                titles a reader has to guess at. The ranking above is untouched:
                `withRelated` sorts on shared tags, date and slug, and the field
                added here takes no part in that.

                Rendered only when the row HAS one. Rows written before
                2026-09-03 carry no description in their stored blob, so this
                degrades to the title it always was rather than to an empty
                paragraph, until the next sync rewrites them.
              */
```

### app/routes/blog.$slug.tsx:818 (CONTRACT, shortened)

the target size, the no-image prohibition and the machine-readable half; the old inline shape goes to the history document.

```tsx
/*
          PREV AND NEXT AS TARGETS, not as a line of text.

          They were two inline links reading "Previous: <title>", so the label
          and the title were one run of text and the hit area was whatever the
          words happened to occupy. Each is now a bordered block carrying the
          label above the title, which gives it a real 24px-plus target on
          touch and lets the direction be read before the title rather than
          parsed out of the same sentence.

          NO IMAGE, deliberately. The verified reference carries a label and a
          title and nothing else, and a thumbnail here would be a third image
          on a page that already has a cover and a card.

          `rel="prev"` and `rel="next"` are kept: they are the machine-readable
          half and nothing about the styling replaces them.
        */
```

## app/root.tsx

### app/root.tsx:22 (CONTRACT, shortened)

header: the ordering prohibition; the Tailwind-hoisting story goes to the history document.

```tsx
/*
 * THE COMPONENT SHEETS, IN CASCADE ORDER. Grounds at the bottom of app.css.
 *
 * These were nine `@import` statements at the end of app.css until 2026-08-27.
 * CSS requires `@import` before every other rule and drops a late one; they had
 * been surviving on Tailwind's processor hoisting them, so removing Tailwind
 * took all nine sheets off the site while the build stayed green. Here they are
 * ordinary module imports, collected into the same root stylesheet in this
 * order, which is where they already sat in the cascade.
 *
 * THE ORDER IS LOAD-BEARING and is the order they were cut out of the original
 * 9,269-line app.css. Do not sort this list.
 */
```

### app/root.tsx:41 (CONTRACT, shortened)

why the position is kept; the header suspension goes to the history document.

```tsx
/*
 * LAST, AND IT NO LONGER CONTAINS A HEADER.
 *
 * This sheet arrived last on 2026-09-13 so the Paper, Glass, Light bar would
 * beat `public-chrome.css` and `chrome-nav.css` on ORDER rather than by
 * out-specifying them. Dustin ruled the header back on 2026-09-14, so the two
 * sheets above are the header again and shell.css keeps only the track grid
 * and the footer, which neither of them declares. The position is kept because
 * the order of this list is load-bearing and shell.css still needs to win
 * where it and page-shell.css touch the same thing.
 */
```

### app/root.tsx:54 (CONTRACT, shortened)

the one-owner rule for the hashed name.

```tsx
/*
 * THE HASHED URL OF THE NORMAL FACE, so the preload below names the same bytes
 * app.css asks for. Imported rather than written out: the filename carries a
 * content hash, which is the whole reason self-hosting these could be made
 * immutable, and a hand-written path would be a second statement of it that
 * goes stale the day the font is replaced. Rule 17.
 */
```

### app/root.tsx:62 (CONTRACT, shortened)

what `?url` buys; the katex build grounds go to the history document.

```tsx
/*
 * THE MATH STYLESHEET'S URL, AND `?url` IS WHAT MAKES IT CONDITIONAL.
 *
 * A bare `import "./styles/katex.generated.css"` would fold these bytes into
 * root's own stylesheet, which every page on the site links. `?url` makes Vite
 * emit it as a standalone content-hashed asset instead and hand back its path,
 * so a document can decide at render time whether to ask for it. Vite compiles
 * the file on the way through, which is what repoints its 20 `url()` font
 * references at hashed copies under `assets/`, where `public/_headers` already
 * grants them an immutable year.
 *
 * The file is generated by `npm run build:katex` from the installed katex
 * package plus `styles/katex-overrides.css`. Grounds in that script.
 */
```

### app/root.tsx:78 (CONTRACT, shortened)

header: the whole flash fix.

```tsx
/**
 * Reads the theme cookie so the attribute is server-rendered.
 *
 * This is the entire flash-of-wrong-theme fix. There is no inline script and
 * nothing to correct after paint: the first byte of HTML already carries the
 * right attribute, or deliberately carries none so prefers-color-scheme
 * decides. Cookie parsing only, no binding and no I/O, so it costs nothing on
 * a route that does not care.
 */
```

### app/root.tsx:87 (CONTRACT, shortened)

header: the opt-in property and the middleware requirement.

```tsx
/**
 * THE TIMING COLLECTOR, created ONCE per request, for every route on the site.
 *
 * `?timing=1` opts in and nothing else does. A request that did not ask carries
 * `undefined` all the way down, every `timed` call degrades to a plain call,
 * and no header is emitted, so the uninstrumented response is byte-identical to
 * what shipped before any of this existed.
 *
 * ## WHY IT MOVED HERE, 2026-08-27
 *
 * It was created in TWO places and reached a third of the site. `admin.tsx`
 * made one for the admin subtree, `blog._index.tsx` made a LOCAL one for
 * itself, and every other public route could call `timed` all it liked into an
 * `undefined` collector that nothing ever created. `/`, a post and `/search`
 * answered `?timing=1` with no header at all, which reads as "this route is
 * instant" rather than "this route is not instrumented".
 *
 * Root matches every route, so one middleware here covers the public plane and
 * the admin plane together, and `workers/app.ts` stamps the header from the
 * same array after the handler returns, which is the one point where it is
 * complete. `admin.tsx` no longer creates its own: a child that replaced this
 * array would silently discard whatever a parent had already recorded.
 *
 * MIDDLEWARE, NOT THE LOADER, and that is load-bearing rather than stylistic.
 * A loader runs alongside its siblings, so a collector created in one is not
 * visible to another; middleware runs BEFORE the whole matched tree.
 */
```

### app/root.tsx:123 (CONTRACT, shortened)

why the nonce travels this way.

```tsx
// The nonce is generated in `workers/app.ts` BEFORE the render and put in the
  // request context, because the same value has to appear in the CSP header and
  // on every script in this document. Carried through the loader because
  // `Layout` cannot reach the request context directly.
```

### app/root.tsx:131 (CONTRACT, shortened)

the merge asymmetry, which is why these live here.

```tsx
// Icons and the manifest live here rather than in the document head because
  // `links` from every matched route are merged, so these ride on every page.
  // `meta` is NOT merged, which is why the default social card is a constant in
  // seo.ts that each public route names for itself.
```

### app/root.tsx:139 (CONTRACT, shortened)

why the type stays; the every-page history goes to the history document.

```tsx
/*
   * FEED AUTODISCOVERY, ON EVERY PAGE since 2026-08-27.
   *
   * These two lived on `/blog` alone, so a reader who arrived on a post, which
   * is where most readers arrive, saw a site with no feed. `links` from every
   * matched route are merged, which is exactly why the icons and the manifest
   * are here, and a feed is the same kind of fact about the site rather than
   * about the page.
   *
   * The `type` on the JSON one stays `application/feed+json` even though the
   * response now travels as `application/json` for compression: a reader scans
   * autodiscovery links for the FEED types, so this is what the resource is,
   * and the content-type is how it gets there. Grounds on the route.
   */
```

### app/root.tsx:167 (CONTRACT, shortened)

keeps crossorigin and normal-face-only; the measured bytes and timings go to the history document.

```tsx
/*
   * NO FONT LINKS, EXCEPT THIS PRELOAD. Inter is self-hosted since 2026-08-21;
   * the @font-face blocks are at the top of app.css. Removing the old links
   * took away two external preconnects and one render-blocking stylesheet, and
   * let style-src and font-src both drop to 'self'. None of that changes.
   *
   * ## WHY ONE LINK COMES BACK
   *
   * A font inside a stylesheet is discovered LATE: the browser has to fetch
   * app.css, parse it, match the rule, and only then start the download.
   * MEASURED cold on the throttled profile the audits used: the normal face is
   * 72,920 bytes of a 91 KB page, the largest single resource on every route,
   * and it spent 512 to 786 ms in flight after the stylesheet had already
   * arrived. The preload moves the request to the first byte of the document.
   *
   * ## THE NORMAL FACE ONLY
   *
   * The italic is 79,716 bytes and is needed by a page only if that page
   * renders italic latin text. Its `unicode-range` already makes the browser
   * fetch it on demand, and preloading it would download eighty kilobytes on
   * every route to serve the few that use it. A preload that is not used within
   * a few seconds is worse than no preload: the browser warns, and the bytes
   * competed with the ones that were needed.
   *
   * ## `crossorigin` IS MANDATORY AND IS NOT ABOUT CORS HERE
   *
   * Fonts are fetched in anonymous CORS mode whatever their origin, so a
   * preload without the attribute is a DIFFERENT request from the one the font
   * loader will make, and the browser fetches the file twice. Same-origin does
   * not exempt it.
   */
```

### app/root.tsx:208 (CONTRACT, shortened)

the error-boundary path.

```tsx
// Layout also renders the error boundary, where the root loader may not have
  // run, so this reads the optional route data rather than useLoaderData. No
  // data means no attribute, which is the system path and always safe.
```

### app/root.tsx:213 (CONTRACT, shortened)

keeps the no-fallback prohibition; the discharged note goes to the history document.

```tsx
/*
   * No data means the root loader did not run, which is the error-boundary
   * path, and there is then nothing to stamp FROM HERE.
   *
   * **"Revisit before switching to enforcing" is now DISCHARGED, by a commit
   * that was not about this.** It said an un-nonced error page cost a violation
   * report and nothing else, which was true under Report-Only and would have
   * become "error pages never hydrate" on 2026-08-17.
   *
   * It did not, because `<Scripts>` FALLS BACK to the framework context:
   * react-router 8.3.0, `lib/dom/ssr/components.js`, verbatim
   * `if (scriptProps.nonce == null && contextNonce)`, and `ScrollRestoration`
   * does the same. `entry.server.tsx` fills that context from
   * `<ServerRouter nonce>`, reading `getNonce(loadContext)` DIRECTLY rather than
   * through loader data, so it has a value whether or not the root loader ran.
   * That prop was added on 2026-08-07 to fix react-router's two streaming
   * scripts, and it covered this path as a side effect nobody recorded.
   *
   * So `undefined` here is still the honest value and is still deliberately not
   * given a fallback: a made-up nonce would satisfy the markup while matching
   * nothing in the header. It is simply no longer the LAST word on what gets
   * stamped.
   */
```

### app/root.tsx:238 (CONTRACT, shortened)

the opt-in law and the gate that pins it.

```tsx
/*
   * HYDRATION IS OPT-IN BY ROUTE, since 2026-08-26.
   *
   * A route that needs React in the browser exports `handle = { hydrate:
   * true }`; today that is the admin layout (covering every admin child) and
   * /login. No public reading route does, so a public page ships NO framework
   * script and no modulepreloads: its only script tags are the nonced
   * enhancement bundles, which is rule 4's public payload and rule 9's
   * standing ruling (works without script, fast with it) with the "with it"
   * carried by the bundles alone. This is React Router's documented shape:
   * the framework docs state `<Scripts>` may simply be omitted for a
   * traditional no-JS app, and matches expose `handle` exactly for decisions
   * like this one.
   *
   * The ERROR-BOUNDARY path has whatever matches existed when the error threw
   * and hydrates only if one of them had opted in: an admin error page keeps
   * its scripts, a public error page stays script-free, and a root-level
   * error (no handle anywhere) renders the boundary below with no framework
   * script, which is fine because it is plain markup.
   *
   * `check:page-payload` pins both halves: the opt-in set is exactly
   * {admin.tsx, login.tsx}, and <Scripts> renders only behind this guard.
   */
```

### app/root.tsx:266 (CONTRACT, shortened)

keeps the React-hoisting defect and the mirror gate; the useMatches probe goes to the history document.

```tsx
/*
   * THE MATH STYLESHEET, LINKED ONLY BY A PAGE THAT HAS MATH.
   *
   * Whether a post carries an expression is a property of the POST, not of the
   * route: `/blog/:slug` is one route serving thirteen posts and one of them
   * has math. A CSS import would put 2.8 kB and a twenty-face font set on all
   * thirteen to serve one, which is hard rule 4's question answered the wrong
   * way for the other twelve.
   *
   * ## WHY BY ROUTE ID AND NOT OFF `matches`
   *
   * **MEASURED 2026-09-06 with a probe attribute on the document element:
   * `useMatches()` inside `Layout` returns each match's id and `handle`, and
   * `match.data` is EMPTY for every match, root's own included.** That is why
   * `hydrates` above works (a handle is static route metadata) and why reading
   * a loader value the same way cannot. `useRouteLoaderData` does work here,
   * for a CHILD as well as for root, measured in the same probe, and it is
   * already how `theme` and `nonce` reach this component.
   *
   * ## AND WHY NOT REACT 19'S STYLESHEET HOISTING, WHICH WAS TRIED FIRST
   *
   * The alternative is a `<link rel="stylesheet" precedence="...">` rendered by
   * the post component, which needs no route ids at all. It works, and it puts
   * the element in the WRONG PLACE: React hoists a precedence-managed
   * stylesheet to the TOP of `<head>`, above `<meta name="color-scheme">`.
   * MEASURED on the rendered page, and `check:browser` caught it by name: the
   * colour-scheme signal is load-bearing exactly because it arrives BEFORE the
   * first stylesheet request, and hoisting inverted that on every math page. So
   * the link is written here, after `<Links />`, where its position is this
   * file's decision rather than React's.
   *
   * ## THE ID LIST IS A MIRROR, AND IT IS GATED AS ONE
   *
   * Two ids are named below, and a third route rendering a post would be
   * unstyled with nothing complaining. `check:page-payload` derives the set of
   * routes whose loader returns `blogPostView(...)` and reconciles it against
   * the ids named here, in both directions.
   */
```

### app/root.tsx:308 (CONTRACT, shortened)

why unconditional, and the stated cost.

```tsx
/*
   * AND THE EDITOR TAKES IT UNCONDITIONALLY, through a handle rather than data.
   *
   * The exact-preview pane copies every `link[rel="stylesheet"]` off THIS
   * document into its iframe, deliberately, so the preview cannot drift from
   * the published page. Which means an author typing `$x^2$` sees the
   * expression rendered with no math stylesheet: both KaTeX trees at once, the
   * layout one unpositioned and the MathML one unclipped. The authoring path
   * for this feature would have been the one place it looked broken.
   *
   * Unconditional because the condition would be wrong: the flag is a property
   * of what has been SAVED, and an author is typing something that has not been
   * saved. A handle is the right carrier for "this route always wants it", it
   * is static route metadata like `hydrate` above, and `useMatches` does expose
   * it here where it does not expose loader data.
   *
   * It costs the admin plane 2.8 kB brotli on two routes. Rule 4 grades the
   * public payload and `check:page-payload` derives its route set from the
   * shared-cache exports, so no admin route is in it; this is a real cost taken
   * on purpose, in the plane the rule exempts.
   */
```

### app/root.tsx:339 (CONTRACT, shortened)

keeps the ordering contract and what the gate asserts; the frame measurement goes to the history document.

```tsx
/*
          COLOUR SCHEME, BEFORE ANY STYLESHEET, and the position is the point
          rather than tidiness.

          Written here directly after charset; it ARRIVES third, after viewport,
          because React 19 hoists document metadata and owns the order among the
          metas. That is stated rather than implied because the obvious reading
          of this JSX is wrong, and because the property that matters is not the
          exact index: it is that the browser reads this before it has requested
          a stylesheet. `check:browser` asserts that relation and deliberately
          does not assert an index, which would be pinning React's internals.

          This is the only thing in the document that tells the BROWSER, as
          opposed to the stylesheet, which palette the page is. `data-theme` on
          <html> means nothing until the CSS that reads it has been fetched and
          parsed, and until then the canvas the browser paints between and
          beneath documents is its default, which is light. Measured on
          production in real Chrome at about 45 frames a second: one composited
          frame at 253 of 255 between two pages that read 61, on a header click
          with a dark theme and a light machine. It sits before <Links> so it
          is read before a stylesheet is even requested.

          Rendered here rather than through a `meta` export for the same
          mechanical reason as theme-color below: `meta` exports are not merged
          across matched routes, so any route exporting one would drop this.

          It follows the SERVER-RESOLVED choice, so the toggle keeps it in
          step: the no-script path re-renders the document, and the scripted
          path re-renders it too. Grounds on colorSchemeMeta.
        */
```

### app/root.tsx:371 (CONTRACT, shortened)

the merge reason and the second-copy gate.

```tsx
/*
          THEME-COLOUR, BOTH THEMES, and it is here rather than in a `meta`
          export for a mechanical reason: `links` are merged across matched
          routes and `meta` is NOT, so a root-level meta export would be
          replaced wholesale by every route that exports one. Rendered into the
          head directly, beside charSet and viewport, which are here for the
          same reason.

          The two values are the light and dark `--bg` tokens. They are written
          out rather than read from a var(), because this attribute is consumed
          by the browser chrome and the OS, neither of which resolves a custom
          property. That makes them a second copy of a token, which rule 17 does
          not like, so `check:contrast` asserts they still match the palette.

          Media-scoped rather than a single value: a bare theme-color paints the
          address bar one colour in both themes, which is exactly the seam a
          dark reader sees.
        */
```

### app/root.tsx:392 (CONTRACT, shortened)

why it is not removable; the measured bytes go to the history document.

```tsx
/*
          THE NONCE ON THESE LINKS IS NOT REMOVABLE FOR 23 BYTES, measured
          2026-08-27.

          `<Links>` takes a nonce from the framework context and has no opt-out:
          `nonce == null && contextNonce` is the only branch. That context value
          comes from `<ServerRouter nonce>` in entry.server.tsx, which exists to
          nonce react-router's two STREAMING scripts, including on the
          error-boundary path where the root loader never ran. So the attribute
          on nine `<link>` elements is a side effect of a mechanism that is
          load-bearing elsewhere.

          What it costs, measured on `/blog`: 405 bytes raw and 23 bytes brotli,
          because the same nonce string repeats and compresses to nothing. The
          nonce is inert on a `<link>` under `style-src 'self'`. Trading the
          streaming scripts' nonce for 23 bytes is the wrong way round.
        */
```

### app/root.tsx:410 (CONTRACT, shortened)

the cascade position and the precedence prohibition.

```tsx
/*
          AFTER <Links />, so the cascade puts the math rules last and a site
          rule inside the generated sheet wins over the upstream katex rule it
          overrides. No nonce: a stylesheet from this origin is authorised by
          `style-src 'self'`, and the nonce `<Links>` puts on its own elements
          is a side effect of the framework's streaming-script mechanism rather
          than something a link needs (see the note above it).

          No `precedence` either, deliberately: that attribute makes React treat
          the element as a resource and lift it above the colour-scheme meta,
          which is the defect recorded at `linksMath`.
        */
```

### app/root.tsx:449 (WHY, shortened)

why the strings are deliberate; the four originals go to the history document.

```tsx
/*
   * THE COPY, and all four strings are deliberate rather than scaffold.
   *
   * `Oops!` and `An unexpected error occurred.` were the Remix template's, and
   * they survived every pass over this file because nothing renders them on a
   * healthy site: the 404 branch below overwrites both, so the only reader who
   * ever sees them is one whose page has just failed. That is the worst moment
   * to sound like a starter kit.
   *
   * `The page failed to render.` says what happened. `Something broke.` is an
   * admission rather than an interjection. And `This page is not here.` is the
   * 404 in the voice the rest of the site uses, where "The requested page
   * could not be found." is three passives about a request the reader did not
   * know they were making.
   */
```

### app/root.tsx:479 (CONTRACT, shortened)

keeps the a-404-is-still-the-site rule and why the header is safe; the Tailwind classes go to the history document.

```tsx
/*
   * A 404 IS STILL THE SITE, and this page was not.
   *
   * It rendered four leftover Tailwind utility classes, `pt-16 p-4 container
   * mx-auto`, which this repo does not use anywhere else, with no header, no
   * footer, and no `id="main"`. So the most likely page a stranger reaches by a
   * broken link had no navigation off it, no identity, and a skip link pointing
   * at nothing, because root emits `href="#main"` on every route.
   *
   * SiteHeader is SAFE HERE and that is not an assumption: since 2026-08-29 it
   * reads the root loader NOT AT ALL. It used to take the resolved theme with a
   * justified fallback naming this path; the one-button theme control resolves
   * itself from `<html data-theme>` through the cascade, so the header renders
   * from its props and the route table alone. There is no loader value left for
   * the error-boundary path to be missing.
   *
   * The stack block keeps its own class rather than borrowing `.prose pre`,
   * because it is DEV-ONLY output and styling it as prose would put a reader's
   * eye on it as content. It stays scrollable so a long stack cannot widen the
   * page, which is the same overflow class the header just had.
   */
```

## app/components/admin/media-grid.tsx

### app/components/admin/media-grid.tsx:1 (CONTRACT, shortened)

header: the one-tree rule; the move date goes to the history document.

```tsx
/*
 * THE LIBRARY ITSELF: one markup tree, two layouts.
 *
 * Grid and list are the same elements under different data attributes, so the layout cannot change which submissions the page can issue.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, markup and
 * comments unchanged.
 */
```

### app/components/admin/media-grid.tsx:30 (CONTRACT, shortened)

why the member is selected rather than the property read.

```tsx
/*
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries these fields, so the member is
 * selected rather than the property read off the union. One owner: the loader.
 */
```

### app/components/admin/media-grid.tsx:61 (CONTRACT, shortened)

the accessibility prohibition, and the rule that decided it.

```tsx
// A plain list. NOT role="grid": positional information is meaningless
        // to a screen reader here, because the number of columns depends on the
        // container width, and directional navigation does not help anyone find
        // a specific picture. Semantic elements first; the only ARIA on this
        // page is the nav label above and aria-current on the active chip.
```

### app/components/admin/media-grid.tsx:66 (CONTRACT, shortened)

the one-tree rule and what a second branch would cost.

```tsx
/*
          ONE MARKUP TREE, TWO LAYOUTS, selected by data attributes.
          The list view is CSS over the same elements rather than a second
          branch of JSX: a second tree is a second place for a control to go
          missing, and check:admin-ui would then have to prove both carry the
          same submissions instead of the layout being unable to change them.
          Tile size is a class exactly as ruled, never an inline style.
        */
```

### app/components/admin/media-grid.tsx:75 (CONTRACT, shortened)

the nesting prohibition and the fixture consequence.

```tsx
/*
        THE BULK BAR, and the FORM WRAPS THE GRID so the checkboxes are part of
        the same submission. Nesting this inside the toolbar above would put a
        form inside a form, which the browser drops; the posts index solved it
        the same way and this is that solution, not a new one.

        Rendered only when something is selected, which is also why the two
        bulk intents appear in the fixture only under the seeded-selection
        state: an unselected page genuinely cannot issue them.
      */
```

### app/components/admin/media-grid.tsx:89 (WHY, shortened)

which question the number answers.

```tsx
/*
                THE SIZE OF WHAT IS SELECTED, which is the number the mockup puts
                beside the count and the one that answers the question somebody
                selecting a dozen files is actually asking: how much is this.
                A count of twelve says nothing about whether they are thumbnails
                or a conference poster.
              */
```

### app/components/admin/media-grid.tsx:104 (CONTRACT, shortened)

why it cannot submit, and the line shape.

```tsx
/*
              COPY ADDRESSES, one per line, for the selection.

              `type="button"` so it never submits the form it sits inside, and
              the only client-side control in this bar: everything beside it is a
              real submission. One address per line because that is what pastes
              usefully into a document, and a comma-separated list is not
              something anybody wants.
            */
```

### app/components/admin/media-grid.tsx:156 (CONTRACT, shortened)

the ladder position and why the button cannot submit.

```tsx
/*
              MOVE TO TRASH, for the selection. Reversible, touches no object and
              no public URL, so it takes a plain confirmation rather than the
              type-the-count ceremony reserved for the irreversible delete.

              A `type="button"` that opens the confirmation, because the confirm
              lives in the modal and submitting from here would skip it. The
              modal's own submit carries the same form's selected keys.
            */
```

### app/components/admin/media-grid.tsx:183 (WHY, shortened)

keeps the page-local ruling and the braces prohibition; the leak story goes to the history document.

```tsx
/*
          GROUPED PAGE-LOCAL. Each page buckets the rows IT HAS; a group never
          spans a page boundary. That is a ruling, not a shortcut, and the
          grounds are on `groupRows`: fetching the whole library to group
          globally is fine at 70 rows and wrong at 700, and letting a group
          resume on page two reads as a bug to everyone who sees it.

          The heading therefore counts THIS PAGE and says so, because a count
          that looked like a library total would be the over-promise again.

          BRACED. Without the braces this is JSX CHILDREN TEXT, not a comment,
          and the whole paragraph renders on the page. It did, and it was
          caught by looking rather than by any gate: check:admin-ui reads
          submissions and structure, and a comment leaking into the document
          changes neither.
        */
```

### app/components/admin/media-grid.tsx:199 (WHY, shortened)

why the header is not repeated.

```tsx
/*
          THE HEADER ROW, ONCE, above every group rather than once per group.

          Column headings describe the TABLE, and a heading repeated above each
          folder would say the same five words four times while making each
          group look like a table of its own. The grouping is still real: the
          folder headings sit below this, and the columns line up across all of
          them because every row is laid out on the same fixed track list rather
          than on a shared grid.
        */
```

### app/components/admin/media-grid.tsx:221 (CONTRACT, shortened)

what the note prevents, and the contrast floor; the rejected hex goes to the history document.

```tsx
/*
                THE NOTE, right-aligned and quiet, and it is the reason this
                grouping exists. "Placed by the roster page template" is the
                sentence that stops somebody deleting nine photographs because
                a post-level tracker called them unreferenced.

                Quiet by SIZE and WEIGHT, never by an unreadable grey: the
                mockup's #A79C8A measures 2.34 to 1 and does not ship. This
                resolves to --text-muted.
              */
```

### app/components/admin/media-grid.tsx:247 (CONTRACT, shortened)

the one-definition rule.

```tsx
/*
             * THE THREE-STATE DESCRIPTOR AND THE PER-ROW FLAGS, from the pure
             * module. The row does not decide either: `usage` arrives from the
             * loader, and `flagsFor` is the one definition of what a flag is, so
             * the lens that selects rows and the badge that labels them cannot
             * drift.
             */
```

### app/components/admin/media-grid.tsx:266 (CONTRACT, shortened)

keeps no-new-client-state and the hover prohibition; the mockup comparison goes to the history document.

```tsx
/*
             * WHETHER THIS TILE WEARS THE CAPTION BAR.
             *
             * **NO NEW CLIENT STATE.** Both halves already exist and neither is
             * invented here: `chosen` is the selection this page has carried
             * since bulk actions landed, and `view.key` is the inspector, which
             * is a URL parameter like every other. So the caption is a function
             * of state the page already holds, which is why it costs nothing.
             *
             * GRID ONLY. In the list a row already has columns for the size and
             * the dimensions, so a bar laid over a 44px thumbnail would be the
             * same three facts a second time, in less room.
             *
             * Deliberately NOT on hover. Hover is not a state the server can
             * render, and reaching it would mean either script or a CSS rule
             * that reveals a control the keyboard cannot get to first. The
             * mockup shows it on hover AND on the active tile; this page keeps
             * the half that has an address.
             */
```

### app/components/admin/media-grid.tsx:291 (CONTRACT, shortened)

why the attribute is the key.

```tsx
/* The keyboard navigator addresses tiles by this attribute and
                   reads their rendered boxes for the grid geometry. It is the
                   only thing tying the island to the markup, and it is the key
                   rather than an index so a reflow cannot change what it means. */
```

### app/components/admin/media-grid.tsx:300 (CONTRACT, shortened)

the one-grammar rule.

```tsx
/* The checkbox carries `key`, which is what the bulk action
                    reads with form.getAll("key"). Same shape as the posts
                    index's `slug`, so the two bulk surfaces are one grammar. */
```

### app/components/admin/media-grid.tsx:312 (CONTRACT, shortened)

the keyboard behaviour that falls out of it.

```tsx
// `nativeEvent` carries the modifier a change event
                        // does not expose directly. Keyboard activation reports
                        // shiftKey false, so Space still toggles one row, which
                        // is the behaviour a keyboard reader expects.
```

### app/components/admin/media-grid.tsx:322 (CONTRACT, shortened)

why the ratio is on the wrapper; the ragged-grid story goes to the history document.

```tsx
/* A FIXED BOX, declared as aspect-ratio on the wrapper rather
                    than left to the image.

                    The grid was ragged because it mixes 1200x630 cards, 3:2
                    photos and 1:1 icons and nothing constrained them, which also
                    made the cards tall enough to clip the Save button. An
                    explicit ratio on the wrapper reserves the space before the
                    image arrives, so a lazily-loaded tile cannot reflow the rows
                    below it as it lands. */
```

### app/components/admin/media-grid.tsx:331 (WHY, shortened)

the invalid-HTML prohibition.

```tsx
/*
                  THE FRAME EXISTS SO THE CAPTION CAN BE A SIBLING OF THE LINK
                  RATHER THAN A CHILD OF IT.
                  The caption carries the copy control, and a <button> inside an
                  <a> is invalid HTML that browsers resolve differently: the
                  press either navigates or copies depending on who you ask.
                  Wrapping both in one positioned box is what lets the bar sit
                  over the picture while staying outside the anchor.
                */
```

### app/components/admin/media-grid.tsx:341 (CONTRACT, shortened)

what the prop prevents.

```tsx
/*
                  `preventScrollReset` is what stops opening a file throwing the
                  reader back to the top of the library.

                  `<Link>` is a CLIENT-SIDE transition, so there is no document
                  reload, but `<ScrollRestoration>` in root treats every new
                  location as a new place and scrolls to top. Opening an
                  inspector is not going somewhere else, it is looking closer at
                  where you already are, and the grid behind the drawer must
                  still be showing the tile you clicked.
                */
```

### app/components/admin/media-grid.tsx:356 (CONTRACT, shortened)

keeps the no-script guarantee; the file-manager argument goes to the history document.

```tsx
/*
                    SHIFT OR META CLICK SELECTS INSTEAD OF OPENING.

                    This is the mockup's behaviour and it is what every file
                    manager does: a modified click extends or toggles a
                    selection rather than navigating. Without it, building a
                    selection in the grid means hunting for 31 small checkboxes,
                    and shift-clicking a range is impossible because the first
                    click navigates away.

                    `preventDefault` only inside the branch, so an UNMODIFIED
                    click is untouched and still a plain link: with no script it
                    navigates as it always did, and ctrl-click to open in a new
                    tab still works because that is meta on this platform and
                    lands on the same guard the mockup uses.

                    The range logic is `selectRange`, already written for the
                    checkbox, so shift-click in the grid and shift-click on a
                    checkbox extend the same way from the same anchor.
                  */
```

### app/components/admin/media-grid.tsx:384 (CONTRACT, shortened)

the conditional is the prohibition; the eleven-of-seventy count goes to the history document.

```tsx
// LQIP as a CSS background BEHIND the real image. The element
                    // paints immediately and the image covers it on arrival, so
                    // the tile is never empty, the swap needs no script and no
                    // onload, and the box never changes size.
                    //
                    // ELEVEN OF SEVENTY ROWS HAVE NO PLACEHOLDER: the Images
                    // binding does not rasterize vectors, so every SVG has a null
                    // one. Those must degrade to the surface colour rather than
                    // render as a black or empty hole, which is why this is set
                    // conditionally over a token background rather than always
                    // written as `url(null)`.
```

### app/components/admin/media-grid.tsx:401 (WHY, shortened)

keeps the live reason; the superseded premise goes to the history document.

```tsx
/*
                     * A DOCUMENT USED TO GET A SHORTER BOX, and it no longer
                     * does. The old reason was written down and was true at the
                     * time: "there is nothing to look at, so it must not claim
                     * the same height as a picture", and 5:2 kept a wall of
                     * empty bands from claiming a picture's canvas.
                     *
                     * THERE IS SOMETHING TO LOOK AT NOW. `DocumentCard` puts a
                     * title, a suggestion of text and a size in that space, so
                     * the premise the squash was built on is gone, and a squashed
                     * card would crush the thing that fixed it. Back to 3:2,
                     * which is also the ratio every tile has in the mockup.
                     */
```

### app/components/admin/media-grid.tsx:416 (WHY, shortened)

why a card and not an img; the counts go to the history document.

```tsx
/* A document has no thumbnail the Images binding can ever
                        produce, so it gets a CARD rather than an <img> pointed
                        at something that cannot render one. 31 of the 70 rows
                        are documents; an empty box for each read as 31 loading
                        failures, which is what this replaces. */
```

### app/components/admin/media-grid.tsx:437 (CONTRACT, shortened)

one dot, and where it sits.

```tsx
/*
                  THE CORNER FLAG, one dot, on the tile.

                  `tileFlagFor` picks the single most urgent of the row's flags
                  rather than stacking three on a 150px tile. Its `title` is the
                  sentence; the dot is the glance. Rendered outside the caption
                  so a selected tile shows both.
                */
```

### app/components/admin/media-grid.tsx:455 (CONTRACT, shortened)

the one-control rule and its accessibility reason.

```tsx
/*
                  THE CAPTION BAR, over the picture, on the tile the reader has
                  picked out. Filename, size and dimensions, and the page's one
                  job in the corner of it.

                  It is the tile's ONLY copy control when it renders: the body's
                  copy button is suppressed below rather than drawn twice. Two
                  buttons with the same accessible name on one card is a thing
                  a screen reader reads twice and a pointer picks between for no
                  reason, and the payload is identical either way, so there is
                  nothing to trade off.
                */
```

### app/components/admin/media-grid.tsx:471 (WHY, shortened)

why the absence is not printed here.

```tsx
/* Size, then the dimensions WHEN THERE ARE ANY. A
                          document has none and never will, and "1.4 MB · not
                          measured" spends the caption's second line saying that
                          a PDF is not a picture. The list has a Dims column
                          where an absence belongs, because there a blank cell
                          is a value; here it is just a phrase in the way. */
```

### app/components/admin/media-grid.tsx:489 (CONTRACT, shortened)

why the wrapper stops laying out.

```tsx
/*
                  THE BODY IS `display: contents` IN BOTH LAYOUTS, so its
                  children are laid out by the CARD rather than by it.

                  That is what keeps this ONE MARKUP TREE while the list becomes
                  a real eight-column table. A row's cells have to be grid items
                  of the row, and they cannot be if a wrapper sits between them;
                  a second JSX branch for the list would be a second place for a
                  control to go missing, which is exactly what this page's
                  layout rule forbids. The wrapper stays because it names the
                  group, and it stops laying anything out.
                */
```

### app/components/admin/media-grid.tsx:507 (CONTRACT, shortened)

why the last segment, and where the key stays.

```tsx
/* The LAST SEGMENT, linking to the detail view, which is
                        also the no-script route to the address. A
                        content-addressed key is an ADDRESS and reads as noise,
                        so the name the author gave the file identifies it to a
                        human; the full key stays in the title and in the
                        detail view. */
```

### app/components/admin/media-grid.tsx:519 (CONTRACT, shortened)

why the clamp is per layout; the worked example goes to the history document.

```tsx
/*
                        THE CLAMP IS THE GRID'S, AND ONLY THE GRID'S.

                        Found by LOOKING at the list view rather than by
                        measuring it: with a 13 character middle clamp applied
                        to a full-width row, `microscope-plate-2019.png` and
                        `microscope-plate-2020.png` both render as
                        "mic...-2019.png" style stubs and the reader cannot tell
                        two files apart in a view with 1200px of empty space
                        beside the name.

                        The clamp exists because every truncation cuts the END,
                        which is the half that distinguishes, and a narrow tile
                        genuinely has no room. A list row does. So the clamp is
                        applied per LAYOUT rather than per name, and the list
                        shows the whole thing.
                      */
```

### app/components/admin/media-grid.tsx:538 (CONTRACT, shortened)

why the directory comes back in the list.

```tsx
/* THE DIRECTORY, under the name, LIST ONLY.

                        `displayName` drops the directory because nine roster
                        photographs share every character of theirs and the tile
                        had 109px to spend. A list row is not a tile: it has the
                        width, and without the folder two files with the same
                        basename in different directories are one row printed
                        twice. So the half the grid throws away comes back
                        exactly where there is room for it. */
```

### app/components/admin/media-grid.tsx:549 (WHY, shortened)

the forbidden word is the prohibition; the drift story goes to the history document.

```tsx
/*
                    The grid's meta line. Hidden in the list, where the same
                    facts have columns of their own.

                    **IT SAID "unused" AND THAT WORD IS FORBIDDEN HERE.** The
                    line was written when the page had two states and it
                    survived the three-state model landing, so a tile could read
                    `content 189 kB · unused` while the row beneath it in the
                    list view said `in template` about the same file. Worse than
                    inconsistent: "unused" is the exact claim the usage ruling
                    says this page may never make, because the repository scan
                    cannot see a constructed path and nothing here can see an
                    external site linking a file. Nine roster photographs the
                    site serves on every visit were labelled unused.

                    It now reads the SAME descriptor every other surface reads,
                    so the tile, the row and the inspector cannot disagree.
                  */
```

### app/components/admin/media-grid.tsx:573 (CONTRACT, shortened)

hidden not omitted, and why an absence is spelled.

```tsx
/*
                  THE LIST'S REMAINING COLUMNS. Hidden in the grid by CSS rather
                  than omitted from the markup, per the one-tree rule above.

                  A cell that reads "not measured" is doing work: 31 documents
                  and every SVG have no dimensions, and printing 0x0 or an empty
                  cell would both read as a value rather than as an absence.
                */
```

### app/components/admin/media-grid.tsx:581 (CONTRACT, shortened)

the second-channel rule.

```tsx
/*
                  THE USAGE CELL, three states rather than two, with its flags
                  underneath. `used` and `unattached` were the whole vocabulary
                  and it could not express the roster photographs, which the site
                  places on every visit and no post cites.

                  The dot is a SECOND CHANNEL beside a word, never the signal
                  itself, so a reader who cannot separate the hues loses nothing.
                */
```

### app/components/admin/media-grid.tsx:615 (CONTRACT, shortened)

why it is the card's last child; the old placement goes to the history document.

```tsx
/*
                  THE COPY CONTROL, ONE PER CARD, as the card's last child.

                  It was inside the name row, which made the name row two cells
                  wide and left the list with no eighth column to put it in.
                  Explicit grid placement puts it back beside the name in the
                  grid view, so the tile is unchanged to look at while the row
                  gains its column. It renders here only when the caption bar is
                  not already carrying it.
                */
```

## app/routes/playground.tsx

### app/routes/playground.tsx:10 (CONTRACT, shortened)

why the export is named, and the no-new-bytes fact.

```tsx
/*
 * THE MARKDOWN DEMO'S ONE CALL, behind a NAMED server export.
 *
 * `renderSnippet` wraps `renderBody`, the renderer every post goes through,
 * and installs the Worker's WASM instantiator on the way. The wrapper is not
 * decoration: a bare `import "~/lib/content/wasm.server"` here failed the
 * build, because a side-effect import binds no name and React Router's
 * server-code removal traces NAMES. That module's docblock carries the
 * measurement.
 *
 * NO NEW BYTES IN THE WORKER. It is the same pipeline and the same WASM module
 * the editor and operator paths already pull in, and the Worker is one bundle.
 */
```

### app/routes/playground.tsx:26 (CONTRACT, shortened)

the one-statement rule.

```tsx
/*
 * The key grammar's four readers, plus the classifier and the two per-asset
 * predicates. IMPORTED, never restated: this module is the only statement of
 * the grammar in the repository, and the last time there were more they had
 * already drifted into two answers for one key.
 */
```

### app/routes/playground.tsx:51 (CONTRACT, shortened)

why the resolver is imported.

```tsx
/*
 * The theme resolver, IMPORTED. `themeFromRequest` is the function
 * `workers/app.ts` calls on every request to build its cache key and that
 * `root.tsx` calls to write `data-theme` into the first byte of HTML, so a
 * demo that reimplemented it would keep agreeing with itself while the site
 * disagreed with both.
 */
```

### app/routes/playground.tsx:69 (CONTRACT, shortened)

header: the two laws; the corrections and the dated load figures go to the history document.

```tsx
/**
 * /playground, the interactive index of this site's own machinery.
 *
 * TWO LAWS GOVERN THIS FILE.
 *
 * 1. EVERY DEMO RUNS THE REAL CODE PATH. The contrast lab computes with
 *    `app/lib/contrast.mjs`, which `scripts/check-contrast.mjs` also imports.
 *    The search demo calls `search()`, the function `/search` calls. The chart
 *    is drawn by `app/lib/content/chart.mjs`, the module the build, the editor
 *    preview and the operator save all render through. Nothing here reimplements
 *    a rule, because a demo of a reimplementation demonstrates nothing: it would
 *    keep working while the thing it claims to show was broken.
 *
 * 2. EVERY RESULT STATE IS A URL, AND THE SERVER RENDERS IT. Every demo is a
 *    GET form whose entire input is the query string, so a reader can paste a
 *    URL and the recipient sees the identical render. With scripting off the
 *    forms submit natively and the server answers exactly the same way, which
 *    is what satisfies hard rule 9 here.
 *
 *    THIS LAW USED TO READ "ZERO JAVASCRIPT, BY CONSTRUCTION", WHICH WAS
 *    FALSE, AND THE PARAGRAPH THAT CORRECTED IT IS NOW FALSE THE OTHER WAY.
 *
 *    Corrected 2026-08-16: `root.tsx` rendered `<Scripts />` on every route, so
 *    the router runtime shipped here and the zero-JavaScript claim was only
 *    ever true of this file's own code. The reader-facing copy in
 *    `playground-page.mjs` was corrected with it, having told visitors the
 *    demos ran "with no JavaScript".
 *
 *    Corrected again 2026-08-28, because the public plane stopped hydrating on
 *    2026-08-26: hydration is opt-in by route and this route does not opt in,
 *    so `<Scripts>` is not rendered here and NO router runtime ships. The forms
 *    are react-router `<Form method="get">`, which emits the same markup and
 *    the same URL as a plain form, and with nothing to intercept them they
 *    submit natively for every reader. The client transition this paragraph
 *    used to describe no longer happens on this page, so the document-load
 *    figures it carried are history rather than a live comparison, and they are
 *    left dated rather than deleted: MEASURED on production 2026-08-16, a full
 *    document load of this page spent 861ms after `responseEnd` reaching
 *    interactive and 2111ms reaching load, against a wire cost of 145ms either
 *    way. Bytes were never the reason, and now there is no second path.
 *
 * NO USER INPUT IS PERSISTED ANYWHERE. Not logged, not stored, not counted. The
 * analytics point carries the bare path and never the query string, which is a
 * property of the capture in `workers/app.ts` rather than a promise made here.
 *
 * WHY THE FORMS CARRY HIDDEN FIELDS. Three independent demos share one URL, so
 * submitting one would otherwise wipe the other two results. Each form restates
 * the others' current values as hidden inputs, which keeps a shared URL whole
 * with no script and no session.
 *
 * CACHE-CONTROL IS EXPLICIT, per hard rule 8: with the Workers cache on, a
 * response carrying no Cache-Control is CACHED rather than skipped. This page
 * takes the ordinary public-HTML policy the rest of the public plane takes.
 */
```

### app/routes/playground.tsx:126 (CONTRACT, shortened)

header: why the manifest owns the data.

```tsx
/**
 * Presets and fixtures come from the MANIFEST, not from this file.
 *
 * `content/playground.json` is the one source, exactly as `content/projects.json`
 * is for /projects: this route renders from it and `check:features` asserts
 * against it, including rendering the same chart through the same module and
 * computing the same ratio through the same maths. If the data lived here, the
 * gate would have to restate it, and a gate whose expected values come from a
 * copy of the input is checking itself.
 */
```

### app/routes/playground.tsx:142 (CONTRACT, shortened)

the enum prohibition and the threat-model reason.

```tsx
/**
 * The markdown demo's input bound, and it is the strictest on the page.
 *
 * AN ENUM, NOT A TEXT BOX. WHAT REFUSES BEYOND IT: an unknown value is
 * REPORTED and the default is rendered, the same shape the chart demo takes,
 * so a hand-edited URL says what happened rather than quietly showing
 * something else. There is no way to put a character of your own into this
 * renderer.
 *
 * That is not caution for its own sake. The pipeline runs a syntax highlighter
 * over a WebAssembly regex engine and a directive layer that resolves assets,
 * so arbitrary text into it is a compute and sanitization surface that needs a
 * threat model of its own before it can be opened to the public plane. The
 * deferred entry at the foot of the page says so and stays.
 */
```

### app/routes/playground.tsx:162 (CONTRACT, shortened)

imported so the demo cannot offer what the renderer rejects.

```tsx
/**
 * The mark enum, IMPORTED from the module that owns it rather than restated, so
 * the demo can never offer a mark the renderer would reject. The manifest lists
 * the same four and `check:features` argues the two lists against each other.
 */
```

### app/routes/playground.tsx:172 (CONTRACT, shortened)

the cap is stated; the generosity argument goes to the history document.

```tsx
/**
 * The key demo's input bound.
 *
 * WHAT REFUSES BEYOND IT: the loader cuts at this length and SAYS SO, the same
 * shape the search demo's cap takes, because a cap enforced in the loader and
 * unstated in the UI is a silent truncation. There is no other bound to state
 * and that is a property of the subject rather than an omission: every function
 * this demo calls is pure string work over one argument, with no database, no
 * network, no clock and no allocation that grows with the input. The longest
 * real key this site holds is a content digest plus a dimension segment plus an
 * extension, so a hundred and twenty characters is generous by a wide margin
 * and still small enough that no input can cost anything.
 */
```

### app/routes/playground.tsx:187 (CONTRACT, shortened)

two bounds, and why the second is a refusal.

```tsx
/**
 * The theme demo's input bounds. TWO, and the second is not a length.
 *
 * LENGTH: cut at this many characters, said in the form and reported by the
 * loader, the same shape the other two caps take.
 *
 * SHAPE: printable ASCII only, and this one is a REFUSAL rather than a cut.
 * The demo runs the real `themeFromRequest`, which takes a Request, so the
 * input has to become a real header value. A control character in a header
 * value makes `new Request` throw a TypeError, and a demo whose input can
 * crash its own loader is a demo that answers some readers with a stack trace.
 * Refusing the shape up front means the request is only ever constructed from
 * something a browser could actually have sent, which is also the only input
 * the answer would mean anything for.
 */
```

### app/routes/playground.tsx:206 (WHY, shortened)

tagged by what STAYS; the before-state goes to the history document.

```tsx
/* Was canonical plus OG text with NO image and NO twitter card, so a shared
     link rendered as a bare URL rather than a card. pageMeta carries the set. */
```

### app/routes/playground.tsx:219 (CONTRACT, shortened)

why the types are named.

```tsx
/* The hast types, so neither side of this is an escape: check:slop makes a type
   assertion an error, and an assertion here would hide a wrong tree shape. */
```

### app/routes/playground.tsx:228 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---------------------------------------------------------------- lab --- */
```

### app/routes/playground.tsx:235 (CONTRACT, shortened)

the same-parser rule.

```tsx
// Validated through the SAME parser that computes, so the page cannot accept
    // a string the maths would then throw on, or refuse one it would have taken.
```

### app/routes/playground.tsx:259 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ------------------------------------------------------------- search --- */
```

### app/routes/playground.tsx:270 (CONTRACT, shortened)

the real-path law, restated locally.

```tsx
// The real search, with the flag that attaches what fuse() already recorded.
    // No query changes, no ordering changes, and no scoring rule is restated.
```

### app/routes/playground.tsx:281 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ---------------------------------------------------------------- key --- */
```

### app/routes/playground.tsx:293 (CONTRACT, shortened)

the refusal is a result, and catching does not soften it.

```tsx
/*
     * THE CLASSIFIER'S REFUSAL IS A RESULT, not an error page.
     *
     * `classify()` throws on an unknown extension, deliberately, so a new file
     * type under public/ stops a build rather than acquiring a plausible kind
     * nobody chose. That refusal is one of the most interesting things this
     * module does and it is invisible everywhere else on the site, so it is
     * caught here and RENDERED as the answer it is. Catching it does not soften
     * it: every other caller still gets the throw.
     */
```

### app/routes/playground.tsx:327 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* -------------------------------------------------------------- theme --- */
```

### app/routes/playground.tsx:329 (CONTRACT, shortened)

why presence and not truthiness.

```tsx
/*
   * PRESENCE, NOT TRUTHINESS, decides whether this demo ran.
   *
   * The empty cookie header is a REAL AND INTERESTING CASE here: it is the
   * reader who has chosen nothing, which is the default branch the whole
   * anti-flash design rests on. Keying on `params.has` rather than on the
   * string being non-empty is what lets that case have a URL at all. The other
   * demos key on a non-empty value because for them the empty input means
   * "not asked".
   */
```

### app/routes/playground.tsx:355 (CONTRACT, shortened)

why the request is real, and the absent-header distinction.

```tsx
/*
       * A REAL REQUEST, because the real function takes one. Constructed with
       * no cookie header at all when the input is empty, which is a different
       * thing from an empty one and is the state a first-time reader arrives
       * in: the resolver's first line is a test for the header's absence.
       */
```

### app/routes/playground.tsx:375 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ----------------------------------------------------------- markdown --- */
```

### app/routes/playground.tsx:380 (CONTRACT, shortened)

reported rather than corrected.

```tsx
// Reported rather than silently corrected, the same rule the chart demo
  // follows: a hand-edited URL says what happened instead of quietly rendering
  // something else.
```

### app/routes/playground.tsx:393 (CONTRACT, shortened)

the real-renderer law and what the wrapper adds.

```tsx
/*
       * THE REAL RENDERER, through the server wrapper. The same `renderBody`
       * call the deploy build makes for every post and the same one the editor
       * preview and every operator save make; the wrapper adds the WASM
       * instantiator and an image resolver that REFUSES, and nothing else.
       */
```

### app/routes/playground.tsx:408 (CONTRACT, shortened)

why the refusal branch exists.

```tsx
/*
       * A REFUSAL IS A RESULT, exactly as the classifier's is in the key demo.
       * One of the three snippets exists to earn this, and it is the branch a
       * published article can never show: an article carrying an unknown
       * directive would never have been published.
       */
```

### app/routes/playground.tsx:418 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* -------------------------------------------------------------- chart --- */
```

### app/routes/playground.tsx:426 (CONTRACT, shortened)

reported rather than corrected.

```tsx
// An out-of-enum value is reported rather than silently corrected, so a
  // hand-edited URL says what happened instead of quietly rendering something
  // else. This is the only place the demo can disagree with its input.
```

### app/routes/playground.tsx:437 (CONTRACT, shortened)

what the wrapper owns.

```tsx
// The real renderer. `renderChartHast` returns the FIGURE'S CHILDREN, not
    // the figure, so the wrapper and its class are this route's responsibility;
    // without `.chart-figure` the stylesheet's chart rules never apply.
```

### app/routes/playground.tsx:495 (CONTRACT, shortened)

header: why it reads the manifest and why it throws; the duplicated literals go to the history document.

```tsx
/**
 * A demo input's declared default, read out of the manifest.
 *
 * BOTH DEFAULTS WERE WRITTEN TWICE until 2026-08-28: `#2B2320` and `#FAF7F2`
 * were in `content/playground.json` as each input's `default`, AND again as a
 * literal in the two `defaultValue` expressions below. They agreed, which is
 * the only reason nobody noticed; a second copy that agrees is a second copy.
 *
 * They are the `--text` and `--bg` tokens, and the manifest is as close to
 * those as JavaScript gets: a Worker cannot read the stylesheet, and
 * `scripts/lib/tokens.mjs`, which does read it, is a build-time module. So the
 * manifest is the JS-side owner and this reads it rather than restating it.
 *
 * Throws rather than defaulting. An input rendered with no value is a form that
 * silently stops demonstrating anything, and `check:features` reconciles this
 * page against the manifest in both directions, so a missing entry is already
 * a build failure rather than something to paper over here.
 *
 * @param {string} demoSlug the demo's slug in the manifest
 * @param {string} inputName
 */
```

### app/routes/playground.tsx:526 (CONTRACT, shortened)

why the key is the slug; the failure mode goes to the history document.

```tsx
/**
 * KEYED BY SLUG SINCE 2026-08-30, and it used to be a positional index.
 *
 * An index couples the page's ORDER to the manifest's, silently: insert a demo
 * anywhere but the end and every section below it renders another demo's title,
 * lede and article link over its own form. Nothing would fail. `check:features`
 * reconciles which demos exist in both directions and says nothing about which
 * header sits above which form, because both lists are still complete.
 *
 * The slug is already the thing this section is identified by, since the
 * section id comes from `demoAnchor(slug)` beside it, so keying on it removes
 * the coupling rather than moving it.
 */
```

### app/routes/playground.tsx:541 (WHY, shortened)

the fail-closed rule.

```tsx
/*
   * FAIL CLOSED ON A MISSING DEMO, rather than rendering an empty header.
   *
   * `check:features` reconciles this page's demos against `playground.json` in
   * both directions, so a slug with no entry is already a build failure. What
   * this adds is that if one ever slips through, the page renders nothing for
   * that demo instead of a heading with no title, which is the shape that reads
   * as a styling bug and sends the next reader to the stylesheet.
   */
```

### app/routes/playground.tsx:580 (CONTRACT, shortened)

carried on presence, matching the loader.

```tsx
/* Carried on PRESENCE, matching the loader: an empty cookie is a real
          result here, so dropping it would lose that demo's state on any other
          demo's submit. */
```

### app/routes/playground.tsx:608 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ------------------------------------------------ contrast --- */
```

### app/routes/playground.tsx:701 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* -------------------------------------------------- search --- */
```

### app/routes/playground.tsx:741 (WHY, shortened)

the prohibition, and why it follows from the second law.

```tsx
/*
                  NO TIMING HERE, deliberately. A wall-clock reading is the one
                  value that would differ between two fetches of the same URL,
                  and this page's contract is that a result URL renders
                  identically wherever it is opened. Latency claims belong in
                  the article, measured properly, not in a demo where a cold
                  Worker would quietly libel the database.
                */
```

### app/routes/playground.tsx:813 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* --------------------------------------------------- chart --- */
```

### app/routes/playground.tsx:875 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ----------------------------------------------- media key --- */
```

### app/routes/playground.tsx:955 (CONTRACT, shortened)

the refusal is a result, not a fault.

```tsx
/*
                  THE REFUSAL, verbatim, and it is a result rather than a fault.
                  Shown in the ordinary error block because that is what a
                  refusal looks like everywhere else on this page, and the note
                  underneath says why this one is the module working.
                */
```

### app/routes/playground.tsx:1010 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* --------------------------------------------------- theme --- */
```

### app/routes/playground.tsx:1060 (CONTRACT, shortened)

why the absence is spelled out.

```tsx
/*
                      THE ABSENCE IS THE ANSWER for a reader on system, so it is
                      spelled out rather than rendered as an empty cell. An empty
                      cell reads as a bug; "omitted" reads as the mechanism it is.
                    */
```

### app/routes/playground.tsx:1104 (CONTRACT, shortened)

separator: label kept, dashes dropped.

```tsx
/* ------------------------------------------------ markdown --- */
```

### app/routes/playground.tsx:1136 (WHY, shortened)

the mirror prohibition.

```tsx
/*
                The snippet verbatim, in a plain <pre>. NOT run through the
                highlighter: this is the INPUT, and highlighting it would render
                the demo's subject with the demo's subject, which is the mirror
                this page exists not to be.
              */
```

### app/routes/playground.tsx:1164 (CONTRACT, shortened)

why it is injected, and why it gets the article treatment.

```tsx
/*
                    Rendered into `.prose`, the same treatment an article body
                    gets, because it IS an article body: it came out of the same
                    call. Injected the way the chart is and for the same reason,
                    which is that it was produced by this pipeline from data
                    committed in this repository and contains no third-party
                    input at all.
                  */
```

## app/routes/admin.mentions.tsx

### app/routes/admin.mentions.tsx:22 (CONTRACT, shortened)

header, over 370 on purpose: three prohibitions, none of which the others cover.

```tsx
/**
 * /admin/mentions: the webmention moderation queue.
 *
 * ## THE SMOKE ACTOR IS REFUSED, AND NOT BY ANYTHING IN THIS FILE
 *
 * That is deliberate and it is the mechanism every other non-publish admin
 * write already uses. `app/routes/admin.tsx`'s middleware is a METHOD
 * ALLOWLIST: GET and HEAD are named, everything else is refused with
 * `SMOKE_READ_ONLY_POLICY` before a single child action runs. Its own comment
 * names the surfaces it covers ("the eleven media intents, the tag writes, the
 * trash, the rebuild, or any action added tomorrow") and says why the inversion
 * matters: a route that starts answering a new method is refused on the day it
 * is written rather than on the day somebody remembers to add it.
 *
 * The `WRITE_CAPABILITIES` table in `publish-policy.mjs` is consulted by
 * `decide()` and `decideDelete()` on the PUBLISH path only, and none of the
 * three actions below is a publish. So a capability read here would be a SECOND
 * enforcement point for a rule that already has one, which is the shape hard
 * rule 17 refuses: two owners of one fact, free to disagree. The refusal is
 * asserted in `test/worker/webmention.test.ts` against the middleware, which is
 * where it actually lives.
 *
 * ## ONE QUEUE, NOT FOUR PANELS, ruling 21 on 2026-09-05
 *
 * The page was four `Panel` groups stacked in a fixed order, each with its own
 * heading, its own description and its own empty box. With one mention in the
 * table that is three headings shouting about nothing, and the operator's own
 * verdict on it was "terrible on screen". A status is a FILTER, not a section:
 * the reader is deciding about one row at a time and wants the set that needs
 * deciding, so the statuses became link chips carrying `?status=` and the rows
 * became one list. The chips are the same server-rendered pattern the media
 * library uses for its lenses, for the same reason: every state is a URL, and
 * nothing about it needs script.
 *
 * ## APPROVING IS IMMEDIATE, AND IT WAS NOT
 *
 * This docblock said "there is no public surface for it in H1" and then, after
 * H2, that an approval reached readers within ten minutes. Both were true when
 * written. Since 2026-09-05 an approval PURGES `post:<slug>` and the section
 * appears on the next fetch, because Workers Cache gained a purge API and
 * ruling 7 was reversed by ruling 10.
 *
 * The one clause beside Approve is all that survives of the paragraph that used
 * to explain this. THE NUMBER WENT WITH IT, deliberately: the old sentence
 * derived a fallback minute count from `SHARED_CACHE_CONTROL` for the case
 * where a purge is rate limited and refused, which is honest and is a sentence
 * for the person who BUILT the page rather than the person deciding. A refused
 * purge degrades to the behaviour the page had for its whole first month, and
 * the operator finds out by looking at the post, which they were going to do
 * anyway.
 *
 * ## EVERY VALUE ON IT CAME FROM A STRANGER
 *
 * The source URL, the author name and the excerpt were read out of a document
 * this site does not control. They are rendered as React children, which
 * escapes them; the source URL is shown as TEXT rather than as a link, because
 * an admin page is not a place to put a one-click navigation to a URL an
 * unauthenticated POST chose. H2's public render is the one that gets an
 * anchor, and it gets `rel="nofollow ugc noopener"` with it.
 *
 * ## NO CLIENT JAVASCRIPT
 *
 * The admin plane is exempt from the progressive enhancement law and nothing
 * here needs the exemption: four plain `<Form method="post">` submissions, a
 * row of links, and a server-rendered list. THE FILTER IS RESOLVED IN THE
 * LOADER rather than by a hook, so the component is a pure function of what the
 * server handed it and the rendered page is the whole answer.
 */
```

### app/routes/admin.mentions.tsx:103 (CONTRACT, shortened)

the ordering reason and the adding-up property; the four-panel history goes to the history document.

```tsx
/**
 * THE FILTER ROW, and the order is a decision rather than an alphabet.
 *
 * Pending first because it is the only one that wants an action, failed second
 * because it is the only one that might mean something is broken, then the two
 * settled states, then everything. That is the order the four panels were in,
 * and the reasoning survived the panels.
 *
 * `all` LISTS EVERY ROW INCLUDING `unverified`, which is what makes the counts
 * on this row add up: four filter counts plus the unverified chip equals the
 * All count, and a reader can see at a glance that nothing is hiding. The old
 * page could not do that, because `unverified` had no panel and its number was
 * a sentence at the bottom of a different section.
 */
```

### app/routes/admin.mentions.tsx:127 (CONTRACT, shortened)

why the record is keyed by the union.

```tsx
/**
 * What an empty filter says, KEYED BY THE UNION ITSELF.
 *
 * A `Record<FilterId, string>` is total by typecheck, which is what rule 13
 * asks for in `app/`: a filter added to the list above with no line here is a
 * compile error rather than a lookup that quietly substitutes a different
 * filter's sentence, or renders nothing at all and leaves an empty page with
 * no explanation on it.
 */
```

### app/routes/admin.mentions.tsx:148 (CONTRACT, shortened)

what an absent parameter means.

```tsx
/**
 * Which filter a request is asking for.
 *
 * AN ABSENT `?status=` IS NOT `all`, and neither is an unrecognised one. The
 * default lands on the set that wants a decision when there is one, and on
 * everything when there is not, so arriving at the page with nothing pending
 * shows the log rather than a quiet line about an empty queue. `?status=all` is
 * how a reader asks for everything on purpose, which is the media library's own
 * rule for `?role=` and is why an empty parameter is treated as absent.
 */
```

### app/routes/admin.mentions.tsx:167 (WHY, shortened)

why the count is read in the loader.

```tsx
/*
   * THE EXPIRING COUNT IS READ HERE because the sweep button is LABELLED with
   * it, and a label is a fact the page states rather than a fact the action
   * discovers. It was already read on the confirmation step; reading it in the
   * loader too is what turns "Sweep expired mentions" into "Remove 3 expired"
   * and lets the control disable itself when there is nothing to remove.
   */
```

### app/routes/admin.mentions.tsx:185 (CONTRACT, shortened)

why the flag is a boolean.

```tsx
/**
   * WHETHER `message` IS AN OUTCOME OR A REFUSAL, carried as a boolean because
   * the alternative is classifying by string matching and that is a second
   * owner of a fact the action already knows. A page that read "Unknown action."
   * and inferred failure would silently start rendering a success in the error
   * box the day somebody rephrased a message.
   */
```

### app/routes/admin.mentions.tsx:209 (WHY, shortened)

the no-script prohibition on handler guards.

```tsx
/*
   * THE TYPED CONFIRMATION, read once for whichever branch below wants it.
   *
   * `app/lib/destructive.mjs` states the rule: a guard that runs in a handler
   * is feedback, not a guard, because with scripting off the handler never runs
   * and the form posts anyway. So both destructive intents here refuse in the
   * ACTION and the refusal renders a second step, which is what makes the
   * ceremony real for a reader without JavaScript.
   */
```

### app/routes/admin.mentions.tsx:221 (NUMBER, shortened)

why the typed count is 1.

```tsx
/*
     * THE COUNT IS 1, not the number of rows at risk, and the reason is the
     * same one the media rebuild gives: the operator is authorising the SWEEP,
     * and a typed row count read a moment before the delete would be a number
     * invented to look precise about a set that can change underneath it. The
     * confirmation step states the current quantity instead, which is the thing
     * actually at stake.
     */
```

### app/routes/admin.mentions.tsx:241 (CONTRACT, shortened)

why the id is parsed and checked.

```tsx
/*
   * THE ID IS PARSED AND CHECKED, never passed through. It arrives in a form
   * body, and `Number("")` is 0, which is a plausible-looking rowid. An id that
   * is not a positive integer is a malformed request rather than a row that
   * happens not to exist.
   */
```

### app/routes/admin.mentions.tsx:256 (NUMBER, shortened)

why one row is still a ceremony.

```tsx
/*
     * ONE ROW, SO THE COUNT IS 1. Deleting a mention removes the only copy of
     * what somebody sent: there is no repository behind this table and no
     * derivation that could produce the row again, which is exactly why this is
     * classified destructive rather than reversible.
     */
```

### app/routes/admin.mentions.tsx:265 (CONTRACT, shortened)

the one-door rule.

```tsx
// ONE DOOR, shared with the operator API since 2026-09-05. The write and
    // the purge travel together in `decideMention` so a second caller cannot
    // take only half of them; grounds are on that function.
```

### app/routes/admin.mentions.tsx:273 (WHY, shortened)

tagged by what STAYS; the wire proof goes to the history document.

```tsx
// THE REVERSAL OF RULING 7, PROVEN ON THE WIRE 2026-09-05: the page was a
    // cache HIT with no section, and after this call it was a MISS carrying it.
    // That is what the clause beside the Approve button is reporting.
```

### app/routes/admin.mentions.tsx:287 (WHY, shortened)

the branch shape is the prohibition; the first-draft story goes to the history document.

```tsx
/*
   * UNREACHABLE, AND WRITTEN AS FOUR SEPARATE COMPARISONS RATHER THAN A TERNARY
   * TO GET HERE.
   *
   * `check:destructive` builds its vocabulary by matching a strict equality
   * between the word intent and a string literal, ON THE RAW SOURCE, so an
   * intent handled as the else arm of a ternary is INVISIBLE to it, and a
   * comment that spelled the needle out would invent one. Both were true of
   * this file's first draft: it decided approve and reject with a ternary, the
   * gate classified three of the four intents while `reject` was never named,
   * and the comment written to explain that then registered as a fifth.
   *
   * An unclassifiable destructive path is the hole that gate exists to close,
   * so the branch shape is chosen to stay inside its view.
   */
```

### app/routes/admin.mentions.tsx:305 (CONTRACT, shortened)

header: why ISO, and why there is no null branch.

```tsx
/**
 * A timestamp as an ISO instant.
 *
 * ISO rather than a friendly rendering, deliberately: this page is a moderation
 * log, the reader is one person who wrote the schema, and an unambiguous
 * instant is worth more here than "3 days ago".
 *
 * NO NULL BRANCH, which is rule 13 rather than an oversight. `received_at` is
 * `notNull` in the schema, and the only other stamp on the row is rendered
 * behind a check for its own presence, so a placeholder string here would be a
 * substituted value for a case that cannot arrive.
 */
```

### app/routes/admin.mentions.tsx:324 (CONTRACT, shortened)

header: the excerpt leads, and why.

```tsx
/**
 * One row.
 *
 * THE EXCERPT LEADS, which is the whole of ruling 21b and is a change of
 * subject rather than a reordering. The row used to open with the source URL,
 * so the first thing on every row was a long unbreakable string a stranger
 * chose, and the sentence a human wrote was third. The reader is judging
 * whether a mention is worth publishing, and the quotation is the evidence for
 * that; the URL is how they would check it, which is a second question.
 */
```

### app/routes/admin.mentions.tsx:342 (CONTRACT, shortened)

the absence is a statement, not a substituted value.

```tsx
/* THE ABSENCE IS NAMED rather than left as a dangling verb. A source
            page with no h-card gives this row no author at all, and the line
            used to open on the word "mentioned" with nothing in front of it,
            which reads as a rendering fault rather than as a fact about the
            sender. It is a statement about what the fetch found, not a value
            substituted for one it did not find. */
```

### app/routes/admin.mentions.tsx:357 (WHY, shortened)

why the stamp went; the timing detail goes to the history document.

```tsx
/* THE VERIFIED STAMP IS GONE, and it is the one fact here that was
              never worth a column of the reader's attention: it lands seconds
              after `received` for every row that has one at all, and the rows
              where it matters are the ones that DO NOT have one, which is what
              the unverified chip counts. */
```

### app/routes/admin.mentions.tsx:380 (CONTRACT, shortened)

why approve stays on the row.

```tsx
/*
          APPROVE STAYS ON THE ROW, because it is the decision the operator came
          to make and burying the primary action of a queue inside a menu would
          be the opposite of the rule. Approve and reject are each hidden on the
          state they would produce, so the pair reads as a decision that can be
          changed rather than as two buttons one of which does nothing.
        */
```

### app/routes/admin.mentions.tsx:396 (WHY, shortened)

why the other two move into the menu.

```tsx
/*
          REJECT AND DELETE MOVE INTO THE ROW MENU, which is the same change the
          posts list took and for the same reason: three controls on every row
          compete with the excerpt the reader is actually judging. Delete was
          already the lightest thing here; a menu is lighter still and it is
          where an irreversible action belongs beside a reversible one.
        */
```

### app/routes/admin.mentions.tsx:434 (CONTRACT, shortened)

the one-array rule; the media library's defect goes to the history document.

```tsx
/*
   * ONE ARRAY FEEDS THE CHIPS AND THE LIST, which is the media library's own
   * lesson written down: its Unused chip counted with one predicate and
   * filtered with another, and the chip and the grid disagreed. A count derived
   * from the same rows the list is about cannot do that.
   */
```

### app/routes/admin.mentions.tsx:444 (CONTRACT, shortened)

why unverified is counted and not filtered.

```tsx
/*
   * `unverified` rows are COUNTED on the filter row rather than given a filter
   * of their own. They are a state that lasts seconds: the endpoint writes one
   * and hands verification to `waitUntil` in the same request. A row that STAYS
   * unverified means verification never completed, which is worth a number
   * where the numbers are and is not a decision anybody can make. Shown only
   * when it is above zero, because a chip reading 0 is an alarm about nothing.
   */
```

### app/routes/admin.mentions.tsx:457 (CONTRACT, shortened)

the box matches the outcome.

```tsx
/* THE BOX MATCHES THE OUTCOME. A success in an error box was the first
          thing the operator named about this page, and `ok` is a field on the
          action's result rather than a guess made from the message text. */
```

### app/routes/admin.mentions.tsx:487 (CONTRACT, shortened)

why the clause is rendered once; the amendment date goes to the history document.

```tsx
/* THE PURGE CLAUSE, ONCE. Ruling 21e asked for it beside Approve, and it
          was rendered per pending row: on a queue of twelve it said the same
          sentence twelve times, which is how a page stops being read. It states
          a property of the whole pending filter, not of any one mention, so it
          belongs where the filter is chosen. Amended 2026-09-06.

          Shown only on the pending filter and only when there is something to
          approve: on an empty queue it would be advice about an action nobody
          can take. */
```

### app/routes/admin.mentions.tsx:512 (WHY, shortened)

keeps why it is not a cron; the sync:content objection goes to the history document.

```tsx
/*
        RETENTION, AND IT IS A BUTTON RATHER THAN A CRON. The reason is written
        here because the alternative was considered and refused.

        This site's only scheduled work is the watchdog Worker's cron, which
        polls /api/health and repairs DRIFT: a derived store that has fallen
        out of step with the repository, under hard rule 18. A webmention is
        neither derived nor repo-sourced, so there is no derivation to run and
        nothing for a health check to find; wiring an expiry into that door
        would put a permanently-healthy check into a mechanism whose whole job
        is to notice unhealthy ones. `sync:content` is the same objection in the
        other direction: it converges D1 toward the repository, and these rows
        have no repository side to converge to.

        So there is no honest existing home, and rather than adding a second
        cron for two DELETE statements the sweep is a control on the page whose
        rows it removes. It is idempotent, it reports what it removed, and the
        admin who is already here to moderate is the person who runs it.

        THE ESSAY THAT USED TO BE ON THE PAGE IS NOW ENTIRELY IN THIS COMMENT,
        which is ruling 21e. Three of its four sentences explained a DESIGN to a
        reader who did not ask: why two windows, why open rows are never swept,
        why the cap would move if they were. The person deciding needs the two
        windows and the number at stake, and the button now carries the number
        rather than a verb with no object. `unverified` lost its sentence here
        and gained a chip on the filter row, where a count belongs.

        THE TWO WINDOWS ARE IMPORTED, never typed, which is hard rule 17: a
        button labelled with one number beside a sweep that uses another is the
        drift the rule exists to prevent.
      */
```

### app/routes/admin.mentions.tsx:567 (CONTRACT, shortened)

why the label does not change.

```tsx
/* DISABLED AT ZERO, WITH THE SAME LABEL. A control that changes its
                words when it has nothing to do makes the reader read it twice to
                learn there is nothing to do; a greyed "Remove 0 expired" says it
                once, and the count is the same fact in both states. */
```

## app/components/admin/markdown-editor.tsx

### app/components/admin/markdown-editor.tsx:13 (CONTRACT, shortened)

header: ruling 2 and the chunk boundary.

```tsx
/**
 * The markdown body, in CodeMirror 6.
 *
 * Ruling 2: the text edited IS the file. There is no document model, no
 * serializer and no round trip, so the fidelity risk that ruled out a rich-node
 * editor does not exist here by construction. `view.state.doc.toString()` is
 * the bytes that get committed.
 *
 * This module is imported lazily and only ever from the post editor, which is
 * only ever imported by admin routes. Ruling 6 requires that CodeMirror never
 * reaches a public-plane bundle; the dynamic import is what makes it its own
 * chunk, and the build output is what proves it.
 */
```

### app/components/admin/markdown-editor.tsx:27 (CONTRACT, shortened)

separator plus the token prohibition.

```tsx
/* -------------------------------------------------------------------------
 * Theme, entirely from tokens.
 *
 * Not one hex in here. Every colour is a `var(--token)` that resolves through
 * the same theme selectors as the rest of the site, so both themes and the
 * default land correctly with nothing to flash and no second theme to keep in
 * step. That is also why there is no `dark` variant of this object: there is
 * only one theme, and the tokens under it change.
 * ---------------------------------------------------------------------- */
```

### app/components/admin/markdown-editor.tsx:67 (CONTRACT, shortened)

why these tokens and not a seventh palette.

```tsx
/**
 * Syntax colours, drawn from the ratified chart ladder and the semantic text
 * tokens rather than from a syntax theme of their own.
 *
 * check:contrast measures the shiki tokens against the code surfaces because
 * those ship to readers. These are admin-only and sit on `--bg`, so they reuse
 * tokens the matrix already covers against `--bg` instead of introducing a
 * seventh palette nobody would remember to check.
 */
```

### app/components/admin/markdown-editor.tsx:91 (CONTRACT, shortened)

separator plus the one-path rule.

```tsx
/* -------------------------------------------------------------------------
 * Syntax insertion. Every toolbar action and every shortcut goes through one
 * of these, so a keyboard user and a mouse user run identical code.
 * ---------------------------------------------------------------------- */
```

### app/components/admin/markdown-editor.tsx:163 (CONTRACT, shortened)

header: why alt is scaffolded.

```tsx
/**
 * The house directive scaffolds.
 *
 * Every one carries `alt=""` with the cursor inside it, because alt is
 * mandatory on both `:::chart` and `:::diagram` and the build FAILS without it.
 * Scaffolding the failure and putting the cursor in the hole is the difference
 * between a template and a trap.
 */
```

### app/components/admin/markdown-editor.tsx:210 (CONTRACT, shortened)

the second-channel rule; the ruling citation stays.

```tsx
/**
 * A glyph per directive, in the house inline-SVG idiom (ruling 7).
 *
 * Each one draws what the directive PRODUCES rather than an abstract symbol:
 * bars for a chart, connected nodes for a diagram, a framed picture for a
 * figure. The accessible name is still the word, so the drawing is the second
 * channel and never the only one.
 */
```

### app/components/admin/markdown-editor.tsx:245 (CONTRACT, shortened)

why state rides along.

```tsx
/**
 * One post the link palette can point at.
 *
 * `state` rides along so the palette can mark a target that is not live. A
 * palette that silently inserted a link to a draft would produce a 404 on the
 * published page, which is the silent-wrong-output class this repo forbids
 * everywhere else.
 */
```

### app/components/admin/markdown-editor.tsx:262 (CONTRACT, shortened)

why a literal destination is taken as one.

```tsx
/**
 * Whether what the author typed is already a destination.
 *
 * The palette searches the site's own posts, but an author linking OUT has
 * nothing to search for, so a string that already names a destination is taken
 * literally. Covers absolute URLs, mail, site-root paths and bare fragments,
 * which is every href this blog's prose actually uses.
 */
```

### app/components/admin/markdown-editor.tsx:274 (CONTRACT, shortened)

header, kept long: the read-off-the-document argument is the correctness argument.

```tsx
/**
 * THE NONCE THIS DOCUMENT'S CSP WILL ACTUALLY ACCEPT.
 *
 * CodeMirror injects its StyleModule as an inline `<style>` element on mount.
 * Under an enforced `style-src` that element is refused unless it carries a
 * nonce the DOCUMENT'S OWN header names, and `EditorView.cspNonce` is the
 * facet `@codemirror/view` exposes for putting one on it.
 *
 * **READ OFF THE DOCUMENT, DELIBERATELY NOT OFF LOADER DATA, and the
 * distinction is the whole correctness argument.** The root loader does carry
 * a `nonce`, and the admin layout already uses it for the no-flash script. But
 * the root loader RE-RUNS on client-side navigation, so after a transition from
 * /admin/posts to /admin/posts/new its `nonce` is the one minted for that
 * `.data` request, which is a different value from the one in the enforced
 * header of the document still on screen. Nonces are per-request here, measured
 * (four cookie-bearing requests, four distinct nonces), so that mismatch is
 * certain rather than possible, and the editor mounts after exactly that kind
 * of navigation. The document's own nonce is the only value the document's own
 * policy accepts, and it does not change when the route does.
 *
 * The `nonce` IDL PROPERTY, not `getAttribute`. Browsers hide the content
 * attribute after parsing precisely so an injected script cannot read a nonce
 * back out of the DOM; the property is the supported way in, and it returns the
 * empty string rather than the value on elements that never had one.
 *
 * FAILS CLOSED. No carrier means no nonce means the style element is refused,
 * which is exactly today's behaviour and not worse. Fabricating a value would
 * satisfy the facet while matching no policy, which is hard rule 13's
 * substituted fallback wearing a different hat.
 */
```

### app/components/admin/markdown-editor.tsx:330 (CONTRACT, shortened)

the no-script defect this flag closes.

```tsx
/**
   * Whether CodeMirror actually exists yet.
   *
   * React 19 resolves a lazy component during SSR, so this module's markup IS
   * in the server-rendered document even though the editor itself only mounts
   * in an effect. Without this the no-script reader was handed a dead toolbar,
   * an empty box, and a strip telling them to drag and drop an image, which is
   * the one thing that cannot work for them. The host div below always renders,
   * because CodeMirror needs a node to attach to; the chrome waits.
   */
```

### app/components/admin/markdown-editor.tsx:346 (CONTRACT, shortened)

why the numbers are seeded.

```tsx
/**
   * Words and minutes, from the CodeMirror document itself.
   *
   * Seeded from the initial value so the numbers are right before the first
   * keystroke rather than reading zero on a post that already has 2000 words.
   */
```

### app/components/admin/markdown-editor.tsx:357 (CONTRACT, shortened)

why the range is captured.

```tsx
/**
   * The link palette: where it was opened from, and what is typed into it.
   *
   * `from`/`to` are the selection AT THE MOMENT Cmd+K was pressed, captured
   * because focus is about to leave the editor for the input. Without them the
   * insertion would land wherever CodeMirror's selection happened to be after
   * the blur, which is not where the author was.
   */
```

### app/components/admin/markdown-editor.tsx:400 (CONTRACT, shortened)

why the route's reason is reported.

```tsx
// The route names the real reason (wrong type, over 10 MB), so it is
      // reported rather than replaced with a status code the author cannot act
      // on. The code is the fallback, not the message.
```

### app/components/admin/markdown-editor.tsx:411 (CONTRACT, shortened)

why the query is seeded from the selection.

```tsx
/**
   * Opens the link palette at the cursor, seeded with any selected text.
   *
   * Seeding the QUERY with the selection is deliberate: linking the words
   * "Observable Plot" almost always means linking to the post about Observable
   * Plot, so the search has already been performed by the time the palette
   * appears. The selection is still used as the link TEXT on insert, so seeding
   * the query costs nothing if the author wanted something else.
   */
```

### app/components/admin/markdown-editor.tsx:446 (CONTRACT, shortened)

why the cursor lands after.

```tsx
/**
   * Writes the link and puts the cursor AFTER it.
   *
   * After it rather than inside it, because the author's next keystroke is
   * almost always the sentence continuing; landing inside the label would make
   * them arrow out of their own link.
   */
```

### app/components/admin/markdown-editor.tsx:488 (CONTRACT, shortened)

why the nonce facet comes first.

```tsx
/*
       * FIRST, because everything below this line that styles anything reaches
       * the DOM through the same injected element. `houseTheme` and
       * `syntaxHighlighting` are StyleModules too, so without this the house
       * appearance was being dropped alongside CodeMirror's base theme and only
       * `admin-editor.css` was holding the editor together.
       */
```

### app/components/admin/markdown-editor.tsx:505 (CONTRACT, shortened)

counted from the document, and the identity bail-out.

```tsx
// Counted from the DOCUMENT, not from the parent's copy of it, so the
          // number cannot lag a keystroke behind what is on screen. The state
          // update bails out by identity when the count has not changed, so
          // typing within a word does not re-render the component.
```

### app/components/admin/markdown-editor.tsx:515 (CONTRACT, shortened)

why the trigger is narrow.

```tsx
// The slash menu opens on a lone "/" at the start of an empty line,
          // deliberately narrow: markdown is full of slashes, and a menu that
          // opened inside a URL would be unusable.
```

### app/components/admin/markdown-editor.tsx:559 (WHY, shortened)

tagged by what STAYS; the old stub goes to the history document.

```tsx
// Cmd+K SEARCHES the site's own posts now, rather than inserting a
        // `](url)` stub the author then had to go and fill in from memory. A
        // typed URL still works, so nothing that used to be possible stopped
        // being possible; the stub is what went away.
```

### app/components/admin/markdown-editor.tsx:565 (CONTRACT, shortened)

why Cmd+S is not handled here.

```tsx
// Cmd+S is handled by the editor shell, which knows which transition
        // the primary button is armed for. Swallowing it here would save with
        // whatever draft flag the last press happened to leave behind.
```

### app/components/admin/markdown-editor.tsx:596 (CONTRACT, shortened)

why the guard is on the text differing.

```tsx
/**
   * Accepts a document set from OUTSIDE, which is the draft-buffer restore.
   *
   * Guarded on the text actually differing, or every keystroke would round trip
   * through the parent and dispatch a redundant transaction that resets the
   * selection. A restore is the only thing that legitimately replaces the whole
   * document while mounted.
   */
```

### app/components/admin/markdown-editor.tsx:690 (CONTRACT, shortened)

why it is a hint and why it is aria-hidden.

```tsx
/*
        The replacement affordance for the Insert image section this pass
        removes. Drag-drop and paste are invisible until someone tells you they
        exist, and the native file input that used to say so is gone, so the
        capability now announces itself here instead of being folklore.

        A hint, not a control: nothing to focus, nothing to activate, and it is
        `aria-hidden` because the same information reaches assistive tech
        through the toolbar's named buttons and the alt prompt that follows an
        upload. Announcing it here as well would be a third telling of one fact.
      */
```

### app/components/admin/markdown-editor.tsx:721 (CONTRACT, shortened)

the placement reason and the live-region prohibition.

```tsx
/*
            WORD COUNT AND READING TIME.

            At the foot of the WRITING PANE, not in the command bar, and that is
            a placement decision rather than a convenience. The command bar
            carries the save state, which is the one thing in this view that is
            ever urgent; a number that changes on every keystroke sitting beside
            it would pull the eye away from the dirty dot forever after.

            It is not a live region. It changes constantly and announcing every
            change would make the editor unusable with a screen reader; the
            numbers are reference the author looks at when they want them, which
            is what `aria-live` is explicitly not for.
          */
```

### app/components/admin/markdown-editor.tsx:751 (CONTRACT, shortened)

why it searches posts; the rest is the palette's own shape.

```tsx
/*
        THE LINK PALETTE. Cmd+K, or the toolbar's link button.

        A search over the site's own posts, because the overwhelmingly common
        link in this corpus is to another post on it, and the author knows the
        title rather than the slug. Typing a destination still works, so the
        capability this replaced is intact.
      */
```

### app/components/admin/markdown-editor.tsx:798 (CONTRACT, shortened)

why the event is stopped as well as prevented.

```tsx
// Stopped as well as prevented: this input sits inside the
                // editor's DOM, and an Escape that kept bubbling would reach
                // the shell and close things the author did not mean to close.
```

### app/components/admin/markdown-editor.tsx:830 (CONTRACT, shortened)

why both drive one highlight.

```tsx
/* Mouse and keyboard drive the SAME highlight, so a pointer
                       moving across the list does not leave Enter pointing at a
                       different row than the one under the cursor. */
```

### app/components/admin/markdown-editor.tsx:911 (CONTRACT, shortened)

the alt policy, as the prohibition.

```tsx
/* Blocked until alt exists. The media policy says an image
                  inserted without alt is the one that ships without it, so the
                  insert is what waits, not a reminder to fix it later. */
```

## app/components/admin/media-inspector.tsx

### app/components/admin/media-inspector.tsx:1 (CONTRACT, shortened)

header: the one-owner rule; the move date goes to the history document.

```tsx
/*
 * THE `?key=` INSPECTOR: the panel that opens over the library when a row is
 * addressed by key.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24. The JSX is
 * unchanged, comments included; the route renders it where the block used to
 * sit and passes the two values it reads from the page around it.
 *
 * `detail` is the loader's own row, taken from the route's generated types
 * rather than restated here, so the shape has ONE owner and this file cannot
 * drift from what the loader actually returns.
 */
```

### app/components/admin/media-inspector.tsx:25 (CONTRACT, shortened)

why the member is selected.

```tsx
/*
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries `detail`, so the member is selected
 * rather than the property read off the union, which is what the compiler
 * refused. Still one owner: the loader.
 */
```

### app/components/admin/media-inspector.tsx:43 (CONTRACT, shortened)

the no-script mechanism and the one-way-to-close rule.

```tsx
/*
          THE SCRIM, and it is a LINK rather than a div with a handler.

          Clicking outside a drawer closes it, and that expectation does not
          depend on script, so the mechanism must not either. A link to the same
          view with `key` cleared is the whole implementation, it works with
          scripting off, and it is the same URL the Close control uses, so there
          is one way to close and not two.

          `preventScrollReset` because closing is not a new place to be: the
          reader was looking at a grid and should still be looking at the same
          part of it.
        */
```

### app/components/admin/media-inspector.tsx:64 (CONTRACT, shortened)

why the role is on a div.

```tsx
/*
            A DIALOG in role, because that is what a scrim plus a focus trap
            makes it. Not a `<dialog>` element: that would need `showModal()` to
            behave, which is script, and this panel is server-rendered and has to
            work without any. The role and the label are what assistive
            technology reads either way, and `MediaDrawer` supplies the trap.
          */
```

### app/components/admin/media-inspector.tsx:78 (CONTRACT, shortened)

keeps the ellipsis reason and the repeated pill; the mockup note goes to the history document.

```tsx
/*
                THE STICKY HEAD, which the mockup has and which a scrolling
                drawer needs: the name of the thing you are reading about must
                not scroll away from the facts about it, and Close must stay
                reachable without scrolling back up.

                The name ELLIPSISES rather than wrapping. A content-addressed key
                is 20 characters of hash and a static one is a path; either can
                wrap to three lines and push the whole panel down. The full
                string is in the `title` and in the Address field below.

                The usage pill repeats the state the panel explains further down.
                That is deliberate: it is the one fact somebody opens this panel
                to check, and it belongs where the eye lands first.
              */
```

### app/components/admin/media-inspector.tsx:126 (CONTRACT, shortened)

the no-script path for the page's one job.

```tsx
/* THE NO-SCRIPT PATH FOR THE PAGE'S ONE JOB. A readonly
                      input rather than a <code>: it selects with a click and
                      a keyboard, and it copies with the platform's own
                      shortcut, none of which needs this page to be running. */
```

### app/components/admin/media-inspector.tsx:143 (CONTRACT, shortened)

why the panel says derived.

```tsx
/* DERIVED, and the inspector says so. The mockup made this
                      distinction with a Role row marked "assigned by the
                      system" and a Tags row marked "yours to edit"; this page
                      has no tags column, so the same honesty lands on the two
                      groups it does have. Everything in this list is
                      recomputable from the object by `rebuildMediaIndex`, and
                      an edit here would be overwritten by the next rebuild. */
```

### app/components/admin/media-inspector.tsx:178 (CONTRACT, shortened)

why the field is images only; the counts go to the history document.

```tsx
/*
                    ALT TEXT, FOR IMAGES ONLY.

                    A document does not take alt text, so offering the field on
                    one invents an obligation the author cannot discharge. 31 of
                    the 70 rows are documents, and the field was on all of them.
                  */
```

### app/components/admin/media-inspector.tsx:200 (CONTRACT, shortened)

keeps the one-writer rule and the empty-field condition; the value-on-the-button reasoning goes to the history document.

```tsx
/*
                        THE SUGGESTION, AS A SUBMIT BUTTON CARRYING ITS VALUE.

                        One press writes it, through the SAME `set-alt` intent
                        the field above submits, so the server keeps one writer
                        and check:admin-ui sees no new payload shape. The value
                        rides on the button rather than in a hidden field for the
                        reason the upload intent does: a button name and value
                        pin the token, a hidden field lands in the field list as
                        a bare name.

                        Offered only while the field is EMPTY. A suggestion
                        beside text somebody has already written is an invitation
                        to overwrite their sentence with a filename.

                        A FORM, not a click handler that fills the input, so it
                        works with scripting off like everything else here.
                      */
```

### app/components/admin/media-inspector.tsx:237 (CONTRACT, shortened)

the parsed-not-storage rule.

```tsx
/*
                    TAGS. A comma separated text field, which is the same shape
                    the post editor's tag field submits, so an author who has
                    tagged a post already knows how this behaves.

                    The field carries the PARSED list joined back with commas,
                    never the delimiter-wrapped storage form. Nothing outside
                    `tags.mjs` should ever see `,alpha,beta,`.
                  */
```

### app/components/admin/media-inspector.tsx:261 (CONTRACT, shortened)

keeps the one-writer rule, the clear marker and the no-script property; the join-character history goes to the history document.

```tsx
/*
                    THE APPLIED TAGS AS CHIPS, each with a remove control, and
                    the SUGGESTIONS the path implies beside them.

                    Every one of these is a submit button on the SAME `set-tags`
                    intent, carrying the WHOLE resulting list as its value, with
                    ONE exception: the chip whose removal would leave nothing
                    submits `clear` instead, because an empty `tags` value is no
                    longer an instruction to clear. A button carries exactly one
                    name and value, so the marker replaces the list rather than
                    accompanying it. That
                    is deliberate: `setMediaTags` stays the one writer and the one
                    author of the delimiter rule, so a chip cannot become a second
                    way to write a tag that formats it differently. This table has
                    already been bitten once by two writers disagreeing about a
                    join character.

                    It also means every chip works with scripting off, which a
                    click handler mutating a text field would not.

                    A dashed outline on a suggestion and a solid one on an applied
                    tag, so the two differ by SHAPE and not only by a plus sign.
                  */
```

### app/components/admin/media-inspector.tsx:305 (CONTRACT, shortened)

why clearing is deliberate, and why it hides at one.

```tsx
/*
                        CLEAR ALL, an explicit act with its own control.

                        Without it the only way to empty a long list would be to
                        remove chips one at a time, which is the kind of friction
                        that gets routed around. The point of the fix is that
                        clearing is DELIBERATE, not that it is tedious. Shown
                        only above one tag, because at exactly one tag the chip
                        beside it already does this and two controls for one act
                        is noise.
                      */
```

### app/components/admin/media-inspector.tsx:342 (CONTRACT, shortened)

keeps the label rule and its owner; the seventy-row story goes to the history document.

```tsx
/*
                    THE ADDRESS, in the three forms an author actually pastes,
                    and THE LABELS CHANGE WITH THE FILE.

                    An image goes into a post as `![alt](src)` and a document
                    goes in as `[title](href)`, so a control labelled HTML has to
                    produce a different thing for each. It produced an `<img>`
                    tag for all seventy rows, which for the 31 documents is a
                    snippet that renders a broken image where a link was wanted.
                    The label is what stops somebody pressing it: "HTML tag" for a
                    picture, "HTML link" for a paper.

                    `copySnippetsFor` owns both the label and the value, so the
                    two cannot disagree, and it is unit tested with the document
                    case asserting that no `<img>` ever reaches one.
                  */
```

### app/components/admin/media-inspector.tsx:376 (CONTRACT, shortened)

exact identity only, and what makes the offer safe.

```tsx
/*
                    TWINS: rows carrying IDENTICAL BYTES, found by content hash.
                    Exact identity only, never a similarity score.

                    The copy is careful, because this is the one place the page
                    offers to remove something on the strength of a comparison:
                    trashing a twin hides it from the library and BOTH addresses
                    keep working, so nothing here can cost a published page its
                    image.
                  */
```

### app/components/admin/media-inspector.tsx:392 (CONTRACT, shortened)

what the sentence has to say; the mockup attribution goes to the history document.

```tsx
/*
                              THE SENTENCE THE MOCKUP WRITES, per twin, because
                              it is the one that makes the offer safe to accept.

                              "Byte-identical" says the comparison was exact, not
                              a similarity score. "Both addresses resolve to the
                              same content" says what a reader most needs before
                              trashing one: the surviving address serves the same
                              bytes, so no published page changes. Naming the twin
                              in the button is the other half; "trash that one"
                              was ambiguous on a panel showing two files.
                            */
```

### app/components/admin/media-inspector.tsx:430 (CONTRACT, shortened)

why a static row gets nothing.

```tsx
/*
                    THE CONTENT HASH, shown and never recomputed: the key already
                    carries it. A static row has a path rather than a hash, so it
                    gets nothing rather than a truncated path dressed as a digest.
                  */
```

### app/components/admin/media-inspector.tsx:442 (CONTRACT, shortened)

the claim, the boundary and the evidence; the old confession goes to the history document.

```tsx
/*
                    USAGE, IN THREE STATES, each with its title, its sentence and
                    the evidence behind it.

                    This section used to have two outcomes and the second one was
                    a confession: "an asset a route references in code would look
                    the same here". It was true, it was written by somebody who
                    knew the answer was incomplete, and it appeared on nine
                    photographs the site serves on every visit.

                    Now the third state has evidence of its own and the panel
                    names it. The heading is the CLAIM, the sentence is its
                    BOUNDARY, and the list underneath is what was actually found:
                    posts for `used`, source files for `in template`.
                  */
```

### app/components/admin/media-inspector.tsx:496 (CONTRACT, shortened)

why paths and why not links.

```tsx
/*
                          THE SOURCE FILES, which is what `in template` is
                          evidence of, and the whole reason the state exists.

                          Repo-relative paths rather than the mockup prose labels
                          ("Phage Hunters roster, page template"): those were
                          authored strings in a fixture, and a path is a fact the
                          reader can open and check. Not links, because the admin
                          has no source browser and a link to nothing is worse
                          than text.
                        */
```

### app/components/admin/media-inspector.tsx:521 (CONTRACT, shortened)

the ladder, and why a static row may still be trashed.

```tsx
/*
                    TRASH AND RESTORE, and NEITHER carries a confirm.

                    That is the friction ladder working, not a gap in it.
                    Trashing is reversible and changes nothing a reader can see,
                    so a confirm on it would be ceremony, and ceremony that is
                    always harmless is ceremony people learn to click through.
                    The confirm is spent where it buys something: on Delete
                    below, which is irreversible.

                    Offered on a static row too, unlike delete. Trashing tidies
                    the library and touches no file, which is exactly the thing a
                    static asset can safely have done to it.
                  */
```

### app/components/admin/media-inspector.tsx:554 (CONTRACT, shortened)

why the refusal is explained.

```tsx
/* A static asset shows WHY it cannot be deleted rather than
                      simply lacking a button. The action refuses it regardless;
                      this is so the page explains the refusal instead of
                      leaving a gap the operator has to interpret. */
```

### app/components/admin/media-inspector.tsx:562 (CONTRACT, shortened)

earlier feedback, not the gate.

```tsx
/*
                         * EARLIER FEEDBACK, NOT THE GATE. The action checks the
                         * same thing server-side, because this handler does not
                         * run for a reader without JavaScript and the R2 delete
                         * did. On accept it fills the field the server reads, so
                         * a scripted operator is asked once rather than twice.
                         */
```

## app/routes/home.tsx

### app/routes/home.tsx:26 (CONTRACT, shortened)

the opt-in and the default that still covers everything else; the citation stays on one line.

```tsx
/**
 * Publicly cacheable for COOKIELESS readers only.
 *
 * This route had no `headers` export and reached `private, no-store` through the
 * hard rule 8 default. That default STAYS and still covers everything unlisted;
 * this route now opts in, and `workers/app.ts` downgrades it right back whenever
 * every reader since 2026-09-05: the theme is a dimension of the cache key
 * rather than a Vary. Tagged `posts`, because the proof tiles and the featured
 * list read the corpus. Grounds on cacheTags in seo.ts.
 */
```

### app/routes/home.tsx:46 (CONTRACT, shortened)

header, over 370 on purpose: four prohibitions about a cached page; the measurements and both corrections go to the history document.

```tsx
/**
 * THE FRONT DOOR: who, what, and why believe it. Ruled 2026-08-25.
 *
 * What stood here was a centred name and a one-line role in a full-viewport
 * hero, and nothing else: a reader who arrived knowing nothing left knowing a
 * name. The research the ruling rests on is consistent and dull, which is why
 * it was followed rather than argued with: the first screen answers who and
 * what within seconds, two or three pieces of featured work beat a wall of
 * links, and PROOF beats claims.
 *
 * This site's proof is unusual and is the reason the tiles exist at all: it
 * measures itself continuously and publishes the measurements. So the three
 * numbers are READ AT RENDER from the instruments that own them, never typed
 * into this file.
 *
 *   gates      `stack.gates.length`, from content/generated/stack.json, which
 *              `build:stack` derives from package.json and `check:stack`
 *              reconciles in both directions. A digit here would be a second
 *              copy of a number a gate already owns. Rule 17.
 *   health     the SNAPSHOT `/api/health` last wrote to KV, read here and never
 *              recomputed. One KV read. See the correction below.
 *   writing    `total` from `listHomeStartHere`, the same `publiclyVisible()`
 *              predicate the blog index counts with, in the same batch.
 *
 * ## THE HEALTH TILE AND THE SHARED CACHE, and this is the decision the ruling
 * ## asked to see stated
 *
 * This page is `public, s-maxage=600`, so a verdict rendered into it can be up
 * to ten minutes old by the time it is read, and stale-while-revalidate widens
 * that further. A tile reading "healthy" with no qualifier would therefore be a
 * claim the page cannot support, which is the specific failure the ruling named:
 * the cached page must not lie.
 *
 * **The tile carries the time it was read, and the page stays cached.** The
 * alternative on offer was to keep health out of the cached body, and it is
 * refused: it costs either the tile (the most interesting of the three) or the
 * shared cache for every reader on the site's most-visited page, and it buys
 * accuracy this page does not need. "All N checks passed at 14:32 UTC" is TRUE
 * when read at 14:41. "All N checks passed" is not.
 *
 * `/api/health` is linked beside it, uncached and answering in real time, for
 * anyone who wants the current answer rather than the rendered one.
 *
 * ## THIS LOADER NO LONGER RUNS THE HEALTH SUITE. Corrected 2026-08-26.
 *
 * What stood here argued for calling `runHealthChecks` directly, against the
 * alternative of a subrequest to `/api/health`. The argument against the
 * subrequest was right and is kept below. The argument FOR computing was
 * wrong, and it was wrong about the cost rather than about the frequency:
 *
 *   "the health run is the slow half of this loader at roughly 0.7 to 2.7
 *    seconds... It is paid on a cache MISS only... Readers on a HIT pay
 *    nothing for it."
 *
 * Both sentences are true and the conclusion does not follow. MEASURED
 * 2026-08-26 against a control, unthrottled, six samples each: this page
 * rendered at origin in 1.07 to 3.48 s while `/blog` rendered in 0.32 to
 * 0.90 s, and `/api/health` measured alone took 0.98 to 2.01 s. The gap IS
 * the suite. On the throttled mobile profile two audits used, that arrived as
 * an LCP of 3.8 to 5.2 s on this page against 1.4 s on every other one.
 *
 * "A cache miss only" is not rare. The entry is `s-maxage=600` and it is per
 * LOCATION, so every colo pays it every ten minutes and the first reader in
 * each window pays all of it. A reader who has ever set a theme cookie paid it
 * on EVERY view, because a cookie-bearing request was downgraded past the
 * shared cache entirely. The slowest page on the site was the front door.
 *
 * ## WHAT IT DOES INSTEAD: ONE KV READ
 *
 * `/api/health` writes its verdict to KV on the way out, and the fifteen
 * minute scheduled poll goes through that same endpoint, so the snapshot stays
 * fresh with no second timer in existence. This loader reads it and renders
 * it. Nothing here can start a health run.
 *
 * The subrequest is still refused, for the reasons that were always good: a
 * Worker fetching its own public URL is a hop out to the edge and back, it
 * would have to name an origin that changes at DNS cutover, and it would put a
 * cacheable-looking request in front of an endpoint whose contract is
 * `no-store`. KV is neither a hop nor an origin.
 *
 * ## THE TILE GAINS A THIRD STATE, AND THAT IS THE PRICE
 *
 * The snapshot can be absent or old, so the tile must be able to say so
 * instead of showing a verdict. `healthTile` in `snapshot.mjs` owns the
 * classification and every uncertain input resolves to `missing`. The age is
 * measured from the SNAPSHOT'S timestamp, not from this render, so it counts
 * both hops of staleness: how long ago the suite ran, plus however long this
 * cached body has been sitting in front of a reader.
 */
```

### app/routes/home.tsx:139 (CONTRACT, shortened)

why concurrent, and why the mark keeps its name.

```tsx
/*
   * CONCURRENT. The listing is D1 and the tile is one KV read, and neither
   * reads the other's result, so serialising them would add their latencies
   * for nothing. Both are now cheap; the shape is kept because it costs
   * nothing and the reason it was right has not changed.
   *
   * `home_health` KEEPS ITS NAME, deliberately. It is now the KV read rather
   * than the suite, which is the whole point of the change, and the mark is
   * what will show that in production: the same name against a different
   * number is a legible before and after, where a renamed mark would look
   * like the instrument was removed.
   */
```

### app/routes/home.tsx:156 (WHY, shortened)

keeps ruling 57 and why /blog differs; the dark-section story goes to the history document.

```tsx
/*
   * `splitFeatured` IS GONE FROM THIS ROUTE, and that is ruling 57.
   *
   * It searched for the featured post inside the four rows this loader had
   * already fetched, so the lead was only ever found when it happened to be
   * among the four newest. The flagship sorts fifth, so the section was dark in
   * production: no heading, no cards, no "All N posts" link, on the page people
   * paste. `listHomeStartHere` asks for the featured post by name.
   *
   * `/blog` KEEPS `splitFeatured`, and the two are not disagreeing. There the
   * question really is "is the hero on the page I just fetched", because the
   * hero is drawn above a list it must then be removed from and only the
   * unfiltered first page may show one. Here the question is "what leads", and
   * that is a different query rather than a different answer.
   */
```

### app/routes/home.tsx:176 (CONTRACT, shortened)

this route decides nothing about health.

```tsx
/*
     * HANDED STRAIGHT THROUGH. The classification, the age and the refusal to
     * present an uncertain snapshot as a verdict all happened in `healthTile`,
     * which is where `node:test` can reach them. This route decides nothing
     * about health and computes no timestamp of its own: the age belongs to
     * the snapshot, not to this render.
     */
```

### app/routes/home.tsx:187 (CONTRACT, shortened)

header: why the gate reads an attribute and not the prose.

```tsx
/**
 * A proof tile. The number is always passed in; this component owns none.
 *
 * `age` is optional and is emitted as `data-health-age` in SECONDS. It exists
 * for `check:browser`, which asserts that a freshly deployed home page carries
 * a verdict inside one poll interval. The gate reads the attribute rather than
 * the sentence beside it, because the sentence is prose that will be edited and
 * the attribute is a number that cannot be satisfied by a rewording.
 */
```

### app/routes/home.tsx:224 (CONTRACT, shortened)

why an uncertain state shows a dash; the UTC reasoning goes to the history document.

```tsx
/*
   * THE TILE'S THREE STATES, resolved to a value and a sentence here and
   * nowhere else.
   *
   * `missing` and `stale` both refuse to show a ratio, and they refuse for the
   * same reason: a number beside the words "health checks passing" is read as
   * the CURRENT answer no matter what sentence sits under it. A dash is not
   * mistakable for a verdict. This is the same stance the old timestamp took,
   * carried one step further now that there is a state where the page has no
   * verdict at all rather than an old one.
   *
   * UTC is named in the detail, and the page is cached and served worldwide,
   * so a local time would be the reader's or the origin's depending on where
   * it rendered. `data-health-age` carries the age in seconds for
   * `check:browser`, which asserts a fresh deploy's tile is inside one poll
   * interval; a gate reading the prose would be reading a sentence rather than
   * a number.
   */
```

### app/routes/home.tsx:256 (CONTRACT, shortened)

keeps the one hidden element and the no-photo rule; the ruling citation stays on one line.

```tsx
/*
          THE SITE AUTHOR'S h-card, on the hero that already says who this is.
          Item I, ruling 50 as amended: microformats only. No `rel="me"`, no
          social links; social presence lives with germomics.

          MOSTLY VISIBLE, unlike the post page's author card. The name is the
          `<h1>` a reader already sees, so `p-name` needed no new markup and no
          hiding. Only `u-url` had nowhere to go: nothing in this hero links to
          the site's own root, and the one element that does, the header
          wordmark, is on every page rather than this one. So the anchor is
          hidden, and it is the ONE hidden element here.

          NO `u-photo`. There is no photograph of Dustin on this page or in the
          Person JSON-LD beside it, and a card claiming a photo the site does
          not publish would be the h-card version of a substituted value.
        */
```

### app/routes/home.tsx:278 (CONTRACT, shortened)

the one-owner rule for the sentence.

```tsx
/*
            ONE SENTENCE OF WHO AND WHAT, and it is `SITE.tagline`, the string
            the Person record and the meta description already derive from.
            A second sentence written here would be a second answer to the
            question the whole page exists to answer once.
          */
```

### app/routes/home.tsx:285 (CONTRACT, shortened)

keeps the one-constant rule and the not-repeated title; the audit finding goes to the history document.

```tsx
/*
            **THE UNIVERSITY, IN TEXT A PERSON CAN READ.**

            It was in `personJsonLd` and nowhere else. The pre-cutover audit's
            fourth part put it plainly: a stranger could read this whole site
            and never learn where the author works, because the only place it
            was written was a script element addressed to machines.

            `SITE.affiliation`, the SAME constant the Person record takes its
            `worksFor` from, so the page and the graph cannot come to name
            different employers. And it is `p-org` on the h-card this block
            already is, which is the property that was missing from it: a card
            with a name and no organisation is the half a reader wanted.

            The JOB TITLE is deliberately not repeated here. `SITE.tagline`
            one line up already says "Professor by training", and `/about`
            carries the current title in prose; three statements of one job
            across two pages is the mirror this file's own comments keep
            arguing against.
          */
```

### app/routes/home.tsx:342 (CONTRACT, shortened)

keeps the stated cost and the gate that covers it; the element history goes to the history document.

```tsx
/*
              THE SAME FOUR PROPERTIES AS `PostCard`, on markup that is not
              `PostCard`.

              This list has never used that component and this arc is not the
              place to make it: the cards here are `h3` under a section heading
              rather than `h2`, and the recent ones deliberately show no
              description. Marking them by hand is three lines; unifying the
              two card shapes is a design change nobody asked for. It IS a
              second place the property set is written down, which is the cost,
              and `check:microformats` reads both surfaces so the two cannot
              quietly diverge.

              `dt-published` NEEDED AN ELEMENT. The date here was bare text,
              formatted and then thrown away, so unlike the blog index there was
              no `<time>` to take the class. The rendered string is unchanged;
              what is new is the element around it and its machine-readable
              `datetime`, which this list should have had anyway.

              NO h-feed. This is a hand-picked three, not the blog's feed, and
              `/blog` is the page that says it is one.
            */
```

### app/routes/home.tsx:415 (CONTRACT, shortened)

why it is stated on the page.

```tsx
/*
          FOR READERS WHO ARE NOT PEOPLE, stated plainly rather than left to be
          discovered in a Link header. Every post serves its own markdown source
          at `.md`, and llms.txt lists the corpus; an agent that knows this can
          read the writing without parsing markup at all.
        */
```

## app/routes/blog._index.tsx

### app/routes/blog._index.tsx:36 (CONTRACT, shortened)

the opt-in and its one owner.

```tsx
// INSTRUMENTATION, OFF BY DEFAULT. `?timing=1` opts in, and root's
  // middleware is what reads that parameter and creates the collector, for
  // this route and every other one. This loader used to make its own, which is
  // why the public plane answered `?timing=1` on exactly one page.
```

### app/routes/blog._index.tsx:45 (WHY, shortened)

what to read off the numbers rather than assume.

```tsx
// ONE round trip now, not three: the tag lookup became a LEFT JOIN and
      // what remained went into a `db.batch`. These two run in parallel with
      // it and were entirely hidden underneath the old serial chain, so
      // whether they are now the critical path is the thing to read off the
      // numbers rather than assume.
```

### app/routes/blog._index.tsx:56 (CONTRACT, shortened)

keeps the removal, the pagination property and the known limit; the self-contradicting comment goes to the history document.

```tsx
/*
   * The featured post is surfaced only on the unfiltered first page. Inside a
   * filter it would be noise.
   *
   * AND IT IS REMOVED FROM THE LIST BELOW IT, since 2026-08-21. The comment
   * that used to sit here ended "repeating it above a list it already appears
   * in reads as a duplicate", and then the code did exactly that: `featured` is
   * FOUND IN `listing.posts` and the list was rendered from the same array
   * unchanged, so the hero post appeared twice on /blog. The sentence was the
   * argument against the behaviour it introduced.
   *
   * Filtered HERE rather than in the component so the payload is already
   * correct, which also means the count the page reports and the items it
   * renders come from one decision instead of two.
   *
   * PAGINATION IS UNAFFECTED, and that is worth stating because it is the
   * obvious worry. `pageCount` is computed by the query over the whole corpus,
   * and page 2 is a separate offset query; removing one item from page 1's
   * rendered list does not shift anything into or out of page 2. Page 1 still
   * displays the same posts, one of them as the hero rather than as a row.
   *
   * KNOWN LIMIT, unchanged and now written down: the hero only appears when the
   * featured post happens to fall on page 1, because that is the only page this
   * loader has in hand. A featured post old enough to sit on page 3 is featured
   * nowhere.
   */
```

### app/routes/blog._index.tsx:87 (CONTRACT, shortened)

keeps the three-way argument compressed; the soft-404 explanation goes to the history document.

```tsx
/*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE. Chosen over 404 and over
   * clamping in place, and the three differ in what they tell the reader.
   *
   * `/blog?page=99` rendered an empty list under the words "Page 99 of 3". The
   * list was honest and the sentence was not, and a crawler reading it sees a
   * soft 404: a 200 with no content, which is the shape search engines penalise
   * hardest because it cannot be distinguished from a real page.
   *
   * NOT 404, because the resource EXISTS. `/blog?tag=cloudflare` is a real
   * list; 99 is out of bounds for that list, not a missing document, and 404
   * would also be wrong the moment enough posts are published to make it valid.
   *
   * NOT CLAMPED IN PLACE, because the URL would then disagree with the page:
   * the address bar says 99 and the content is page 3, so a copied link is a
   * lie and the canonical would have to argue with its own URL.
   *
   * A REDIRECT fixes both. The reader lands on a page that exists, at the URL
   * that names it, and a crawler follows one hop to the canonical rather than
   * indexing an empty one. 302 rather than 301: the bound moves as posts are
   * published, so this is where page 99 goes TODAY, not forever.
   *
   * Page 0 and negatives fall out of the same clamp. The parse above already
   * turns junk into 1 via `|| 1`, so only numbers above the bound reach here.
   */
```

### app/routes/blog._index.tsx:125 (CONTRACT, shortened)

the ordering is the whole fix.

```tsx
// AFTER the spread, so the filtered array wins over `listing.posts`. Spread
    // first and this line is the whole fix; spread second and it is a no-op
    // that reads like one.
```

### app/routes/blog._index.tsx:136 (WHY, shortened)

why the route no longer stamps; the local-array history goes to the history document.

```tsx
/*
   * **AND THE LAST ROUTE-LEVEL STAMP IS GONE, 2026-08-27.**
   *
   * It was kept because the array here was LOCAL: nothing set `timingsContext`
   * on the public plane, so the transport read `undefined` and stamping here
   * was the only Server-Timing a public reader could get. Root's middleware
   * sets it for every route now, so `workers/app.ts` writes the header from the
   * same array AFTER the handler returns, which is the one point where it is
   * complete. Stamping here would emit a header built from a list still being
   * written to, which is the race that transport-side note describes.
   */
```

### app/routes/blog._index.tsx:151 (CONTRACT, shortened)

the cache dimension and the tag.

```tsx
// Publicly cacheable for EVERY reader since 2026-09-05: the theme is a
  // dimension of the cache key rather than a Vary, so this page no longer
  // declares one. Tagged `posts`, because its content is a function of the
  // corpus and a publish must be able to move it. Grounds on cacheTags in seo.ts.
```

### app/routes/blog._index.tsx:171 (CONTRACT, shortened)

what the canonical must carry; the consequence goes to the history document.

```tsx
/*
   * THE CANONICAL CARRIES EVERY AXIS THAT CHANGES THE LIST, which is all three.
   *
   * It carried `tag` alone, so `/blog?year=2026` and `/blog?page=2` each
   * declared `/blog` as their canonical. That tells a crawler those are the
   * same document as the unfiltered first page, which they are not: they are
   * different posts. The recorded consequence is thin-duplicate treatment, and
   * the actual one is worse, that the pages are asking to be dropped from the
   * index in favour of a page whose content they do not share.
   *
   * Built from the same axes `filterHref` uses, in the same order, so the
   * canonical of a page is byte-identical to the link that reaches it.
   */
```

### app/routes/blog._index.tsx:192 (CONTRACT, shortened)

the condition is the whole care in the block.

```tsx
/*
   * A TAG-ONLY FILTER CANONICALISES TO THE ARCHIVE, since the archive exists.
   *
   * `/blog?tag=x` and `/blog/tags/x` are the same list of posts at two
   * addresses, which is duplicate content by construction. The archive is the
   * better one: it has a title naming the tag, a description, a breadcrumb, its
   * own feeds and a place in the sitemap, none of which a query-string view of
   * the index has. So the filtered view keeps working, keeps composing with the
   * year chips beside it, and tells a crawler where the canonical copy lives.
   *
   * ONLY WHEN THE TAG IS THE ONLY FILTER, and that condition is the whole care
   * in this block. `?tag=x&year=2026` is a DIFFERENT list from the archive, so
   * naming the archive as its canonical would point a crawler at a page whose
   * content it does not share, which is the exact defect the comment above
   * describes and fixed for `year` in the first place. There is no year archive
   * to send it to, so it stays self-canonical.
   *
   * Page two of a tag-only filter maps to page two of the archive, because the
   * archive paginates the same list in the same order at the same size.
   */
```

### app/routes/blog._index.tsx:221 (CONTRACT, shortened)

the one-builder rule; the drift and the feed move go to the history document.

```tsx
/*
   * THE SHARED BUILDER, and nothing else any more.
   *
   * The social half was a hand-written array here exactly as it was on five
   * other pages, and it had drifted the same way: no `twitter:image`, so the
   * card it declared rendered as a bare link. `pageMeta` owns that set.
   *
   * The two feed alternates used to be added here because this was the only
   * page that had them. They moved to root's `links` on 2026-08-27, which are
   * merged onto every route, so a reader arriving on a post can find the feed
   * too. Nothing about this page is local any more.
   */
```

### app/routes/blog._index.tsx:240 (CONTRACT, shortened)

header: the AND property and the page-drop rule; the destroyed-axis defect goes to the history document.

```tsx
/**
   * EVERY link on this page, from one builder.
   *
   * The loader composes tag AND year into a single query, so the two filters
   * are ANDed and a reader can legitimately be in both at once. The chips did
   * not know that: a tag chip linked to `/blog?tag=x` and a year chip to
   * `/blog?year=y`, so clicking either one silently DESTROYED the other. A
   * reader filtering to 2026 and then clicking a tag lost the year without
   * being told, and the chip they had just been using stopped being current.
   *
   * `pageHref` already knew how to preserve both and was the only link that
   * did. This generalises it rather than adding a second spelling: an override
   * of `null` clears one axis, which is what the All chips want, and every
   * other caller passes what it is changing.
   *
   * Page is dropped on any filter change, deliberately. Page 3 of one filter is
   * not page 3 of another, and carrying it would land a reader on an empty list
   * that their own click created.
   */
```

### app/routes/blog._index.tsx:277 (CONTRACT, shortened)

keeps the no-wrapper refusal and the scope; the harmlessness argument goes to the history document.

```tsx
/*
        THE h-feed IS THE `<main>` ITSELF, and that is a deliberate refusal to
        add a wrapper. The feed has to contain BOTH the featured section and the
        list, and those are siblings; a `<div class="h-feed">` around the pair
        would be a new element introduced for a class, on a page whose whole
        constraint this arc is that nothing visual moves. `.page` is a plain
        block with padding and both children centre themselves with `margin:
        0 auto`, so a wrapper would almost certainly have been harmless, and
        "almost certainly harmless" is not a reason to add markup.

        WHAT ELSE FALLS INSIDE THE FEED: the search form, the tag chips, the
        year archive and the pagination. None of them carries a microformats
        class, so a parser reads past them; a feed's properties are the
        annotated descendants, not everything in the subtree.

        NOT ON THE TAG ARCHIVE OR THE SERIES PAGE. Those render the same cards,
        so their entries parse as top-level h-entries, which is valid and is
        what they are: a filtered view is not this blog's feed. If either ever
        wants to BE a feed, it says so itself rather than inheriting it here.
      */
```

### app/routes/blog._index.tsx:311 (CONTRACT, shortened)

the measured correction is the point.

```tsx
/* The feed's own name, on the heading that already is it.

              MEASURED, because the first version of this comment guessed and
              was wrong. It claimed that without an explicit `p-name` a parser
              would imply one from the page text. It does not: implied
              properties are skipped for a root that contains nested
              microformats, and this feed contains an h-entry per card, so the
              feed's properties parse as `{}` with the class absent. The class
              is not preventing a bad name, it is supplying the only one. */
```

### app/routes/blog._index.tsx:324 (CONTRACT, shortened)

one engine, and the no-script property.

```tsx
/* Blog-scoped search is site search with type pinned, not a second
            engine. The hidden field is what scopes it, so the same index, the
            same parser and the same ranking serve both, and a reader can widen
            to the whole site by removing one chip on the results page.

            A router `<Form method="get">`, which emits the same markup and the
            same URL as a plain form, so it still works with scripting off. The
            destination's own form (`search.tsx`) has always been a `<Form>`;
            these two now agree. */
```

### app/routes/blog._index.tsx:389 (CONTRACT, shortened)

keeps why the feed is the main and the hidden date; the one-shape argument goes to the history document.

```tsx
/*
          THE FEATURED POST IS AN ENTRY IN THE FEED, which is the whole reason
          the feed is the `<main>`. `splitFeatured` REMOVES this post from the
          list below, so a feed scoped to the `<ul>` alone would silently omit
          the one post the page is pushing hardest. That omission is invisible
          from the page: the reader sees it, and only a parser notices it gone.

          IT CARRIES THE SAME FOUR PROPERTIES AS A CARD, so every entry in this
          feed has one shape and `check:microformats` needs no special case for
          this one. A special case is where a gate stops biting.

          `dt-published` IS HIDDEN HERE and visible on a card, because this
          section renders no date and never has. Showing one would change the
          page; the alternative is a feed whose first entry has no date, which
          is the property a reader sorts by. The hidden `<time>` carries the
          same value the card below would have rendered for this post.
        */
```

### app/routes/blog._index.tsx:440 (CONTRACT, shortened)

why the bundle is absent and what asserts it; the byte count goes to the history document.

```tsx
/* NO BlogEnhancements HERE, since 2026-08-27. Every one of that bundle's
          seven enhancements targets markup the post PIPELINE renders inside
          `.prose`: the reading bar wants `.post .prose`, the scrollspy wants
          `.post-toc`, and the code buttons, heading links, footnote previews and
          lightbox all want elements that exist only inside a rendered post body.
          This page has none of them, so the bundle was 4,514 bytes downloaded and
          parsed to find nothing on the site's second most visited page.
          check:browser asserts on the resource timeline that it is not fetched
          here, which is the half a source reading cannot give you. */
```

## app/routes/admin.posts.$slug.edit.tsx

### app/routes/admin.posts.$slug.edit.tsx:28 (CONTRACT, shortened)

why a handle and not a loader field.

```tsx
/*
 * THE MATH STYLESHEET, ALWAYS, on both routes that render the editor.
 *
 * A handle rather than a loader field, because the flag every other reader uses
 * is a property of what has been SAVED and an author is typing something that
 * has not been. Read by root.tsx, which links the sheet; the grounds, including
 * why the preview pane needs the link on THIS document, are there.
 */
```

### app/routes/admin.posts.$slug.edit.tsx:43 (WHY, shortened)

why the marks were added without reordering; the date goes to the history document.

```tsx
/*
   * INSTRUMENTED 2026-08-22, and this loader has the shape the admin layout was
   * already fixed for: FIVE of its awaits sit inside the RETURNED OBJECT
   * LITERAL, which evaluates its properties in order, so they run SERIALLY.
   * Most of them are GitHub API calls. The marks below are deliberately added
   * WITHOUT reordering anything, so the measurement describes what shipped
   * rather than what a fix would produce.
   */
```

### app/routes/admin.posts.$slug.edit.tsx:69 (CONTRACT, shortened)

the hydration boundary.

```tsx
// Derived HERE rather than in the component, for the same reason the posts
    // index derives its pill in its loader: `stateOf` reads the clock, and a
    // component that recomputed it would render one word on the server and
    // hydrate a different one for a post scheduled seconds away.
```

### app/routes/admin.posts.$slug.edit.tsx:74 (CONTRACT, shortened)

the empty array is the mechanism; the non-fatal stance stays.

```tsx
/**
     * Live preview links, and the EMPTY ARRAY IS A DECISION on a post that is
     * not a draft.
     *
     * A published post has none: the publish path revoked them. A scheduled post
     * is `draft: false` too, so it also has none, and this does not ask. What
     * the empty array then does is stop the section rendering at all, which is
     * how "a published post offers NEITHER intent" is held.
     *
     * Non-fatal: a KV outage costs the drawer a list, not the editor. The same
     * stance the revision list takes, and for the same reason.
     */
```

### app/routes/admin.posts.$slug.edit.tsx:99 (CONTRACT, shortened)

the one fact the table needs.

```tsx
// The one fact the transition table needs that current state cannot give:
    // a draft is either brand new or previously withdrawn, and only
    // `first_published` in the committed file tells them apart. It is the same
    // fact publish-policy.mjs gates the operator's first publication on.
```

### app/routes/admin.posts.$slug.edit.tsx:104 (WHY, shortened)

why the vocabulary is offered.

```tsx
// Autocomplete for the tag field. Whatever is already in use on the site,
    // so tagging tends toward the existing vocabulary instead of inventing a
    // near-duplicate of a tag that already exists.
```

### app/routes/admin.posts.$slug.edit.tsx:112 (CONTRACT, shortened)

keeps ruling 1 holding by route shape and the non-fatal stance.

```tsx
// Commits touching this post, for the drawer's revision list. LOADER work,
    // deliberately: reading history is a read, so it belongs in the loader and
    // adds no form and no submission to this page. Diffs and revision contents
    // are fetched on demand from the revisions resource route, which exports no
    // action, so ruling 1's "restore loads, it does not write" holds by the
    // shape of the routes rather than by anything this page promises.
    //
    // Non-fatal: a GitHub outage must not blank the editor. The drawer simply
    // reports no commits, and writing still works because the save path fails
    // loudly on its own.
```

### app/routes/admin.posts.$slug.edit.tsx:137 (CONTRACT, shortened)

why these two are not in the shared path.

```tsx
/*
   * THE TWO PREVIEW-LINK INTENTS, handled here rather than in
   * `handleEditorAction`.
   *
   * That module is the SHARED save path behind this route and /admin/posts/new,
   * and both of these are edit-only: a post that does not exist yet cannot be
   * previewed. Putting them there would put two intents on the new-post route
   * that the new-post route can never legally use. Delete is here for the same
   * reason and by the same argument.
   *
   * Neither of them writes to GitHub, D1 or the artifact. They are KV only.
   */
```

### app/routes/admin.posts.$slug.edit.tsx:153 (CONTRACT, shortened)

why every arm has one shape.

```tsx
// `conflict`, `field` and `line` are stated rather than omitted so every
      // problem this route can return has one shape. An optional property on
      // one arm of the union is how the component's `actionData.problem.field`
      // read stops compiling, which is exactly what it did when `field` and
      // `line` were first surfaced.
```

### app/routes/admin.posts.$slug.edit.tsx:163 (WHY, shortened)

the server-side prohibition and the authority.

```tsx
/*
       * THE DRAFT CHECK IS SERVER SIDE, and it is not redundant with the UI.
       *
       * The drawer does not render the control on a published post, so nothing
       * on the page can send this. That is a statement about the page, and this
       * is an action: it is reachable by anyone holding the admin session and a
       * curl command. Minting a capability is exactly the operation that must
       * not trust the absence of a button.
       *
       * The COMMITTED FILE is the authority, re-read here rather than taken from
       * the submitted form, because the form is the author's unsaved draft of
       * what the post should become and this question is about what it IS.
       */
```

### app/routes/admin.posts.$slug.edit.tsx:202 (WHY, shortened)

why the asymmetry is deliberate.

```tsx
/*
     * REVOKE IS NOT DRAFT-GATED, and the asymmetry is deliberate.
     *
     * Creating on a published post is refused because it mints something. Taking
     * one away is a delete: it can only ever reduce what exists, it is
     * idempotent, and refusing it would strand a row in a drawer that a
     * concurrent publish had already emptied. The one operation that must never
     * be blocked by a stale page is the one that removes access.
     */
```

### app/routes/admin.posts.$slug.edit.tsx:225 (WHY, shortened)

keeps the no-script prohibition, the consent distinction, the count and the one-spelling rule.

```tsx
/*
     * **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.**
     *
     * It was a `confirm()` in an `onSubmit` handler. With scripting off the
     * handler never ran, the form posted, and the file and its rows went with
     * no confirmation at all. `expectedHeadSha` below is CONCURRENCY, not
     * consent: it stops a stale page overwriting a newer one, and says nothing
     * about whether a human meant to delete anything.
     *
     * One post, so the count is 1. Same predicate and same field name as the
     * bulk and empty-trash paths, because three spellings of one ceremony is
     * how one of them ends up unchecked.
     *
     * An unconfirmed delete is the CONFIRMATION STEP, not an error: the route
     * renders a server-rendered second step from this, so a reader without
     * script gets a confirmation rather than a refusal they cannot satisfy.
     */
```

### app/routes/admin.posts.$slug.edit.tsx:275 (WHY, shortened)

why the save lands here.

```tsx
// Back to this page rather than the post list. A save used to land on the
  // list with nothing to say, which is how a first publication completed in
  // silence: the one act reserved to the human looked like nothing had
  // happened at all.
```

### app/routes/admin.posts.$slug.edit.tsx:284 (CONTRACT, shortened)

why the narrowing is by kind.

```tsx
/*
   * Narrowed by KIND rather than by `"fields" in actionData`.
   *
   * The `in` form stopped narrowing once this route's action grew arms that
   * carry no fields at all: TypeScript widened the result to `PostFields |
   * undefined` and the editor's required prop went red. Naming the two arms that
   * DO carry them is the same behaviour and says which they are.
   */
```

### app/routes/admin.posts.$slug.edit.tsx:294 (CONTRACT, shortened)

why the third arm carries fields.

```tsx
/*
   * The third arm that carries fields. An unconfirmed first publication is not
   * a failure, so it is not a `problem`, but it re-renders the editor around
   * the author's submitted body exactly as one does: the confirming submit is
   * this same form posting again, so what it posts has to be what they typed.
   */
```

### app/routes/admin.posts.$slug.edit.tsx:309 (CONTRACT, shortened)

what persistent means here.

```tsx
// Persistent until the NEXT action, and the next action is whatever produced
  // an actionData: a failure replaces the message, and a preview clears it,
  // because by then the URL is describing a save two steps ago.
```

### app/routes/admin.posts.$slug.edit.tsx:326 (CONTRACT, shortened)

the transition describes what is committed.

```tsx
// The state the editor renders against comes from the loader, but a failed
  // save hands back the fields the author submitted, and those can disagree.
  // The transition must describe what is COMMITTED, so it stays the loader's.
```

### app/routes/admin.posts.$slug.edit.tsx:331 (CONTRACT, shortened)

the structural holding, and why the state is the loader's.

```tsx
/*
   * THE SECTION EXISTS ONLY FOR A DRAFT, and `undefined` is how that is said.
   *
   * The drawer renders the section when it is handed a node and renders nothing
   * when it is not, so on a published post there is no create control and no
   * revoke control anywhere in the markup. That is the ruling held structurally
   * rather than by a disabled button, which sends nothing but still looks like
   * an offer.
   *
   * The state is the LOADER'S, so an unsaved edit toggling the draft checkbox
   * does not conjure the section: what a preview link previews is the committed
   * file, and offering one against unsaved intent would promise the reviewer
   * something they would not see.
   */
```

### app/routes/admin.posts.$slug.edit.tsx:389 (CONTRACT, shortened)

the nesting prohibition.

```tsx
/*
              Associated by the `form` attribute rather than by containment.
              The delete form cannot be nested inside the editing form, because
              nested forms are not valid HTML and the browser drops the inner
              one, so the button lives in the drawer and points at a form that
              sits outside it. Same request as before: POST here, intent=delete,
              carrying headSha.
            */
```

### app/routes/admin.posts.$slug.edit.tsx:410 (CONTRACT, shortened)

the no-script path.

```tsx
/*
        THE SERVER-RENDERED CONFIRMATION STEP, reached when the action refused
        an unconfirmed delete. That is the no-script path: the onSubmit handler
        never ran, the field arrived empty, and nothing was deleted. An ordinary
        form, so no script participates in satisfying it either.
      */
```

### app/routes/admin.posts.$slug.edit.tsx:446 (CONTRACT, shortened)

earlier feedback, not the gate.

```tsx
/*
           * EARLIER FEEDBACK, NOT THE GATE. The action checks the same thing
           * server-side, because this handler does not run for a reader without
           * JavaScript and the delete did. On accept it fills the field the
           * server reads, so a scripted operator is asked once rather than
           * twice.
           */
```

### app/routes/admin.posts.$slug.edit.tsx:467 (CONTRACT, shortened)

keeps the nesting reason and the fixture argument.

```tsx
/*
        THE PREVIEW-LINK FORMS, outside the editing form for the same reason the
        delete form is: the drawer that holds their buttons is a <dialog> nested
        inside it, and a form inside a form is dropped by the browser.

        They render only for a draft, so a published post has no form to submit
        to either. `previewLinkSlot` is the same condition, so the buttons and
        the forms they point at cannot exist without each other.

        ONE REVOKE FORM PER LINK, each carrying its own token as a hidden field.
        The alternative, one form and a `name="token"` on every button, works
        identically for a browser and worse for the gate: it would put the token
        into the submission tuple, so a post with two links would record a
        different payload set from a post with one, and the fixture would be
        describing the data rather than the request surface.
      */
```

## app/routes/publications.tsx

### app/routes/publications.tsx:41 (CONTRACT, shortened)

header: why abstracts stay in the file and out of the page.

```tsx
/**
 * Types this page shows. The data file is also the source for the CV, which
 * does list conference abstracts, so those records stay in the file and are
 * excluded here instead of being deleted. An abstract is the meeting version
 * of a paper already listed, so showing both would repeat the same work.
 */
```

### app/routes/publications.tsx:56 (CONTRACT, shortened)

header: why the descriptions are written.

```tsx
/**
 * Head metadata for the four single-topic views, which are the only filtered
 * URLs that self-canonical.
 *
 * Descriptions are written, not templated. A generated line like "Publications
 * in {topic}" or "N of 33 publications" is the same thin metadata with a
 * variable in it, which is what the audit found and what this replaces. Each
 * sentence describes the actual work, so the four pages differ in content and
 * not just in a number.
 */
```

### app/routes/publications.tsx:89 (CONTRACT, shortened)

header: the comparison-time rule.

```tsx
/**
 * Fold the dash family to a plain hyphen and flatten case and runs of space.
 *
 * Applied to both sides of every comparison. Nobody types an em dash into a
 * search box, but Crossref titles carry them, so "US-A Cross-Sectional" has to
 * reach the stored "US-A Cross-Sectional" spelt with U+2014. The stored strings
 * are never rewritten; this is comparison-time only.
 */
```

### app/routes/publications.tsx:107 (CONTRACT, shortened)

header: why the haystack is decoded.

```tsx
/**
 * Fields the text query runs against. Abstract is deliberately not included.
 *
 * DECODED FIRST, so the haystack is the text on the page rather than the text
 * in the file. Without it a search for `Microbiology & Biology Education`
 * cannot reach a journal stored as `Microbiology &amp; Biology Education`, and
 * the one place a reader would copy that string from is the page, where it now
 * renders with the ampersand.
 */
```

### app/routes/publications.tsx:130 (CONTRACT, shortened)

header: what noindex means now, and the one-builder rule; the archived period goes to the history document.

```tsx
/**
 * Head metadata.
 *
 * ## UN-ARCHIVED 2026-09-12, and this is the seam the old comment described
 *
 * From 2026-07-27 until PR #3 deleted it, this route served `noindex, follow`
 * on every variant and dropped `rel=canonical` entirely, because a canonical
 * and a noindex are contradictory signals and a crawler shown both will act on
 * one of them without telling you which. The old comment named the two edits
 * that would reverse it: put the canonical link back, and make the robots entry
 * conditional on the loader's `noindex` again. Both are done here, so the four
 * bare single-topic URLs self-canonical and the bare page indexes.
 *
 * `noindex` now means what it always computed and never got to say: an empty
 * result set. A query matching nothing is a real URL with no content on it, and
 * that is worth keeping out of an index whether or not the route is archived.
 *
 * ## `pageMeta` RATHER THAN A HAND-BUILT ARRAY
 *
 * The original wrote its own tag list and deliberately emitted no `og:image`,
 * on the grounds that the only images in the repo were phage cohort photos. The
 * site has had a default social card since `0517cb0`, and `pageMeta` is the one
 * place the card, the canonical and the twitter tags are decided together. A
 * second hand-built list here would be a fifth copy of a set that has already
 * drifted once, which is the defect `pageMeta` was extracted to end.
 */
```

### app/routes/publications.tsx:170 (CONTRACT, shortened)

header: what omitting the export would cost; the citation stays on one line.

```tsx
/**
 * Shared-cache headers, which the July route did not have because the layer did
 * not exist yet. A public HTML route that returns none is stamped
 * `private, no-store` by the gateway under hard rule 8, so omitting this would
 * quietly make the most static page on the site the only uncacheable one.
 */
```

### app/routes/publications.tsx:189 (CONTRACT, shortened)

what an unrecognised value does.

```tsx
// Accepts "1" or "true", any casing. Any other value is absent rather than
  // truthy, so a stray ?selected=banana shows the full list instead of an
  // empty page. Generated links always emit the canonical "1".
```

### app/routes/publications.tsx:243 (CONTRACT, shortened)

the canonical policy, compressed.

```tsx
// Canonical policy. Exactly the four bare single-topic URLs self-canonical
  // and carry their own written title and description. Everything else
  // canonicals to the bare page: multi-topic combinations, any q, any sort
  // including the default, any selected, and any unrecognised param. Those
  // views are re-orderings or subsets of the index, not distinct content, and
  // the URL space is unbounded because q is free text.
```

### app/routes/publications.tsx:266 (WHY, shortened)

the one thing a canonical must never do.

```tsx
/*
   * A PATH rather than an absolute URL, because `pageMeta` builds the absolute
   * form from `SITE_ORIGIN`. Those two disagree on every request that does not
   * arrive on the canonical host: a preview URL, a `workers.dev` request while
   * the apex is live, or a local run. Deriving the canonical from `url.origin`
   * is how a page ends up declaring a preview host canonical, which is the one
   * thing a canonical must never do.
   */
```

### app/routes/publications.tsx:336 (CONTRACT, shortened)

header: why the collapse always includes the owner.

```tsx
/**
 * Author list, collapsed to a summary that always includes the site owner.
 *
 * Author order varies across the corpus: he is first on some papers, last on
 * every phage announcement, and 14th of 108 on a community teaching resource.
 * A plain "first three" collapse would hide his name on most of the page, so
 * when he falls outside the first three the summary shows the first two, an
 * ellipsis, then his entry. details, not a button, so it expands without
 * scripting.
 */
```

### app/routes/publications.tsx:357 (CONTRACT, shortened)

why the flag is derived from the value.

```tsx
/*
   * THE PULLED NAME IS READ ONCE, HERE, and `pulled` is derived from whether
   * that read produced anything.
   *
   * It used to be `ownerIndex >= 3`, with `authors[ownerIndex]` read separately
   * in the markup. Those are two statements of the same condition, and under
   * `noUncheckedIndexedAccess` the second one is what the compiler objects to:
   * an index that the first statement proved good. Deriving the flag from the
   * value collapses them, so there is one read and no assertion.
   */
```

### app/routes/publications.tsx:400 (WHY, shortened)

tagged by what STAYS; the before-state goes to the history document.

```tsx
/*
        THE TITLE IS THE LINK TO THE PAPER'S OWN PAGE.
        Every row leads somewhere now. Before the per-paper pages existed this
        was plain text and the only outbound links were the DOI and the PDF, so
        the index was a leaf: a reader who wanted one paper had to leave the
        site to read anything more about it. It is also what makes the paper
        pages reachable by a crawler, which Scholar requires (every article URL
        "reachable from the homepage by following at most ten simple HTML
        links"); a sitemap entry alone is a weaker signal than a real link.
      */
```

### app/routes/publications.tsx:433 (CONTRACT, shortened)

the zero rule and the provenance reason.

```tsx
/* Last in the row. Only at 1 or more, so a zero is never rendered as
            though it were a real count. It is a link rather than plain text
            because it sits among the link pills, and the OpenAlex work page
            carries the provenance that the title attribute cannot show on a
            touch device. The URL comes from the response, never constructed. */
```

### app/routes/publications.tsx:448 (CONTRACT, shortened)

keeps why a list page can carry this and the per-paper split; the ruling citation stays.

```tsx
/*
        COinS, one per row, INDEX ONLY.

        An empty span whose title is an OpenURL ContextObject. Zotero and its
        relatives scan for `.Z3988` and offer to save what they find, which is
        the only machine-readable citation a LIST page can carry: Highwire
        `citation_*` tags describe the document they sit in, and a page is one
        document, so 33 records cannot each have a citation_title. That is the
        same limit that stops Scholar indexing a list page, and this is the
        thing that fills it: a reader can save one row without opening it.

        The per-paper pages carry the citation tags and JSON-LD instead, so
        this is deliberately not repeated there. Ruling 63.
      */
```

### app/routes/publications.tsx:502 (CONTRACT, shortened)

what the id is for; the gate reference goes to the history document.

```tsx
/* `id="main"` is root's unconditional skip-link target. Without it the
          skip link moves focus nowhere, which is what `check:invariants`
          section 12 refuses. The July markup predates that gate. */
```

### app/routes/publications.tsx:582 (CONTRACT, shortened)

why the files are always the full list.

```tsx
/* The whole list, as files. Under the count rather than in the
              controls, because they describe what is listed rather than
              changing it. Always the FULL list regardless of the current
              filter: a citation file that silently carried only what a chip
              happened to be showing would be a subset nobody asked for. */
```

### app/routes/publications.tsx:615 (WHY, shortened)

the injection prohibition and why this route is the highest risk.

```tsx
/*
          schema.org data for search and language models.

          `jsonLd`, NOT a bare `JSON.stringify`. The July version stringified
          straight into `dangerouslySetInnerHTML`, which was how every emitter on
          the site did it before `app/lib/json-ld.mjs` was written; a `<script>`
          element's contents are raw text and the only thing that ends one is the
          literal `</script`, so an abstract or a title carrying that sequence
          closes the element early. This route is the highest-risk emitter on the
          site for exactly that, because it is the only one whose strings come
          from THIRD PARTY registries rather than from the one admin's
          frontmatter. `check:policy` refuses the bypass.
        */
```

## app/routes/projects.tsx

### app/routes/projects.tsx:24 (CONTRACT, shortened)

header: the no-script property, the two provenances and the card licence; the slogan correction goes to the history document.

```tsx
/**
 * /projects, the portfolio index.
 *
 * NO SCRIPT AT ALL, which is stronger than the law hard rule 9 asks for and is
 * a property of this route rather than a claim about the site. There is no
 * loader, no client state and no enhancement: every input is a build-time
 * import, so this route is a pure function from committed data to markup.
 * Nothing here belongs in enhancements.json because there is nothing to
 * enhance. This paragraph used to open "ZERO JAVASCRIPT", which is the one
 * phrasing rule 9 forbids, because it is the slogan that survives paraphrase
 * and is false in both directions.
 *
 * WHY THE NUMBER IS THE POINT. The hero says this site publishes the numbers,
 * and a portfolio without numbers is a list of links. Every card therefore
 * leads with a real value and says where that value came from. TWO PROVENANCES
 * ARE POSSIBLE and a metric declares exactly one: a DATED observation, whose
 * date is rendered because an undated number rots silently while continuing to
 * look authoritative, or a DERIVATION this build ran, which cannot rot and
 * therefore carries no date. The derived form arrived on 2026-08-30, when the
 * flagship card's "verification gates in the build" was found reading four
 * fewer gates than the build ran: the date was honest and the number was a
 * second copy, which is exactly what hard rule 17 refuses.
 *
 * WHAT IS TECHNICALLY NOTABLE, AND THE EVIDENCE FOR IT, are both optional
 * fields, and that asymmetry is the page's other honest shape. A card whose
 * project is documented nowhere public carries no notable list and no evidence
 * list, rather than sentences reconstructed from memory and links to nothing.
 *
 * CARDS ON THE CANVAS ARE LEGAL HERE. Binding rule 7 reserves cards for
 * indexes and keeps body prose on the page canvas; this is an index, so the
 * card treatment is the sanctioned one rather than an exception.
 *
 * The build-time import is the features.json pattern: a roster change needs a
 * deploy AND a sync, and `npm run ship` covers both.
 */
```

### app/routes/projects.tsx:60 (CONTRACT, shortened)

header: why a union and not two optional fields.

```tsx
/**
 * A metric is DATED or DERIVED, never both. See METRIC_DERIVATIONS.
 *
 * Modelled as a union rather than as two optional fields, so a card cannot be
 * written with a value and a derivation and quietly render one of them: the
 * two branches below are exhaustive because the type says they are.
 */
```

### app/routes/projects.tsx:92 (CONTRACT, shortened)

header: why neither input is measured here.

```tsx
/**
 * What the derived metrics are computed FROM, assembled once at module scope.
 *
 * Both are already in this Worker: `stack.json` because the colophon imports
 * it, `PHAGE_YEARS` because the roster route renders it. Neither is a
 * measurement taken here, which is the whole property that makes a derived
 * metric worth more than a dated one.
 */
```

### app/routes/projects.tsx:102 (CONTRACT, shortened)

the one-owner rule and what it prevents.

```tsx
/*
 * The title, description, intro and anchors come from `projects-page.mjs`, the
 * module the INDEXER also reads. Nothing on this page is typed twice, so a
 * search result's title cannot drift from the heading it lands on, and a
 * section record cannot cite a fragment this page does not render.
 */
```

### app/routes/projects.tsx:111 (CONTRACT, shortened)

header: what omitting the export cost; the citation stays on one line.

```tsx
/**
 * /projects IS EDGE-CACHED NOW, and was the only public page that was not.
 *
 * It exported no headers() at all, so it fell through to hard rule 8's
 * uncached default in workers/app.ts and every reader paid an origin hit for a
 * page whose body is identical for all of them. Recorded in core.md as a known
 * gap; the shared helper is what closes it, and using the helper rather than a
 * fifth copy is what stops the Vary line being dropped here later.
 */
```

### app/routes/projects.tsx:134 (CONTRACT, shortened)

header: why it is un-nonced.

```tsx
/**
 * ItemList, one entry per project.
 *
 * UN-NONCED, deliberately, on the measured asymmetry this repo already relies
 * on for the article and home page payloads: `script-src` does not gate
 * `application/ld+json`, because it is data rather than an executable script.
 * Adding a nonce here would imply a protection that is not the one doing the
 * work, and would diverge from the three payloads already shipping.
 */
```

### app/routes/projects.tsx:154 (WHY, shortened)

the closed vocabulary; the six-of-seven story goes to the history document.

```tsx
/*
         * THE TYPE IS DECLARED PER ENTRY, since the roster page joined this
         * list. Every entry used to be a SoftwareApplication with an
         * applicationCategory of WebApplication, which was true of six things
         * and false of the seventh: a roster page on this site is a page, and
         * telling a machine it is an application is a lie that costs nothing
         * to avoid. The vocabulary is closed and the gate holds it closed.
         */
```

### app/routes/projects.tsx:175 (CONTRACT, shortened)

header: one transformation in one place, and the fail-closed rule.

```tsx
/**
 * One citation, rendered as an ordinary link.
 *
 * THE THREE KINDS DIFFER ONLY IN HOW THE HREF IS BUILT, and that is why they
 * are a kind rather than three fields. A post ref is a SLUG, not a path: the
 * manifest cannot carry `/blog/<slug>` because the gate has to check the slug
 * against the built corpus, and a path would make it strip the prefix back off
 * to do so. One transformation, in one place, here.
 *
 * FAILS CLOSED on an unknown kind. Rendering the bare label would leave a
 * citation on the page pointing nowhere, which is the silent failure the
 * anchor discipline in `projects-page.mjs` exists to prevent, wearing a
 * different hat.
 */
```

### app/routes/projects.tsx:199 (CONTRACT, shortened)

header: why it is its own component; the type-error account goes to the history document.

```tsx
/**
 * The line under the metric saying where its number came from.
 *
 * ITS OWN COMPONENT so the union narrows. Written inline, TypeScript could not
 * discriminate `derived?: undefined` from `derived: string` through a property
 * of a property, and `asOf` stayed `string | undefined` inside the branch that
 * had already excluded the derived case. Binding the metric to one parameter
 * and testing it directly is what makes both branches exhaustive, and the type
 * error was a real one rather than a nuisance: it was the compiler saying the
 * two shapes were not actually being told apart.
 *
 * SAME ELEMENT CLASS EITHER WAY. The two forms are one channel, and giving the
 * derived line its own treatment would read as a different kind of fact.
 */
```

### app/routes/projects.tsx:253 (CONTRACT, shortened)

the silent failure this prevents.

```tsx
// The id IS the search record's anchor, from the one definition
              // in projects-page.mjs. A record citing a fragment the page does
              // not render still returns a hit and scrolls nowhere, silently.
```

### app/routes/projects.tsx:267 (CONTRACT, shortened)

the two forms and why the derived one carries no date.

```tsx
/*
                    THE PROVENANCE LINE, one shape per metric form.

                    A dated metric gets a <time> element, so the date is
                    machine-readable as well as rendered; rule 2 does not apply,
                    this is not a link. A DERIVED metric gets a plain span
                    saying so, and deliberately carries no date: the value was
                    computed by this build, so a date would only record when a
                    human last looked, which is a claim that rots while the
                    number beside it stays true.

                    Same element class either way, so the two read as one
                    channel rather than as two treatments.
                  */
```

### app/routes/projects.tsx:288 (CONTRACT, shortened)

why the field is optional.

```tsx
/*
                  WHAT IS TECHNICALLY NOTABLE, and it is optional on purpose.

                  Several projects here are documented nowhere public, so there
                  is no source this list could be written from that is not
                  somebody's recollection. A card with no notable list is
                  therefore the honest shape for those, exactly as a card with
                  neither link renders no link list rather than an empty row.
                */
```

### app/routes/projects.tsx:320 (CONTRACT, shortened)

the binding rule and the empty-list rule.

```tsx
/*
                  Bare-text links, so binding rule 2 applies and they underline.
                  The base `a` rule already does it; nothing here removes it.
                  A card with neither link renders no list at all rather than an
                  empty row, which is the honest shape for the unlinked tier.
                */
```

### app/routes/projects.tsx:341 (CONTRACT, shortened)

why the heading exists and why it is an h3.

```tsx
/*
                  THE EVIDENCE, last, under its own heading.

                  A heading rather than a bare list, because this is a claim
                  about the card above it and an unlabelled row of links reads
                  as navigation. It is an h3 under the card's h2, so the
                  document outline stays ordered and a screen reader reaches it
                  as part of the project rather than as a sibling of it.
                */
```

## app/routes/publications.$slug.tsx

### app/routes/publications.$slug.tsx:36 (CONTRACT, shortened)

header: the slash rule and the DOI slug; Scholar's expectation goes to the history document.

```tsx
/**
 * ONE PAGE PER PAPER, which is the whole reason this route exists.
 *
 * Google Scholar's technical guidelines: "Each paper must have its own unique
 * URL in order for it to be included in Google Scholar", and a browse page
 * listing many papers is explicitly not that. The July build had a good index
 * and no per-paper page, so none of these were indexable from this site: they
 * are in Scholar through their publishers, and what this adds is a clean
 * self-hosted record, not a ranking change. That expectation is ruling 63's and
 * is worth keeping in view before anybody measures this against Scholar.
 *
 * ## THE URL ENDS IN A SLASH, AND IT IS NOT A STYLE CHOICE
 *
 * `citation_pdf_url` "must refer to a file in the same subdirectory as the HTML
 * abstract". `/publications/<slug>` has the subdirectory `/publications/`;
 * `/publications/<slug>/` has `/publications/<slug>/`, which is where the PDF
 * sits. Only the second satisfies the rule. The slashless spelling redirects in
 * the gateway so there is one URL rather than two. Grounds on `paths.mjs`.
 *
 * ## THE SLUG IS THE DOI, NOT THE CURATED ID
 *
 * `edwards-2025-godfather` would read better than `10-1128-mra-00888-24`. It is
 * also a name somebody chose, and a name can be chosen again: the July rename
 * plan retitled these twice before freezing. A publication URL that is
 * re-decidable will eventually be re-decided, after Scholar has indexed it, and
 * a correction takes six to nine months. A DOI cannot be re-decided.
 */
```

### app/routes/publications.$slug.tsx:77 (CONTRACT, shortened)

why the 404 costs nothing.

```tsx
/*
   * 404 out of the loader, which is the ordinary shape here. There is no
   * database read to save: the map above is the corpus, so an unknown slug is
   * known to be unknown before anything is fetched.
   */
```

### app/routes/publications.$slug.tsx:97 (CONTRACT, shortened)

why the list is committed and why both numbers travel; the credit cost goes to the history document.

```tsx
/*
     * WHO CITES THIS, from the committed artifact rather than from OpenAlex at
     * request time. The grounds are in scripts/fetch-cited-by.mjs: the list is
     * 55 KB across the corpus, it needs a 10-credit filter query where a count
     * needs a 1-credit lookup, and it is evidence, so it carries the date it was
     * read rather than pretending to be current.
     *
     * `total` and the list length are BOTH carried, because one paper here has
     * 52 citing works against a cap of 50 and the page has to be able to say so.
     */
```

### app/routes/publications.$slug.tsx:113 (CONTRACT, shortened)

header: the no-exemption rule and the description; the refused first attempt goes to the history document.

```tsx
/**
 * The head: the site's social set, plus the citation tags.
 *
 * ## `pageMeta` FOR THE SOCIAL HALF, AND WHY THAT WAS NOT THE FIRST ATTEMPT
 *
 * This was written as a hand-assembled array, on the reasoning that a paper
 * page needs a repeated `citation_author` tag and `pageMeta` has no business
 * knowing about those. `check:invariants` section 13 refused it, and the
 * section is right: five pages once ended up with five different partial
 * social sets, each missing a different edge, and every one of them was a page
 * whose author thought it was special. The repair was to teach `pageMeta` the
 * one thing this page actually needed differently, `og:type: article`, rather
 * than to take an exemption.
 *
 * The citation tags stay here. They are not social metadata, no other page has
 * them, and they are built by a module `check:features` calls, so the tag set
 * on the page and the tag set the gate asserts cannot come apart.
 *
 * ## THE DESCRIPTION IS THE ABSTRACT'S OPENING
 *
 * Not a written line. A paper's own first sentences are the best short
 * description of it that exists, and hand-writing 36 of them would produce 36
 * worse ones. Cut at a word boundary, the way a search engine cuts.
 */
```

### app/routes/publications.$slug.tsx:170 (CONTRACT, shortened)

why no collapse here.

```tsx
/*
   * EVERY AUTHOR, VISIBLE, with no collapse. The index collapses around the
   * owner because it shows 33 records at once; this page shows one, and the
   * author list of a paper is part of the record rather than a detail to hide.
   * It is also what `citation_author` asserts, and a page whose visible content
   * disagrees with its own meta tags is the thing Scholar penalises.
   */
```

### app/routes/publications.$slug.tsx:241 (CONTRACT, shortened)

the no-script property and why the query is the title; the gate reference stays.

```tsx
/* ASK, AS A LINK. The URL is built by `paperAskUrl`, which carries
                the reasoning and the measurement: /search renders keyword
                results from its loader and mounts the Ask affordance as an
                enhancement, so a link with the query already in `q` works both
                with scripting and without it, and nothing here is a second
                implementation of Ask. The query is the quoted title alone,
                because the classic index ANDs its terms and an interrogative
                wrapped around the title returned zero results.
                check:publications exercises that function over every record and
                asserts this route calls it. */
```

### app/routes/publications.$slug.tsx:254 (CONTRACT, shortened)

the provenance rule and the zero rule.

```tsx
/* The count, LABELLED with its source and the date it was read.
              A bare number is a claim with no provenance and no age, and this
              one moves without a deploy. Rendered only at 1 or more, so a cold
              cache shows nothing rather than a zero that looks measured. */
```

### app/routes/publications.$slug.tsx:269 (CONTRACT, shortened)

why the cap is stated and why the link is conditional.

```tsx
/*
            WHO CITES THIS, under the count, which is where ruling 63 puts it.

            Newest first and capped, and the cap is STATED when it bites: one
            paper here has 52 citing works against a cap of 50, and a list that
            silently showed 50 would be claiming completeness it does not have.

            A plain list rather than a table. Each entry is a sentence (title,
            venue, year) and a link where a DOI exists; three of the 263 have no
            DOI, which is why the link is conditional rather than assumed.
          */
```

### app/routes/publications.$slug.tsx:307 (CONTRACT, shortened)

the placement rule and the role choice; the dark-path reasoning goes to the history document.

```tsx
/*
            A RETRACTION OR CORRECTION, ABOVE EVERYTHING IT APPLIES TO.

            Above the plain-language line, the abstract and the PDF link,
            because a reader who stops after the first paragraph must not stop
            before this one. Rendered only when the record carries a notice, and
            no record does today: the field is dark on purpose, and
            `update-notice.mjs` carries the reason for building a dark path
            cold rather than on the day it is needed.

            `role="status"` rather than `alert`: an alert interrupts a screen
            reader mid-sentence, and this is part of the document rather than
            something that just happened. The link goes to the NOTICE, which has
            its own DOI and its own authors, and not to the paper's landing
            page.
          */
```

### app/routes/publications.$slug.tsx:331 (CONTRACT, shortened)

why it sits above the abstract.

```tsx
/*
            THE PLAIN-LANGUAGE LINE, ABOVE THE ABSTRACT.

            Above rather than below, because it is for the reader who will not
            read the abstract: a sentence saying what the paper found, in words
            that do not assume the field. Rendered only where one exists, which
            is why an absent summary leaves no empty heading behind.

            Not styled as a quotation or a callout. It is the author speaking
            plainly about his own work, and a decorative frame would make it
            look like something lifted from somewhere else.
          */
```

### app/routes/publications.$slug.tsx:347 (CONTRACT, shortened)

why it is never inside a details.

```tsx
/* VISIBLE, never inside a details element. The index collapses
              abstracts because it lists 33 of them; this page exists to BE the
              abstract, and a crawler that has to open a disclosure to find the
              text is a crawler that does not find it. */
```

### app/routes/publications.$slug.tsx:358 (CONTRACT, shortened)

the placement reason and the refusal rule.

```tsx
/*
            THE DATA BEHIND THE PAPER, under the abstract rather than in the
            link row above it.

            The link row is where a reader goes to READ the paper; this is where
            they go to check it, which is a different errand and belongs after
            the abstract has said what there is to check. Rendered only for the
            papers whose journal made the authors say what they deposited, which
            is the twelve announcements.

            Each accession is labelled with its registry and links there
            directly. `accessionUrl` refuses a kind it has no registry for
            rather than guessing one, because an SRA run under a nuccore URL is
            a 404 that looks like a working link.
          */
```

## app/routes/search.tsx

### app/routes/search.tsx:34 (CONTRACT, shortened)

header: why the facets are parameters too.

```tsx
/**
 * Reads the query parameters this route understands.
 *
 * `type`, `tag` and `year` are separate parameters as well as query operators,
 * so a facet chip can be an ordinary link rather than a second filter language
 * that only the form knows how to speak. Both feed the same parse.
 */
```

### app/routes/search.tsx:52 (CONTRACT, shortened)

header: why middleware, and what the representation is; the measurement goes to the history document.

```tsx
/**
 * JSON negotiation runs as middleware, not in the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData` and the first property read 500s. Measured
 * on this repo 2026-07-28. Middleware is the layer allowed to short-circuit,
 * which is the same mechanism `/blog/:slug` uses for its markdown twin and the
 * same one the /admin gate uses.
 *
 * The JSON representation is the SAME query against the SAME index. It is an
 * agent affordance, not a second search, and it is documented in llms.txt.
 */
```

### app/routes/search.tsx:86 (CONTRACT, shortened)

why the flag rides on the response.

```tsx
// Whether Ask exists, as a fact about this deployment. The palette
          // reads it off the response it already makes, so the Ask affordance
          // costs no extra request and vanishes with the binding rather than
          // needing a second switch to turn off.
```

### app/routes/search.tsx:112 (WHY, shortened)

kept long: a measured prohibition whose failure is the wrong document served to a cookied reader.

```tsx
// NEVER STORED, and this is not a performance oversight. Do not
          // "optimise" this back to SHARED_CACHE_CONTROL.
          //
          // `/search` sets `Vary: Accept, Cookie`. Measured 2026-08-05 with a
          // paired control on fresh URLs: with only the HTML representation in
          // play, a cookie-bearing request correctly BYPASSes and is downgraded
          // to `private, no-store` by `workers/app.ts`. After ONE request for
          // this JSON representation, that same request gets a `HIT` and
          // `public` instead, because the edge answers from the stored
          // cookieless variant and the Worker never runs. A reader with
          // `theme=dark` then receives the light document. `Accept` separates
          // storage correctly; the `Cookie` dimension is what collapses once a
          // second variant exists under the key.
          //
          // A response that is never stored cannot become that second variant.
          // The fix belongs here rather than on the HTML side, which is
          // measured correct while it is the only representation.
          //
          // The trigger is advertised: llms.txt tells agents this exact URL
          // returns JSON for `Accept: application/json`.
          //
          // Documented repair is a Cache Rule with `bypass` on `Cookie`, which
          // needs a proxied zone, so it is a DNS-cutover item. Citations in
          // `media.$.ts`.
```

### app/routes/search.tsx:153 (CONTRACT, shortened)

when a zero state is warranted.

```tsx
// Only ask for suggestions when there is a query that found nothing. A blank
  // /search is a search box, not a failure, and does not need consoling. A
  // filter that matched nothing (tag:typo) is a failure and does.
```

### app/routes/search.tsx:159 (CONTRACT, shortened)

the prohibition on waiting for the AI layer.

```tsx
// A boolean, computed from the binding's presence. NOT an AI call: the loader
  // that renders classic results must never wait on the AI layer, so all the
  // server does here is say whether the affordance exists.
```

### app/routes/search.tsx:167 (CONTRACT, shortened)

the cache dimension, why Accept stays, and the tag.

```tsx
// Publicly cacheable for EVERY reader since 2026-09-05: the theme is a
    // dimension of the cache key rather than a Vary. `Accept` STAYS, because
    // this URL really does serve a JSON representation as well as HTML and a
    // cache that ignored that would hand one to the other.
    //
    // Tagged `posts`: the results are the corpus, so a publish must move them.
```

### app/routes/search.tsx:179 (CONTRACT, shortened)

header: why the canonical drops the query; the hand-written history goes to the history document.

```tsx
/**
 * ## THE SHARED BUILDER, AND A CANONICAL THAT DROPS THE QUERY
 *
 * This page was the last one writing its own social tags by hand, which is the
 * shape `pageMeta` exists to end: it had a title and a description and no
 * canonical, no `og:*` and no card, so a shared search link rendered as a bare
 * URL. It takes the builder now like every other page.
 *
 * **THE CANONICAL IS `/search`, WITHOUT THE QUERY, DELIBERATELY.** Every
 * distinct `?q=` is a distinct URL for what is one page of the site, and there
 * are unboundedly many of them. Pointing all of them at the bare path says
 * "this is the search page" rather than minting a canonical per query. The
 * `noindex` below already keeps results out of an index; the canonical is what
 * a crawler that ignores it, or a social card, or a link shortener, reads.
 *
 * `noindex, follow` survives the merge and is still the ruling: results pages
 * are not content, and the links out of them are worth following.
 */
```

### app/routes/search.tsx:224 (CONTRACT, shortened)

why a filter change resets the page.

```tsx
// Changing a filter always returns to the first page. Staying on page 4 of a
  // narrower result set is how a filter appears to return nothing.
```

### app/routes/search.tsx:239 (CONTRACT, shortened)

header: why the union keying is better than a gate; the colophon defect goes to the history document.

```tsx
/**
 * Keyed by the UNION, not by `string`, and there is deliberately no fallback.
 *
 * This was `Record<string, string>` with `?? reason` at the call site, which is
 * byte-for-byte the shape that shipped the colophon defect: a fifth
 * `MatchReason` would typecheck clean and render the raw enum to readers, and
 * every surface would agree because every surface read the same wrong value.
 * Hard rule 13, and it was the last live instance of that class.
 *
 * Typed this way, adding a reason to `MatchReason` without adding a label here
 * is a TYPECHECK failure at the point of the omission. That is strictly better
 * than a lint or a gate: it cannot be skipped, it names the missing key, and it
 * fails before anything is built.
 */
```

### app/routes/search.tsx:314 (CONTRACT, shortened)

what isEmpty does and does not mean.

```tsx
// `isEmpty` means no matchable TEXT, which is not the same as no request. A
  // bare year or a tag chip clicked from an empty box is a real query answered
  // by the browse path, and it still has a count and a result list to render.
```

### app/routes/search.tsx:398 (CONTRACT, shortened)

the no-script guarantee and the absent-binding case.

```tsx
/* Ask mode, search Layer 2.
            Rendered ABOVE the results and after them in source order is not the
            question: what matters is that the results below were produced by
            the loader and are already on screen. This is an empty container and
            a script tag. With scripting off it stays empty and the page is
            byte-identical to the pre-Layer-2 page apart from these two inert
            elements. With the binding absent it is not rendered at all. */
```

### app/routes/search.tsx:405 (WHY, shortened)

the prohibition on offering a control with nothing to do; the empty-string path goes to the history document.

```tsx
/*
            ASK NEEDS A QUESTION, NOT A FILTER.

            The condition was `hasQuery`, which is
            `!parsed.isEmpty || hasFilters(parsed)`. So `/search?year=2026` with
            no `q` mounted the Ask affordance and handed it `params.q ?? ""`, an
            EMPTY STRING. The button appeared, a reader clicked it, and it
            returned immediately because there was no question to answer. That is
            a control that looks live and does nothing.

            Filters narrow a list; Ask answers a sentence. A year is not a
            sentence, and there is nothing sensible for it to generate. So the
            affordance is gone on filter-only queries rather than being made to
            fail more gracefully: the honest fix for a control with nothing to do
            is not to offer it.

            The trimmed check also covers `?q=` and `?q=%20`, which reached the
            same empty string by a different route. */
```

### app/routes/search.tsx:435 (CONTRACT, shortened)

the one-query rule.

```tsx
/* Facets are links, never click handlers, and their counts come
                from the same query that produced the list, so a chip only ever
                promises results a click would actually return. */
```

## app/components/admin/preview-links.tsx

### app/components/admin/preview-links.tsx:5 (CONTRACT, shortened)

header: the capability rule and the two gate-visible shapes; the nesting account goes to the history document.

```tsx
/**
 * The drawer's preview-link section. Feature G.
 *
 * ## The token is a CAPABILITY, so it is never printed
 *
 * Anyone holding the full URL can read the draft. That makes it the same class
 * of thing as a password, and it gets the same treatment: the list prints SIX
 * characters, which is enough to tell two links apart and to know which one you
 * are revoking, and the whole value leaves the page only through the copy
 * control. A list that printed the URL would put every live capability for this
 * post on screen at once, in something the author might screen-share.
 *
 * ## Why the buttons point at forms that are somewhere else
 *
 * The drawer is a `<dialog>` INSIDE the editing `<Form>`, so a form declared
 * here would be a nested form and the browser would drop it. Association is by
 * the `form` attribute instead, exactly as the delete control already does, and
 * the forms themselves live in the edit route beside the delete form.
 *
 * ONE FORM PER LINK, each carrying its token as a hidden field, rather than one
 * form and a `name="token"` on each button. Both work. The first keeps every
 * revoke submission IDENTICAL in shape, so `check:admin-ui` records one tuple
 * whether the post has one preview link or five, and the fixture describes the
 * requests the page can issue rather than how many rows it happens to hold.
 *
 * THE INTENT IS ON THE BUTTON, not in a hidden field, and that is the delete
 * control's idiom copied deliberately. `check:admin-ui` records a hidden field's
 * NAME and not its value, so an intent carried as `<input type="hidden"
 * name="intent" value="preview-link">` would reach the fixture as the bare word
 * `intent` and the two controls would be told apart only by whether a `token`
 * field happened to be present. The dispatch key belongs where the gate can see
 * its value.
 */
```

### app/components/admin/preview-links.tsx:54 (CONTRACT, shortened)

header: why this is not rule 13's class, and why the marker is absent; the gate exchange goes to the history document.

```tsx
/**
 * When a link expires, or a phrase saying that cannot be read.
 *
 * ## NOT HARD RULE 13'S CLASS, and the gate is why that had to be settled
 *
 * The first version of this line coalesced with `??` and carried rule 13's
 * call-site marker. `check:invariants` refused it, because that rule names
 * exactly two such call sites and a third is an unrecorded exception. The gate
 * was right to stop, and the MARKER was the mistake rather than the behaviour:
 * the marker is deliberately not repeated here, since the gate counts files
 * carrying it and a comment about one would read as a third.
 *
 * Rule 13's class is a fallback that substitutes a PLAUSIBLE value for a
 * failure, so the failure stops being visible. This does the opposite: it
 * says out loud that the date could not be read. Nothing downstream consumes
 * it and no decision is taken on it; it is the rendering of the null case,
 * which every label needs and which is not a fallback at all.
 *
 * The shape is the one that shipped here before the three formatters were
 * consolidated: a branch, not a coalesce. Behaviour is unchanged in both
 * directions, which is the point.
 *
 * The substitution lives HERE and not inside `longDateUTC` because the blog
 * pages want the null: they omit the whole line when there is no date, and a
 * formatter that answered with a phrase would have taken that choice away
 * from them. That is how the three copies diverged in the first place.
 */
```

### app/components/admin/preview-links.tsx:99 (CONTRACT, shortened)

keeps the measured bound and the asymmetry; the production measurement goes to the history document.

```tsx
/*
        THE REVOKE CLAUSE IS A MEASURED BOUND, NOT A FIGURE OF SPEECH.
        MEASURED on production 2026-08-15, on the first real use: a revoked link
        was still serving the draft on the first check after the revoke landed,
        and was refusing by the next check about a minute later.

        The mechanism is KV, and it is not a defect to fix here. `APP_KV.get`
        takes a default 60 second edge read cache, and KV is eventually
        consistent besides, so a colo that has already read the record keeps
        serving it until that cache lapses. Sub-minute global revocation is not
        purchasable on KV at any price, so the mechanism stays and the SENTENCE
        changes. It said "the moment you revoke it", which was measurably false
        by up to a minute.

        PUBLICATION IS STILL IMMEDIATE and the asymmetry is worth knowing rather
        than smoothing away. Publishing revokes the tokens, but that is not what
        makes it instant: the read path re-asks D1 for `status = 'draft'` on
        every request, and that read is not KV-cached. So a published post stops
        previewing at once even if the KV record is still warm somewhere. That
        is exactly the belt the read path was built with, doing its job.
      */
```

### app/components/admin/preview-links.tsx:127 (CONTRACT, shortened)

why it is shown once.

```tsx
/*
         * The one place the full URL is VISIBLE rather than merely copyable.
         *
         * It is shown once, on the response to the request that minted it,
         * because an author who cannot see what they just made has to trust a
         * copy button that may have failed. It is not shown again: reload the
         * page and it is behind the copy control with every other link.
         */
```

### app/components/admin/preview-links.tsx:191 (CONTRACT, shortened)

header: why it is not the shared button, and the stated difference; the rename goes to the history document.

```tsx
/**
 * Copies the URL, and says so.
 *
 * SCRIPT ONLY, and that is permitted here rather than an oversight: the admin
 * plane is exempt from the progressive-enhancement law, and the same control
 * already exists on the slug field. Without script the button does nothing,
 * which is the state the whole editor is in.
 *
 * ## NOT `~/components/admin/media-copy-button`, AND NOT MERGED INTO IT
 *
 * That one is the media library's, and the difference is not styling taste. It
 * renders `.btn-ghost.media-copy` as a GLYPH, sized against a measurement made
 * on a 131px grid row; it reports through `toast()` from `media-keyboard`,
 * which is the media page's live region; and it holds no React state at all,
 * because that page carries none by ruling and uses a data attribute plus a
 * `::after`. This is a text button in a `.row-action` list on a page that
 * already holds state.
 *
 * Pointing this at the shared one would import the media page's keyboard and
 * toast module into the editor to get a glyph styled for a grid this panel does
 * not have. The mechanism they share is one `navigator.clipboard.writeText`
 * call, which is not a fact that needs an owner.
 *
 * **RENAMED FROM `CopyButton` ON 2026-08-24.** What WAS worth removing is the
 * name: two different components called `CopyButton`, one exported and one
 * private, in the same directory, is the collision that gets resolved by
 * whichever import the editor happens to have.
 *
 * STATED DIFFERENCE, not fixed here because it is a change to how the editor
 * behaves rather than a deduplication: the shared button announces through a
 * live region and resets after 1500ms, and this one changes its own label
 * permanently and announces nothing until the control is refocused.
 */
```

## app/routes/colophon.tsx

### app/routes/colophon.tsx:31 (CONTRACT, shortened)

header: the four standing rules; the ruling citation and the evidence go to the history document.

```tsx
/**
 * The colophon. Ruling: colophon-page.md, 2026-08-05.
 *
 * **The URL is /colophon and the title is "How this site is built", and the
 * split is deliberate.** A colophon is an IndieWeb convention with a lineage,
 * and machines and tooling expect the conventional top-level path. But
 * "colophon" is a word many readers do not know, so the TITLE takes the
 * legibility while the URL takes the convention. Do not swap them.
 *
 * **Everything here is READ FROM A GENERATED ARTIFACT.** `content/generated/
 * stack.json` is emitted by `build:stack` from the repo's own configuration and
 * reconciled by `check:stack` in both directions. Nothing on this page is typed
 * out: no binding name, no version, no migration, no gate. That is the whole
 * design, on the ruling's evidence rather than on taste, because a hand-written
 * reference page has a 100% chance of being wrong within a quarter and this
 * site has already published three quantitative claims that went wrong.
 *
 * If you find yourself adding a fact here, it belongs in `stack-notes.json`
 * where the gate can reconcile it, or in the generator where it can be derived.
 *
 * **FLAT, no filtering, no facets, no taxonomy.** Ruled: roughly ten components
 * and a few dozen entries do not need a menu, and the right axes will be
 * obvious from having the data rather than from guessing now.
 *
 * **NOTHING CLIENT-SIDE, and there is nothing to enhance.** Hard rule 9 makes
 * every public reading route server-complete without script; this one is
 * server-complete because it is entirely static markup over a build artifact.
 * There is no interaction to progressively enhance, which is why this file
 * imports no `~/enhance` chunk and declares no fallback: the fallback and the
 * page are the same thing.
 *
 * **Styled by `.prose`, deliberately**, exactly as the Roster page is. It
 * already carries the ratified treatment for h2, dl, ul and code, and
 * `check:contrast` already covers those, so this page needs no CSS of its own.
 * A `.colophon-*` block would be per-page rules in a large stylesheet for
 * markup that prose already describes.
 */
```

### app/routes/colophon.tsx:77 (CONTRACT, shortened)

header: the silent failure this prevents.

```tsx
/**
 * The heading and lead for a section, BOTH read from the descriptor.
 *
 * No `id` or heading text is typed in this file. `recordsForPage` reads the
 * same list, so a renamed section changes the page and its search records
 * together, and a record can never point at a fragment the page does not
 * render. That failure would be silent: the hit still appears and scrolls
 * nowhere.
 */
```

### app/routes/colophon.tsx:105 (CONTRACT, shortened)

what the flag means and why it is not hand-kept.

```tsx
/**
   * False when an anonymous GET of this route does not produce a page. The
   * anchor still NAMES the route; it just stops pretending it is a
   * destination. Absent means it is one, which is the common case.
   *
   * `check:features` derives the same answer from the route module and
   * refuses a declaration that disagrees, so this is not a hand-kept flag.
   */
```

### app/routes/colophon.tsx:116 (CONTRACT, shortened)

header: why a Map, and why there is no taxonomy.

```tsx
/**
 * Features grouped by component, in the order the data file declares them.
 *
 * A Map preserves insertion order, so the grouping is the author's rather than
 * alphabetical. That is the closest thing this page has to structure, and it is
 * deliberately all it has: the ruling forbids building the taxonomy before the
 * data exists, on the grounds that facets over a few dozen entries are
 * decoration and the right axes will be obvious from having the data.
 */
```

### app/routes/colophon.tsx:135 (CONTRACT, shortened)

header: the page's best property, and why a gate anchor is not a link.

```tsx
/**
 * One anchor, rendered as the thing that proves the claim.
 *
 * **This is the page's best property**, per the ruling: every claim links to
 * its evidence. A route anchor becomes a real link, so a reader can go and see
 * it. A gate or assertion anchor NAMES the script rather than linking, because
 * the scripts are not served; the name is enough to find it in the repository,
 * and `check:features` is what guarantees the name still resolves to something.
 *
 * A decision anchor is context and says so. It cannot be verified offline,
 * which is why the gate refuses to let one stand as a feature's only anchor.
 */
```

### app/routes/colophon.tsx:149 (CONTRACT, shortened)

the two reasons and the prohibition; the audit measurement goes to the history document.

```tsx
/*
     * TWO REASONS A ROUTE IS NOT A DESTINATION, and both make it plain text.
     *
     * A PARAMETER SEGMENT. `/blog/:slug` is a declaration, and there is no
     * one URL it stands for.
     *
     * AN ANONYMOUS GET THAT IS NOT A PAGE, `anonymousGet: false`. Measured in
     * the pre-cutover audit 2026-09-11 (P1-22): of 203 internal URLs swept,
     * the only non-200s on the whole site were `/api/operator` (401) and
     * `/search/ask` (405), and both were reached as `href`s FROM THIS PAGE.
     * The colophon's best property is that every claim links to its evidence,
     * and two of those links were the only broken links a crawler could find.
     *
     * A link a reader cannot follow is worse than no link: it reads as
     * evidence until you click it. The path is still NAMED, in the same
     * `<code>` a gate anchor gets, because the name is what makes the claim
     * checkable and the anchor never needed to be clickable to do that.
     */
```

### app/routes/colophon.tsx:216 (CONTRACT, shortened)

the one-owner rule for the title.

```tsx
/* THE TITLE IS READ, NOT TYPED. meta() and recordsForPage both use
              COLOPHON_TITLE, and this h1 was the one place it was a literal, so
              renaming the page would have changed the tab, the search record and
              the social card while the heading kept the old words. That is the
              exact drift colophon-sections.mjs exists to prevent, inside the
              page it protects. */
```

### app/routes/colophon.tsx:310 (CONTRACT, shortened)

one constant, and why it is prose.

```tsx
/*
              The security tradeoff, rendered from the SAME constant the search
              record is built from, so the page cannot describe it one way and
              the index another. Prose, not a table: it is an argument, and a
              reader deciding whether to trust the claim needs the reasoning
              rather than a row.
            */
```

### app/routes/colophon.tsx:322 (CONTRACT, shortened)

one constant, and why it reads as prose.

```tsx
/*
              The AI disclosure, rendered from the SAME constant the search
              index is built from, exactly as the security tradeoff above is.
              Plain paragraphs: this is the section a reader is most likely to
              have arrived for, and it should read as prose rather than as a
              compliance notice.
            */
```

### app/routes/colophon.tsx:339 (CONTRACT, shortened)

the never-hue-alone rule.

```tsx
/* The status is spelled out in TEXT, not carried by colour
                      or by position. design-tokens usage rule 1: hue is never
                      the sole channel, and a reader who cannot see the styling
                      still gets the distinction. */
```

### app/routes/colophon.tsx:353 (CONTRACT, shortened)

why each page names the other.

```tsx
/* The colophon says how the site is BUILT; /privacy says what it
              RECORDS. They are two halves of one question, and a reader who
              found either is likely looking for the other, so each names the
              other rather than leaving it to the footer. */
```

## app/routes/preview.$token.tsx

### app/routes/preview.$token.tsx:17 (CONTRACT, shortened)

header, kept long: the placement IS the control, plus the one-404 rule and the real-path claim.

```tsx
/**
 * A draft, shown to whoever holds the link. Feature G.
 *
 * ## WHY THIS ROUTE IS TOP LEVEL, AND WHY THAT IS THE SECURITY DESIGN
 *
 * The obvious placement is under the post route, as a query parameter or a
 * second path segment on `/blog/:slug`. That would be wrong, and not by a
 * little.
 *
 * `blog.$slug.tsx` exports `headers()` returning `SHARED_CACHE_CONTROL` with
 * `Vary: Accept, Cookie`. Workers Cache sits in front of this Worker and THE
 * CACHE KEY DOES NOT INCLUDE COOKIES. What makes that safe today is the
 * cookieless-only downgrade in `workers/app.ts`: a request that carries a cookie
 * gets `private, no-store` and is never stored, so the only variant that can
 * exist is the one for readers who are not signed in.
 *
 * **A reviewer holding a preview link carries no cookie.** They are exactly the
 * shape of request the downgrade does not fire for. Had the preview shared a
 * route with the public post, one unauthenticated preview fetch would have been
 * stored under a public cache entry and served to anyone who asked for that path
 * for the next ten minutes, with no session and no token. That is an unpublished
 * post on a shared cache, arrived at without anybody making a mistake in this
 * file.
 *
 * So the placement is the control. `PREVIEW_HEADERS` below has NO public branch
 * to reach: there is no condition under which this route emits a cacheable
 * response, because the alternative does not exist in the module. `Vary: Cookie`
 * is declared for correctness rather than as protection, since `no-store` has
 * already settled the question.
 *
 * ## Everything else
 *
 * The token is a lookup key, not a claim. The slug comes out of the KV record it
 * names and never out of the URL, so nothing a caller types selects a post.
 *
 * EVERY failure returns the same 404 the post route returns, byte for byte,
 * because `data("Not found", { status: 404 })` is the same call and the root
 * ErrorBoundary renders it identically. Unknown token, expired token, revoked
 * token, malformed token, deleted post, published post: one response. A caller
 * cannot learn whether a token ever existed, and cannot learn whether a slug is
 * a real post, because they never get to name a slug in the first place.
 *
 * The page renders through the REAL path: the same component `/blog/:slug`
 * renders, from the same projection, over the same stored `html` column that the
 * publish pipeline wrote. There is no second renderer and no preview-shaped
 * approximation of one, which is the only thing that makes "this is what will
 * publish" true rather than hopeful.
 */
```

### app/routes/preview.$token.tsx:66 (CONTRACT, shortened)

header: why the values are literals.

```tsx
/**
 * The three headers, as ONE declaration read by `headers()` and by the 429.
 *
 * `check:headers` parses this constant and compares it against its own
 * transcription of the ratification, which is why the values are literals here
 * rather than imported constants. Importing `SHARED_CACHE_CONTROL` is the exact
 * mistake a copy-paste from `blog.$slug.tsx` would make, and the gate is written
 * to name it.
 */
```

### app/routes/preview.$token.tsx:81 (CONTRACT, shortened)

header: why middleware, and what the ordering buys.

```tsx
/**
 * The rate limit, as middleware rather than as the first lines of the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData`, which 500s on the first property read. That
 * is measured and is recorded on `blog.$slug.tsx`, which uses middleware for the
 * same reason. Throwing would reach the ErrorBoundary and lose the headers.
 *
 * It runs BEFORE anything is looked up, so a refusal reveals nothing: at this
 * point the Worker has not read KV, has not read D1, and does not know whether
 * the token means anything.
 */
```

### app/routes/preview.$token.tsx:134 (WHY, shortened)

keeps why the field is passed and where the grounds live; the 500 and its dates go to the history document.

```tsx
/*
   * `mentions: []`, AND ITS ABSENCE WAS A 500 ON EVERY PREVIEW.
   *
   * MEASURED 2026-09-06, the first time anything drove this route: every
   * `/preview/:token` answered 500 with `TypeError: Cannot read properties of
   * undefined (reading 'length')` from `BlogPost`. It had been doing so since
   * `e839bfc` on 2026-09-04, and it shipped.
   *
   * The component reads `mentions.length` to decide whether to render the
   * section. `blogPostView` does not carry the field, deliberately and for the
   * reason recorded on the read in `blog.$slug.tsx`: a draft has no readers and
   * therefore no approved mentions, so the query has no business running here.
   * That reasoning is intact. What was missing is the SHAPE: the projection's
   * whole claim is that a reviewer sees what a reader would see, and a
   * component rendered against a payload missing a field it destructures does
   * not see anything at all.
   *
   * **TYPECHECK CANNOT SEE THIS AND WILL NOT START.** `preview.$token.tsx`
   * re-exports `blog.$slug`'s default export, so the component is typed against
   * THAT route's `loaderData` while being rendered with this one's. The
   * re-export is what makes the two pages provably identical and is also what
   * hides the mismatch, which is why the gate that found it is a browser
   * driving a seeded token (`check:browser`, section 4a) rather than `tsc`.
   *
   * Empty rather than read, and empty is the honest value: an unpublished post
   * has no approved mention by construction.
   */
```

### app/routes/preview.$token.tsx:173 (CONTRACT, shortened)

the belt-and-control split, and the two deliberate absences.

```tsx
/*
   * NOINDEX IN THE MARKUP AS WELL AS ON THE WIRE, and the redundancy is the
   * point. `X-Robots-Tag` is the control, because a crawler that never renders
   * still sees it and because a header cannot be stripped by anything between
   * here and the reader. The meta tag is the belt: it survives the page being
   * saved, re-served, or fetched by something that reads HTML and ignores
   * headers.
   *
   * NO CANONICAL, deliberately. Pointing at /blog/<slug> would name a URL that
   * 404s while the post is a draft, and pointing here would be asking to have
   * this indexed. The page also carries no og: tags: there is nothing to preview
   * and a link unfurling an unpublished title in a chat window is the leak this
   * feature exists to control.
   */
```

### app/routes/preview.$token.tsx:193 (CONTRACT, shortened)

header: why it is re-exported rather than wrapped.

```tsx
/**
 * THE SAME COMPONENT, not a copy of it and not a variant of it.
 *
 * Re-exported rather than imported and wrapped, so there is exactly one function
 * on this site that renders a post page. A wrapper would be a second place for
 * the two to differ, and the whole claim of a preview is that they cannot.
 *
 * It works because the loader above returns `blogPostView`'s output, which is
 * what `/blog/:slug`'s loader returns, from the same function.
 */
```

## app/routes/admin._index.tsx

### app/routes/admin._index.tsx:15 (CONTRACT, shortened)

header: the read-back rule, the one-reading rule and the nothing-invented rule; the July stub goes to the history document.

```tsx
/**
 * THE COCKPIT, REWIRED TO REAL INSTRUMENTS. Ruled 2026-08-25.
 *
 * What stood here was a status board typed for a fleet: an `AdminDataSource`
 * interface with a `provider` field naming Cloudflare, Vercel, Sentry, Recova,
 * Foxing and Capsid, a `stubSource()` helper, and a `SourceResult` union whose
 * third arm meant "placeholder data, real integration pending". Under it: one
 * card, reading "Auth / Single admin", whose green dot was a CONSTANT. It would
 * have rendered the same green with the session store unreachable, because
 * nothing on the page checked anything.
 *
 * The audits called it a stub and proposed deleting the page. That was the
 * wrong half. The page was hollow in July because there was nothing real to
 * show; August built the real things, and this is their human-readable view.
 *
 * ## EVERY NUMBER HERE IS A READ-BACK, NEVER A COPY. Rule 17.
 *
 * `runHealthChecks` is the same function `/api/health` runs and the scheduled
 * workflow polls. `syncStatus` is the same function the `sync_status` operator
 * tool runs. Neither is reimplemented and neither is wrapped in an admin-side
 * calculation, so this page cannot disagree with the alert that wakes Dustin at
 * 2am: they are reading one instrument.
 *
 * **The sentences are no longer the verdicts' own `detail` strings.** Ruling 54
 * moved the wording to `check-copy.mjs`, because a verdict's detail is written
 * for whoever has to repair the mechanism and names it in the source's terms:
 * "content drift 2: 2 sha-changed, 0 file(s) with no row". What did NOT move is
 * the numbers. `check-copy.mjs` owns nouns and verbs only and substitutes every
 * figure from the verdict's own `counts`, and where a check ships no counts its
 * `detail` is still what renders. Rule 17 holds: the instrument that measured a
 * value is still the only thing that states it.
 *
 * **The media index and the Ask index are not fetched again here.** They are
 * two of the four health checks, and calling `mediaIndexStatus` or
 * `askIndexStatus` a second time to render them separately would be a second
 * reading of the same fact on one page, free to disagree with the first.
 *
 * ## WHAT IS NOT SHOWN, AND WHY THAT IS THE RULE
 *
 * Nothing was invented to fill space. Deploy history, error rates, portfolio
 * sites and Capsid memory are absent because no instrument in this repo reports
 * them; the previous board rendered five such cards reading "unknown" with
 * hints ending in "pending", which is a roadmap wearing the costume of
 * instrumentation. A reader cannot tell a measured card from a decorated one at
 * a glance, so there are no decorated ones.
 *
 * ## IT COSTS REAL I/O, STATED RATHER THAN HIDDEN
 *
 * The health run lists the Ask index, lists R2 and reads D1; `syncStatus`
 * lists the repository's post directory and counts four stores. That is the price
 * of a page whose entire purpose is to be true at the moment it is read, and it
 * is why the two run CONCURRENTLY and why each carries its own `timed` mark: an
 * instrument only sees what it was threaded through, so the cost of this page
 * is readable off its own Server-Timing header rather than guessed at.
 *
 * This plane is never edge-cached and has one user.
 */
```

### app/routes/admin._index.tsx:77 (CONTRACT, shortened)

why concurrent.

```tsx
/*
   * CONCURRENT, because they share nothing. Serial, these two would add their
   * latencies for no reason: the health run touches AI Search, R2 and D1, and
   * `syncStatus` touches GitHub and D1, and neither reads the other's result.
   */
```

### app/routes/admin._index.tsx:107 (CONTRACT, shortened)

the one-array rule; the drifted wording goes to the history document.

```tsx
/*
   * ONE READ OF THE CHECKS FEEDS THE SENTENCE, THE NOTICE AND THE TABLE.
   *
   * Ruling 54 makes "the status sentence and the notice never disagree" a rule
   * because they were two computations and they drifted: the sentence read
   * "every check the scheduled poll runs, answered here at page load" while the
   * page under it showed a failing check. Both now come out of this array, and
   * the notice is rendered from `worst`, which is the same element the sentence
   * already described.
   */
```

### app/routes/admin._index.tsx:132 (CONTRACT, shortened)

the live-region prohibition.

```tsx
/*
        ONE NOTICE, AND ONLY WHEN SOMETHING IS WRONG. A standing condition is
        not news, so this is a named region rather than a live one: a `role`
        would announce it on every load to a reader who came here to do
        something else. The heading names it and the words carry the meaning,
        so rule 1 holds without the edge being asked to say anything alone.
      */
```

### app/routes/admin._index.tsx:160 (CONTRACT, shortened)

why there is one primary and where it posts.

```tsx
/*
            THE ONE PRIMARY ON THIS PAGE, and only because a repair exists.
            It posts to the route that ALREADY owns the intent: `/admin` has a
            loader and no action, and this pass does not give it one.
          */
```

### app/routes/admin._index.tsx:222 (CONTRACT, shortened)

why these two figures and not four cards.

```tsx
/*
        TWO FIGURES. What the repository holds and what the site is serving:
        those two can disagree, and the disagreement is why this panel exists.
        The search index and the bindings were two more cards of the same size,
        and neither has ever been the answer to a question anyone opened this
        page with, so they are one disclosure below.
      */
```

### app/routes/admin._index.tsx:269 (CONTRACT, shortened)

why an absent block is not evidence of health.

```tsx
/*
        DIVERGENCES: commits that landed while the site did not follow. An EMPTY
        list is the normal answer, so this renders only when there is something
        to say. `known: false` is a third state and is not an empty list: a
        store that cannot be read must say so rather than report zero, which is
        why the absence of this block is not evidence of health on its own.
      */
```

## app/components/admin/settings-drawer.tsx

### app/components/admin/settings-drawer.tsx:6 (CONTRACT, shortened)

the one-limit rule; the drifted pair goes to the history document.

```tsx
/*
 * ONE DESCRIPTION LIMIT, and it is the SERP number.
 *
 * This file carried its own DESCRIPTION_LIMIT = 160 while social-previews.tsx
 * truncated at SERP_DESCRIPTION_LIMIT = 155, so the drawer told an author they
 * were inside the limit at 158 characters and the preview beside it cut the
 * sentence. 155 wins because it is the number Google actually truncates at,
 * and because the preview is the surface the author believes.
 */
```

### app/components/admin/settings-drawer.tsx:18 (CONTRACT, shortened)

header: the platform choice and the form-association rule.

```tsx
/**
 * Everything about a post that is not the writing.
 *
 * Built on a real `<dialog>` opened with `showModal()`, which is the same
 * choice the command palette made and for the same reasons: the focus trap,
 * the Escape handling and the focus return are the platform's, not a
 * hand-rolled keydown handler that will be subtly wrong in a way nobody
 * notices. CLAUDE.md records that decision for the palette; this inherits it.
 *
 * The controls inside it belong to the EDITING form, which is outside the
 * dialog, so every one of them carries `form={formId}`. That is what lets the
 * drawer be a modal and still be part of the same submission: form association
 * in HTML is by attribute, not by containment. A closed dialog is
 * `display: none`, and display has no bearing on whether a control is
 * submitted, so the drawer's fields ride along whether or not it was ever
 * opened. Only `disabled` removes a field, and nothing here is disabled.
 */
```

### app/components/admin/settings-drawer.tsx:77 (CONTRACT, shortened)

absent is the whole contract.

```tsx
/**
   * The draft preview-link section, or nothing.
   *
   * ABSENT is the whole contract. A published post is handed no slot, so the
   * section does not render, so neither the create control nor any revoke
   * control exists on the page. The ruling says a published post offers NEITHER
   * intent, and the way that is held is by there being nothing to press rather
   * than by a disabled button, which submits nothing but still reads as an offer.
   */
```

### app/components/admin/settings-drawer.tsx:165 (CONTRACT, shortened)

the placement reason and the one-function rule.

```tsx
/*
          The two previews, directly under the field they are about, because the
          description is the one input in this editor whose effect is completely
          invisible from inside it. Both render from `postSocial`, the same
          function `blog.$slug.tsx`'s meta() calls, so they cannot drift from
          what the site actually emits.
        */
```

### app/components/admin/settings-drawer.tsx:226 (CONTRACT, shortened)

header: why the slug is read-only.

```tsx
/**
 * The slug, read-only once the post exists.
 *
 * It is the public URL and the filename, so changing it after the first save
 * would be a rename plus a redirect, which is not what a text input implies.
 * On an existing post it renders as a URL line with a copy button; only the
 * new-post flow gets an input, and that lives in the canvas rather than here.
 */
```

### app/components/admin/settings-drawer.tsx:273 (CONTRACT, shortened)

read-only rather than disabled.

```tsx
/* Still submitted, because the save path reads it. Read-only rather than
          disabled: a disabled field submits nothing, and dropping the slug
          would make every save look like a new post. */
```

### app/components/admin/settings-drawer.tsx:284 (CONTRACT, shortened)

header: the payload is unchanged.

```tsx
/**
 * Tags as chips, with autocomplete over the tags already used on the site.
 *
 * The submitted field is unchanged: one `tags` input holding a comma separated
 * list, exactly what `parseTags` has always split. The chips are a view of that
 * string, so the payload cannot drift from what the checkbox era sent.
 */
```

### app/components/admin/settings-drawer.tsx:419 (CONTRACT, shortened)

the component boundary and the alt rule.

```tsx
/*
        THE PICKER COMPONENT, not picker logic. Shape 3: the drawer renders it
        and takes a chosen object back, so the listing, the thumbnails and the
        empty state are the media module's and cannot drift from the library's.

        Picking also pre-fills ALT from the record, per ruling 2, and only when
        the field is empty: alt is contextual as well as intrinsic, so a
        description already written for this cover outranks the stored one.
      */
```

### app/components/admin/settings-drawer.tsx:465 (CONTRACT, shortened)

header: the same field in the same format, and the stated cost.

```tsx
/**
 * Publish date and schedule.
 *
 * The raw ISO text input is gone. What replaced it writes the SAME field in the
 * SAME format: a `datetime-local` control the author touches, and a hidden
 * `publishAt` carrying the ISO string the server has always received. The
 * visible control is deliberately unnamed so it cannot join the payload.
 *
 * The cost, stated rather than hidden: with scripting off the visible control
 * cannot update the hidden one, so a schedule cannot be CHANGED without script.
 * The hidden field still renders with the committed value, so an existing
 * schedule is preserved rather than silently cleared, which is the failure that
 * would actually matter.
 */
```

### app/components/admin/settings-drawer.tsx:500 (CONTRACT, shortened)

why the checkbox is unnamed; the radio-pair catch goes to the history document.

```tsx
/*
        A single UNNAMED checkbox, and both halves of that matter.
        A control with no `name` is never submitted, which keeps the schedule
        toggle out of the payload entirely: `publishAt` below is the only field
        the server sees, exactly as before. It was briefly a radio pair, and
        check:admin-ui caught that immediately, because a radio group needs a
        shared `name` to be a group and that name went straight into the
        request as `schedule-mode=on`.
      */
```

## app/components/site-header.tsx

### app/components/site-header.tsx:11 (CONTRACT, shortened)

header: the standing rules; every measured threshold and the probe story go to the history document.

```tsx
/**
 * Public site header. Brand plus the nav links the site currently earns.
 * It grows when there is a page to add, not in anticipation, so there is still
 * no disclosure widget and no mobile menu machinery.
 *
 * THIS IS THE FOURTH LINK, and the previous comment said the fourth is where
 * counting links stops and measuring starts. Measured 2026-08-14, and the
 * numbers are why Playground is here rather than in the footer:
 *
 *   header no-wrap threshold   3 links 537px   4 links 619px
 *   320px to 480px             identical: header 81px, wordmark on two lines
 *   nav overflow, page x-scroll   none at any width down to 320px
 *
 * The 619px figure is measured against THIS nav. A prediction of 629px was made
 * first from a probe anchor injected into the row, and it was 10px wide because
 * the probe rendered slightly broader than a real NavLink (nav content 413px
 * against the real 403px). Recorded because it is the general case: a simulated
 * element is not the element, so the threshold is re-measured after the link
 * actually lands, not before.
 *
 * The header is `flex-wrap: wrap`, on BOTH the header and the nav, and the only
 * media query touching it is `print`, so nothing here is breakpoint-dependent.
 * `public-chrome.css` carries the 320px measurement and the reason wrapping is
 * on both: on the nav alone the brand and the nav still compete for one line,
 * and on the header alone the nav stays an unbreakable row.
 *
 * At every real phone width the header was ALREADY two lines with three links,
 * so the fourth costs nothing there; it only moves the wordmark's two-line
 * threshold from 537px to 619px. That band is accepted (ruled 2026-08-14). A
 * disclosure widget would be client state on a page that has none, so it stays
 * refused: the row wraps onto a second line rather than overflowing.
 *
 * The FIFTH link is the next place to look, and the same measurement decides
 * it. Re-measure rather than reasoning from these numbers: they are a property
 * of the current label widths, and a longer word moves them.
 *
 * Roster's LABEL and its PATH deliberately disagree. The path is
 * /phage-discovery because that is the indexed legacy URL the Worker takes over
 * at cutover; the label is what the page is called. NavLink matches on the
 * path, so `aria-current` still lands correctly.
 *
 * The search entry point is an ordinary link to /search. With scripting on it
 * is upgraded in place into a button that opens the command palette; with
 * scripting off it stays a link and search still works. Nothing in the header
 * depends on the palette existing.
 *
 * THE LINK LIST MOVED TO `~/lib/nav`, because `SiteSpeculation` needs the same
 * paths and a second hand-written copy would drift silently: a link added
 * without a speculation entry still navigates, just slower. Four NavLinks
 * mapped from one array render exactly what four literals rendered.
 *
 * NO `prefetch="intent"` any more, removed 2026-08-26 with the unhydration
 * arc. The prop worked through React event handlers, which exist only on a
 * hydrated page, and the public plane no longer hydrates: the props had
 * become dead configuration that reads as an optimisation, which is the
 * dead-code-that-looks-alive class rule 4's hook gate exists for. Hover
 * prepayment is not lost, because it never came from here alone:
 * `SiteSpeculation` below declares the same header destinations as
 * speculation rules, which are DECLARATIVE and work without any script or
 * hydration, so the hover speculation this comment used to promise is still
 * delivered, by the mechanism that survives.
 */
```

### app/components/site-header.tsx:74 (CONTRACT, shortened)

why it reads no loader data.

```tsx
/*
   * NO LOADER READ SINCE 2026-08-29. This component called
   * `useRouteLoaderData` for exactly one value, the resolved theme, which it
   * handed to `ThemeToggle`. The single-button control reads the theme off
   * `<html data-theme>` through the cascade instead, so the header now renders
   * from its props and the route table alone and cannot disagree with the
   * document it sits in.
   */
```

### app/components/site-header.tsx:91 (CONTRACT, shortened)

why the nav is named.

```tsx
/* NAMED, because site-footer.tsx's own comment already says "The nav
          carries an aria-label because the header has one too, and two
          unlabelled navigation landmarks on a page are indistinguishable to a
          screen reader". The footer carried aria-label="Colophon" and the
          header carried nothing, so that sentence was false on every page and
          the pair it describes never existed. */
```

### app/components/site-header.tsx:104 (WHY, shortened)

why there is nothing left to substitute; the 2026-08-10 ruling goes to the history document.

```tsx
/*
          THE HARD RULE 13 SUBSTITUTION THAT SAT HERE IS GONE, and so is the
          reason for it. This passed the resolved theme down with a fallback,
          ruled on 2026-08-10, which kept the header rendering on the
          error-boundary path where the root loader legitimately never ran.

          Since 2026-08-29 the control takes no theme at all: both of its
          buttons are always rendered and the cascade chooses between them from
          `<html data-theme>` and `prefers-color-scheme`. There is no value to
          pass and nothing to substitute when `data` is absent, so the
          error-boundary path renders the same markup as every other path by
          construction.
        */
```

### app/components/site-header.tsx:119 (CONTRACT, shortened)

why the speculation rides here.

```tsx
/* Hover speculation for the paths this header links to. It rides HERE
          rather than in root's Layout so its scope is exactly the header's:
          every public page, never the admin plane, which does not render this
          component. See site-speculation.tsx for the nonce and the cost. */
```

## app/entry.server.tsx

### app/entry.server.tsx:12 (CONTRACT, shortened)

what the fifth argument is.

```tsx
// The FIFTH argument is the request context `workers/app.ts` built, the same
  // object it set `nonceContext` into. `server.js` calls this function as
  // `handleDocumentRequestFunction(request, status, headers, entryContext,
  // loadContext)`, and the default entry shipped by @react-router/dev names it
  // `_loadContext` for exactly this reason.
```

### app/entry.server.tsx:21 (CONTRACT, shortened)

kept long: both halves of the nonce are required and neither covers the other.

```tsx
/*
   * THE NONCE PROP, AND WHY ITS ABSENCE WAS A REAL BUG.
   *
   * `ServerRouter` does two things with this prop: it puts the value into
   * `FrameworkContext`, which is the fallback `<Scripts>` reads, AND it passes
   * it straight to `StreamTransfer`, which stamps it on BOTH of React Router's
   * streaming scripts (`streamController.enqueue(...)` and `.close()`).
   *
   * **Without it those two scripts ship bare on EVERY page**, and under an
   * enforcing CSP the `enqueue` script is the one carrying the hydration
   * payload, so the site would render and never hydrate.
   *
   * MEASURED, not inferred. The Report-Only observation window on 2026-08-06
   * produced 10 violation reports, every one `script-src-elem` with
   * `blockedURL: inline`, and the reported line was the document's LAST line on
   * every page, which is where those two scripts sit. `<Scripts nonce>` in
   * root.tsx was already correct and is why the earlier scripts were clean.
   *
   * This is a documented, supported prop, not a workaround: see
   * `ServerRouterProps.nonce` in react-router's types, and PR #15170, "Use the
   * ServerRouter nonce for nonce-aware SSR components when they don't provide
   * their own value so strict CSP pages can load them."
   *
   * **THE PROP IS NOT ENOUGH. REACT EMITS INLINE SCRIPTS OF ITS OWN, AND ONLY
   * THE RENDER OPTION BELOW STAMPS THOSE.**
   *
   * The prop reaches react-router's components. It cannot reach react-dom,
   * which writes its own inline `<script>` blocks to COMPLETE a Suspense
   * boundary whose content resolves after the shell has flushed. Those are the
   * `$RC` instruction scripts, and react-dom takes their nonce from the
   * `renderToReadableStream` OPTIONS, never from a prop on the tree.
   *
   * MEASURED, not inferred: a boundary resolving after the shell emits exactly
   * two inline scripts, `<script id="_R_">` and a bare `<script>`. Without the
   * option both ship with no nonce; with it both carry one. `test/ssr-nonce.test.mjs`
   * holds that pair, including the no-option control, so the option cannot be
   * dropped without a named failure.
   *
   * **This was inert for eleven days and then was not.** The policy spent them
   * in Report-Only, where a blocked script is only a report. Enforcement landed
   * 2026-08-17 and the site's ONE Suspense boundary, the lazily imported
   * CodeMirror in the post editor, stopped completing: the browser refused the
   * two scripts, the boundary never swapped its `null` fallback for the editor,
   * and react reported error #419, "the server could not finish this Suspense
   * boundary". The editor route rendered a plain textarea and nothing said why.
   */
```

### app/entry.server.tsx:88 (WHY, shortened)

keeps the structural reason and the reversal condition; the measurement and its control go to the history document.

```tsx
/*
   * NO `await body.allReady`, AND NO USER-AGENT SNIFF. REMOVED 2026-08-28.
   *
   * The template this file started from waits for the whole tree before
   * responding when the caller looks like a crawler, so a bot never receives a
   * document with an unresolved Suspense placeholder in it. That is worth doing
   * on a site that streams one. **This one does not.**
   *
   * MEASURED 2026-08-28, in production, against the live public routes: `/`,
   * `/blog`, `/colophon`, `/search` and `/projects` each carry ZERO of react's
   * three late-boundary signatures, the `$RC` completion call, the `<!--$?-->`
   * placeholder, and the `<template id="B:` slot.
   *
   * **WITH A CONTROL, because a zero from a search proves nothing until the
   * instrument is shown able to report a non-zero.** The same three needles run
   * over a deliberately late boundary, read progressively, report two, one and
   * one. The zeros above are real negatives rather than a broken needle.
   *
   * The structural reason behind the measurement: the repository declares
   * exactly ONE Suspense boundary, the lazily imported editor in
   * `app/components/admin/post-editor.tsx`, and it is on the ADMIN plane behind
   * a session, where no crawler arrives. There is no `<Await>` anywhere and no
   * loader returns a promise. `isSpaMode` is permanently false, because
   * `react-router.config.ts` sets `ssr: true`.
   *
   * So the branch could never fire for a reader and the sniff could only ever
   * cost one header read per request. `isbot` went with it: it was this file's
   * only caller, and a dependency the deployed Worker carries for a branch that
   * cannot be taken is a dependency that is lying about what serves the site.
   *
   * **IF A PUBLIC ROUTE EVER STREAMS A BOUNDARY, THIS DECISION IS REVERSED**,
   * and the thing to restore is the wait, not the sniff: `await body.allReady`
   * unconditionally is simpler than guessing who is a crawler, and the nonce
   * option above is what makes the streamed form safe under the CSP either way.
   */
```

## app/routes/login.tsx

### app/routes/login.tsx:13 (CONTRACT, shortened)

header: the two measured dependencies and the refused alternative; the line numbers go to the history document.

```tsx
/*
 * THE ADMIN STYLESHEET, ON A PUBLIC ROUTE, DELIBERATELY.
 *
 * This page is unauthenticated and therefore public, but it is the admin
 * plane's door and it is styled like one. Measured 2026-08-23 while splitting
 * the admin CSS out of the public bundle: `/login` is the ONLY non-admin file
 * in `app/` that uses a class defined solely in an admin stylesheet.
 * TWO dependencies, both measured with postcss rather than assumed, and the
 * first draft of this comment got the second one wrong:
 *
 *   `.field-alarm`         admin-editor.css line 855, and NOWHERE else. It
 *                          carries the sign-in error at line 122 below, so
 *                          without this import the failure state renders with
 *                          no colour and no size.
 *   `.btn-brand:disabled`  admin-posts.css line 318. The button's ordinary
 *                          appearance comes from `app.css`, which is public,
 *                          so that half needs nothing; it is the DISABLED
 *                          state, `disabled={busy}` below, that lives only in
 *                          an admin sheet.
 *
 * The alternative was moving two rules into a public sheet, which would have
 * changed their cascade position for the admin plane to save bytes on a page
 * essentially one person loads. Not worth it.
 */
```

### app/routes/login.tsx:43 (CONTRACT, shortened)

header: what hydration costs and what it does not.

```tsx
/**
 * /login hydrates for its busy flag and the browser-client fast path on the
 * button below, and that is DECORATION: the door itself is the plain form
 * above it, a real no-script POST, which is what rule 9 requires of a public
 * route. Dropping this flag would cost the spinner and the saved round trip,
 * never the sign-in.
 */
```

### app/routes/login.tsx:61 (CONTRACT, shortened)

header, kept long: three prohibitions on the site's only unauthenticated write.

```tsx
/**
 * THE DOOR, WITHOUT SCRIPT.
 *
 * ## What this closes
 *
 * The only way in used to be a `type="button"` with an `onClick` that called
 * the Better Auth browser client. With scripting off it rendered, it was
 * enabled, and it did nothing at all: the site's single door was JS-only while
 * README declared that every public page works with scripting disabled. Hard
 * rule 9 decides where the boundary sits, and the admin plane behind this page
 * may require script; the DOOR is on the public plane, so it may not.
 *
 * ## Why this action exists instead of posting straight to Better Auth
 *
 * `POST /api/auth/sign-in/social` answers `200` with a JSON body carrying the
 * authorize URL, because it is written for a fetch client that will navigate
 * itself. Pointed at by a plain `<form>`, a browser would render that JSON as
 * text. Verified in the installed package rather than assumed: the endpoint's
 * own schema declares a JSON response, and `better-call` has no
 * redirect-on-form-submission path.
 *
 * So the form posts HERE, this action asks the same Better Auth server API for
 * the same URL, and answers with a real 302. `form-action 'self'` is satisfied
 * because the form's target is this origin; the cross-origin hop afterwards is
 * a REDIRECT, and redirects are not checked against `form-action` (Chrome
 * shipped that check and reverted it in 78 because it broke exactly this OAuth
 * shape). If a browser ever reinstates it the symptom is a blocked navigation
 * from this page, and the fix is to name the provider in `form-action`.
 *
 * ## The rate limit is applied here too, and that is not belt-and-braces
 *
 * `/api/auth/*` is guarded on both verbs, but this route is not under that
 * path, so without this line the form would be an unguarded way to ask Better
 * Auth to mint authorize URLs and set state cookies. Same limiter, same key
 * prefix, so the two doors share one budget rather than each getting their own.
 */
```

### app/routes/login.tsx:115 (CONTRACT, shortened)

why the headers travel with the URL.

```tsx
/*
   * THE HEADERS MATTER AS MUCH AS THE URL. Better Auth sets the OAuth state
   * cookie on this response, and the callback refuses without it. Returning the
   * redirect while dropping the Set-Cookie would produce a door that opens onto
   * a failure every time, which is worse than one that does nothing.
   */
```

### app/routes/login.tsx:129 (CONTRACT, shortened)

what the id is for.

```tsx
// `id="main"` because root ALWAYS renders `<a class="skip-link" href="#main">`,
  // on every route including this one. Without a target here the first thing a
  // keyboard reader hits on the site's only door moved focus nowhere.
```

### app/routes/login.tsx:144 (CONTRACT, shortened)

why a plain form.

```tsx
/*
          A PLAIN form, deliberately not react-router's <Form>. The submission
          has to end in a cross-origin redirect to the provider, and a native
          navigation follows that without the client router having to decide
          what a 303 to another site means.
        */
```

### app/routes/login.tsx:156 (CONTRACT, shortened)

the enhancement is layered, not a replacement.

```tsx
/*
               * THE ENHANCEMENT, layered on top rather than replacing anything.
               * With script the browser client goes straight to the provider,
               * which saves this route a round trip and gives the operator a
               * state to look at. Without script none of this runs and the form
               * above posts normally.
               */
```

## app/components/search-trigger.tsx

### app/components/search-trigger.tsx:7 (CONTRACT, shortened)

header: the link, the honesty contract and the attribute; the badge history and the corrections go to the history document.

```tsx
/**
 * The site-wide search entry point.
 *
 * WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search carrying a
 * magnifying glass and an accessible name, so a reader with scripting off gets
 * working search by clicking it. The palette chunk, when it loads, finds it by
 * its data attribute and upgrades it into a control that opens the dialog. If
 * the chunk never loads, never finishes, or throws, the link is still a link.
 *
 * ## THE HINT IS NO LONGER PAINTED, ordered by Dustin on aesthetics 2026-08-29
 *
 * A visible `<kbd>/</kbd>` sat inside this control. It had already moved twice,
 * from beside the anchor to inside it, chasing a shape that did not read as a
 * stray character parked next to an icon. The ruling is that it should not be
 * painted at all: the header carries less chrome without it, and the control
 * is a plain icon again.
 *
 * **THE SHORTCUT IS Cmd/Ctrl-K, AND THE BARE SLASH IS GONE.** This paragraph
 * said "still binds / and Cmd-K, and pressing / still opens the palette" until
 * 2026-09-14; the slash was retired in the Part A review for colliding with
 * find-in-page and the sentence was not moved with it. MEASURED on the wire the
 * day it was corrected: "/" did not open the palette and Ctrl-K did. Where a
 * reader LEARNS the chord is two places that cost no
 * pixels: the `title`, which a pointer user gets on hover, and an
 * `aria-describedby` region, which a screen reader announces after the control's
 * name. Both are discoverable and neither draws a box in the header.
 *
 * **THE HONESTY CONTRACT SURVIVES THE MOVE, and it had to.** The old badge was
 * server-rendered `hidden` and unhidden by the script, so a reader without
 * script was never told about a shortcut that does not exist for them. The
 * description keeps exactly that property by the same mechanism: it ships
 * `hidden` and `theme.ts` unhides it, so the promise is still made only once
 * the listener is attached. The `title` is set by the same script for the same
 * reason, and the server renders none.
 *
 * NOT UNDERLINED, and the ground moves BACK with the badge. It renders no text
 * again, which was the original exemption; it also still carries a border, so
 * it would take the ordinary .search-chip exemption either way. Rule 2 is
 * satisfied twice over rather than by a technicality.
 *
 * The bundle is separate from the blog enhancement bundle on purpose: this one
 * is site-wide and that one is blog-only, so merging them would make every
 * homepage visit pay for reading enhancements it will never use.
 *
 * ## NO SCRIPT TAG HERE SINCE 2026-08-27. THE ATTRIBUTE IS THE WHOLE CHANGE.
 *
 * This rendered a nonced `<script type="module">` for the palette bundle, so
 * every document on the site downloaded and parsed a search dialog in order to
 * offer a keyboard shortcut. The bundle is the largest thing on the public
 * plane and almost nobody opens it.
 *
 * What ships now is `data-palette`, carrying the same hashed URL the script tag
 * carried. `app/enhance/theme.ts` is on every page already, holds the "/" key,
 * the Cmd-K chord and this element's click, and imports that URL the first time
 * one of them fires. The bundle must still be PREBUILT for the same reason it
 * always was: `?url` copies the file verbatim with no compilation, so pointed at
 * the .ts source it serves the browser raw TypeScript (measured 2026-07-28).
 *
 * The attribute goes on the trigger rather than on the document, so the element
 * that needs the palette is the element that names it, and a page without this
 * component simply has no palette instead of a broken one.
 */
```

### app/components/search-trigger.tsx:69 (CONTRACT, shortened)

header: one statement, two attributes.

```tsx
/**
 * The id `aria-describedby` points at. One statement, two attributes.
 *
 * A literal written twice is a description that silently stops being announced
 * the day one of them is edited, which is a failure nothing paints and nobody
 * sees. `check:browser` asserts the association resolves.
 */
```

### app/components/search-trigger.tsx:108 (CONTRACT, shortened)

why hidden and not sr-only, and why it sits outside.

```tsx
/*
        THE DESCRIPTION, NOT A BADGE. `.sr-only` rather than `hidden` would be
        wrong twice over: it would announce a shortcut to a scriptless reader
        who does not have one, and `hidden` is what lets `theme.ts` reveal it on
        exactly the signal the badge used to wait for.

        OUTSIDE the anchor, deliberately. An `aria-describedby` target may sit
        anywhere in the document, and putting it inside would make it part of
        the link's own content, which is what made the old badge a second run of
        link text.
      */
```

### app/components/search-trigger.tsx:119 (CONTRACT, shortened)

why the server text is a placeholder; the stale-string story goes to the history document.

```tsx
/*
        A PLACEHOLDER, NOT THE HINT. This read "Press slash to search" until
        2026-09-14. The bare slash was retired in efc0dab the day before and
        this string was not moved with it; because the element ships `hidden`
        nothing painted the lie, and a reader with script got it unhidden and
        announced verbatim. The chord is platform-dependent and
        the server cannot know the platform, so `theme.ts` writes the real text
        here BEFORE it unhides this, and this text is never announced.
      */
```

## app/components/admin/media-palette.tsx

### app/components/admin/media-palette.tsx:6 (CONTRACT, shortened)

header: the no-server-render rule, the one-query rule and the declared state; the four-step story goes to the history document.

```tsx
/**
 * THE COMMAND PALETTE, LAYERED OVER THE SEARCH FORM RATHER THAN REPLACING IT.
 *
 * ## WHAT IT IS FOR
 *
 * The library has one job, handing an author an address, and the fastest path to
 * one was: type, press Enter, wait for a page, find the row, press Copy. Four of
 * those five steps are the page getting out of its own way. Typing and pressing
 * Enter should be the whole thing, and that is what this is.
 *
 * ## PROGRESSIVE ENHANCEMENT, LITERALLY
 *
 * **THIS COMPONENT RENDERS NOTHING ON THE SERVER.** It mounts, finds the search
 * input that is already in the DOM, and attaches to it. With scripting off the
 * page is byte-for-byte what it was: a native GET form that navigates and
 * filters in SQL. Nothing here is the only way to do anything.
 *
 * That is also why it takes the input by ID rather than owning it. An enhanced
 * control that REPLACES the unenhanced one has to reimplement everything the
 * platform gave the original, and the first thing it always loses is the
 * no-script path.
 *
 * ## THE RESULTS COME FROM THE SAME QUERY THE FORM RUNS
 *
 * `?palette=1` is a branch of the media loader, so `matchesQuery` in SQL decides
 * what matches for both. A client-side filter over a copy of the library would
 * be a SECOND answer to "what matches this", and this page has already paid for
 * a second answer once, when the Unused chip counted with one predicate and
 * filtered with another.
 *
 * ## CLIENT STATE, DECLARED
 *
 * Five pieces: the query, the results, the cursor, whether a request is in
 * flight, and whether the panel is open. All of it is transient by nature, none
 * of it survives a navigation, and none of it belongs in a URL: a half-typed
 * query in the address bar would make the back button walk letter by letter.
 */
```

### app/components/admin/media-palette.tsx:58 (CONTRACT, shortened)

the harness seam and its wire-unreachability.

```tsx
/**
   * HARNESS SEAM, per admin queue ruling 8: an optional prop with a production
   * default. `check:admin-ui` renders one static pass and dispatches no events,
   * so without this the panel never opens and the gate would assert the absence
   * of something that structurally cannot appear. Wire-unreachable: React Router
   * never supplies it.
   */
```

### app/components/admin/media-palette.tsx:97 (CONTRACT, shortened)

the half that gets forgotten.

```tsx
/*
   * THE FETCH, DEBOUNCED, AND ORDERED BY SEQUENCE NUMBER.
   *
   * The debounce is the obvious half. The sequence number is the half that gets
   * forgotten: two requests in flight can complete in either order, so a slow
   * response to `ed` can land after a fast response to `edwards` and replace the
   * right answer with a stale one. Comparing against the latest issued id makes
   * a late response a no-op rather than a corruption.
   */
```

### app/components/admin/media-palette.tsx:126 (CONTRACT, shortened)

why silence is right.

```tsx
// A failed lookup leaves the form underneath untouched, so pressing
          // Enter still navigates and still searches. Silence is the right
          // behaviour: an error banner over a working control is noise.
```

### app/components/admin/media-palette.tsx:146 (CONTRACT, shortened)

why the handler is global and what the guard protects.

```tsx
/*
   * THE KEY HANDLER, on the window, because two of its bindings are global.
   *
   * Cmd+K and slash have to work while focus is anywhere on the page, which is
   * the point of them. Everything else only applies while the search box has
   * focus, and the guard below is what keeps arrow keys working normally in the
   * alt textarea: a palette that stole ArrowDown from every field on the page
   * would break typing to fix finding.
   */
```

### app/components/admin/media-palette.tsx:192 (CONTRACT, shortened)

why preventDefault is the fallback boundary.

```tsx
/*
         * ENTER COPIES. SHIFT+ENTER OPENS.
         *
         * `preventDefault` matters here: without it the form submits and
         * navigates, which is the unenhanced behaviour and would throw away the
         * copy. With scripting off there is no handler and the same key does
         * exactly that navigation, which is the fallback working.
         */
```

### app/components/admin/media-palette.tsx:204 (CONTRACT, shortened)

why a router navigation.

```tsx
// A ROUTER navigation, not `window.location`. The destination is
          // this same route with a `key` in the query, which every other
          // control that opens the inspector reaches by `<Link>`; assigning to
          // `location` tore the document down and rebuilt it to show a panel.
```

### app/components/admin/media-palette.tsx:233 (CONTRACT, shortened)

why the two paths differ on purpose.

```tsx
/*
                A LINK, not a button, and it goes to the inspector. The pointer
                path and the keyboard path therefore differ on purpose: clicking
                a row opens it, because that is what clicking a row means
                everywhere, while Enter copies, because that is what the reader
                came for and the hint says so.
              */
```

### app/components/admin/media-palette.tsx:265 (CONTRACT, shortened)

why the hints exist and what the count says.

```tsx
/*
        THE HINTS, which are the only documentation these shortcuts get.

        A keyboard affordance nobody can discover is a keyboard affordance
        nobody uses, and this row is where the reader learns that Enter does
        something other than submit. The count on the right says "6+ matches"
        when the cap was hit, so six never reads as the whole answer.
      */
```

## app/components/admin/post-metadata.tsx

### app/components/admin/post-metadata.tsx:9 (CONTRACT, shortened)

header: why not the drawer, and the absent-field rule; the B004 relay goes to the history document.

```tsx
/**
 * The frontmatter keys the editor carried and never offered.
 *
 * `featured`, `series`/`part`, `further_reading`, `og_title` and
 * `og_description` are all real schema keys that reach D1 and the public page.
 * Until 2026-09-03 the editor relayed them through hidden inputs so that saving
 * did not DELETE them (finding B004) while giving the author no way to set one:
 * the only routes to a series or a featured flag were hand-editing the markdown
 * or the operator API.
 *
 * ## WHY THIS IS NOT IN THE SETTINGS DRAWER
 *
 * The drawer is a real `<dialog>` opened with `showModal()`. Its fields are
 * submitted whether or not it was ever opened, because they carry `form=`, but
 * they can only be EDITED by someone whose browser ran the script that opens
 * it. That is a fine home for a control the author can also live without.
 *
 * It is not a home for these, because the brief for this work is that they work
 * with scripting off, and the further-reading picker in particular is specified
 * as a server-rendered checkbox list. A control inside a modal nobody can open
 * is a control that does not exist on that path. So this section lives in the
 * editing form itself, disclosed by `<details>`, which is the same element the
 * overflow menu uses and for the same recorded reason: it opens without script.
 *
 * ## THE RULE EVERY CONTROL HERE OBEYS
 *
 * **An absent field never means cleared.** A text input always submits, even
 * empty, so `series`, `part`, `ogTitle` and `ogDescription` are safe as
 * ordinary inputs and their payload is unchanged. The two that are not safe are
 * handled explicitly and each carries its argument at the point of use:
 * `featured` pairs a hidden "false" with the checkbox, and further reading
 * carries a marker plus the untouched stored JSON. Neither adds a way for a
 * missing field to read as an author's decision.
 */
```

### app/components/admin/post-metadata.tsx:76 (CONTRACT, shortened)

why the narrowing is here and not in the palette.

```tsx
/*
   * PUBLISHED ONLY, and not the post being edited.
   *
   * `linkTargets` deliberately carries every post with its state, because the
   * Cmd+K palette wants to link forward to a scheduled part and marks it. This
   * picker is a different question: further reading is rendered to the public,
   * so offering a draft would be offering a link that 404s for every reader.
   * The palette's own comment argues for the wider list; the narrowing is here
   * rather than there so both stay right.
   *
   * A post citing itself is filtered for the same reason a self-link is not
   * further reading. Nothing enforces it downstream, so it is enforced by not
   * being offered.
   */
```

### app/components/admin/post-metadata.tsx:94 (CONTRACT, shortened)

why one spare row.

```tsx
/*
   * One spare row, always. Existing links render as filled rows and the spare
   * is what makes adding one possible without script; saving reveals the next
   * spare. Two spares were considered and rejected as clutter, since the cost
   * of a second link is one more save rather than a lost one.
   */
```

### app/components/admin/post-metadata.tsx:114 (CONTRACT, shortened)

why the hidden false is required and why it comes first.

```tsx
/*
            THE HIDDEN "false" IS NOT REDUNDANT. It is the half that makes the
            checkbox safe: an unticked checkbox is absent from the submission
            entirely, so without this the request would carry no `featured` key
            and the parser would read that absence. It is rendered BEFORE the
            checkbox because `fieldsFromForm` takes the LAST value, so ticking
            the box overrides it and leaving it alone does not.
          */
```

### app/components/admin/post-metadata.tsx:209 (CONTRACT, shortened)

why both the marker and the carried value are required.

```tsx
/*
            THE MARKER AND THE CARRIED VALUE, together, and neither is optional.

            The marker says this control was on the page, so an empty result is
            the author clearing the list rather than a form that never offered
            one. The hidden `furtherReading` is what the parser falls back to
            when the marker is absent, which is every caller that is not this
            section; it is the same relay the editor had before this existed and
            it is kept for exactly that case. `furtherReadingFromForm` carries
            the full argument.
          */
```

### app/components/admin/post-metadata.tsx:274 (CONTRACT, shortened)

why the value carries both.

```tsx
/*
                        The VALUE carries the slug and the title together, so
                        the picker contributes exactly one field name to the
                        submission tuple no matter how long the blog gets.
                      */
```

## app/components/admin/media-keyboard.tsx

### app/components/admin/media-keyboard.tsx:3 (CONTRACT, shortened)

header: both need script and neither is the only way.

```tsx
/**
 * TOASTS AND GRID KEYBOARD NAVIGATION: the two page-level enhancements.
 *
 * Both need script and both are accepted as needing it. Neither is the only way
 * to do anything: every action a shortcut reaches has a visible control, and
 * every toast reports something the page also shows.
 */
```

### app/components/admin/media-keyboard.tsx:14 (CONTRACT, shortened)

header: why an event and not context.

```tsx
/**
 * Say something, from anywhere, without threading a callback through the tree.
 *
 * A CUSTOM EVENT rather than context, deliberately. The alternative is a
 * provider wrapping the page and a hook in every component that might speak,
 * which is a lot of plumbing for one string, and it would put the toast in the
 * server render where it has nothing to say. A component that wants to speak
 * calls this; if no toast is mounted, nothing happens and nothing breaks.
 */
```

### app/components/admin/media-keyboard.tsx:28 (CONTRACT, shortened)

header: why a live region, and why it is always mounted.

```tsx
/**
 * THE TOAST, which exists because a copy that succeeds silently looks broken.
 *
 * `role="status"` with `aria-live="polite"`, so the message is announced rather
 * than only drawn. That is the whole reason this is a live region and not a
 * tooltip: the copy button's own acknowledgement is a `::after` on a data
 * attribute, which a screen reader never sees.
 *
 * IT IS ALWAYS IN THE DOM once mounted, empty until it has something to say. A
 * live region inserted at the moment it gets content is frequently not
 * announced, because the assistive technology never observed the container.
 */
```

### app/components/admin/media-keyboard.tsx:66 (CONTRACT, shortened)

header: why geometry and not a layout model, and the degradation.

```tsx
/**
 * GRID KEYBOARD NAVIGATION, reading the RENDERED GEOMETRY rather than a layout
 * model.
 *
 * The grid is `repeat(auto-fill, minmax(...))`, so the number of columns is
 * decided by the browser from the container width and the logic does not know
 * it. Any attempt to compute it here would be a second layout engine that
 * disagrees with the real one at exactly the widths nobody tested.
 *
 * So down means "the tile nearest my horizontal centre, one visual row lower",
 * measured from `getBoundingClientRect`. That is the mockup's approach and it is
 * correct for a reason worth stating: it keeps working when the grid reflows,
 * when a folder heading interrupts the rows, and when the last row is short.
 *
 * DEGRADES TO NOTHING. Every tile is a link and a checkbox already; with no
 * script the reader tabs, which has always worked. This adds a faster path over
 * the top of it.
 */
```

### app/components/admin/media-keyboard.tsx:87 (CONTRACT, shortened)

why the mark is in the DOM.

```tsx
/* The active tile is marked in the DOM rather than by re-rendering the grid,
     which is what keeps this island from owning the grid's state. */
```

### app/components/admin/media-keyboard.tsx:124 (CONTRACT, shortened)

why the first id is guarded.

```tsx
// The first id is guarded rather than the length: the same early return on
      // an empty grid, and it is what makes the two `setActive(firstId)` calls
      // below pass a string rather than a possibly-absent one.
```

### app/components/admin/media-keyboard.tsx:150 (CONTRACT, shortened)

why unreachable returns are still written.

```tsx
// The row and the item the search above just found. Both are guarded
        // rather than asserted: the indices came from walking `rows`, so these
        // returns are unreachable, and an unreachable return substitutes
        // nothing while a non-null assertion would hide a real regression here.
```

### app/components/admin/media-keyboard.tsx:192 (CONTRACT, shortened)

what Escape clears and why the order is not arbitrary.

```tsx
/*
         * ESCAPE CLEARS EVERYTHING THIS PAGE CAN HAVE OPEN, in one press, which
         * is what the key means everywhere else.
         *
         * It cleared only the keyboard cursor, so a reader with twelve files
         * selected and a popover open had no way out but clicking each control.
         *
         * ORDER MATTERS AND IS NOT ARBITRARY: the drawer and the modals stop
         * this event before it reaches here, so one press closes the thing ON
         * TOP rather than everything at once. What is left for this handler is
         * the page underneath.
         */
```

### app/components/admin/media-keyboard.tsx:209 (CONTRACT, shortened)

why the real boxes are unchecked.

```tsx
// The selection, by unchecking the real boxes rather than by keeping a
        // second copy of it here. The grid owns the selection; this asks.
```

### app/components/admin/media-keyboard.tsx:217 (CONTRACT, shortened)

why the real checkbox is clicked.

```tsx
// The REAL checkbox, clicked. Not a parallel selection model: the bulk
        // form reads those checkboxes, so anything else would select rows the
        // submission does not carry.
```

## app/components/admin/publish-actions.tsx

### app/components/admin/publish-actions.tsx:10 (CONTRACT, shortened)

header: the transition rides in the submitter; the checkbox era goes to the history document.

```tsx
/**
 * The publish state machine, as controls.
 *
 * The draft checkbox is gone. What replaced it names the transition instead of
 * stating a field: the primary button says Publish, Republish or Update, and
 * the author never has to translate "draft is unticked" into "this is on the
 * internet".
 *
 * ## EVERY BUTTON CARRIES ITS OWN TRANSITION, since 2026-09-03
 *
 * Each control submits `intent=<transition id>`, and the server reads the draft
 * flag off that intent. Nothing is flipped, nothing is armed, and no handler
 * has to run for the request to say what the author asked for.
 *
 * What this replaced was a hidden `draft` input toggled through a ref in each
 * button's `onClick`. It reproduced a checkbox faithfully and it made all three
 * publication transitions depend on script, two of them silently: republish
 * saved a draft, revert-to-draft left the post live, and a first publication
 * could not be reached at all. `publish-transition.mjs` carries the full
 * account and the argument for putting the decision in the submitter.
 *
 * That the transitions map correctly is asserted by check:admin-ui against
 * publish-transition.mjs, not by this component. What check:admin-ui CAN now
 * see, which it could not before, is the whole contract: the intent a button
 * sends is in the markup, so the gate reads the transition off the rendered
 * page rather than taking a click handler on trust.
 */
```

### app/components/admin/publish-actions.tsx:96 (CONTRACT, shortened)

the real-submit shape and the race it makes harmless.

```tsx
/*
            A REAL SUBMIT that a script INTERCEPTS, which is the delete path's
            shape and is the whole of the fix.

            It was `type="button"`, so with scripting off there was no path to a
            first publication at all: both real submits lived inside a <dialog>
            that is display:none until showModal() runs. Now the press always
            means something. Scripted, the handler opens the dialog instead and
            the author answers there; unscripted, the request reaches the server
            as a plain `publish`, which is the ASK rather than the answer, and
            the server renders the confirmation step.

            The ceremony is not weakened by this, because the ceremony was never
            the dialog: it is savePost refusing an unconfirmed first
            publication. The dialog is earlier feedback, and this handler is the
            same. Note the race it makes harmless, too: a click landing before
            hydration submits for real and still cannot publish, because the
            server asks anyway.
          */
```

### app/components/admin/publish-actions.tsx:146 (CONTRACT, shortened)

why the dialog is conditional, and what an unconditional one would submit.

```tsx
/*
            RENDERED ONLY WHERE IT CAN BE OPENED, which is the same condition
            the Reschedule menu item carries. This arm also serves a WITHDRAWN
            draft, whose primary is Republish and which offers no Reschedule, so
            an unconditional dialog would leave two submits in the markup that
            nothing can reach. They would not be harmless: the reschedule arm
            sends the in-place `save`, which on a draft means draft:false, so
            the page would carry a publication nobody can see and check:admin-ui
            would record it as part of this page's request surface. Held by
            there being nothing to submit rather than by nothing opening it,
            which is how the preview-link section holds the same kind of rule.
          */
```

### app/components/admin/publish-actions.tsx:173 (CONTRACT, shortened)

header: why containment still holds, and why the submitter carries the intent.

```tsx
/**
 * Publish now, or hold until a time.
 *
 * A `<dialog>` again, for the platform focus trap. Both buttons inside it are
 * real submits of the editing form: the dialog sits INSIDE that form, and
 * `showModal()` moves an element to the top layer visually without moving it in
 * the DOM, so form association by containment still holds.
 *
 * BOTH SEND THE CONFIRMED INTENT, which is what separates them from the primary
 * that opened them. A closed `<dialog>` still submits the fields it contains,
 * so a confirmation carried in a hidden input here would have to be armed on
 * click, which is the machinery this whole change removes. The submitter is the
 * only part of a form that means "this is the control that was pressed".
 *
 * The RESCHEDULE arm sends the ordinary in-place save instead: a post that is
 * already public is not publishing for the first time, so there is nothing to
 * confirm and the ceremony's intent would be a lie about what is happening.
 */
```

## app/routes/blog.tags.$tag.tsx

### app/routes/blog.tags.$tag.tsx:21 (CONTRACT, shortened)

header: why both sheets, and what a payload gate cannot see.

```tsx
/*
 * BOTH SHEETS THE SHARED CARD NEEDS, not just the obvious one.
 *
 * `PostCard` renders `.post-card-series`, which is defined ONLY in
 * blog-index-extras.css. Importing blog-index.css alone left that element
 * unstyled on this page and on no other, which is the failure mode of sharing a
 * component without sharing what it is styled by: the markup is identical, the
 * page is not, and nothing in a payload gate can see it because the weight was
 * merely lower.
 */
```

### app/routes/blog.tags.$tag.tsx:34 (CONTRACT, shortened)

header: the 404 rule and the one-list rule; the missing-page history goes to the history document.

```tsx
/**
 * The archive for one tag.
 *
 * Tags have been in the model, the `tags` table, the chips and the JSON-LD
 * since the blog shipped, and there was no PAGE for one: the only address a tag
 * had was `/blog?tag=<slug>`, a filtered view of the index whose canonical
 * pointed at itself and which no sitemap listed. So the site knew about its own
 * taxonomy and offered a crawler no way in.
 *
 * ## 404 RATHER THAN AN EMPTY PAGE
 *
 * `getBlogTag` composes the same `isBlogPost()` the chip list does, so a tag
 * carried only by drafts or by future-dated posts does not exist here. That is
 * a real case and not a hypothetical: a draft is how a tag first appears.
 * Rendering an empty archive for one would be a soft 404, a 200 with no
 * content, which is the shape search engines penalise hardest, and it would
 * also leak the existence of a tag only a draft carries.
 *
 * ## THE LIST IS THE INDEX'S LIST
 *
 * `listBlogPosts` with a tag, the same call `/blog?tag=` makes, so the archive
 * and the filtered view cannot disagree about which posts carry a tag or about
 * how they are ordered. The cards are `PostCard`, the same component, for the
 * same reason.
 */
```

### app/routes/blog.tags.$tag.tsx:64 (CONTRACT, shortened)

why the order matters.

```tsx
/*
   * THE TAG IS RESOLVED BEFORE THE LIST IS READ, and the order matters: a tag
   * nothing public carries must 404 rather than render an empty archive, and
   * asking the list first would make that decision from a zero-length array,
   * which cannot tell "no such tag" from "every post using it was unpublished".
   */
```

### app/routes/blog.tags.$tag.tsx:79 (CONTRACT, shortened)

inherited rather than re-argued.

```tsx
/*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE, which is `/blog`'s ruling and
   * is inherited rather than re-argued. The reader lands on a page that exists,
   * at the URL naming it, and a crawler follows one hop instead of indexing an
   * empty list under an honest-looking "Page 99 of 3". 302, because the bound
   * moves as posts are published.
   */
```

### app/routes/blog.tags.$tag.tsx:95 (CONTRACT, shortened)

why the helper, and why not the Accept vary.

```tsx
/*
   * `/blog`'s HEADERS, THROUGH THE HELPER THAT OWNS THEM.
   *
   * `publicHtmlHeaders(cacheTags())` returns exactly the pair `/blog` sets,
   * `SHARED_CACHE_CONTROL` with the `posts` cache tag, and calling it is stricter than
   * copying the two constants: the helper is the one owner, so this page cannot
   * drift from the others if the pair ever changes.
   *
   * `/blog` itself writes them out rather than calling this, because it also
   * forwards a `Server-Timing` header off its loader. This page has no such
   * header to carry, so it takes the helper.
   *
   * NOT `HTML_VARY_ACCEPT`, which the post page and the index use: those
   * negotiate a twin representation on `Accept` and this page has none.
   * `workers/app.ts` downgrades all of it to private for any request carrying a
   * cookie, so the only variant ever stored is the themeless one.
   */
```

### app/routes/blog.tags.$tag.tsx:120 (CONTRACT, shortened)

the complete-set rule and the page axis.

```tsx
/*
   * THE SAME BUILDER THE OTHER PAGES USE. `pageMeta` owns the complete social
   * and canonical set, so this page cannot ship the partial one five pages
   * shipped before it existed: canonical, og:title, og:description, og:url,
   * og:type, og:image, twitter:card and twitter:image, all or none.
   *
   * The canonical carries `?page=` when there is one, for the reason `/blog`'s
   * does: page two is different posts, and declaring page one as its canonical
   * asks a crawler to drop content it does not share.
   */
```

### app/routes/blog.tags.$tag.tsx:168 (CONTRACT, shortened)

why the per-tag feeds exist.

```tsx
/*
          THE FEEDS FOR THIS TAG, as plain links. A reader who filters to a
          subject is exactly the reader who wants only that subject in their
          reader, and until these existed the only feed on offer was everything.
        */
```

## app/components/site-speculation.tsx

### app/components/site-speculation.tsx:7 (CONTRACT, shortened)

header, kept long: the browser's asymmetry, the credentialed cost, and a standing instruction to a future gate author.

```tsx
/**
 * Speculation Rules for the whole public plane, on every public page.
 *
 * It rides in `SiteHeader`, so its scope is exactly "wherever the header is":
 * the public routes plus the root error boundary, and never the admin plane,
 * which has its own shell and does not render `SiteHeader`.
 *
 * **THE PAYLOAD IS BUILT BY `~/lib/speculation.mjs`, WHICH IS THE ONE OWNER OF
 * THE RULE SHAPE AND THE EXCLUSIONS.** Read it for what is excluded and why,
 * for the two eagerness budgets, and for what `immediate` costs. This file owns
 * only the two things a module cannot: the nonce and the location.
 *
 * **IT REPLACED `BlogSpeculation` on 2026-08-28.** That component carried a
 * second `speculationrules` block on the two blog routes, scoped to `/blog/*`.
 * Its whole subject is now inside the document rule here, and two blocks on one
 * page meant two rule sets competing for one budget.
 *
 * ## IT CARRIES A CSP NONCE
 *
 * `script-src` gates `type="speculationrules"` and does NOT gate
 * `type="application/ld+json"`. Both are non-executable data blocks in a
 * `<script>` element, so the expectation is that either both are gated or
 * neither is; the browser disagrees. Measured 2026-08-06 across ten violation
 * reports, all `script-src-elem`: `/` carried two un-nonced `ld+json` blocks and
 * was not reported, while the pages carrying a speculationrules block were.
 * Do not "consistently" add a nonce to the JSON-LD or remove this one; the
 * asymmetry is the browser's, and the full record is in `VERIFICATION.md`.
 *
 * Under an ENFORCED policy an un-nonced block is refused SILENTLY: the page
 * renders identically, nothing is logged where anyone looks, and the whole
 * enhancement is simply absent on every public page.
 *
 * The nonce comes from the root loader, read OPTIONALLY: on the error-boundary
 * path the root loader never ran, and an enforcing policy then drops this
 * enhancement on an error page and nothing else.
 *
 * ## WHAT A SPECULATION COSTS A COOKIE-CARRYING READER, stated rather than assumed
 *
 * A speculation issues a real, CREDENTIALED request. Measured on the wire: a
 * `prefetch` rule sends `Sec-Purpose: prefetch` and carries the reader's
 * `Cookie`, so it resolves the same theme as the click will and reads or warms
 * the same `caches.default` entry keyed by URL plus resolved theme. That is
 * what makes this a warm-up rather than a duplicate render. Because the reader
 * carries a cookie, the response is `private, no-store` and the PLATFORM cache
 * stores nothing for them (rule 8), so the request reaches this Worker either
 * way; `x-theme-cache` on the wire says whether it rendered.
 *
 * The action was `prerender` until 2026-08-28 and the cost was the same shape,
 * with `Sec-Purpose: prefetch;prerender`. Why it changed is the action section
 * in `~/lib/speculation.mjs`, which is the one owner of that reasoning.
 *
 * ## WHAT NO AUTOMATED GATE CAN SEE HERE, measured 2026-08-28
 *
 * **Chrome refuses to prerender while CDP is attached.** Driving this site
 * under Puppeteer, `Preload.prerenderStatusUpdated` reported every attempt as
 * `Failure [PrerenderingDisabledByDevTools]` and Chrome fell back to prefetch:
 * `deliveryType` read `navigational-prefetch` and `activationStart` was 0 on
 * every run. It is CDP itself and not the Preload domain, confirmed by running
 * the same navigation with the domain disabled and getting the same result.
 *
 * **That is why the blink investigation had to leave CDP entirely**, and why
 * the measurement behind the prefetch ruling is a screen capture rather than a
 * trace. It also still bounds this gate: `check:browser` can assert that the
 * rules are PRESENT, well-formed, accepted and which ACTION they name, and it
 * cannot assert what the browser did on activation. Do not write that
 * assertion; it will pass vacuously or fail forever.
 */
```

## app/components/admin/media-document-card.tsx

### app/components/admin/media-document-card.tsx:10 (CONTRACT, shortened)

header: why the key and not the mime, and why the name differs from its neighbour.

```tsx
/**
 * The file extension, uppercased, off the key. PDF, SVG, PNG.
 *
 * Read from the KEY rather than from the mime type, because the key is what the
 * reader sees everywhere else on this page and a mime type disagreeing with a
 * filename is a distinction nobody wants explained on a tile. Falls back to the
 * mime subtype when a key genuinely carries no extension.
 *
 * **RENAMED FROM `extensionOf` ON 2026-08-24, and the rename IS the fix.**
 * `app/lib/media/classify.mjs` exports a function of that name which is not
 * this one: it takes a plain string, returns LOWERCASE, and returns the empty
 * string for a key with no extension, because `classify()` depends on that
 * empty string to THROW on an unknown type. This one takes a row, returns
 * UPPERCASE for display, caps at five characters, and falls back to the mime
 * subtype rather than returning nothing.
 *
 * Two functions, one name, different inputs and different outputs is the shape
 * VERIFICATION.md calls a vacuity machine: a body copied from one to the other
 * type-checks at neither call site and changes behaviour at both. They are not
 * merged because the difference is real and each is right where it is. What is
 * removed is the collision.
 */
```

### app/components/admin/media-document-card.tsx:38 (CONTRACT, shortened)

keeps the no-invented-fact rule and what the gate holds; the mockup comparison goes to the history document.

```tsx
/**
 * WHAT A DOCUMENT TILE SHOWS INSTEAD OF A PICTURE.
 *
 * **31 of the 70 rows are documents and they currently read as damage.** The
 * tile was a label floating in an empty band, so a folder of five papers
 * rendered as five identical grey boxes whose only distinguishing text was
 * `edw...omics.pdf` against `edw...lysis.pdf`: the middle-elision working
 * correctly on a string that should never have been the identifying one.
 *
 * The mockup's answer, verified in its source rather than in a description of
 * it: a small extension label top left, the TITLE in words, a few faint ruled
 * lines standing in for the text of the page, and one fact along the bottom.
 * A reader scanning that grid sees five different papers.
 *
 * **THERE IS NO BOTTOM LINE, BECAUSE THE FACT IT WOULD CARRY DOES NOT EXIST.**
 *
 * The mockup's card ends with "24 pages". In the mockup that string is FIXTURE
 * DATA, typed into its row table beside the size, and nothing computes it.
 * Nothing in this system stores a page count either: `media` carries bytes,
 * mime, width and height, and width and height are null for every PDF. Getting
 * one would mean fetching the object out of R2 and parsing it, per row, per
 * render, which is a network read for a decoration.
 *
 * The SIZE was put there instead for one render and it was worse, which is why
 * this note is longer than the code it explains. The mockup's tile has NO BODY:
 * the card IS the whole tile. This page's tile has always had a body, and that
 * body's meta line already prints the size, so a card foot carrying it too
 * rendered `1.4 MB` twice inside sixty pixels. A fact repeated is not a fact
 * confirmed; it reads as a bug, and it read as one on a screenshot.
 *
 * So the space is left empty, and the card is the extension, the title and the
 * suggestion of text. A page count goes in when a column holds one.
 * `check:admin-ui` holds both halves meanwhile: no invented page count, and the
 * size stated exactly ONCE per tile.
 *
 * THE RULED LINES ARE DECORATION and are marked so: `aria-hidden`, no text, no
 * meaning carried. They are the one thing here that suggests rather than states.
 */
```

## app/components/admin/confirm-dialog.tsx

### app/components/admin/confirm-dialog.tsx:6 (CONTRACT, shortened)

header, kept long: four prohibitions on the one destructive ceremony.

```tsx
/**
 * THE ONE DESTRUCTIVE CONFIRMATION. A real `<dialog>`, opened with
 * `showModal()`, with an inline fallback for a reader without script.
 *
 * ## It is rendered because the ACTION refused, not because a handler ran
 *
 * An unconfirmed destructive POST is not an error, it is the confirmation step:
 * the action refuses, returns what it would have destroyed, and the route
 * renders this from that. So the ceremony is reachable on the no-script path by
 * construction rather than by a second code path that has to be remembered.
 * `window.confirm` and `window.prompt` are not confirmations; they are
 * script-only ceremony in front of destruction that is not script-only, and
 * this repo has now found that same defect on five separate controls.
 *
 * ## WHY `data-inline` AND NOT THE `open` ATTRIBUTE
 *
 * A `<dialog>` with no `open` is `display: none`, so with script disabled a
 * dialog nobody called `showModal()` on is simply gone, and the confirmation
 * would be unreachable exactly where it matters most.
 *
 * Putting `open` in the JSX solves that and creates a worse problem: React then
 * owns the attribute, `showModal()` sets it too, and `close()` removes it
 * behind React's back, so the element's modal state and the VDOM disagree the
 * first time either side changes.
 *
 * So the attribute React writes is `data-inline`, which is a plain data hook
 * this component owns and the UA has no opinion about. It is present on the
 * server render, `admin-posts.css` gives `dialog[data-inline]` a static
 * in-flow box, and the effect below removes it in the same pass that calls
 * `showModal()`. First hydration render matches the server exactly, because
 * `hydrated` starts false.
 *
 * ## THE DISABLED BUTTON IS FEEDBACK. THE ACTION IS THE GATE.
 *
 * The confirm button is rendered ENABLED on the server, because `typed` starts
 * empty and would never become anything without script: rendering it disabled
 * would leave a scriptless reader unable to confirm at all. Once hydrated it
 * refuses early. Either way `confirmationSatisfied` re-checks the typed count
 * inside the action, which is the only thing a crawler, a prefetch or a reader
 * without JavaScript cannot skip.
 *
 * ## THE INTENT IS A HIDDEN FIELD, NEVER THE SUBMITTER'S VALUE
 *
 * This is what makes the disabled button possible at all, and the posts list
 * carried the bug it prevents: a disabled submitter contributes NO name and NO
 * value, so a form whose intent rides on `<button name="intent">` sends no
 * intent the moment that button is disabled. `MediaConfirm` already put the
 * intent in a field for this reason; the posts and editor confirmations did
 * not, which is why neither could adopt disable-until-it-matches.
 */
```

### app/components/admin/confirm-dialog.tsx:89 (CONTRACT, shortened)

why autoFocus is not enough.

```tsx
// The field the ceremony is about, focused. `autoFocus` is not enough:
    // React applies it on mount rather than emitting the attribute, and the
    // dialog's own focus rules run when showModal is called, which is here.
```

### app/components/admin/confirm-dialog.tsx:121 (CONTRACT, shortened)

the one-wire-name rule.

```tsx
/* NAMED FROM THE CONSTANT, because the action reads the same one. A
              literal here and a CONFIRM_FIELD there is two spellings of one
              wire name, and a rename would split them silently. */
```

## app/components/admin/media-drawer.tsx

### app/components/admin/media-drawer.tsx:4 (CONTRACT, shortened)

header: the three things HTML cannot express, and why focus return is derived.

```tsx
/**
 * THE DRAWER'S KEYBOARD CONTRACT: Escape closes it, Tab stays inside it, and
 * focus goes back to the tile that opened it.
 *
 * ## THE PANEL ITSELF NEEDS NO SCRIPT
 *
 * It is server-rendered whenever `?key=` is present, the scrim is a real link
 * that closes it, and every control inside is a form. With scripting off the
 * drawer opens, works and closes. This component adds the three things a modal
 * surface owes that HTML cannot express on its own.
 *
 * ## WHY A FOCUS TRAP AT ALL
 *
 * The drawer covers the page behind a scrim. Tabbing out of it lands on
 * controls the reader cannot see and cannot reach with a pointer, which is the
 * failure mode that makes an overlay unusable rather than merely awkward. The
 * trap is what makes the scrim honest.
 *
 * ## FOCUS RETURN WITHOUT REMEMBERING ANYTHING
 *
 * The obvious implementation stores `document.activeElement` before opening and
 * restores it after. That does not survive a navigation, and opening this
 * drawer IS a navigation: the URL gains `?key=`, React Router re-renders, and
 * the element reference from before may be a different node.
 *
 * So focus return is DERIVED instead. The drawer knows which key it is showing,
 * every tile carries `data-tile="<key>"`, and closing scrolls that tile into
 * view and focuses its link. It is more reliable than a stored reference and it
 * also works when the drawer was opened from the URL rather than from a click,
 * where there is no trigger to remember.
 */
```

### app/components/admin/media-drawer.tsx:60 (CONTRACT, shortened)

why focus lands on the panel.

```tsx
/*
     * FOCUS MOVES IN ON OPEN, and to the panel rather than to its first control.
     *
     * The first control is the Close link, and focusing it makes a screen reader
     * announce "Close" as the whole of what just happened. The panel carries the
     * dialog role and its label, so focusing the container announces what opened
     * and leaves Tab to reach the controls in order.
     */
```

### app/components/admin/media-drawer.tsx:73 (CONTRACT, shortened)

why the return is deferred twice.

```tsx
// After the transition, hand focus back to the tile that owns this key.
      // Deferred twice: once for React to commit, once for layout to settle,
      // because a tile inside a scroller is not focusable until it has a box.
```

### app/components/admin/media-drawer.tsx:84 (CONTRACT, shortened)

the fallback and why it beats the alternative.

```tsx
// The tile may not be on this page: the drawer is reachable by URL and
        // the row it names can be on any page or none. Falling back to the
        // previously focused element beats collapsing focus to <body>.
```

### app/components/admin/media-drawer.tsx:94 (CONTRACT, shortened)

why the event stops here.

```tsx
// STOP HERE. Escape inside the drawer means close the drawer, and
        // nothing else on the page may also act on it, or one press would close
        // the drawer AND clear the selection behind it.
```

## app/components/theme-toggle.tsx

### app/components/theme-toggle.tsx:5 (CONTRACT, shortened)

header: why two buttons ship, the icon/name split and the no-aria-pressed rule; the ruling date goes to the history document.

```tsx
/**
 * ONE theme button, ordered by Dustin on aesthetics 2026-08-29.
 *
 * The site has two themes and a default. This control switches between the two.
 * The default is what a reader gets until they touch it, and `app/lib/theme.ts`
 * is where that resolution lives and is explained; nothing here needs to know
 * how it is spelled.
 *
 * There is deliberately no control for returning to the default. Clearing the
 * cookie does it, and that is undocumented on purpose: a recovery rather than a
 * feature, and a second control to reach it is exactly the chrome this ruling
 * removes.
 *
 * ## WHY TWO BUTTONS SHIP AND ONE IS EVER SEEN
 *
 * The control must name the theme it will switch TO, and with no cookie the
 * server cannot know what the reader is currently seeing: the preference lives
 * on their machine and arrives in no header this site reads. Asking for it
 * would mean `Accept-CH` and a `Vary` the Worker's cache key cannot carry,
 * which is the trap `media.$.ts` records at length.
 *
 * So both buttons are rendered and CSS displays exactly one. With an explicit
 * choice the `data-theme` attribute on `<html>` picks it; with no choice
 * `prefers-color-scheme` does. A reader always sees a single button, it always
 * posts the correct value, and none of it needs script.
 *
 * That also makes the SCRIPTED path trivial: `theme.ts` sets or removes
 * `data-theme` and the control follows by cascade alone. No icon swapping, no
 * label rewriting, no second copy of the SVG in a bundle.
 *
 * ## THE ICON IS THE THEME IN EFFECT, THE NAME IS THE ACTION
 *
 * A sun means "you are in light", and its label is "Switch to dark theme".
 * Those pull in opposite directions on purpose: the icon is state, which is
 * what a glance wants, and the accessible name is the outcome, which is what a
 * screen reader user needs before activating anything.
 *
 * No `aria-pressed`. This is not a control with an on and an off; it performs
 * an action and the label says which. `aria-pressed` on a button whose meaning
 * flips underneath it is the kind of half-true semantics the three-button
 * version deliberately avoided by not calling itself a radiogroup.
 *
 * It is a real form posting to /theme, so it works with scripting off: the
 * action writes the cookie and the next render carries the right attribute. The
 * enhancement intercepts the submit and flips the attribute in place, which
 * removes the round trip but is not what makes the control work.
 */
```

### app/components/theme-toggle.tsx:53 (CONTRACT, shortened)

why it takes no props.

```tsx
/*
   * IT TAKES NO PROPS SINCE 2026-08-29, and that is the design rather than an
   * omission. Both buttons are always rendered and the cascade chooses, so the
   * server's resolved theme reaches this control through `<html data-theme>`
   * alone. A `theme` prop would be a second input that could disagree with the
   * attribute, which is exactly how a control ends up showing one thing and
   * posting another.
   */
```

## app/routes/admin.posts.$slug.revisions.tsx

### app/routes/admin.posts.$slug.revisions.tsx:15 (CONTRACT, shortened)

header: ruling 1 held structurally, and the three questions.

```tsx
/**
 * Reading git, for the editor's revision drawer. JSON, GET, and NOTHING ELSE.
 *
 * **This module exports no `action`, and that is the enforcement of ruling 1,
 * not a stylistic choice.** Ruling 1 says a restore LOADS a revision into the
 * editor as unsaved content and never writes, and that every mutation stays on
 * the one existing save path. A route with no action cannot be made to write by
 * any request: React Router answers a POST here with 405 before any code of
 * mine runs. The guarantee is therefore structural rather than a promise made
 * in a comment, which is what makes it provable from outside.
 *
 * It sits inside /admin, so the layout middleware has already required the
 * single-admin session before any of this executes.
 *
 * Three questions, one route, because they are the same resource at different
 * depths and a route each would be three places to keep the path construction
 * in step:
 *
 *   (no params)          the commits that touched this post
 *   ?sha=<sha>           that commit's diff against its parent
 *   ?sha=<sha>&want=content   that revision's fields, for loading into the editor
 */
```

### app/routes/admin.posts.$slug.revisions.tsx:39 (CONTRACT, shortened)

why a resource route is instrumented; the superseded sentence goes to the history document.

```tsx
/*
   * A RESOURCE ROUTE, and instrumented anyway.
   *
   * It returns raw `Response.json`, so the `headers()` export the other admin
   * routes used to carry never applied here. That sentence used to end "the
   * header is set on each Response directly", which stopped being true when the
   * per-route stamps came out: the header is written once, in `workers/app.ts`,
   * for every response on both planes.
   *
   * Marked because it makes GitHub calls and because the finding this session
   * exists for is that the ONE loader nobody suspected was the expensive one.
   */
```

### app/routes/admin.posts.$slug.revisions.tsx:53 (CONTRACT, shortened)

why the push stays and the write went.

```tsx
/*
   * PUSHES THE MARK, DOES NOT WRITE THE HEADER. It used to do both, and the
   * write was redundant: `workers/app.ts` stamps `Server-Timing` from the same
   * shared array after the handler returns, with `set`, so this one was
   * overwritten by an identical value on every request that asked for it.
   *
   * The push stays because it is the MEASUREMENT, and it is the only place
   * `loader_total` is recorded for this route. The response argument is kept so
   * every return path still runs it: dropping it would make the mark
   * conditional on which branch returned.
   */
```

### app/routes/admin.posts.$slug.revisions.tsx:75 (WHY, shortened)

keeps why the branch exists and why the import is static; the warning history goes to the history document.

```tsx
// The commit list is supplied by the edit route's own loader, so this
    // branch exists for a refresh after a save rather than for first paint.
    //
    // STATIC, since 2026-08-26. It was `await import(...)`, which bought
    // nothing: this file already imports the same module statically three lines
    // into its own header, and five other modules import it statically too, so
    // the chunk was in the graph however this line was written. Rolldown said
    // so on every build, in a warning that had become scenery.
```

## app/components/admin/media-confirm.tsx

### app/components/admin/media-confirm.tsx:6 (CONTRACT, shortened)

header: why prompt had to go, the preserved ladder and the two triggers.

```tsx
/**
 * A DESTRUCTIVE CONFIRMATION, as a real modal rather than `window.prompt`.
 *
 * ## WHY prompt() HAD TO GO, and it is worse than "it looks wrong"
 *
 * The empty-trash control called `prompt()` from an `onSubmit` handler and
 * cancelled the submit unless the reader typed the count. **With scripting off
 * the handler never ran and the form submitted straight through**, deleting
 * every trashed object with no confirmation at all. The ceremony was
 * script-only while the destruction was not, which is the exact inversion of
 * what a friction ladder is for.
 *
 * `prompt()` is also unstyleable, unreadable to a screen reader beyond its bare
 * string, blocks the whole browser, and is silently disabled in some contexts,
 * where the form would again submit unconfirmed.
 *
 * ## THE TYPE-THE-COUNT LADDER IS PRESERVED EXACTLY
 *
 * The ruling is unchanged: a bulk delete asks the operator to type the number
 * of files, because the count is the thing a distracted person gets wrong. The
 * confirm button stays DISABLED until the typed value matches, which `prompt()`
 * could not express at all.
 *
 * ## TWO TRIGGERS, ONE APPEARANCE
 *
 * Empty-trash opens from a URL (`?confirm=empty-trash`), so it is
 * server-rendered and works with no script. Bulk trash opens from client state,
 * because the selection it acts on IS client state and the bulk bar it lives in
 * does not exist without script either. Same component, same ladder, same look;
 * only the trigger differs, and each trigger matches what its subject depends
 * on.
 */
```

### app/components/admin/media-confirm.tsx:63 (CONTRACT, shortened)

the server is the authority and the button ships enabled.

```tsx
/*
   * WHETHER SCRIPT IS RUNNING, which decides who enforces the ladder.
   *
   * **THE SERVER IS THE AUTHORITY EITHER WAY.** The action re-reads the typed
   * count and refuses on a mismatch, so the ladder holds whether or not this
   * component is alive. Disabling the button is EARLIER FEEDBACK, not the
   * check.
   *
   * That distinction is what makes the no-script path work. Rendering the
   * button disabled on the server would leave a reader without script unable to
   * empty the trash at all, because nothing would ever enable it: `typed` stays
   * "" forever. So the server renders it ENABLED, the reader types and submits,
   * and the action decides. Once hydrated, the button starts refusing early.
   *
   * Initialised false so the hydration render matches the server's.
   */
```

### app/components/admin/media-confirm.tsx:160 (CONTRACT, shortened)

the one-wire-name rule.

```tsx
/* NAMED FROM THE CONSTANT, because the server reads the same
                  one. A literal here and a CONFIRM_FIELD there is two spellings
                  of one wire name, and a rename would split them silently. */
```

## app/components/admin/media-list-header.tsx

### app/components/admin/media-list-header.tsx:12 (CONTRACT, shortened)

header: one list, and what null means.

```tsx
/**
 * The columns, in track order, and whether each one sorts.
 *
 * ONE LIST, so the header cannot grow a column the row does not have or lose
 * one the row still renders. `null` is Dims, which is a label rather than a
 * link; see the note above for why there is no `dims` sort key to point it at.
 */
```

### app/components/admin/media-list-header.tsx:27 (CONTRACT, shortened)

header: every cell is a link, one builder, and why Dims is a span.

```tsx
/**
 * THE LIST'S HEADER ROW, and every cell in it is a LINK.
 *
 * The whole display state is a URL on this page, so a sort control has an
 * address and must be an anchor: it is shareable, bookmarkable, restored by the
 * back button and works with scripting off, which a click handler on a `<th>`
 * is none of. That is the same reasoning the Display popover's segmented
 * controls were built on, applied to the other control that changes a sort.
 *
 * **BOTH CONTROLS CALL `sortHref`, WHICH IS THE POINT.** A header and a popover
 * that build their own URLs are two implementations of one destination, and
 * they drift the way `q` and `role` drifted off their links. One builder means
 * choosing Size in the popover and pressing the Size header land on the same
 * page by construction; `check:admin-ui` asserts the two hrefs are byte-equal
 * per column over the rendered markup, and `test/media-view.test.mjs` asserts
 * the same property on the function.
 *
 * DIMS IS NOT SORTABLE AND SAYS SO BY BEING A SPAN. There is no `dims` sort
 * key, because half the library has no dimensions at all: 31 documents and
 * every SVG would collapse into one undifferentiated block at whichever end of
 * the order nulls land. So the column is a label rather than a dead link, which
 * is the mockup's own choice (its Dims entry carries no arrow and a no-op
 * handler) expressed in markup instead of in a disabled state.
 */
```

### app/components/admin/media-list-header.tsx:75 (CONTRACT, shortened)

why alignment is data; the collision goes to the history document.

```tsx
/* ALIGNMENT AS DATA, never as `nth-of-type`. It was positional for
               one render and it was already wrong: `nth-of-type` counts among
               siblings of the SAME ELEMENT TYPE, and this row mixes anchors
               with spans, so "the fourth heading" and "the fourth anchor" are
               different cells. Size sat at the left of its track against a
               right-aligned Dims and the two headings collided. A column
               declares its own alignment beside its own label. */
```

### app/components/admin/media-list-header.tsx:86 (CONTRACT, shortened)

why none is not noise.

```tsx
// The SORT STATE, as the property assistive technology reads for a
            // sortable column. `none` on the others is not noise: it is what
            // says this column can be sorted and currently is not.
```

## app/routes/admin.origin-requests.tsx

### app/routes/admin.origin-requests.tsx:5 (CONTRACT, shortened)

the shared-module rule; the NaN story goes to the history document.

```tsx
// Constants come from the SHARED module, never from the .server one. This
// component renders on the client too, where a .server import is stubbed out
// and every value from it arrives undefined: that shipped "Top NaN of 23
// paths" until check:admin-ui rendered the route and read the markup back.
```

### app/routes/admin.origin-requests.tsx:14 (CONTRACT, shortened)

header: what it counts, and why the loader returns the error.

```tsx
/**
 * /admin/origin-requests, the first cockpit panel reading real data.
 *
 * WHAT THIS PANEL COUNTS, and why the wording is not decoration. Analytics
 * Engine is written from the Worker's response path, and `cache.enabled` means
 * an edge HIT can serve a reader without the Worker running. So this is a count
 * of ORIGIN REQUESTS: a floor under readership, never a measure of it. The
 * heading, the column and the caption all say so, and the words this panel must
 * not use are asserted by the gate rather than left to reviewer memory.
 *
 * NO CLIENT JAVASCRIPT. The admin plane is exempt from the progressive
 * enhancement law, but nothing here needs the exemption: it is a server
 * rendered table and one CSS width per bar.
 *
 * THE ERROR STATE IS THE ORDINARY STATE ON A DEV MACHINE. The read token is
 * optional by contract and local dev carries no secrets, so this route renders
 * its error every time it is opened outside production. That is why the loader
 * returns the error rather than throwing: a throw would take out the admin
 * route segment and replace the whole cockpit with an error boundary.
 */
```

### app/routes/admin.origin-requests.tsx:104 (CONTRACT, shortened)

the sanctioned inline style.

```tsx
/*
                        The one inline style on this page, and it is the sanctioned
                        kind: a runtime numeric value no token could name. The
                        colour comes from the stylesheet.
                      */
```

### app/routes/admin.origin-requests.tsx:120 (CONTRACT, shortened)

the SSR splicing prohibition.

```tsx
/*
            ONE STRING, not interpolated JSX children. React SSR splices
            <!-- --> between adjacent text nodes, so a sentence assembled from
            several expressions renders with comments through it and any check
            reading the markup has to strip them first. Building it in JS keeps
            it one text node.
          */
```

### app/routes/admin.origin-requests.tsx:127 (CONTRACT, shortened)

why a disclosure and not a caption.

```tsx
/*
            THE CAVEAT, AS A DISCLOSURE. It was this table's `<caption>`, which
            a screen reader announces before EVERY row: five sentences about
            what the number is not, repeated once per path. The closed summary
            is enough to act on and the body is for whoever wants to know why
            the number is what it is.

            Assembled in JS for the same reason as the remainder line below:
            one text node, so no spliced SSR comments for a reader of the
            markup to strip.
          */
```

## app/components/admin/media-copy-button.tsx

### app/components/admin/media-copy-button.tsx:10 (CONTRACT, shortened)

header: why an icon and where the fallback is; the measured widths go to the history document.

```tsx
/**
 * THE PAGE'S ONE JOB, as one small button beside the name it copies.
 *
 * The clipboard needs script, which is why the filename beside it links to the
 * detail view where the same string sits in a readonly input. Feedback is a data
 * attribute rather than component state: the page holds no client state by
 * ruling, and a copy button with no acknowledgement reads as broken.
 *
 * AN ICON RATHER THAN THE WORD, and the reason is measured rather than
 * fashionable. It shipped as a full-width block under every tile, which at 24
 * tiles is 24 slabs competing with the pictures they belong to. Compacting it
 * to the WORD "Copy" beside the name was measured next: the word cost 41px of a
 * 131px row and left the name 85, which the browser then ellipsised from the
 * end, undoing the truncation fix in the same commit that made it. The glyph
 * costs 22 and leaves the name 109.
 *
 * `title` carries the address for a pointer, and the visually hidden span
 * carries the accessible name for everything else. An icon with neither is a
 * button that says nothing to a screen reader.
 */
```

### app/components/admin/media-copy-button.tsx:33 (CONTRACT, shortened)

why the default is what it is.

```tsx
/**
   * The accessible name, when the visible label is not a sentence.
   *
   * Defaults to the old shape, which is right for a tile whose label is a
   * filename ("Copy the address for plate-2019.png"). The inspector passes one
   * explicitly, because there the label is already an imperative and the default
   * produced "Copy the address for Copy address".
   */
```

### app/components/admin/media-copy-button.tsx:42 (CONTRACT, shortened)

why glyph-only is the default and why the inspector needs words; the gate finding goes to the history document.

```tsx
/**
   * Render the label as TEXT beside the glyph.
   *
   * **THE DEFAULT IS GLYPH-ONLY AND THAT IS MEASURED**: on a tile the word
   * "Copy" cost 41px of a 131px row and pushed the filename back into the
   * end-truncation this design exists to avoid. The inspector has the room, and
   * more importantly it NEEDS the words: three identical glyphs in a row are
   * three controls a reader has to press to tell apart, and the whole point of
   * the adaptive labels is that "HTML link" and "HTML tag" warn you which one
   * you are about to copy. A label only a screen reader can hear cannot do that.
   *
   * Found by `check:admin-ui`: the labels were computed, passed in, and rendered
   * nowhere, so the adaptive naming shipped invisible for one commit.
   */
```

### app/components/admin/media-copy-button.tsx:69 (CONTRACT, shortened)

the half a screen reader gets.

```tsx
// ANNOUNCED as well as drawn. The data attribute drives a `::after`,
            // which is invisible to assistive technology; the toast is a live
            // region, so this is the half a screen reader actually gets.
```

## app/routes/about.tsx

### app/routes/about.tsx:8 (CONTRACT, shortened)

the route-scoped sheet rule.

```tsx
// This page renders into `.prose`, and prose.css is route-scoped since the
// per-route CSS split. A page that uses the class and does not import the sheet
// renders unstyled, which check:page-payload's coverage half is what catches.
```

### app/routes/about.tsx:13 (CONTRACT, shortened)

header: why markdown here, why it is rendered at build time, and why one Person graph; the audit finding goes to the history document.

```tsx
/**
 * Who this is, in the first person.
 *
 * ## WHY IT EXISTS, and it is the one finding in the audit that was not a bug
 *
 * The pre-cutover audit's fourth part asked what a stranger does not
 * understand, and the first three questions off the home page were: who is
 * this, where do they work, and how do I contact them. The university was in
 * the `Person` JSON-LD and in no human-visible text anywhere on the site. The
 * footer offered Colophon, Privacy, llms.txt, RSS and Login, and no address.
 * A site whose front page is an evidence table and whose deepest page is a
 * generated inventory of its own bindings had nowhere to say what the person
 * does for a living.
 *
 * ## WHY THE PROSE IS IN MARKDOWN
 *
 * `content/about.md`, rendered at build time by `build:content` through the
 * same `renderBody` the corpus uses. `/privacy` and `/colophon` are prose in
 * JSX and that is right for them: every sentence on those pages is tied to a
 * file a reader can check, so they change when the code changes. This page
 * changes on taste, by the person it is about, and asking him to edit a
 * component to move a comma is how a page like this goes stale.
 *
 * The grounds for rendering it at build time rather than in the Worker are on
 * `buildAbout` in `scripts/build-content.mjs`: the public plane must not grow
 * a second markdown renderer and must not pay for the first one on a static
 * page.
 *
 * ## THE JSON-LD IS THE HOME PAGE'S, THE SAME FUNCTION
 *
 * `personJsonLd`, not a second graph assembled here. Two `Person` objects for
 * one person, differing in a field, is worse for a machine reader than one of
 * them not existing: it is the mirror problem with a search engine holding the
 * stale copy. `url` stays the site origin on both for the same reason, because
 * it identifies the person's site and not the page they are described on.
 */
```

### app/routes/about.tsx:73 (CONTRACT, shortened)

why it is injected, and what ran over it.

```tsx
/*
            RENDERED HTML FROM THE BUILD, injected the way a post body is, and
            the reasoning at `blog.$slug.tsx` applies unchanged: this markup is
            produced at build time from markdown in this repository, it
            contains no third-party input, and injecting it is the point of
            having one pipeline. The URL allowlist ran over it at build time
            and `buildAbout` refuses on a blocked link rather than shipping a
            demoted one.
          */
```

## app/routes/privacy.tsx

### app/routes/privacy.tsx:5 (CONTRACT, shortened)

the route-scoped sheet rule.

```tsx
// This page renders into `.prose`, and prose.css is route-scoped since the
// per-route CSS split. A page that uses the class and does not import the sheet
// renders unstyled, which check:page-payload's coverage half is what catches.
```

### app/routes/privacy.tsx:10 (CONTRACT, shortened)

header: the derivability rule and the two refusals; the file list goes to the history document.

```tsx
/**
 * What this site records, in plain English.
 *
 * ## EVERY SENTENCE IS DERIVABLE FROM THE CODE
 *
 * That is the rule this page is written under, and it is the reason it can be
 * short. There is no "we may collect" and no "from time to time": each claim
 * below names something a reader could go and check, and the cited files are
 * the ones that do it.
 *
 *   the analytics fields      workers/app.ts, recordTraffic
 *   the redaction             app/lib/analytics-path.mjs
 *   the Ask cache and its TTL app/lib/search/ask-guard.server.ts
 *   the CSP report sink       app/routes/api.csp-report.ts
 *   the webmention receiver   app/routes/webmention.ts
 *   what a mention stores     app/db/schema.ts, the `webmentions` table
 *   what it reads off a page  app/lib/webmention/verify.server.ts
 *   the theme cookie          app/lib/theme.ts
 *   the admin session         app/lib/auth.server.ts
 *
 * NO RETENTION PERIOD IS STATED THAT THE CODE DOES NOT OWN. The Ask cache has
 * one, because `expirationTtl` is a number in the source. Analytics Engine's
 * retention is Cloudflare's and is not set here, so this page says that rather
 * than inventing a figure, which is the difference between a privacy page and a
 * privacy performance.
 *
 * NO COMPLIANCE CLAIM. This is not a GDPR notice, it does not name a lawful
 * basis, and it does not promise a process for requests, because none of those
 * would be true statements about a personal site. Saying what is recorded is
 * something this page can actually stand behind.
 *
 * ## WHY IT IS A ROUTE AND NOT A POST
 *
 * A post is content that ages and carries a date. This is a statement about how
 * the site works right now, so it lives beside `/colophon`, takes the shared
 * cache headers like every other public page, and changes when the code does.
 *
 * It joins the footer on every page, which is WCAG 2.2 3.2.6 consistent help:
 * the same help mechanism in the same relative order on every page that has it.
 */
```

### app/routes/privacy.tsx:51 (CONTRACT, shortened)

why the shared builder.

```tsx
// The SHARED builder, never a hand-written pair. check:headers refuses the
  // latter by name: a hand-written pair is how the Vary line gets dropped, and
  // the shared string without Vary: Cookie serves one reader's theme to
  // another.
```

## app/components/post-card.tsx

### app/components/post-card.tsx:6 (CONTRACT, shortened)

header: why it was extracted.

```tsx
/**
 * One post in a listing.
 *
 * EXTRACTED rather than copied, on 2026-09-03, when the tag archive needed the
 * same card. The spec asks for "the same cards", and the only way to be sure of
 * that is for there to be one card: two copies of thirty lines of markup are
 * two places a field gets added and one place it gets forgotten, which is how
 * the index and the archive would come to show different things about the same
 * post.
 *
 * The shape is the row `listBlogPosts` returns, narrowed to what a card draws.
 */
```

### app/components/post-card.tsx:31 (CONTRACT, shortened)

why a summary entry and where u-url sits.

```tsx
/*
     * THE SUMMARY h-entry, and it rides HERE for the same reason the card
     * itself was extracted: three routes render this component (`/blog`, the
     * tag archive and the series page), so one set of classes marks all three
     * and there is no second copy to forget.
     *
     * A SUMMARY ENTRY, not a truncated full one. It carries `p-name`, `u-url`,
     * `dt-published` and `p-summary` and deliberately no `e-content`: a
     * consumer that finds content on a listing entry has been handed a summary
     * labelled as the article, and the honest signal for "the body is at the
     * url" is the absence of a content property.
     *
     * `u-url` is on the anchor rather than on the `<li>`, because the anchor is
     * where the address actually is. It renders relative, and a parser resolves
     * it against the page it was served from, which is what
     * `check:microformats` asserts by handing the parser the page's own URL.
     */
```

### app/components/post-card.tsx:70 (CONTRACT, shortened)

why the card links to the archive.

```tsx
/*
            THE TAG NAME IS A LINK TO THE ARCHIVE, not to a filtered index.

            It pointed at `/blog?tag=<slug>`, which is a filtered VIEW of the
            index: a real list, but one whose canonical now names the archive,
            so every card on the site was linking at the non-canonical address
            of a page that exists at a better one. The chips on `/blog` keep
            pointing at the filtered view, because their job is composing with
            the year filter beside them; a card's tag has no such job.
          */
```

### app/components/post-card.tsx:91 (CONTRACT, shortened)

header: why the href is passed in.

```tsx
/**
 * Newer/older pagination, shared for the same reason the card is.
 *
 * `hrefFor` is passed in because the two listings paginate at different URLs:
 * the index composes a query string of three axes, the archive appends `?page=`
 * to a path. The MARKUP is what has to be identical, and it is.
 */
```

## app/routes/blog.series.$series.tsx

### app/routes/blog.series.$series.tsx:21 (CONTRACT, shortened)

why both sheets.

```tsx
// Both sheets the shared card needs. `PostCard` renders `.post-card-series`,
// which lives only in the extras sheet; the tag archive learned this the hard
// way and the note is there.
```

### app/routes/blog.series.$series.tsx:27 (CONTRACT, shortened)

header: the one ascending list and the 404 rule; section E goes to the history document.

```tsx
/**
 * The archive for one series.
 *
 * A post has carried `series` and `part` since the schema was written, the post
 * page has listed the other parts for just as long, and the set had no URL: a
 * reader arriving at part three from a search result could see that a series
 * existed and had nowhere to go for it. Section E's whole content.
 *
 * ## ORDERED BY PART, WHICH IS THE ONE LISTING THAT IS NOT NEWEST FIRST
 *
 * Every other list on this site is reverse chronological, because that is what
 * a reader wants from a blog. A series is the exception by construction: the
 * author numbered the parts, and part one is where you start. `listSeriesPosts`
 * orders ascending and the feeds take the same order, so the page and the
 * subscription agree.
 *
 * ## 404 RATHER THAN AN EMPTY PAGE
 *
 * `getBlogSeries` resolves through `listBlogSeries`, which composes
 * `isBlogPost()`. So a series carried only by drafts or by future-dated posts
 * does not exist here, which is the tag archive's rule inherited rather than
 * re-argued: an empty archive would be a soft 404 and would leak the existence
 * of a series only a draft carries.
 */
```

### app/routes/blog.series.$series.tsx:61 (CONTRACT, shortened)

inherited rather than restated.

```tsx
// Out of range redirects to the last real page, which is `/blog`'s ruling and
  // the tag archive's, inherited rather than restated. 302, because the bound
  // moves as parts are published.
```

### app/routes/blog.series.$series.tsx:73 (CONTRACT, shortened)

why the helper.

```tsx
// The tag archive's headers, through the same helper that owns them, which is
  // `SHARED_CACHE_CONTROL` with the `posts` cache tag. This page negotiates
  // nothing, so it
  // takes the helper rather than writing the pair out.
```

### app/routes/blog.series.$series.tsx:85 (CONTRACT, shortened)

the complete-set rule and the page axis.

```tsx
// `pageMeta` owns the complete social and canonical set, so this page cannot
  // ship a partial one. The canonical carries `?page=` when there is one, since
  // page two is different posts.
```

### app/routes/blog.series.$series.tsx:126 (CONTRACT, shortened)

why the per-series feeds exist.

```tsx
/* The feeds for this series, as plain links, the same offer the tag
            archive makes and for the same reason: a reader who wants one series
            wants one series in their reader. */
```

## app/components/admin/social-previews.tsx

### app/components/admin/social-previews.tsx:9 (CONTRACT, shortened)

header: the same-function rule and what the preview claims.

```tsx
/**
 * What this post will look like in a search result and on a social card.
 *
 * Both read from `postSocial` in `app/lib/seo.ts`, which is the SAME function
 * `blog.$slug.tsx`'s `meta()` calls to emit the real tags. Nothing here
 * recomputes a canonical URL, a title template or a card image. That is the
 * whole point: a preview that derived its own version would eventually disagree
 * with the page, and it would disagree SILENTLY, because no view renders both
 * at once for a human to compare.
 *
 * These are previews of the head tags, not of Google's or a social network's
 * rendering, which change without notice and cannot be tracked from here. What
 * they promise is "these are the strings the site emits, cut where they will be
 * cut", which is a claim this repo can actually keep.
 */
```

### app/components/admin/social-previews.tsx:34 (CONTRACT, shortened)

header: why ogImage is deliberately absent.

```tsx
/**
 * Maps the editor's form state onto the shape `postSocial` takes.
 *
 * `ogImage` is deliberately NOT supplied and that is not an omission. The
 * build:og card is a fact about R2 discovered at sync time; the editor cannot
 * know whether one exists for a title the author is still typing, and claiming
 * one would be the preview inventing an image. So the editor's preview falls
 * through cover, then the site mark, and says which it landed on.
 */
```

### app/components/admin/social-previews.tsx:92 (CONTRACT, shortened)

why there is no placeholder.

```tsx
/*
          The real image, at the real URL, and NOT a placeholder when there is
          no cover. A post with no cover does not get an empty box on Twitter,
          it gets the site mark, so that is what is shown here. Inventing a grey
          rectangle would hide the one case worth seeing.
        */
```

## app/routes/phage-discovery.tsx

### app/routes/phage-discovery.tsx:18 (CONTRACT, shortened)

header: the deliberate bareness, the legacy URL and the prose decision; the asset-move note goes to the history document.

```tsx
/**
 * Roster. Photos and names, by year, and nothing else.
 *
 * No intro copy, no JSON-LD, no description constant. Dustin's instruction, and
 * the title is "for the time being", so treat the bare state as deliberate and
 * temporary rather than as something to helpfully fill in.
 *
 * **The URL is /phage-discovery.** It is the legacy WordPress address, indexed
 * and carrying whatever inbound links this content has, so the Worker takes it
 * over at DNS cutover instead of redirecting it. That also makes this page the
 * correction to a real error: the legacy page lists the 2022 roster twice, once
 * under a 2024 heading, so the actual 2024 cohort appears nowhere on it.
 *
 * **The photos are served from /phage-hunters/*, a static prefix, not a route.**
 * The page path and the asset path differ, which is a leftover rather than a
 * rule: the orphaned-assets rule that froze those object URLs was removed on
 * 2026-08-02. The photos are ordinary assets and are expected to move into R2
 * with the rest of the media, at which point the srcs in the data file change
 * and nothing here does.
 *
 * **Everything is styled by `.prose`, deliberately.** It already carries the
 * ratified treatment for h2, figure, img and ul, and check:contrast already
 * covers it, so this page needs no rules of its own. The alternative was a
 * `.roster-*` block in a 142 kB stylesheet for markup that prose describes
 * exactly. If the columned name list is wanted later, that is the moment to add
 * CSS, not before.
 */
```

## app/components/admin/revision-list.tsx

### app/components/admin/revision-list.tsx:12 (CONTRACT, shortened)

header: ruling 1 and the structural guarantee; the standalone page goes to the history document.

```tsx
/**
 * Version history, in the drawer, under ruling 1.
 *
 * **Restore LOADS. It does not write, and it cannot.** Selecting a revision
 * fetches that file's parsed fields with a GET and hands them to the editor as
 * unsaved changes; the editor goes dirty and the author saves, or does not.
 * There is no mutating request anywhere in this component: the only network
 * calls are `fetch` GETs to a route that exports no action, and the only commit
 * the editor can produce is the ordinary save on the one existing write path.
 *
 * That is a change from the standalone history page, which used to restore by
 * putting the old content straight through `savePost`. Ruling 1 retired that:
 * a second route that could commit was a second way to write, and the whole
 * point of the editor's architecture is that there is exactly one.
 *
 * Diffs load on demand rather than with the drawer, because a post with fifty
 * commits would otherwise pull fifty patches to show none of them.
 */
```

### app/components/admin/revision-list.tsx:118 (CONTRACT, shortened)

the hydration boundary.

```tsx
/* UTC, and formatted from the ISO string the API returned.
                    Fixed zone so the server render and the hydration cannot
                    disagree about which day a commit landed on. */
```

### app/components/admin/revision-list.tsx:136 (CONTRACT, shortened)

why the newest is never offered.

```tsx
/*
                Never offered for the newest commit: that revision IS the
                editor's current content, so loading it would mark the post
                dirty while changing nothing.
              */
```

### app/components/admin/revision-list.tsx:157 (CONTRACT, shortened)

one convention, not two.

```tsx
/* The EXISTING diff presentation: .history-diff plus the
                   add/del/hunk data attributes the standalone page already
                   uses. One diff convention on this site, not two. */
```

## app/routes/admin.tools.tsx

### app/routes/admin.tools.tsx:13 (CONTRACT, shortened)

header: why there is no control; the deleted stub goes to the history document.

```tsx
/**
 * THE CONTROLS LIST IS GONE; THE AUDIT IT POINTED AT IS THE PAGE.
 *
 * This loader called `toolsSource`, a `stubSource()` wrapping one literal row:
 * "Secrets audit / Which of the N ratified secrets this deployment holds",
 * with a chip reading "Answered below". It was a row of indirection announcing
 * the thing rendered directly underneath it, and its whole envelope existed to
 * carry a `provider` label and a "stubbed" chip. Both went with the fleet
 * typing on 2026-08-25.
 *
 * The audit itself is unchanged and is still not a button: reading the
 * bindings costs nothing, so a control would add a click and a state to a
 * question the page can simply answer.
 */
```

### app/routes/admin.tools.tsx:31 (CONTRACT, shortened)

presence only, and where that is asserted.

```tsx
/*
   * PRESENCE ONLY. `auditSecrets` returns a name and a boolean per ratified
   * secret and nothing else, which is asserted behaviourally in
   * `test/secrets-audit.test.mjs`: a value, a masked prefix or a length
   * reaching this payload fails two independent assertions there.
   *
   * Not timed: it reads bindings already in memory and performs no I/O.
   */
```

### app/routes/admin.tools.tsx:53 (CONTRACT, shortened)

the no-restated-count rule; the stale word goes to the history document.

```tsx
/*
        THE AUDIT ITSELF, rendered rather than run behind a button.

        There is no "Run" for this one and that is deliberate: reading the
        bindings costs nothing, so a button would add a click and a state to a
        question the page can simply answer. The count is NOT restated here;
        `REQUIRED_SECRETS` is the owner and the chip below derives from it.
        The word "five" once sat in this file while check:secrets measured a
        different number, which is why.
        NAMES AND A WORD, never a value. See `auditSecrets`.
      */
```

### app/routes/admin.tools.tsx:76 (CONTRACT, shortened)

the second-channel rule.

```tsx
/* `chip-error`, which already exists and whose token pair
                check:contrast already measures. The WORD carries the state,
                so the hue is the second channel, per the rule stated at
                `.chip-live`. */
```

## app/components/admin/media-drop-anywhere.tsx

### app/components/admin/media-drop-anywhere.tsx:10 (CONTRACT, shortened)

header: layered over the form, the no-auto-submit rule and the keyboard disclaimer.

```tsx
/**
 * Drop a file anywhere on the page to load it into the upload form.
 *
 * LAYERED OVER THE FORM, never instead of it. It sets the EXISTING input's
 * `files` and does not submit, so what happens next is what has always happened
 * next: the author sees the filename in the field and presses Upload. That is
 * the whole enhancement, and it is why it degrades perfectly: with script off
 * the form is untouched and the page behaves exactly as it did before this
 * existed.
 *
 * It deliberately DOES NOT auto-submit. A drop is easy to do by accident, an
 * upload writes to R2, and the friction ladder puts a deliberate press in front
 * of every write on this page.
 *
 * KEYBOARD REACHABILITY is not this control's job and it does not claim any: it
 * renders no focusable element and adds no shortcut. The file input beside it
 * is the keyboard path and always was, which is why this can be a pure
 * convenience rather than a second way in that has to be made accessible.
 *
 * CLIENT STATE ADDED: one boolean, `over`, purely to draw the target. It is
 * initialised false so the hydration render matches the server's.
 */
```

### app/components/admin/media-drop-anywhere.tsx:36 (CONTRACT, shortened)

why a counter.

```tsx
/* A COUNTER, not a boolean, because dragenter and dragleave fire for every
       nested element the pointer crosses and a naive boolean flickers off the
       moment the cursor moves between two tiles. */
```

## app/components/admin/media-empty-state.tsx

### app/components/admin/media-empty-state.tsx:1 (CONTRACT, shortened)

header: why the decision is here; the move date goes to the history document.

```tsx
/*
 * THE EMPTY LIBRARY, and there are three of them.
 *
 * Which one renders is decided here rather than by the caller, because the three differ only in what the reader should do next.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, markup and
 * comments unchanged.
 */
```

### app/components/admin/media-empty-state.tsx:16 (CONTRACT, shortened)

why the member is selected.

```tsx
/*
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries these fields, so the member is
 * selected rather than the property read off the union. One owner: the loader.
 */
```

### app/components/admin/media-empty-state.tsx:33 (CONTRACT, shortened)

the three meanings, compressed to what each must say.

```tsx
/*
          THREE EMPTY STATES, NOT ONE, because they mean three different things
          and the reader needs a different next step from each.

          The page had one muted sentence for all of them, which is the shape
          that tells somebody with an empty library to "try all media" and
          somebody with a typo to do the same thing.

            LIBRARY EMPTY   nothing has ever been here. Explain what the library
                            is FOR and offer the one action that fills it. This
                            is the only state that gets a heading and a button,
                            because it is the only one where the reader has
                            nothing to undo.

            SEARCH MISS     the query matched nothing. Name the query back, say
                            what was searched so the reader can tell a typo from
                            a wrong assumption, and offer to clear it.

            LENS EMPTY      the lens found nothing, which is GOOD NEWS and reads
                            as an error unless it says so. "Every file passes
                            this check" is the mockup's line and it is the right
                            one.
        */
```

## app/components/admin/panel.tsx

### app/components/admin/panel.tsx:3 (CONTRACT, shortened)

header: what the frame is for.

```tsx
/**
 * Panel is the frame every cockpit section renders inside: a title row with an
 * optional source chip, then whatever body the section needs. Sections stay
 * uniform without knowing about each other.
 */
```

### app/components/admin/panel.tsx:12 (CONTRACT, shortened)

header: why an action belongs on the heading; the measurement goes to the history document.

```tsx
/**
   * Controls that belong BESIDE the title rather than above the content.
   *
   * Optional and absent everywhere but the media library, so no other panel
   * changes. It exists because a page whose primary action is a full-width row
   * of its own spends a whole band of vertical space saying "upload": measured
   * on the media page, the upload row alone pushed the grid 68px down and was
   * one of seven rows above it where the design has four.
   *
   * An action is a thing you do TO the section, so it belongs on the section
   * heading, which is where every other admin surface would put it too.
   */
```

### app/components/admin/panel.tsx:48 (CONTRACT, shortened)

header: why the third branch is gone and what enforces it.

```tsx
/**
 * Marks a panel as live or failed, based on its SourceResult.
 *
 * THE THIRD BRANCH IS GONE with the `stub` arm it rendered, 2026-08-25. It
 * printed a "stubbed" chip whose tooltip explained which integration was
 * pending, and its removal is the point rather than a consequence: a panel can
 * no longer say "this data is not real", because no source produces data that
 * is not real. A `never` in the union here is the typecheck refusing to let one
 * back in without a decision.
 */
```

### app/components/admin/panel.tsx:69 (CONTRACT, shortened)

header: the never-hue-alone rule.

```tsx
/**
 * Rule 1: colour is never the only channel. The dot carries a shape per status
 * (circle, ringed circle, square) and the word rides alongside it, visually
 * hidden. Before this the state reached sighted readers as a hue and reached
 * assistive tech not at all, since the dot was the only carrier and it was
 * aria-hidden.
 */
```

## app/components/site-logo.tsx

### app/components/site-logo.tsx:1 (CONTRACT, shortened)

header: why inline, what the tokens do, and the generated-file prohibition; the diff verification goes to the history document.

```tsx
/**
 * The site mark, inline and in one place.
 *
 * Inline rather than an <img> because the theme is driven by a data-theme
 * attribute, so a <picture> with prefers-color-scheme would ignore the manual
 * toggle. The five purple paths take .site-logo-brand, which is var(--brand),
 * and that token already resolves to #4f2d7f in light and #b7a5e0 in dark,
 * including under SYSTEM mode where no attribute is present at all. That is the
 * entire swap: no second file, no hidden element, no media query of its own.
 *
 * Nothing can flash, because the token is resolved during the first paint of
 * the first byte, and nothing can shift, because there is one element that is
 * never hidden.
 *
 * The four shipped SVGs (logo, logo-header, and their dark variants) differ in
 * exactly two ways: the viewBox, and whether the purple paths carry #4F2D7F or
 * #B7A5E0. Verified by diff with fills stripped, 2026-07-29. One path list plus
 * a viewBox therefore reproduces all four.
 *
 * The warm three keep literal fills because they are IDENTICAL in both
 * variants. Binding them to tokens would make the mark render differently from
 * the ratified assets.
 *
 * GENERATED from public/logo.svg. Path data is verbatim and must never be
 * hand-edited: the construction spec is Capsid dustinedwards/logo-spec.md, and
 * a variant is a rebuild from those values.
 */
```

## app/components/shell-footer.tsx

### app/components/shell-footer.tsx:5 (CONTRACT, shortened)

header: the tonal rule and why the machine links are there; the build history goes to the history document.

```tsx
/**
 * The Paper, Glass, Light footer. Ruling 65, Part A step 6b.
 *
 * TONAL, not a second bar. Limestone ground, one dust rule above it,
 * sentence-case purple links. No purple fill, no logo repeat, no social row, no
 * tracked caps: a footer that repeats the header's brand is a second header,
 * and this one exists to hold the links that are not destinations.
 *
 * `.tracks` goes on the inner div as well as on `main`, so footer content sits
 * in the same column as the prose above it without a second grid definition.
 *
 * THE THREE NAV LINKS ARE THE THREE THAT ARE NOT DESTINATIONS: a policy page, a
 * sandbox and an auth entry. Playground moved here from the header in this
 * build, which is also what took the old header's fourth nav link out of the
 * row step 3's 768 measurement was taken against.
 *
 * THE MACHINE LINKS ARE NOT DECORATION. `/llms.txt` and the per-post markdown
 * twins are how an agent reads this site, and the brief names AI agents and
 * crawlers as the audience that matters most, so they are in the footer of
 * every page rather than on the colophon alone.
 */
```

### app/components/shell-footer.tsx:43 (CONTRACT, shortened)

why the year is a literal.

```tsx
/*
            A DATED STRING, not a computed year. `new Date()` in a component
            body is a value that differs between the server render and any
            later render of the same document, and on an unhydrated public page
            it would also be the only thing on the page that could disagree
            with the cached copy. The copyright year moves when somebody edits
            it, which is once a year and is not a defect.
          */
```

## app/routes/admin.posts.new.tsx

### app/routes/admin.posts.new.tsx:16 (CONTRACT, shortened)

why the handle is unconditional.

```tsx
/*
 * THE MATH STYLESHEET, ALWAYS. Same reason as the edit route beside it: the
 * exact-preview pane copies this document's stylesheets into its iframe, so an
 * author typing an expression needs the sheet on the page they are typing on.
 * Grounds in root.tsx, which reads this handle.
 */
```

### app/routes/admin.posts.new.tsx:29 (WHY, shortened)

why the marks were added without reordering.

```tsx
/*
   * FOUR SERIAL AWAITS, three of them inside the returned object literal, same
   * shape as the editor. Marked without reordering, so the numbers describe
   * what ships.
   */
```

### app/routes/admin.posts.new.tsx:49 (CONTRACT, shortened)

the save gate remains the authority.

```tsx
// So the slug field can say "taken" while the author is still typing,
    // rather than after a round trip that gets refused. The save gate remains
    // the authority; this only saves a wasted submit.
```

### app/routes/admin.posts.new.tsx:91 (CONTRACT, shortened)

why the primary is Publish.

```tsx
// A post that does not exist yet is a draft that has never been public,
      // so the primary action is Publish behind the ceremony, exactly as it
      // would be on the first edit after creating it.
```

### app/routes/admin.posts.new.tsx:96 (CONTRACT, shortened)

why the same second step applies.

```tsx
// A post that has never existed has never been public, so its first save
      // with a publish intent is a first publication and gets the same second
      // step the edit route renders. `fields` above already carries the
      // submitted body back, because this arm has fields like `problem` does.
```

## app/routes/admin.posts.$slug.history.tsx

### app/routes/admin.posts.$slug.history.tsx:16 (CONTRACT, shortened)

header: ruling 1 and the structural guarantee; the removed action goes to the history document.

```tsx
/**
 * Version history for one post. READ ONLY.
 *
 * Admin-only. Git already holds the history, so this is a window onto it: the
 * commit list and the diffs come straight from the GitHub API over the token
 * the editor already uses.
 *
 * **This route used to be able to restore, and that ability was removed on
 * 2026-08-02 by ruling 1 of the feature queue.** It restored by reading the
 * file at an old commit and putting it straight through `savePost`, which was
 * atomic and never rewrote history, but it was still a SECOND ROUTE THAT COULD
 * COMMIT. Ruling 1 says a restore loads a revision into the editor as unsaved
 * content and that every mutation stays on the one existing write path, so the
 * action is gone and restoring now happens in the editor's drawer, where the
 * author sees the change before deciding to keep it.
 *
 * This page therefore exports NO action at all. A POST here answers 405.
 */
```

### app/routes/admin.posts.$slug.history.tsx:126 (CONTRACT, shortened)

why there is no control here.

```tsx
/* No restore control here any more. Ruling 1 moved restoring
                    into the editor's drawer, where it loads rather than
                    writes, and leaving a second one on this page would have
                    been a second way to commit wearing the same word. */
```

## app/components/admin/row-menu.tsx

### app/components/admin/row-menu.tsx:5 (CONTRACT, shortened)

header: the one-control rule, the no-script mechanism and the naming rule; the count goes to the history document.

```tsx
/**
 * ONE ACTIONS MENU PER ROW, and it is borderless.
 *
 * The list used to carry a row of loose buttons per row: Edit, View, Unpublish,
 * Duplicate across fifteen rows is fifty-odd controls competing with the fifteen
 * NAMES the reader came to find. The design rule is one control per row holding
 * every action for it, and a bordered box on every row is fifteen more
 * rectangles to look past, so the trigger draws only its dots until it is
 * hovered or focused.
 *
 * Behaviour is `useDisclosure`, shared with `OverflowMenu`. It opens with no
 * script because it is a `<details>`, and every item inside is a real link or a
 * real submit button, so the whole menu works with nothing loaded.
 *
 * The accessible name NAMES THE ROW, never just "Actions". Fifteen controls all
 * announcing "Actions" tell a screen reader user which control they are on and
 * nothing about which post it acts on.
 */
```

### app/components/admin/row-menu.tsx:37 (CONTRACT, shortened)

why the dots are drawn.

```tsx
/* Three dots, drawn rather than typed: the character U+22EE renders at
            the mercy of whatever font has it, and this is a 24px target that
            has to line up with the 32px controls beside it. */
```

## app/components/admin/alert.tsx

### app/components/admin/alert.tsx:1 (CONTRACT, shortened)

header: the live-region prohibition and what replaces it.

```tsx
/**
 * A standing condition the operator has to act on, with the action that fixes
 * it attached to it.
 *
 * The role is the point. `role="alert"` and `role="status"` are LIVE regions:
 * they exist to interrupt with something that just happened, and assistive tech
 * announces them on insertion. Ask index drift is not an event, it is a state
 * the site is in, rendered into the first byte of HTML on every visit to this
 * page. Announcing it as news on each load would be wrong twice over, once
 * because it is not news and once because a reader who arrived to do something
 * else gets interrupted by it. The drift notice carried `role="status"` before
 * this and did exactly that.
 *
 * So it is a named region instead: `<section>` with an accessible name is a
 * `region` landmark, which puts it in the landmark list where a screen reader
 * user can find it on purpose, and leaves it silent until they do. The heading
 * names it and the glyph plus the words carry the meaning, so rule 1 holds
 * without the tint being asked to say anything on its own.
 */
```

## app/components/enhancement-script.tsx

### app/components/enhancement-script.tsx:5 (CONTRACT, shortened)

header: how every public enhancement loads, the optional nonce, and the CSP that makes an unnonced tag inert.

```tsx
/**
 * A nonced module script tag for one prebuilt enhancement bundle.
 *
 * This is how every public enhancement loads since the public plane stopped
 * hydrating React (2026-08-26): the four modules in app/enhance/ are bundled
 * by build-enhance.mjs into self-contained files under app/enhance/dist/, a
 * `?url` import turns each bundle into a hashed asset URL, and this renders
 * the tag that fetches it. `type="module"` gives deferred execution, so the
 * markup a bundle upgrades exists before the bundle runs, and the browser
 * de-duplicates by URL, so two placements of one bundle execute once.
 *
 * The nonce is the same read Layout does, and it is OPTIONAL for the same
 * reason: on the error-boundary path the root loader never ran, there is
 * nothing honest to stamp, and under the enforcing CSP (script-src is nonce
 * plus strict-dynamic, no 'self') the browser then refuses the fetch. An
 * error page costs its enhancements and nothing else; the markup they would
 * have upgraded still works, which is rule 9's fallback doing its job.
 */
```

## app/lib/scientific-names.tsx

### app/lib/scientific-names.tsx:5 (CONTRACT, shortened)

header: stored strings are never touched.

```tsx
/**
 * Render-time italicization of organism names.
 *
 * Stored strings are never touched. Titles and abstracts stay byte-identical
 * to what Crossref, Europe PMC and DataCite returned, which is what keeps the
 * search haystack, the JSON-LD headline and the meta description working off
 * plain text. Presentation happens here and nowhere else.
 *
 * Lives in lib rather than in the publications route because the CV will need
 * the same treatment.
 */
```

### app/lib/scientific-names.tsx:21 (CONTRACT, shortened)

why the order and the boundaries matter.

```tsx
// ORGANISMS is ordered longest first, and regex alternation takes the first
// branch that matches at a position, so the trinomial wins over the binomial.
// Word boundaries stop a bare genus matching inside a longer word.
```

### app/lib/scientific-names.tsx:29 (CONTRACT, shortened)

header: why nodes and not markup.

```tsx
/**
 * Split a plain string on organism names and wrap each match in `em`.
 *
 * Returns React nodes, never markup, so nothing here needs
 * dangerouslySetInnerHTML and the input is never parsed as HTML.
 */
```

## app/components/admin/media-picker.tsx

### app/components/admin/media-picker.tsx:4 (CONTRACT, shortened)

header: one component, one query.

```tsx
/**
 * THE PICKER. Shape 3 of media-module-architecture.md.
 *
 * One component, consumed by the editor drawer today and usable by any later
 * consumer. The drawer contains no picker logic of its own: it renders this and
 * receives a chosen object back, which is the difference between one media
 * surface and two that drift.
 *
 * It reads the media page's loader rather than a listing endpoint of its own,
 * so what a picker shows and what the library shows come from the same query.
 */
```

### app/components/admin/media-picker.tsx:76 (CONTRACT, shortened)

the thumbnail prohibition.

```tsx
/* The THUMBNAIL, never the original. `thumb` carries the
                  transform URL the server built, so the grid cannot
                  accidentally pull full-resolution bytes. */
```

## app/components/ask-panel.tsx

### app/components/ask-panel.tsx:5 (CONTRACT, shortened)

header: the hidden-until-listening rule and where the real guard lives.

```tsx
/**
 * The Ask affordance on /search. Search Layer 2.
 *
 * Server-rendered markup and a script tag, no React island: the button ships
 * HIDDEN with the question in a data attribute, and the prebuilt bundle of
 * app/enhance/ask.ts unhides and binds it. A reader without script never sees
 * an inert control that looks live and does nothing, which is the same rule
 * the palette's "/" hint follows: it stays hidden until something is actually
 * listening. Classic results are already rendered by the loader above this,
 * and nothing here can delay them.
 *
 * search.tsx renders this only when the binding exists and the query is a
 * real question, so the bundle's own empty-question guard is a backstop, not
 * the rule's home.
 */
```

## app/components/blog-enhancements.tsx

### app/components/blog-enhancements.tsx:5 (CONTRACT, shortened)

header: why the bundle must be prebuilt; the React-effect history goes to the history document.

```tsx
/**
 * Loads the blog reading enhancements, client side only.
 *
 * A nonced module script tag pointing at the prebuilt bundle of
 * app/enhance/blog.ts. It used to be a React effect running a dynamic import,
 * which required the page to hydrate; the public plane stopped hydrating
 * (2026-08-26), so the bundle is built ahead of time by build-enhance.mjs and
 * the `?url` import serves it verbatim. That verbatim copy is exactly why the
 * bundle must be prebuilt: `?url` does not compile, so pointed at the .ts
 * source it serves raw TypeScript (measured 2026-07-28, re-gated by
 * check:page-payload's syntax pass).
 *
 * A reader with JavaScript disabled never runs the bundle and loses nothing
 * but decoration.
 */
```

## app/components/admin/media-display-group.tsx

### app/components/admin/media-display-group.tsx:10 (CONTRACT, shortened)

header: why links and not a select.

```tsx
/**
 * One labelled row of segmented links inside the Display popover.
 *
 * LINKS, not buttons, and not a `<select>`. Every one of these is a different
 * URL, so making them links is what lets the whole display state be shared,
 * bookmarked and restored by the back button with no script at all. A select
 * would need an onChange to navigate, which is the one thing this page has
 * never required.
 */
```

## app/components/admin/overflow-menu.tsx

### app/components/admin/overflow-menu.tsx:5 (CONTRACT, shortened)

header: where the behaviour lives now; the extraction date goes to the history document.

```tsx
/**
 * The cockpit's overflow menu: a labelled button that reveals a panel of
 * secondary actions.
 *
 * Its keyboard and dismissal behaviour moved to `useDisclosure` on 2026-09-10,
 * when `RowMenu` needed the same three manners. The markup below is unchanged,
 * which is what keeps `check:admin-ui`'s fixture green through the extraction;
 * the grounds for the disclosure pattern and the ARIA choice now live beside
 * the hook.
 */
```

## app/routes/admin.logout.tsx

### app/routes/admin.logout.tsx:1 (CONTRACT, shortened)

what the route does and why the header is forwarded.

```tsx
// POST /admin/logout: signs out via Better Auth (clearing the KV session and
// the cookie) and redirects to the login screen. asResponse hands back the
// Set-Cookie header to forward.
```
