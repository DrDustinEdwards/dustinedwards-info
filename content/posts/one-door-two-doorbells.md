---
title: "One door, two doorbells: what an API is, what MCP is, and why the policy lives in only one of them"
slug: one-door-two-doorbells
description: "APIs and MCP servers are layers, not rivals. The door holds the lock; the doorbells introduce themselves. Getting the layering backward is how policy drifts."
date: 2026-07-30
draft: true
tags: [mcp, api, architecture, agents]
---

The internet has a thousand posts comparing APIs to the Model Context Protocol, and most of them frame it as a rivalry: the old way versus the AI-native way. This site now runs both in production, twice over, so this article can make the comparison with receipts instead of vibes. The claim it defends: an API and an MCP server are not competing answers to the same question. They are layers answering different questions, and the failure mode worth writing about is building them as if they were peers.

## The door

An API is a durable contract. This site's operator API is an HTTP endpoint on the site's own Worker: present the bearer token, submit an operation, and the server runs the content gates, enforces the publication policy, applies the rate limit, and lands one atomic commit. Any program that can make an HTTP request and holds the credential can use it: a script, a scheduled job, a CI step, an AI agent that speaks plain HTTP, or the MCP layer this article gets to shortly.

The durable part is the argument. HTTP with bearer authentication has been stable for decades. The payloads are documented, the refusals name their policies, and nothing about the surface assumes anything about who is calling. Every rule this system enforces exists exactly once, at this layer, which means there is exactly one thing to audit, one thing to test, and one thing that can be wrong.

## The doorbell

MCP answers a different question: how does an AI assistant discover that the door exists and what it accepts, without anyone writing integration code for that specific assistant? Connect an MCP server to a client and the tools arrive as protocol: names, typed parameters, descriptions, annotations. The description is the integration. That is genuinely valuable and this article will not pretend otherwise. The reason a thousand tools became agent-callable in two years is that MCP collapsed the many-models-times-many-tools integration problem into writing one server per tool.

But notice what the doorbell does not do. It does not decide who may enter or what they may do inside. On this site, when an agent calls the save tool, the wrapper translates that call into the same bearer-authenticated HTTP request anyone else would make, and the API, not the wrapper, decides. The wrapper contains no policy at all, and a check script in its repository mechanically asserts as much: no imports from the site's code, no database binding, no repository credential. If the MCP layer vanished tomorrow, nothing about what is allowed would change.

## The read side proved it first

This layering was not invented for the publish path. The site's search shipped the same shape months earlier, in three levels: a URL anyone can construct, the same URL returning JSON under content negotiation, and an MCP endpoint an agent can query conversationally. Three doorbells, one engine. The removability was tested by doing it: turning the MCP level off changed nothing underneath, and the classic payload was byte-identical to the day before the AI layer existed. A doorbell you can remove without touching the door is a doorbell wired correctly.

## Why the policy must live in only one of them

The counterfactual is where this stops being aesthetics. Imagine the wrapper implemented its own checks: its own draft rules, its own first-publish reservation, its own rate limit. Now the system has two policies that started identical, and two policies drift, because every future change lands in one place first and the second place sometimes never. This site has already paid that tuition in a different domain: it runs exactly one markdown renderer, imported by both the build scripts and the server, because two renderers once threatened to make the repository and the database disagree about what a post looks like. Two enforcement points are the same bug wearing different clothes.

There is also a blunt stability argument with dates attached. The MCP specification's 2026-07-28 revision, current as this article publishes, is a breaking change: the largest since the protocol launched, removing the session handshake and reworking authorization. It is a good revision, and it arrived with a formal deprecation lifecycle promising twelve-month windows going forward, which is real maturity. But a protocol that can rework its transport in a breaking revision is a volatile layer, and volatile layers belong on top of durable ones, never under them. When this site's wrapper needed rework to track the new revision, the rework touched translation. The policy did not move, because the policy does not live there.

## What each layer is actually for

Use the API when the caller is software you control or software that lives longer than a protocol era: scripts, cron, deploy tooling, tests. Use MCP when the caller is an AI assistant whose value is ambient discovery: tools appearing in a conversation, described well enough that the agent uses them correctly without bespoke glue. This site's own agent workflow uses both in one motion: the assistant calls the MCP tool, the tool calls the API, the API refuses or commits, and the refusal prose the agent reads is the API's own, passed through verbatim, because a doorbell that paraphrases the lock is lying to the visitor.

The one asymmetry between this site's two layers is deliberate and instructive. The API can do everything operators are allowed to do. The MCP layer can do exactly the same, no more, because it is incapable of more. Anything MCP can do here, the API can do; the reverse is not true, and any design where the reverse is true has hidden policy in the presentation layer.

## Disclosures

This comparison is scoped to one trust model and one workload: a single-operator publishing system where the expensive mistakes are policy drift and unaudited writes. Systems with different economics can defensibly weigh the layers differently. MCP's value is real and growing, and nothing here argues against building MCP servers; it argues for building them thin. And the specification claims carry their date, 2026-07-28, because the one certain thing about a young protocol is that a sentence describing it will eventually be wrong.

The short version, suitable for stealing: build the door once, with the lock in it. Add doorbells freely, and make sure every one of them is just a doorbell.
