---
title: "Images in prose: the pipeline fixture"
slug: images-in-prose-fixture
description: "A permanent draft fixture carrying the same photograph as a static asset and as an uploaded object, so every stage that handles a picture inside prose runs against real bytes on a real route rather than against a synthetic string."
date: 2026-09-06
tags: [meta, testing, media]
draft: true
cover:
  src: /phage-hunters/2017.webp
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

One photograph is cited three ways across two storage paths. The cover in the
frontmatter and the markdown image below both point at the copy the site serves
as a static file. The third points at the same picture stored as an uploaded R2
object instead.

The split is the point rather than an accident of how the fixture was written.
Only the uploaded copy passes through the transform route, so only it gets a
`srcset` and a `sizes`. A static file is served as itself. And only the static
copy carries a placeholder, because a placeholder has to be derived from the
repository at build time for both writers to agree on it, and an uploaded object
is not in the repository. That difference is easier to see in one document than
to argue about.

Neither copy is created or destroyed by this post. Deleting it must leave both
exactly where they were.

## The static form

![Group photo of the 2017 Phage Discovery Program cohort](/phage-hunters/2017.webp)

## The uploaded form

The same photograph again, as an uploaded object rather than a static file.

![Group photo of the 2017 Phage Discovery Program cohort](/media/c3c4391fff3ce67a-1080x810.webp)

That is the whole fixture.
