---
title: "Bells and whistles under a zero-JavaScript law"
slug: bells-and-whistles-zero-js
description: "A reading experience in 1.59 kB of gzip, three lessons from having two writers, social cards that stay out of the gate, and the features deliberately refused."
date: 2026-07-28
draft: true
tags: [cloudflare, performance, accessibility, progressive-enhancement]
---

After the pipeline shipped, the blog got its polish pass: reading progress, scroll-spy, copy buttons, related posts, series support, social cards, version history. This article is about the constraint that shaped all of it, the three lessons the architecture taught while resisting, and the features that were refused on purpose. Numbers are measured; the harness bugs that produced false failures are kept in the text.

## The law

Every public route on this blog works completely with JavaScript disabled. Not degrades: works. The table of contents navigates, footnotes jump, images link to originals, tag and year filters run server-side, and highlighted code, including highlighted individual lines, is present in the stored HTML because the pipeline applied it at generation time. Enhancement is one lazily loaded chunk, served only on blog routes, measured at 3,871 bytes raw and 1.59 kB gzipped plus a 0.22 kB loader.

The citable claim: a reading experience with a progress bar, scroll-spy table of contents, code copy buttons with language labels, heading anchor links, footnote hover previews, and an image lightbox costs 1.59 kB of gzipped JavaScript when the server renders everything and script only decorates. The fallback for each enhancement is named in the repo; the progress bar's fallback is nothing, because it is decoration, and admitting that is part of the design.

Two harness traps from verifying this are worth recording because they produce confident false results. A `?url` import copies a file verbatim as an asset, so the browser would have been served raw TypeScript; it was caught only because a 250-line file emitted a 0.05 kB chunk, and 0.05 kB was not plausible. And an automated form-input tool intermittently failed to reach React's synthetic events, making autosave look broken when real keyboard input showed it working. Distrust of a surprising number, in both directions, was the actual debugging tool.

## Three lessons from having two writers

The blog has two writers onto one pipeline: a build script in Node and the editor's save path in the Worker. Anything computed over the whole corpus must be computed identically by both, or live somewhere neither owns. This rule was learned three times.

First, git dates. Displaying "last updated" from git history seems natural, until you notice the gated artifact is generated before the commit that contains it, so a git-derived date in the artifact records the previous commit and the next build computes a different one. The gate would go red after every ordinary content commit, by construction. Revision dates moved to sync time, outside the gated artifact.

Second, related posts. Relatedness is a property of the set: adding one post changes the related lists of others. Both writers therefore recompute it over the whole corpus, not incrementally, because an editor save that updated only its own post's list would leave the artifact inconsistent with a fresh generation, and the gate exists to notice exactly that.

Third, and this one is an operational hazard with a name in the docs: deploying a Worker whose pipeline differs from main lets the live editor write artifacts main cannot reproduce. It happened mid-session, measured on a clean checkout, when a phase-3 Worker was deployed from a branch and an editor save committed an artifact in the new shape against pre-phase-3 main. The standing rule now: a branch deploy that changes the pipeline makes the editor a gate-poisoner until that branch merges.

## Social cards that stay out of the gate

Open Graph images are generated with satori and resvg: 1200 by 630, site-branded, stored in R2 under a key of the slug plus an FNV-1a hash of slug, title, and description, served immutable. A per-post cover image wins when present, checked at both layers.

Two decisions here carry the article's weight. Generation is build-time only, in Node, because the numbers said so: the Worker-compatible rendering path would have added 1.87 MB to a Worker already carrying 3.46 MB plus 0.44 MB of WASM, for code that runs only on the admin save path, and the resvg WebAssembly build requires the runtime compilation Workers refuse. So a post created or retitled in the editor has no card until the next build and sync. The editor stores no URL rather than one that 404s: the failure mode is a missing image, never a broken one.

And nothing about the card entered the gated artifact, including the key, which is deterministic and could have. The reasoning is the citable unit: whether an R2 object exists is a fact about R2, not about the markdown, and the gate compares statements about the markdown. The card's location is a database column instead. The PNG bytes were never a candidate, for exactly the reason the syntax-highlighter incident taught about byte comparisons and rendering stacks.

## Version history as a window, not a mechanism

The admin's version history lists a post's commits via the GitHub API, shows diffs, and restores. Restore does not rewrite anything: it produces a new commit through the same atomic two-file save path, with prior history untouched, verified live (restore commit 0d72577, both earlier commits intact, gate green immediately after). Restored content re-runs the validation gates, closing a hole that is easy to miss: without it, restoring an old commit would be a way to publish prose that predates a rule and was never checked against it.

Autosave, by contrast, deliberately never commits. Drafts persist locally in the browser with restore-on-return, verified across a forced reload, and the commit button remains the only writer. A system whose safety story is "every change is a reviewed commit" cannot also have a background process quietly committing keystrokes.

## The refusals

What this phase did not build is part of its engineering record. No comments, pending a decision rather than by default. No view counters yet; that needs its own measured session. No rich text editor: a textarea plus a preview rendered by the one true pipeline shipped first, and WYSIWYG remains a separate future decision rather than an assumption. No 103 Early Hints, because measurement showed the setting requires a zone and this hostname is not one until DNS cutover; that is a recorded fact, not a skipped config. Each refusal has a sentence in the docs saying why, which is the cheapest insurance against a future session helpfully building the wrong thing.

## Disclosure

The zero-JS claim is scoped to public reading routes; the admin plane requires JavaScript and makes no such promise. The bundle figures are from the production build on the cited commit and will drift as features land; the gate that matters is not the number but the rule that produced it, which is that nothing on the reading path may require script, and every enhancement must name its fallback before it ships.
