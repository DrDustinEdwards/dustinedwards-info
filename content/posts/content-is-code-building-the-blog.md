---
title: "Building a Git-Backed Blog on Cloudflare Workers and D1"
slug: content-is-code-building-the-blog
description: "How to build a content pipeline where markdown in git is the source of truth and D1 serves every read: a deterministic renderer, a byte-comparison build gate, atomic two-file commits via the GitHub Git Data API, and the two bugs to expect."
date: 2026-07-28
tags: [cloudflare, d1, content-model, architecture, workers]
draft: false
first_published: 2026-07-30
---

This article describes a method for building a blog's content layer so that the repository is the source of truth, the database is a serving layer, and a build-time check proves the two agree. I use it in production on this site. The article is written so that a reader with working knowledge of TypeScript, git, and a Cloudflare Workers project can reproduce the architecture, and it includes the two failure modes I encountered that I believe most implementations will also encounter, at the point in the procedure where they will appear.

A note on scope before beginning. The method assumes a single author or a small set of trusted authors, content volumes in the hundreds to low thousands of documents, and a willingness to treat prose with the same discipline as code. At substantially larger scales, or with untrusted authors, several of the trade-offs below change, and I flag those points where they occur.

## Step 1: choose where the words live, and why it matters more than it appears

A blog's content has to live somewhere, and the common candidates are: sanitized HTML in a database, authored through a rich editor; markdown in a database, authored through an admin form; markdown files in the repository; or a third-party headless CMS. Before this build I had production experience with the first two, across three sites, so the comparison here is empirical rather than speculative. All of the candidates work, in the sense that pages render. The differences appear in the properties you can enforce and the failure modes you inherit.

The architecture this method produces: markdown files in the repository are authoritative; a generator renders them and emits a committed artifact plus database rows carrying both the source and the rendered HTML; a check script fails the build whenever the committed artifact disagrees with a fresh generation from source; and the database serves every page read and owns full-text search.

Four properties motivated the choice, and I recommend evaluating your own situation against each rather than adopting the conclusion.

First, enforcement. Anything you can express as a lint rule, a schema, or a hook can gate a file at commit time, and none of it can see a database row. If your project enforces style rules on code, storing prose in the database creates exactly one class of text those rules cannot reach. Second, redundancy. With files, git is a complete second copy of the content. This stopped being an abstract benefit during the build, when I measured that Cloudflare's `wrangler d1 export` command fails outright on databases containing FTS5 virtual tables, which is precisely what a search feature adds. A database-authored site with search may be holding the only copy of its prose behind a broken default backup path, and I would encourage any reader in that position to test an export today. Third, determinism. Content fixed at generation time makes assertions such as "every post has a meta description" build failures rather than periodic audits. Fourth, machine authorship. With content as files, an AI agent's edits arrive as reviewable commits rather than as UPDATE statements against production; that property becomes load-bearing in the later articles in this series on agent-operated publishing.

The cost, stated plainly: publishing now requires producing a commit, which binds authoring to something that can reach the repository. Step 5 addresses this with a server-side path, but the dependency is real and permanent.

## Step 2: build exactly one renderer, and pay for it knowingly

The pipeline itself is conventional unified-ecosystem tooling: remark with GitHub Flavored Markdown and footnotes, rehype for HTML, heading anchors with a table of contents extracted during the same pass, a small directive syntax for figures that makes alt text mandatory, image dimensions probed at build time and written into every tag to prevent layout shift, and Shiki for syntax highlighting applied at render time so that highlighted code ships as static HTML with no client-side JavaScript.

