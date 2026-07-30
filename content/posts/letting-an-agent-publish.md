---
title: "Letting an agent publish, and the one thing it may not do"
slug: letting-an-agent-publish
description: "An AI operator with real write access to a production site, the single asymmetry enforced in code rather than requested in a prompt, and the leak that found the gap anyway."
date: 2026-07-30
draft: true
tags: [cloudflare, agents, mcp, security, architecture]
---

This site can now be operated by an AI agent. Not read by one, which has been true since launch, but operated: an agent can create posts, edit live ones, withdraw them, and restore them, and every one of those actions lands as a commit in the repository with the agent's marker on it. This article is about the trust model that makes that acceptable, the one thing the agent is structurally prevented from doing, and the leak that happened anyway on the path's first real use. The transcripts and commit hashes are all real, because half of this article is evidence rather than description.

## Agent-accessible is not agent-operable

The distinction this article needs did not have a name when the work started, so here is the one I use. A site is agent-accessible when an AI system can read it well: this site serves markdown twins of every post, returns search results as JSON to anyone who asks with an Accept header, publishes llms.txt, and exposes its search as an MCP endpoint. All of that is read access, and the cost of getting it wrong is mostly wasted tokens.

A site is agent-operable when an agent can change what the site says. The entire cost of that second property is the trust model, because a write path without one is a vandalism path with better documentation. The interesting question is not whether an agent can write to a production site, which is trivially achievable and routinely done badly. It is what an agent must be structurally prevented from doing, and whether that prevention is enforced or merely requested.

Requested means a prompt: please do not publish without approval. Enforced means a code path: the request returns 403 no matter what the prompt said. Everything in this article is the second kind.

## The same door as the human

The operator layer is a bearer-authenticated API whose five operations call the same server module the browser editor calls. Same frontmatter validation, same prose gates, same single atomic commit carrying the markdown and the regenerated content artifact together, same database sync, same search index sync. There is no second write path, and that is the design's central claim rather than an implementation detail.

The counterfactual is the argument. A separate agent-facing write path would have been the easy version, and it would have made the repository and the database able to disagree about whether a save happened, which is precisely the class of bug the site's whole content architecture exists to prevent. One door, two kinds of visitor, every rule checked at the threshold regardless of who is knocking.

The finding worth stating plainly, because I budgeted wrong: exposing the machinery to a second caller required no refactor at all. The editor's earlier construction had already separated the save machinery from its HTTP adapter, so the browser route turned out to be a 55-line form-data shim over a callable module. A seam built for one caller was already the seam the second caller needed. Good boundaries pay compound interest.

## One asymmetry

The agent may create posts, edit them, unpublish them, and republish them. It may not perform a post's first transition from draft to public. That single act is reserved for the human administrator, and the reservation is a choice I will defend rather than a standard I can cite.

First publication is the irreversible outward-facing act. It is the moment a draft reaches the feeds, the sitemap, the search index, and the AI answer layer, and becomes a public claim under a named person's byline. Everything after that moment is editing something already public, which is reversible in a way that debut is not. So the policy grants the agent the entire lifecycle except the debut.

Here is the refusal exactly as the agent receives it, from the live system:

> Refused: publishing a post for the first time is reserved to the human admin. This post has never been public, so an operator cannot set draft to false on it. Save it as a draft (draft: true) and ask Dustin to publish it from /admin/posts. Once it has been published once, an operator may unpublish and republish it freely.
> policy: first-publish-requires-admin

A refusal that names its policy, explains the rule, and states the permitted alternative is a system behaving correctly, and the agent's tooling describes it that way in advance so no agent mistakes it for an error to retry.

## Where the fact lives, and the forgery it has to survive

Enforcing that asymmetry needs a durable answer to a question current state cannot answer: has this post ever been published? A post sitting at draft: true is either brand new, in which case the agent must be refused, or previously published and withdrawn, in which case the agent may freely republish it. The two states are identical in the present tense and opposite in policy.

