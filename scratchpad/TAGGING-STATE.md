# Slop audit, commit 1: COMPLETE

All 351 blocks tagged blind, then merged with Grok. See the commit message for
the agreement matrix. comment-tags.tsv is my side, comment-tags.grok.tsv is the
second reader as fetched from review/grok-slop at 3a16f0b, and
comment-tags.merged.tsv is what commit 2 applies.

## Corpus

`scratchpad/extract-blocks.mjs` reads `SHEETS` out of `build-inputs.mjs` and
writes `blocks.json` (structured) and `blocks.txt` (readable). 351 blocks
across 22 sheets. Size bands: 112 under 80 bytes, 74 at 80-200, 101 at
200-600, 55 at 600-2000, 9 over 2000.

Re-run it rather than editing the artifacts; the line numbers move on every
cut and the index is positional.

## Rubric in force

KEEP a block that states a prohibition, a why, a cascade/specificity/z-index/
cache rule, or a measured number with its source. Everything else is slop.

Three structural classes decided up front, with their evidence:

**43 blocks are exact later copies** of an earlier block's prose. Nineteen
token annotations appear THREE times each in `app.css` (the light, dark and
figure blocks), and five longer essays appear twice. The definition names
"duplicates of a kept block elsewhere" and "dark-theme copies of light-theme
notes", so every later copy is POINTER at the first occurrence and the first
occurrence keeps its tag on its own merits. This is the single largest bloc
and it carries real prohibitions ("a press is not a hover and is never
`--visited`", "dust is 1.57:1 on limestone and cannot"), so the prohibition
must survive exactly once rather than three times.

**`reset.css` browser-correction one-liners are CUT.** "Add the correct font
weight in Edge and Safari", "Remove the additional :invalid styles in
Firefox". These are upstream normalize/preflight annotations, and the
definition names tutorial explanation with Tailwind preflight walkthroughs
included. They state a why, but it is the vendor's why about a browser bug,
not this repo's reasoning, and the canvas cannot act on any of it.

**The three-sheet split header is stated three times.** `public-chrome.css:1`,
`page-shell.css:1` and `chrome-nav.css:1` each carry the same "Split out of
app.css on 2026-08-21 ... THE ORDER OF THESE FILES IS THE CASCADE" paragraph
with only the first line differing, which is why the exact-duplicate scan
misses it. The cascade rule is real and load-bearing, so the first is KEEP and
the other two are POINTER at it.

## What is NOT slop, found while reading

Specificity pairs are everywhere in the chrome sheets and every one of them is
a KEEP: `(0,2,0)` against `(0,1,0)`, `(0,2,1)` against `(0,1,1)`. They are the
class of comment this repo has already been burned by deleting, which is the
whole reason the wordmark comment matters.

## One judgement worth a second opinion

`chrome-nav.css:105` ("THE TWO PRESSED-STATE RULES THAT SAT HERE ARE GONE")
is tagged CUT as history narration: it describes rules that no longer exist.
The argument against cutting is that it records why an absence is deliberate.
The merge protects it, since it only goes if Grok also said CUT.
