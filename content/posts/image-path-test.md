---
title: "Test Post: The Image Rendering Path"
slug: image-path-test
description: "A temporary test post that cites one photograph four ways across two storage paths, so the media reference collector and the prose image renderer run against a real asset on a real route instead of a fixture. Scheduled for deletion."
date: 2026-09-01
tags: [meta, testing]
draft: false
cover:
  src: /phage-hunters/2017.webp
  alt: "Group photo of the 2017 Phage Discovery Program cohort"
first_published: 2026-09-01
---

This post exists to exercise the image path. It is not an article, and it will be deleted once the path has been proven.

Here is why it is worth the trouble. The corpus carries no body images at all, so every stage that handles a picture inside prose has only ever run against a fixture. A fixture proves that the collector can parse a form. It does not prove that a reader loading the published page gets a working image, and those are different claims.

One photograph is cited four ways, and it sits in two places. Three citations point at the copy the site already serves as a static file: the cover in the frontmatter above, a markdown image, and a figure directive with a caption. The fourth points at the same picture stored as an uploaded object instead. Each citation should produce its own row in the reference table.

The split matters because only the uploaded copy passes through the transform route, and the transform route is what supplies a picture at more than one width. A static file is served as itself. Putting both in one post is the shortest way to see that difference rather than argue about it.

Neither copy is created or destroyed by this test. Deleting this post must leave both exactly where they were.

## The markdown image form

![Group photo of the 2017 Phage Discovery Program cohort](/phage-hunters/2017.webp)

## The figure directive form

:::figure{src="/phage-hunters/2017.webp" alt="Group photo of the 2017 Phage Discovery Program cohort"}
The same photograph, carried by a figure directive so that the caption has somewhere to live.
:::

## The uploaded copy

The same photograph again, this time as an uploaded object rather than a static file. Everything above this heading points at one path, and this one line points at the other.

![Group photo of the 2017 Phage Discovery Program cohort](/media/c3c4391fff3ce67a-1080x810.webp)

That is the whole test.
