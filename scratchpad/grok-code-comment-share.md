# Code comment share (`app` TS/TSX, `workers` TS, `scripts` mjs)

Measured `origin/main` `5b8007e`. Tracked files only, 257 files matching `app/**/*.ts`, `app/**/*.tsx`, `workers/**/*.ts`, `scripts/**/*.mjs`.

Comments are whatever `scripts/lib/strip-comments.mjs` treats as a comment (the gate tokenizer: strings and regex literals are not comments). A line is a comment line when it is non-blank in the source and blank after the strip; a line that still has code after the strip counts as code even if it also had a trailing comment. That is the Arafat and Riehle density (comment lines / (comment lines + code lines), blanks out). Byte share is comment-token bytes, including `//` and `/* */`, over file bytes.

## By glob

| glob | files | bytes | comment bytes | byte share | non-blank | comment lines | line share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| app/**/*.ts | 85 | 840,046 | 470,843 | 56.0% | 18,286 | 8,876 | 48.5% |
| app/**/*.tsx | 67 | 928,007 | 482,020 | 51.9% | 20,571 | 7,957 | 38.7% |
| workers/**/*.ts | 4 | 100,695 | 75,687 | 75.2% | 2,025 | 1,351 | 66.7% |
| scripts/**/*.mjs | 101 | 2,852,702 | 1,551,498 | 54.4% | 61,358 | 28,907 | 47.1% |
| **total** | **257** | **4,721,450** | **2,580,048** | **54.6%** | **102,240** | **47,091** | **46.1%** |

## By directory

Directory is the folder that holds the file, not a roll-up of its children. `app` is the four files sitting in `app/` itself (`env.d.ts` is one of them). `scripts` is the check and ship scripts at the top of `scripts/`; `scripts/lib` is separate.

| directory | files | bytes | comment bytes | byte share | non-blank | comment lines | line share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| app | 4 | 49,021 | 39,201 | 80.0% | 948 | 677 | 71.4% |
| app/components | 10 | 35,578 | 25,973 | 73.0% | 764 | 450 | 58.9% |
| app/components/admin | 27 | 299,581 | 139,326 | 46.5% | 7,030 | 2,271 | 32.3% |
| app/data | 3 | 9,971 | 867 | 8.7% | 159 | 13 | 8.1% |
| app/db | 3 | 108,402 | 64,806 | 59.8% | 2,503 | 1,237 | 49.4% |
| app/enhance | 4 | 65,426 | 35,238 | 53.9% | 1,528 | 646 | 42.3% |
| app/lib | 17 | 101,135 | 73,516 | 72.7% | 2,226 | 1,418 | 63.7% |
| app/lib/admin | 3 | 18,410 | 12,260 | 66.6% | 421 | 239 | 56.8% |
| app/lib/content | 2 | 3,807 | 3,075 | 80.8% | 81 | 61 | 75.3% |
| app/lib/editor | 8 | 95,118 | 53,800 | 56.6% | 2,216 | 1,012 | 45.7% |
| app/lib/health | 2 | 12,836 | 9,487 | 73.9% | 271 | 176 | 64.9% |
| app/lib/media | 5 | 44,156 | 28,588 | 64.7% | 1,008 | 531 | 52.7% |
| app/lib/media/resolvers | 1 | 4,999 | 3,173 | 63.5% | 106 | 58 | 54.7% |
| app/lib/operator | 2 | 54,647 | 27,451 | 50.2% | 1,334 | 524 | 39.3% |
| app/lib/search | 3 | 80,493 | 52,078 | 64.7% | 1,814 | 984 | 54.2% |
| app/lib/webmention | 3 | 18,057 | 12,057 | 66.8% | 413 | 234 | 56.7% |
| app/routes | 55 | 676,669 | 366,116 | 54.1% | 14,597 | 6,186 | 42.4% |
| scripts | 69 | 2,608,450 | 1,389,557 | 53.3% | 55,713 | 25,633 | 46.0% |
| scripts/lib | 31 | 232,178 | 156,093 | 67.2% | 5,355 | 3,175 | 59.3% |
| scripts/measure | 1 | 12,074 | 5,848 | 48.4% | 290 | 99 | 34.1% |
| workers | 4 | 100,695 | 75,687 | 75.2% | 2,025 | 1,351 | 66.7% |

`app/data` is the only directory under the 20% line norm. Everything else is above it. Workers, `app/` itself, `app/lib`, `app/lib/content`, and `app/components` are the densest folders.

## Ten files, highest line share

| line share | comment bytes | comment / non-blank | file |
| ---: | ---: | ---: | --- |
| 94.3% | 1,400 | 33/35 | scripts/mint-smoke-token.mjs |
| 89.8% | 5,466 | 106/118 | scripts/lib/floor.mjs |
| 88.0% | 1,203 | 22/25 | app/lib/client-ip.ts |
| 87.8% | 1,703 | 36/41 | app/lib/webmention/advertise.ts |
| 84.5% | 3,026 | 60/71 | app/lib/admin/secrets.server.ts |
| 83.3% | 6,941 | 130/156 | app/env.d.ts |
| 81.7% | 3,880 | 67/82 | app/components/site-speculation.tsx |
| 80.9% | 4,825 | 89/110 | app/lib/markdown-twin.ts |
| 80.0% | 4,456 | 80/100 | app/lib/bearer.server.ts |
| 80.0% | 1,289 | 28/35 | app/lib/auth-rate.server.ts |

These are small modules whose body is a few lines and whose header is the why. `mint-smoke-token.mjs` is one executable line under a 33-line header. `client-ip.ts` is one function under a hard-rule-13 justification. They are not tokenizer false positives.

## Ten files, most comment bytes

| comment bytes | line share | comment / non-blank | file |
| ---: | ---: | ---: | --- |
| 172,174 | 50.3% | 3,122/6,201 | scripts/check-browser.mjs |
| 158,598 | 47.2% | 2,947/6,240 | scripts/check-invariants.mjs |
| 122,991 | 38.5% | 2,192/5,688 | scripts/check-admin-ui.mjs |
| 61,073 | 37.8% | 1,114/2,944 | scripts/check-features.mjs |
| 56,058 | 47.0% | 973/2,069 | scripts/verify-live.mjs |
| 54,324 | 45.3% | 908/2,006 | app/routes/admin.media._index.tsx |
| 53,169 | 50.2% | 1,019/2,030 | app/db/index.ts |
| 49,033 | 55.6% | 903/1,624 | scripts/ship.mjs |
| 46,607 | 51.5% | 811/1,575 | scripts/check-contrast.mjs |
| 45,118 | 67.3% | 833/1,237 | scripts/check-all.mjs |

The byte ranking is the gates. Eight of the ten are `scripts/`. Together those ten files hold 819,145 comment bytes, 32% of all comment bytes in the 257-file set.

## Against the 20% line norm

Arafat and Riehle, ICSE NIER 2009: about 19% comment lines in 5,000+ active OSS projects, ~20% called the sweet spot; JavaScript 16%. Source: https://dirkriehle.com/2009/02/04/the-sweet-spot-of-code-commenting-in-open-source/

This set is **46.1% by lines, 54.6% by bytes**. That is 2.3 times the line norm, and the same byte share as the stylesheets after the plain-comment rewrite (54.0%). Every glob is above 20%: TSX is the lowest at 38.7%, workers the highest at 66.7%. The 20% figure describes ordinary OSS. This tree is a rationale archive in the source, in code as in CSS.
