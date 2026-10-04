---
title: "Carrel, part 1: a writing desk that lives apart from the site"
slug: carrel-a-writing-desk-apart-from-the-site
description: "Why the writing for this site moved out of the site's own admin and into a separate private tool, and what that separation buys."
date: 2026-10-04
tags: [carrel, writing, architecture, cloudflare]
writing_status: finished
assumed_audience: "People who run more than one site and are tired of a different editor in each."
key_takeaways:
  - "A site's admin is built around one site; a writer works across several."
  - "Carrel keeps the writing in one private place and talks to each site through the same small API."
  - "The site stays the owner of its own rules; Carrel only asks."
draft: false
first_published: 2026-10-04
---

A carrel is the small private desk in a library stacks, the one with a shelf, a lamp and a door that does not quite close. I named my writing tool after it because that is the job it does: a quiet place to write that sits next to the collection without being part of it.

This is the first of three posts on Carrel. This one covers why it exists. The [second](/writing/carrel-one-api-for-every-site) covers the small API every site exposes to it, and the [third](/writing/carrel-ai-drafts-beside-mine) covers how AI fits into the writing without taking it over.

## The problem with an editor inside every site

This site had its own admin editor, and it worked. The trouble started with the second site. A podcast site has posts too, and so does a product blog, and each one grew its own way to draft, preview and publish. Each editor knew its own site well and nothing else. Moving between them meant remembering which one saved drafts where, which one previewed the real page and which one only showed the body, and which one would let a post go live by accident.

An admin built into a site is built around that site's data. A writer is not organized that way. I think in pieces of writing, not in databases, and the same week might hold a post here, a show note there and a page of documentation somewhere else.

## One desk, many shelves

Carrel is a separate application at its own address, behind Cloudflare Access, so only I can reach it. It does not store the published writing. Each site keeps its own content and its own history. What Carrel keeps is the work in progress: my drafts, notes, flags from the checks it runs, and drafts that an AI writes when I ask for one.

When Carrel opens a site, it reads that site's content through the site's own API and lists everything it finds there. For this site that is more than blog posts. It includes the pages, the CV sections, the phage records, the lab protocols and the publications, each listed as its own kind of item. A post is just one kind.

## The site stays in charge

The important design choice is what Carrel is not allowed to do. It does not reach into a site's database, and it does not hold a site's deploy keys. Every change goes through the same narrow API, and the site decides whether to accept it. If a save arrives against an old version of a post, the site refuses it. If a key tries to do something it was not given, the site refuses that too.

That puts the rules where they already lived. I argued for this pattern in an earlier post about [putting the rules in the API, not in the MCP server](/writing/policy-in-the-api-not-the-mcp), and Carrel is the same idea applied to writing. Carrel is one more caller. Delete it and every site still works, still publishes and still enforces its own policy.

## What it costs

A separate tool is one more thing to run, and one more login. The bet is that the cost is paid once, while the cost of several editors is paid every week. So far the bet has held. This series is the test: it was drafted, checked, previewed and published from Carrel, which is what [part two](/writing/carrel-one-api-for-every-site) explains.
