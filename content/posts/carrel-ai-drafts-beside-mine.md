---
title: "Carrel, part 3: AI drafts sit beside mine, never on top"
slug: carrel-ai-drafts-beside-mine
description: "How Carrel lets an AI assistant draft, check and preview writing without ever replacing the writer's text or publishing on its own."
date: 2026-10-04
tags: [carrel, ai, writing, agents]
writing_status: finished
assumed_audience: "Writers and developers deciding how much an AI assistant should be allowed to touch."
key_takeaways:
  - "An AI draft is saved next to the writer's draft and never replaces it."
  - "Publishing publishes only what the writer saved, and only on the writer's instruction in that conversation."
  - "Open flags from checks hold publication until the writer fixes the text or dismisses the flag."
draft: true
---

[Part one](/writing/carrel-a-writing-desk-apart-from-the-site) covered why Carrel exists and [part two](/writing/carrel-one-api-for-every-site) covered the small API each site exposes to it. This part covers the question I get most: what is AI allowed to do in there?

The short answer is that AI can help with almost everything except the two things that make writing mine: deciding what the words are, and deciding when they go public.

## Beside, never on top

Carrel connects to AI assistants through an MCP server. An assistant can list a site's items, read a post, run the checks, render a preview and save a draft. The save is the part that needed the most care.

When an assistant saves a draft, Carrel stores it as an AI draft beside my own draft. It never replaces my draft, and it never replaces the text on the site. In the editor I see my version and the AI version side by side, and I decide what, if anything, to take. Every tool description repeats the same line to the assistant, that AI never rewrites my prose unasked, so the rule is in front of the model before its first call rather than discovered after a refusal.

Asking is the switch. If I ask for a draft, the assistant writes one. If I ask for a review, it flags problems instead of fixing them.

## Flags hold the door

Carrel runs checks on save: missing sources for factual claims, continuity slips, broken links, and a list of habits that make prose read as machine-written. A check that finds something raises a flag on the post. A reviewer, human or AI, can raise one too.

An open flag holds publication. The post cannot go live until I fix the text or dismiss the flag. That is a small rule with a large effect, because it turns "the AI noticed something" from a comment I might skim into a gate I have to pass.

## Publishing stays with a person

The publish tool has three limits:

1. It publishes only on my explicit instruction in the current conversation. An assistant cannot decide that a post is ready.
2. It publishes what I saved, never the AI draft. No text travels with the publish call, so an assistant cannot slip in a last edit.
3. It must name the version it expects. If the post changed since the assistant last read it, the publish is refused.

After a publish, Carrel records which client published it on my instruction, and emails me a link to unpublish. If something goes out that should not have, undoing it is one click from my inbox.

## This series, as an example

These three posts were drafted by an AI assistant at my request, as a test of the whole path. The drafts landed beside mine in Carrel, the checks ran, I read and edited them, and I accepted them into my own draft. The publish happened from Carrel on my instruction, through the API from part two, which recorded who did it.

That is the arrangement I wanted: help with the typing, the checking and the plumbing, and a clear line around the parts that are mine.