The answer lives in the post's own frontmatter as a first_published date, and the security-critical property is that the server treats it as system-owned: the value is read only from the committed file and overwritten on the way out of every save. Without that overwrite, the design has a hole wide enough to drive a publish through: an agent could submit first_published in its own payload, asserting the very fact the gate checks, and promote any draft to publishable. The gate has a paired forgery test, and I watched it fail with exactly the two forgery cases before trusting it, because a guard that has never been observed failing has not been verified.

The rejected alternative matters as much as the chosen one. Storing the fact in a database column fails open: this site's admin has a repair action that rebuilds database rows from the committed artifact, and a security fact that quietly vanishes during a routine repair is worse than one that was never recorded. Facts about content live in files, where git remembers them and gates can see them.

## The round trip, on camera

The path was verified live before this article was written, because half the claims here are only worth making as transcripts. The sequence: the agent created a draft, and the commit carried both the markdown and the regenerated artifact with one parent and the operator marker in the message. The draft was verified absent from the blog index, both feeds, the sitemap, llms.txt, the search index, and the public answer layer. The agent attempted to publish it and received the 403 above, after which the post still read draft: true with no first_published, because a refusal that writes anything is not a refusal.

Then the human published it from the browser, and the same save stamped first_published into the frontmatter in the same commit. The agent edited the now-live post, and the stamp survived untouched. The agent unpublished it, then republished it, and the republish succeeded precisely because the fact now existed, which is the entire distinction the frontmatter design carries. A forged new draft carrying first_published in its payload was rejected naming the field. A save containing a wide dash was rejected naming the line and column. And in the git log, the human's publish commit sits unmarked between operator-marked commits, which means the repository's history can answer "did an agent write this" without cross-referencing anything.

## The leak, which is the part worth the price of admission

On the operator path's first real use, staging five article drafts, the agent did everything right, the policy held, and the drafts were correctly excluded from eight public surfaces. They leaked anyway through a ninth. The site's AI answer layer, a public unauthenticated endpoint, answered a question from an unpublished draft and cited it by slug, found by probing live with a phrase only that draft contained.

The mechanism generalizes, which is why it belongs in this article rather than a changelog. The classic search index filters drafts at query time. The AI layer cannot, because its index has no per-item status a query can filter on, so exclusion has to happen at upload time, and the upload path had simply never been wired into the visibility rule. Nobody decided drafts should reach it; nobody decided anything, which is the point. A visibility policy is only as real as its least-connected surface, and every new surface is a new obligation that no one audits by default.

Underneath it sat a second bug that made the first fix report success while a draft stayed answerable: the index's listing API is paged, all call sites made a bare first-page call, and a purge over posts whose entries sat on later pages reported removed: 0, which reads as nothing to remove rather than I only looked at page one. Both are fixed and gated now, and the gate was verified by removing each filter and watching it fail. But the honest summary is that the trust model held and the inventory of surfaces did not, and of the two, the inventory is the harder problem.

## The boring parts, which are not boring

Token comparison is constant-time with both operands hashed to a fixed width first, so length does not leak through the loop bound either. Rate limiting reuses the site's existing Durable Object counter on its synchronous storage API rather than adding a new mechanism. And the measurement that almost lied: a sequential test loop of 36 requests against a limit of 30 per minute produced zero refusals, reading exactly like a dead limiter, because each awaited request walked the loop across the fixed window boundary. The same limit attacked with 45 concurrent requests refused 19. This site's records had already documented that exact trap for a different guard, and the test walked into it anyway. A sequential loop is not a burst, and a limiter that never fires under polite load is not necessarily broken.

## Disclosures

The policy protects against an agent publishing, not against a compromised operator token, whose holder can still edit live posts and delete drafts; the mitigation is that every action is a visible, revertable commit and the token rotates in two minutes. The rate limiter's fixed window admits up to double the limit across a boundary, by construction, and the daily ceiling bounds abuse rather than preventing it. And the surface-inventory lesson is stated as a finding, not a solved problem: the fix wired the ninth surface into the rule, and the tenth surface, whenever it is built, will be someone's obligation to remember.

This post was drafted by the agent and staged through the operator path it describes, as a draft, because that is all the agent may do. The commit this file arrived in carries the operator marker. The publish click, like every first publish on this site, belonged to a human.
