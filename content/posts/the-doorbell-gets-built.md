---
title: "The doorbell gets built: an MCP server that contains no policy"
slug: the-doorbell-gets-built
description: "Building a publishing MCP server the week the protocol went stable: a fake authorization server to interrogate the real client, a library chosen by conformance score, and a shim that deletes by removing one file."
date: 2026-07-30
tags: [mcp, cloudflare, oauth, agents, workers]
draft: false
first_published: 2026-07-30
---

The previous article described the door: a bearer-authenticated operator API through which an AI agent can manage this site's posts, with every rule enforced server-side. This one is about the doorbell: the MCP server that lets an AI assistant discover and call that API as tools in a conversation. It was built during the single most interesting week to build such a thing, because the Model Context Protocol's 2026-07-28 revision, the largest since the protocol launched, shipped as final two days before this server deployed. Every claim below is dated for that reason, and the repository is public, so the claims are checkable.

## The law the whole design serves

The wrapper contains no policy. Not "little policy", none. Every tool call becomes an authenticated HTTP request to the operator API, where all rules live: the content gates, the first-publish reservation, the rate limits, the commit attribution. If the wrapper vanished tomorrow, nothing about what is allowed would change. The failure this prevents has a family history on this site: two implementations of anything drift, whether they are two markdown renderers or two enforcement points, and a policy that exists in two places is two policies.

The law got a structural guarantee rather than a promise. The wrapper is a separate Worker in a separate repository, which means the cheap path to the machinery does not exist: there is no in-process call that could skip operator auth, because the only route to the machinery is the API itself. And the law got a gate: a check script derives the wrapper's binding allowlist from its own configuration and asserts no imports from the site's codebase, no database binding, no repository token. It currently holds 225 assertions, and its harness catches 13 of 13 planted violations, because a guard never observed failing has not been verified.

## Interrogating the client before writing the server

The spec's authorization story is precise: an MCP server is an OAuth 2.1 resource server, discovery happens through protected resource metadata, tokens are audience-bound. What the spec cannot say is what any particular client actually does this week, and the client that matters here is the one this site's owner uses. Building to the spec and hoping is how you ship an authorization server no client can finish a handshake with.

So the first deploy was not the wrapper. It was a measurement probe: a fake authorization server that walks a connecting client as far as it will go, records everything, and then stops on purpose with a page saying so. The probe had no control plane at all, not even a protected one; its captures were read out of band through the platform's storage API, so there was no credential to leak and no endpoint to defend.

The captures settled every open question. The real client completes the spec's full modern flow: metadata discovery including the path-scoped variant, PKCE, audience-bound token requests, and client identification by metadata document rather than dynamic registration, which meant an entire registration endpoint did not need to exist. And both target clients still open with the previous era's handshake rather than the new stateless one, which converted the compatibility layer from a vestigial politeness into a load-bearing component with an empirically defined retirement condition: it gets deleted when the same probe shows the clients opening the modern way.

One risk the probe could not settle was whether strict audience matching would reject the client's path-qualified token requests against origin-advertised metadata. The permissive flag stayed unset because there was no evidence it was needed, and the first live token exchange proved the strict default fine. Loosening a security control pre-emptively, on a guess, would have been the wrong kind of caution.

## Losing an argument to a scoreboard

I wanted to hand-roll the protocol layer. A dependency-free server is auditable end to end, and a wrapper this small seemed like the right candidate. The conformance scenarios said otherwise: the hand-rolled draft scored 0 of 8 on the new stateless protocol suite and 3 of 8 on header validation, where the platform's maintained library scored 24 of 28 and 13 of 13. Losing to a scoreboard is the right way to lose, and the miss that best explains the score: the protocol's per-request metadata belongs inside the message parameters, not at the message's top level, and a top-level version reads as a malformed message, not a versioned one. My own test harness made exactly that mistake while testing for it, which is the class of error conformance suites exist to catch and hand-rolling multiplies.

The remaining 4 of 28 are named rather than hidden: the library itself lacks one required error type from the new revision, attributed upstream because the dependency-free draft scored identically on that scenario, and four applicable scenarios are not yet wired into the gate. A conformance baseline that names its gaps is worth more than a sweep that quietly skips them.

The compatibility shim earned its own design decision. The library offers legacy support as a configuration default, which would have made "delete the shim someday" mean flipping a vendor flag and hoping. Instead the wrapper rejects legacy traffic at the library level and handles it in one explicitly named file, so retiring the old era is deleting that file and watching the modern-only behavior prove itself. A seam you can delete is a commitment you can verify.

## Two legs, two credentials

The wrapper authenticates twice, and the two credentials answer different questions. The client leg answers who is operating: an OAuth flow gated on the site owner's identity, re-verified on requests rather than trusted from a session. The API leg answers what operators may do: the same bearer token any raw caller would present, which means the API neither knows nor cares that a wrapper exists. An identity failure and a policy refusal therefore read differently, because they are different, and conflating them is how debugging an auth problem turns into misreading a policy as an outage.

The tool descriptions carry the policy in prose. The save tool's own description states the first-publish reservation, tells the agent to check a post's publishability before attempting, and says plainly that the refusal is the system working rather than an error to retry. The agent is constrained by documentation before it ever makes a call, and when the refusal comes anyway, it arrives verbatim from the API, policy name attached, never summarized or softened by the layer in between.

## The proof, in production

The full round trip ran against the live system before this article was written. The OAuth walk completed, both protocol eras answered correctly, the five tools listed with honest annotations, and then the operations: a draft created as one atomic commit, the first-publish attempt refused with the policy named, an edit landing as a second commit, a save containing a forbidden character rejected naming line and column, a malformed slug rejected by the tool's own schema before any network round trip, and a deletion closing the loop. All three commits carried the operator marker. The site's content gate was green afterward. A concurrent burst of 45 requests saw 17 refused with retry guidance, and the arithmetic of the ones allowed matched the window's earlier spending, which a sequential test would have misread as a dead limiter, again.

One number in the save response deserves its sentence: the draft's search-index sync reported zero documents uploaded. That zero is the draft-exclusion rule, the one whose absence caused the leak the previous article documents, now visible in every response rather than asserted in documentation.

## Publishing the template

This repository is the template two future ports will copy, so it went public, and going public meant its configuration file, which this portfolio treats as sensitive, had to leave both the tree and the history. The scrub surfaced three traps worth recording: the history rewrite deletes the local copy of the very file being protected, the rewrite's backup references keep the old objects alive so a naive verification reports failure, and one commit message carried pasted deploy output that a tree-only rewrite cannot see. The remaining residue is disclosed rather than hidden: pre-rewrite objects stay fetchable by hash until the host's garbage collection runs, the exposed content being two storage namespace identifiers, which are addresses rather than keys.

## Disclosures

The era targeting and client findings are dated 2026-07-29 and will rot as clients update; the shim's retirement condition is empirical and the instrument that answers it ships in the repository. The conformance standing is a baseline with named gaps, not a clean sweep. The adds-nothing claim is verified to the depth that the refusal prose, policy names, gate messages, and commit attribution reaching the agent are the API's own, unmodified. And the recursion is the point rather than a flourish: this article was drafted by an agent and staged through the very tools it describes, as a draft, with the operator marker on its commit, because the one thing the doorbell cannot do is decide the door should open for the first time.
