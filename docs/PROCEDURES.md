# Procedures: protocols, recipes and computational procedures

One format and one set of components for every procedure on the site (job_86709d790a73). A procedure is
a file in `content/procedures/`, the source with its history. `npm run sync:content` and the operator
API's `save_procedure` write it into the D1 `procedures` table, and its pages are drawn from that row at
request time, so a content edit goes live without a build or deploy. Only a change to the components or
to this format goes through a build.

## The file

`content/procedures/<slug>.md`: a YAML front-matter header, then markdown with Cooklang-style marks.

```markdown
---
profile: protocol                 # protocol | recipe | computational
path: /research/protocols/phage-dna-extraction
title: Phage DNA Extraction Protocol
seo_title: "Phage DNA Extraction Protocol: column-free ZnCl2/TES method"
description: One sentence, at most 155 characters.
draft: false                      # true: never public; a signed-in admin sees it
version: "MISSING: No version has been assigned."
updated: 2026-09-30
based_on:
  - citation: "Santos MA (1991), Nucleic Acids Research 19:5442"
    doi: 10.1093/nar/19.19.5442
    for: the zinc chloride method
materials:
  - name: zinc chloride
    display: ZnCl2
    stock: [2 M]
    final: 40 mM
equipment:
  - name: microcentrifuge
references:
  - id: santos-1991
    text: "Santos MA (1991). ... [doi:10.1093/nar/19.19.5442](https://doi.org/10.1093/nar/19.19.5442)"
---

The summary: what this is, where it came from, who it is for.

## Part A: collect the phage

1. Add @zinc chloride|2 M ZnCl2{20%µl} to each tube. Incubate at 37 °C for ~{5%minutes}.
   > CRITICAL: Remove the supernatant quickly.
   > PAUSE POINT: The prep can wait overnight at 4 °C.
   > WHY: **Why zinc chloride?** Markdown, attached to this step.
   > TROUBLESHOOTING: salty-dna
```

### Marks (Cooklang, https://cooklang.org/docs/spec/)

| Mark | Means | Renders as |
| --- | --- | --- |
| `@name` or `@two words{}` | a material (reagent, ingredient, software, data) | its display name |
| `@name{20%µl}` | a material with an amount | "20 µl of name" |
| `@name|shown{20%µl}` | the alias form (cooklang-rs): `name` is the material, `shown` the words on the page | "20 µl of shown" |
| `@name{=20%µl}` | a fixed amount that scaling leaves alone | as above |
| `#name` or `#two words{}` | equipment | its name |
| `~{10%minutes}` or `~label{10%minutes}` | a timer | "10 minutes" |

A mark starts after a space or at the start of a line, so `(#references)` and an email address are never
marks. Marks inside inline code or a link target are left alone.

Temperatures (`37 °C`, `55 to 60 °C`) and spins (`10,000 rpm`, `12,000 x g`) are read from the step's text,
not marked, so the sentence stays the one a person wrote.

### Steps, sections and flags

- Every `## Heading` starts a section. A section with a numbered list is a method section; its list items
  are steps. Prose before or after the list stays with the section. A section with no list is prose.
- Step numbers are the ones written. A list continues the numbering of the one before it or restarts at 1
  (a separate method, such as a rescue).
- A step's flags are `>` lines indented under it: `CRITICAL:` (with the reason), `PAUSE POINT:`,
  `WHY:` (a "why this" note), `TROUBLESHOOTING:` (a row id in the troubleshooting table), `EXPECT:` (the
  expected result of the step). In the computational profile a fenced code block under a step is the
  command to copy, and a fenced block with the info string `output` right after it is its expected
  output.

### A value nobody has yet

Written `"MISSING: <why it is missing>"`, in place, never filled with a guess. The check and the save tool
accept a recorded gap and print it; a bare `MISSING`, or a required field left out, fails. The page omits
a missing value rather than printing it.

## Front matter by profile

Every profile: `profile`, `path`, `title`, `seo_title`, `description`, `version`, `updated`, `based_on`,
`materials`, `references`, `expected_results`, `limitations`, `method`; optional `draft`, `equipment`,
`troubleshooting`, `time` (`total`, `hands_on`), `first_used`, `organism`, `target`, `course`.

What the protocol library filters and lists by (`app/lib/procedures/taxonomy.mjs`):

- `method` (required): a list of ids from the closed list: `pcr`, `plating`, `culture`, `extraction`,
  `sequencing`, `annotation`, `media`, `microscopy`. A procedure that is some of two methods lists both.
- `organism`: ids from the closed list, which are the phages' host keys (`smegmatis`, `foliorum`) and `avian`.
- `course`: ids of the courses that teach it (`phage-discovery`, `virus-isolation`, `phage-bioinformatics`).
- `target`: the genes, regions or samples it works on, in words (free text, since targets are as many as the
  experiments).

A value outside a closed list is refused with the list in the message. Adding a method, organism or course is a
change to `taxonomy.mjs`, so the filter's words are never `PCR`, `pcr` and `polymerase chain reaction` on three
pages. When the lab registry holds host strains, `organism` reads from it.

- **protocol** adds `biosafety` (`organism`, `strain`, `atcc`, or `not applicable`; the agent only, per
  protocols.md), `host_strain`, `status`, `last_run`, `scale` (`count` and `unit`, such as 5 tubes),
  `solutions` (sub-recipes: `id`, `name`, `components`, `storage`, `shelf_life`), `primers`, `cycling`.
  A material may carry `stock` (one or more), `final`, `amount` and `per`, and `solution` (the id of its
  sub-recipe). A spin in rpm needs its `g` (or a recorded gap), and a touchdown annealing its step size.
- **recipe** adds `servings`, `cuisine`, `category`, `diet`, `prep_time`, `cook_time`, `substitutions`
  (`for`, `use`, `note`), and step photos (`![alt](/media/...)` on a step's own line). Amounts in steps
  scale with the servings.
- **computational** adds `environment` and `prerequisites`. Its materials are software (with `version`),
  data and input files. Every command has its expected output. It does not scale.

## Where it goes

| Output | From |
| --- | --- |
| The page | `app/routes/procedure.tsx`, drawn from the D1 row |
| The printable sheet | the page's `/sheet` address |
| The markdown twin | the page's `.md` address, generated from the same record |
| JSON-LD | Bioschemas LabProtocol, schema.org Recipe, or HowTo for a computational procedure |
| Search | `search_docs`, written by the sync and by `save_procedure` |
| The check | `npm run check:protocols` validates every file with the save tool's own validator |