The architectural rule that matters is that exactly one renderer module exists, imported by both the build scripts (Node) and the Worker (the editor's preview and save path). The reason is the gate in step 3: it compares bytes, and if two renderers exist, a mismatch is ambiguous between drift and implementation difference, which makes the gate useless. One renderer makes every byte difference meaningful.

The rule has a measurable price, and you should measure yours before accepting it. Bundling full Shiki into the Worker produced a 14 MB output, because Shiki includes every grammar. Restricting to `shiki/core` with an explicit nine-language allowlist brought the highlighter to roughly 615 KB gzipped and the Worker from 1.49 MB to 3.55 MB. A language outside the allowlist renders as plain unhighlighted code, identically everywhere, which is the correct degradation. Record the bundle cost in your decision log with the alternative you rejected, because a future maintainer will otherwise be tempted to split the renderer to save megabytes, and the megabytes are cheaper than a blind gate.

## Step 3: the gate, and the requirement to break it before trusting it

The gate is a script, run in the build and before deploys, that regenerates the artifact from source and byte-compares it against the committed version, failing with the differing file named. Conceptually it is small. Its value depends entirely on a verification habit that I want to state as a rule: a gate you have never observed failing has not been verified. Before relying on it, attack it deliberately. I used four plants: a hand-edited artifact, a stale artifact after a source edit, a deleted artifact, and invalid frontmatter. It caught all four with usable messages. Only then does a green result mean anything.

Mine then caught two conditions I had not planted, and both are worth knowing in advance because neither is specific to my implementation.

## Expect this bug: one commit, different bytes on different machines

The first fresh checkout on a Windows machine failed the gate on two visually identical lines. The cause is git's `core.autocrlf=true` default in the absence of a `.gitattributes` file: the checkout rewrites line endings to CRLF, the generator embeds that markdown into the artifact and the database, and the same commit produces different published bytes depending on which machine ran the build. The fix is a `.gitattributes` entry pinning content paths to LF. Verify it the way the bug demands: clone to a temporary directory on the affected platform before and after, because this class of defect survives any gate that only ever runs on one machine. If your pipeline embeds file contents into generated output and your contributors span operating systems, I would treat this as a certainty rather than a risk.

## Expect this bug: a nondeterministic syntax highlighter

The second finding took longer to isolate and I have not seen it documented elsewhere, so I will state it carefully and scope it honestly. Shiki's JavaScript regex engine, in the version and grammar set I tested, is not deterministic: eight renders of one TypeScript snippet within a single process produced two distinct outputs, and separate processes colored the same `=` token with three different theme colors. Token boundaries and output length were stable, which is why the variation hides; only the color assignments moved. Against a byte-comparison gate this is fatal, since the gate fails at random on any post containing code, and the natural misdiagnosis (I made it) is that the pipeline changed rather than that the renderer is stochastic.

The resolution was switching to the Oniguruma engine, which was deterministic over the same test set. Oniguruma is a WebAssembly build, and Cloudflare Workers refuse runtime WebAssembly compilation as a security policy, so the loader that compiles bytes at runtime fails inside the Worker. The working arrangement is an injected loader: Node keeps the byte import, the Worker statically imports the compiled module, and both sides run the same engine with byte-identical output, at a bundle cost of 0.44 MB. My claim is scoped to the versions and grammars I measured; the procedure I would recommend regardless of version is to render one code-bearing document a few hundred times, in and across processes, and diff the outputs before you build anything that assumes rendering is a pure function.

## Step 4: make every save one atomic commit

If a browser editor (or any server-side writer) joins the pipeline, the write path order is: validate, commit, then database. Validation runs server-side inside the action, because a commit made through GitHub's API bypasses every local hook; whatever your pre-commit machinery enforces must be re-enforced here or it is not enforced at all. In my implementation a save containing a prohibited character is rejected with the character, line, and column named, before any commit exists.

The commit shape is the part I would most emphasize, because the naive version fails structurally rather than occasionally. Writing one file per save through GitHub's Contents API leaves the generated artifact one commit behind its source, which means the drift gate is red on the main branch after every save, as routine. The correct construction uses the Git Data API to land the markdown and the regenerated artifact as a single commit, in four calls: create a blob per file, create a tree containing both against the base tree, create a commit whose parent is the base, then update the branch reference. The base commit hash you started from doubles as optimistic concurrency control: pass it when updating the reference, and a concurrent save from another tab is refused with the divergence named and no commit created. I verified this live with two editors racing; one landed, one was refused, nothing was overwritten.

Order the database write after the commit succeeds, and fail the save whole if the repository is unreachable. The asymmetry is deliberate: a failed save is an inconvenience, while a database that disagrees with its source of truth is a standing lie that every later read repeats.

Version history then costs almost nothing, because git already holds it: list the file's commits, diff them, and implement restore as a new commit through the same atomic path rather than any history rewrite. One subtlety worth copying: restored content re-runs the validation gates, which closes a hole where restoring an old commit would republish prose that predates a rule and was never checked against it.

## Step 5: what to check when you are done

A checklist, in the order I would run it on a fresh implementation. Clone to a temporary directory on a second platform and run the gate; this exercises the line-ending defect. Render a code-bearing document repeatedly and diff; this exercises determinism. Plant each gate violation and confirm the failure names the file. Save from the editor and confirm exactly one commit carrying both files. Race two saves and confirm one refusal with no commit. Take the database offline (or revoke the token) and confirm the save fails whole. Export your database the way you believe your backup works, and read the output file, because an empty file exits successfully.

## Limitations and disclosures

The Worker carries the full rendering pipeline, 3.55 MB at the time the pipeline landed against 1.49 MB before it, and the figure has grown since with unrelated features; the trade was accepted with the measurement recorded, and a project with tighter size constraints could run the renderer only at build time by giving up the server-side editor preview and accepting a weaker gate. Social card generation in my implementation runs at build time only, because the rendering stack's WebAssembly requirements do not fit the Worker's compilation policy; a post published from the editor has no card until the next build, a gap I chose over the alternative of a broken image reference. The nondeterminism finding is scoped to the engine, grammars, and snippet set I measured, reproduced across processes; I make no claim about configurations I did not test. And the single-author assumption from the introduction matters here: with many concurrent authors, the one-commit-per-save model produces reference-update contention that this design does not address.

The property the method buys, stated once: the prose passes the same gates as the code, the database serves without holding custody, and the build can demonstrate, on every run, that what readers receive is what the repository says. Each of the remaining articles in this series builds on that foundation, and the next one covers the reading experience built on top of it under a strict no-client-JavaScript constraint.
