---
title: "Carrel, part 2: one small API for every site"
slug: carrel-one-api-for-every-site
description: "The contract every site exposes to Carrel: list, read, save with a version check, preview the real page, publish. How this site implements it, and the one rule about first publication."
date: 2026-10-04
tags: [carrel, api, architecture, cloudflare-workers]
writing_status: finished
assumed_audience: "Developers connecting a writing tool to sites they already run, without rebuilding those sites."
key_takeaways:
  - "Each site mounts the same small package and implements an adapter over its own code."
  - "Every save carries the version it was based on, so stale edits are refused instead of overwriting newer work."
  - "Preview returns the full page from the site's own renderer, so what you check is what ships."
draft: true
---

[Part one](/writing/carrel-a-writing-desk-apart-from-the-site) explained why the writing for this site moved into a separate private tool called Carrel. This part covers how Carrel talks to a site, because that contract is the whole design. If it is small and strict, adding a site is an afternoon. If it is large and loose, every site becomes a special case again.

## One package, many adapters

The contract lives in a small package called site-api. A site installs it and mounts its router under one path. On this site that path is `/api/carrel/v1`. The package handles the shape of the conversation: authentication, request validation, error formats. The site supplies an adapter, a set of functions that answer each request using the code the site already has.

That split matters. The package is the same everywhere, so Carrel never needs to know which site it is talking to. The adapter is different everywhere, because a podcast site and a personal site store their writing differently. Nothing in the site had to be rewritten to serve Carrel. The adapter wraps the save, publish and render paths that were already there.

## What the contract covers

The operations are the ones a writer actually uses:

- **List and read.** Carrel asks for the site's items and gets them back with a kind, a status and a version.
- **Save a draft.** Every save says which version it was based on. If the site's copy has moved since then, the save is refused. Two editors working on one post cannot quietly overwrite each other; the second one finds out.
- **Preview.** The site returns the full page as it would be served, built by its own renderer. Not the body in a box, the real page with its header, styles and navigation. What I check in Carrel is what readers get.
- **Publish and unpublish**, through the same publish path the site already used.
- **Revisions**, read from the history the site already keeps.

## A key that can only do this

Carrel holds one key per site, and that key reaches only the Carrel path. It cannot deploy, change configuration, manage users or touch any other admin route. If it leaked, the damage would be limited to what a writer can do on that one site, and revoking it is one secret change on each side.

## The one rule about first publication

This site already had a policy that an automated caller may edit and republish a post but may not publish a post for the first time. That decision stays with a person. The adapter keeps that rule and makes one exception: the Carrel key may perform a first publication, because Carrel only publishes on my explicit instruction. Every other key still gets the same refusal it always did, and the site records who published.

That exception is narrow on purpose. It does not loosen the rule for agents in general; it names one caller that is already gated by a person. How that gate works inside Carrel, and where AI fits in, is [part three](/writing/carrel-ai-drafts-beside-mine).
