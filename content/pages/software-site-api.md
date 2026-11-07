---
path: /software/site-api
title: "site-api"
seo_title: "site-api: the contract Carrel uses to publish to a site"
description: "site-api is the contract Carrel uses to list, edit and publish a site's content. Each of Dustin Edwards's sites mounts the same handler."
schema_type: SoftwareSourceCode
code_repository: https://github.com/DrDustinEdwards/site-api
license: https://spdx.org/licenses/MIT.html
programming_language: TypeScript
---

## The contract with Carrel

site-api is the contract [Carrel](/software/carrel) uses to list, edit and publish this site's content. Each site mounts one handler and implements an adapter over its own storage, so Carrel talks to every site the same way. It is MIT licensed.

## Source

[DrDustinEdwards/site-api on GitHub](https://github.com/DrDustinEdwards/site-api). The [colophon](/colophon) describes how this site uses it.
