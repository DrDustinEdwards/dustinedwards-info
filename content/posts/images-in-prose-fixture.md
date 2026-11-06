---
title: "Images in prose: the pipeline fixture"
slug: images-in-prose-fixture
description: "A permanent draft fixture carrying a media library photograph in prose, so every stage that handles a picture inside a post runs against real bytes on a real route rather than against a synthetic string."
date: 2026-09-06
tags: [meta, testing, media]
draft: true
cover:
  src: /media/dustin-edwards-2017-c3c4391fff3ce67a-1080x810.webp
  alt: "Group photo of the 2017 Phage Discovery Program cohort"
---

This post is a fixture. It exists so that the image half of the pipeline has real
subject matter in the corpus, which is what lets `check:content` render it twice
and byte-compare the result like any other post. The prose is deliberately thin.

Here is why it is worth carrying. Until 2026-09-06 the corpus held no body images
at all, so every stage that handles a picture inside prose had only ever run
against a fixture string in a test file. A test proves a function can parse a
form. It does not prove that the artifact a reader is served carries the right
attributes, and those are different claims. The gap was not theoretical: the
responsive ladder was returning images larger than the originals for months, and
nothing noticed because nothing in the corpus asked for one.

One photograph is cited twice, as the cover in the frontmatter and as the
markdown image below, and both point at the library file the site serves from
its media bucket, at its stored size, in the sizes and formats the image route
makes on request.

The photograph is neither created nor destroyed by this post. Deleting it must
leave the file exactly where it was.

## The library form

![Group photo of the 2017 Phage Discovery Program cohort](/media/dustin-edwards-2017-c3c4391fff3ce67a-1080x810.webp)

That is the whole fixture.
