---
path: /software/d1-dump
title: "d1-dump"
seo_title: "d1-dump: per-table D1 backup and restore"
description: "d1-dump backs up each table of a Cloudflare D1 database to the site's own R2 bucket and restores it, including databases with full-text search tables."
schema_type: SoftwareSourceCode
code_repository: https://github.com/DrDustinEdwards/d1-dump
---

## Backups that work with full-text search

d1-dump backs up each table of the database to the site's own storage and restores it. The database's own export cannot handle tables with full-text search, which this site uses. It is MIT licensed.

## Source

[DrDustinEdwards/d1-dump on GitHub](https://github.com/DrDustinEdwards/d1-dump). The [colophon](/colophon) describes how this site uses it.
