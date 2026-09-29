---
path: /software/capsid
title: "Capsid"
seo_title: "Capsid: a namespaced document store on Workers"
description: "Capsid holds versioned markdown in namespaces, with typed edges and search. This site's rulings live in it. It has no public product site."
schema_type: SoftwareApplication
code_repository: https://github.com/DrDustinEdwards/capsid-mcp
---

## This site and the agents that work on it

Capsid is a knowledge store on Cloudflare Workers and D1 for this site's specifications and rulings, and for an agent whose long-term memory should be a database rather than a folder of notes. It holds versioned markdown in per-project namespaces, with typed edges between documents, search, an attributed audit log, and integrity linting. It is live and has no public product site, with the roster's repository at [capsid-mcp](https://github.com/DrDustinEdwards/capsid-mcp) and the [colophon](/colophon) describing how this site uses it.

## Why the name

A capsid is the protein shell of a virus. It encloses the virus's genome, protects it outside a cell, and helps carry it into the cell it infects. Capsid does a similar job for AI agents: it keeps their instructions and decisions between sessions, and delivers them at the start of each new session, so an agent begins with what earlier sessions settled. Its dashboard, the Capsid Portal, is named for the portal protein through which a phage's DNA is packed into its capsid and later released.
