---
title: "Test Post: The Image Rendering Path"
slug: image-path-test
description: "A temporary test post that cites one image three ways, so the media reference collector and the prose image renderer run against a real asset on a real route instead of a fixture. Scheduled for deletion."
date: 2026-09-01
tags: [meta, testing]
draft: true
cover:
  src: /phage-hunters/2017.webp
  alt: "Group photo of the 2017 Phage Discovery Program cohort"
---

This post exists to exercise the image path. It is not an article, and it will be deleted once the path has been proven.

Here is why it is worth the trouble. The corpus carries no body images at all, so every stage that handles a picture inside prose has only ever run against a fixture. A fixture proves that the collector can parse a form. It does not prove that a reader loading the published page gets a working image, and those are different claims.

One asset is cited three ways: as the cover in the frontmatter above, as a markdown image below, and as a figure directive with a caption. Each form should produce its own row in the reference table, and all of them should name the same key.

The asset is a cohort photograph that the site already places elsewhere, so it is indexed, it carries alt text, and nothing about this test creates or destroys a file. Deleting this post must leave that image exactly where it was.

## The markdown image form

![Group photo of the 2017 Phage Discovery Program cohort](/phage-hunters/2017.webp)

## The figure directive form

:::figure{src="/phage-hunters/2017.webp" alt="Group photo of the 2017 Phage Discovery Program cohort"}
The same photograph, carried by a figure directive so that the caption has somewhere to live.
:::

That is the whole test.
