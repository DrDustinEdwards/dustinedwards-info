---
title: "Content is code: building a blog where the database serves and git remembers"
slug: content-is-code-building-the-blog
description: "The content model decision, a gated markdown pipeline, a syntax highlighter that would not give the same answer twice, and an editor whose every save is an atomic commit."
date: 2026-07-28
tags: [cloudflare, d1, content-model, architecture, workers]
draft: false
first_published: 2026-07-30
---

This site's blog looks ordinary from the outside: posts, tags, an RSS feed. Under it is a content architecture I have not seen elsewhere, and this article is the build log, including the two bugs that only running the system could have found. Every claim here is checkable against the repository; commits are cited by sha.

## The decision that shaped everything

Where should a blog store its words? I had three working answers in my own portfolio before this build started, which made the question empirical rather than theoretical. One site stores sanitized HTML in its database, authored through a rich editor. Two store markdown in the database behind admin textareas. All three work. None of them can run a linter over their own prose.

The citable version of the ruling: markdown files in the repository are the source of truth; a generator renders them and emits database rows carrying both the source and the rendered HTML; a check script fails the build when the committed artifact disagrees with a fresh generation; and the database serves every read and owns search. Files own authorship, D1 owns delivery.

Four arguments survived contact with the alternatives. First, enforcement reaches files and cannot reach rows: this repository lints prose with the same pre-commit machinery that gates code, and database-authored text is the one place those rules cannot see. Second, git is a second copy, which stopped being abstract the day this build measured that `wrangler d1 export` fails outright on databases containing FTS5 virtual tables. On the database-authored sites, the database is the only copy of the prose, sitting behind a broken default backup path. Here, losing every backup loses nothing. Third, deterministic pages: content fixed at generation time can prerender, and assertions like "every post has a meta description" become build failures rather than audits. Fourth, agents: with content as files, an AI agent drafts and edits posts as reviewed pull requests instead of running UPDATE against production.

The cost is honest too: publishing binds to a machine holding the repo. Phase two addressed that, below.

## One renderer, priced in megabytes

The pipeline is unified markdown tooling: remark with GFM and footnotes, heading anchors with an extracted table of contents, a directive syntax for figures with required alt text, image dimensions probed and written into every tag, and Shiki syntax highlighting baked into the stored HTML so code ships pre-highlighted with zero client JavaScript.

The architectural rule is that exactly one renderer exists, imported by both the build scripts and the Worker, because the editor's live preview and the published output must be byte-identical or the drift gate below cannot distinguish drift from provenance. That rule has a measured price. Bundling full Shiki into the Worker produced a 14 MB output, because Shiki code-splits every grammar and they all ship. The shipped compromise is shiki/core with an explicit nine-language allowlist at roughly 615 KB gzipped, which took the Worker from 1.49 MB to 3.55 MB. A language outside the list renders as plain code everywhere, consistently. The bundle growth is recorded in the decisions log as a deliberate trade: the alternative was two renderers and a blind gate.

## The gate, and the rule about trusting it

`check:content` regenerates everything from source and byte-compares against the committed artifact. A gate you have never seen fail is a gate you should not trust, so before relying on it, it was attacked four ways: a hand-edited artifact, a stale artifact, a missing artifact, and invalid frontmatter. It caught all four, each with the file and field named.

Then it caught two things nobody planted.

## Bug one: the same commit produced different bytes on different machines

The first fresh checkout on a Windows machine failed the gate, reporting a difference between two visually identical lines. The cause was `core.autocrlf=true` with no `.gitattributes`: the checkout rewrote line endings, the generator embedded that markdown into the artifact and the database, and the same commit would have published CRLF or LF depending on which machine ran the sync. The fix pins content paths to LF in `.gitattributes`, verified by cloning to a temporary directory before and after. This class of bug survives every gate that runs on one machine, which is exactly why the verification step clones fresh.

## Bug two: the syntax highlighter was nondeterministic

The citable finding: Shiki's JavaScript regex engine is not deterministic. Eight renders of one TypeScript snippet in a single process produced two different outputs; separate processes colored the same `=` operator #D73A49, #005CC5, and #24292E. Token boundaries and output length were identical every time, which is why it hid. Against a byte-comparison gate, this is fatal: the gate would fail at random on any post containing code.

It surfaced when the gate went red after an editor save and the convenient explanation, old pipeline versus new, did not survive testing. The Oniguruma engine was deterministic over the same test and is now the ruling, with the JS engine banned in the decisions log so nobody re-adopts it to save bundle size. Oniguruma brought its own lesson: Workers refuse runtime WebAssembly compilation ("Wasm code generation disallowed by embedder"), so the fix is an injected loader in which Node keeps the byte import while the Worker instantiates a statically imported module. Same engine on both sides, output byte-identical, at a cost of 0.44 MB.

## The editor: every save is one atomic commit

Phase two added a browser editor as a second writer onto the same pipeline. The write path is: browser, action, gates, GitHub commit, generate, D1. The gates run server-side inside the action, because API commits bypass local hooks entirely; a save containing an em dash is rejected naming the character, line 14, column 30, before any commit exists.

The commit shape mattered more than expected. The naive approach, one file per save through the Contents API, leaves the generated artifact lagging its source, so the drift gate goes red on main after every save, permanently, as routine. The shipped design uses the Git Data API to land the markdown and the regenerated artifact as one commit: blobs, tree, commit, ref update. The base commit sha doubles as conflict detection; two tabs editing the same head resolve with one save landing (b25c857, f08cc53 in the live test) and the other refused with the exact divergence named, no commit created, nothing overwritten. D1 is written only after the commit lands; if GitHub is unreachable, the save fails whole, because a database that disagrees with its source of truth is worse than a failed save.

Version history came nearly free, since git already holds it: the admin lists per-post commits, diffs them, and restores by producing a new commit through the same atomic path, never rewriting history. Restored content re-runs the gates, so an old commit cannot smuggle prose past a rule adopted after it was written.

## Disclosures

The Worker carries the full markdown pipeline, 3.55 MB at the time it landed, where it started at 1.49, a real cost against this repo's leanness rule, accepted with the measurement recorded and revisited if it grows. Social card generation runs at build time only, because the rendering stack does not fit the Worker's constraints; a post published from the editor has no card until the next build, a gap chosen over a broken image. And the nondeterminism finding is scoped to what was measured: this engine, these grammars, this snippet set, reproduced across processes; I make no claim about versions I did not test.

The system this produced is unusual in one summarizable way: the prose passes the same gates as the code, the database is a serving layer rather than a custody arrangement, and the whole thing can prove, on every build, that what readers see is what the repository says.
