# dustinedwards.info

Personal site and Cloudflare showcase for Dustin Edwards. React Router 8 with
SSR, running natively on Cloudflare Workers through `@cloudflare/vite-plugin`.

Everything the site serves is either committed to this repo or derived from
something that is. That is the organising idea, and most of what follows is a
consequence of it.

- **Content is code.** Markdown files in `content/posts/` are the source of
  truth. D1 is a derived read model, rebuilt from a committed artifact.
- **The gates are the review.** There is no second reviewer, so a family of
  `check:*` scripts is what stands between a change and production. Since
  2026-08-20 [CI](.github/workflows/ci.yml) runs most of them on a clean
  checkout, which is the closest thing here to a second opinion.
- **Progressive enhancement is a requirement, not a preference.** Every public
  page works with scripting disabled; client JS only ever upgrades markup that
  already functions. That includes the ADMIN DOOR: `/login` is a real form, and
  the browser client is layered on top of it. The admin plane behind that door
  is exempt and does use script. This used to read "zero JavaScript", which was
  the wrong name for the law (hard rule 9 calls it progressive enhancement) and
  was also untrue at the door, where the only way in was a button that did
  nothing without script.

Rebuilding the platform from nothing is a different job with its own document:
see **[RECOVERY.md](RECOVERY.md)** for every binding, the order they have to be
created in, and what is genuinely unrecoverable. Nothing here repeats it.

How anything here gets PROVEN is a third: **[VERIFICATION.md](VERIFICATION.md)**
is the method behind the gates, written from the times it was got wrong.

## Stack

| Layer | What |
| --- | --- |
| Runtime | Cloudflare Workers, `nodejs_compat` |
| Framework | React Router 8 (SSR), Vite |
| Database | D1 (`dustinedwards`), Drizzle, hand-written migrations |
| Auth | Better Auth, Google, single admin, sessions in KV |
| Storage | R2: `dustinedwards-media` (originals), `dustinedwards-og` (derived cards) |
| Search | SQLite FTS5, two tokenizers fused by reciprocal rank |
| AI | AI Search instance for the Ask layer, guarded by a Durable Object |
| Images | Images binding, transforms derived on request |

Node 24.14.1 (`.nvmrc`).

## Getting started

```bash
npm install          # postinstall copies wrangler.jsonc.example into place
npm run dev
```

`wrangler.jsonc` is **gitignored** and `wrangler.jsonc.example` is tracked. That
is a portfolio-wide rule rather than this repo's choice: real resource ids stay
out of git. The two files must declare the same binding surface and
`check:config` fails in both directions if they drift, so **adding a binding
means editing both files in the same commit.**

## The content pipeline

```
content/posts/*.md                    the source of truth
        |
        +- build:content ------------> content/generated/posts.json  (committed, gated)
        |                              rendered HTML, search records,
        |                              diagram keys, media refs
        |
        +- build:og       -----------> R2 dustinedwards-og    1200x630 social cards
        +- build:diagrams -----------> public/diagrams/       light + dark SVG pairs
        +- build:assets   -----------> content/generated/assets.json  (public/ manifest)
        |
        +- sync:content   -----------> D1: posts, tags, search_docs, media_refs
```

Order matters: `build:content` first, then `build:og` and `build:diagrams`
(both read the artifact), then `sync:content`.

**Editing a post** means editing the markdown, running `build:content`,
committing the artifact alongside it, then `sync:content`. Never hand-edit the
artifact and never write prose straight into a D1 row; both defeat the gate.

There are **two writers** of that artifact, the build script and the admin
editor, and they must produce byte-identical output. So anything the artifact
carries is computed in exactly one module that both import (`artifact.mjs`,
`records.mjs`, `pipeline.mjs`). That rule has been learned more than once and is
why those modules exist.

### The editor is a second writer, not a second path

`/admin/posts` commits to GitHub through the Git Data API, one commit carrying
both the markdown and the regenerated artifact, and only then writes D1. The
same zod gates run inside the action, because an API commit bypasses the local
hooks entirely. `POST /api/operator` exposes that identical machinery to agents
behind a bearer token. There is exactly one write path.

## Media

R2 is the store and the truth; D1 is a queryable index over it, and
`check:media` reconciles the two in both directions. **R2 wins every conflict:**
a row with no object is deleted, an object with no row is backfilled, never the
reverse.

The write path is an **event notification, not a dual write**. The Worker writes
only to R2; the bucket emits; a queue consumer derives the row, idempotently,
with a dead-letter queue behind it.

Keys are content-addressed (`sha256` truncated, plus extension), so the filename
lives in `original_name` and in the object's custom metadata rather than in the
key itself. Static assets under `public/` are indexed in place rather than
moved.

## Gates

```bash
npm run check       # the twelve that need no network  (~110s)
npm run check:all   # adds the ones that read deployed resources
```

The list is derived from the `check:*` scripts in `package.json`, so a new gate
is picked up automatically and a missing one fails the run. Every gate runs even
after one fails, because stopping at the first red hides the rest.

| Gate | What it protects |
| --- | --- |
| `check:content` | the committed artifact matches a fresh generation |
| `check:config` | the two wrangler files declare the same bindings |
| `check:search` | the query parser and rank fusion |
| `check:policy` | the operator publish policy, including first-publish |
| `check:contrast` | every token pair, both themes, against the ratified spec |
| `check:logo` | the inline mark still reproduces the four SVG fixtures |
| `check:backup` | the per-table export path covers the live schema |
| `check:charts` | chart determinism and Node-vs-Worker byte parity |
| `check:diagrams` | the diagram contract, asset coverage, colour audit |
| `check:admin-ui` | what the admin's forms SUBMIT, against a baseline |
| `check:urls` | the URL protocol allowlist |
| `check:llms` | `llms.txt` matches the row it seeds |
| `check:media` | D1 against R2 and `public/`, both directions |

**Every gate declares an OBSERVATION BOUNDARY in its header: what it does not
look at.** Read it before trusting a green run. Four separate defects have
shipped past a green gate, each sitting in a blind spot nobody had written down,
and those comments exist so the next one is caught by reading rather than in
production.

Beyond the family: `npx tsc -b` for the typecheck (`tsc --noEmit` is a no-op
here), and `node scripts/verify-live.mjs` after a deploy, which asserts against
the running site. **Run verify-live twice after any caching change**, once cold
and once warm. It normally runs seconds after a deploy, when the version-keyed
cache is empty, and that blind spot hid a real bug for four sessions.

## Secrets

Seven, all set with `wrangler secret put`, never in a file:

| Secret | Used for |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Better Auth |
| `GOOGLE_CLIENT_SECRET` | Better Auth |
| `BETTER_AUTH_SECRET` | session signing |
| `BETTER_AUTH_URL` | OAuth redirect origin |
| `ADMIN_EMAIL` | the single account allowed to sign in |
| `GITHUB_TOKEN` | the editor's commits (fine-grained, Contents read/write) |
| `OPERATOR_TOKEN` | the agent publish API, minimum 32 characters |
| `ANALYTICS_READ_TOKEN` | the cockpit's origin-requests panel, optional |
| `SMOKE_TOKEN` | the read-only credential `check:browser` renders the admin plane with, minimum 32 characters, optional |

Neither wrangler file has ever held one. Local development uses a gitignored
`.dev.vars`. Without `GITHUB_TOKEN` the editor still renders and previews and
reports that saving is unavailable rather than half-working.

## Deploying

```bash
npm run deploy      # builds, then wrangler deploy
```

Auto-deploy is not wired, and bare `wrangler deploy` is **not** the deploy path:
it would ship whatever `build/` already held.

Migrations are separate and hand-written in `drizzle/`. Add a new numbered file;
never edit an applied one. drizzle-kit is deliberately not a dependency.

```bash
wrangler d1 migrations apply dustinedwards --local
wrangler d1 migrations apply dustinedwards --remote
```

After deploying, run `node scripts/verify-live.mjs`.

## Repo layout

```
app/
  routes/          React Router routes, public and /admin
  lib/content/     the markdown pipeline. ONE renderer, imported by both writers
  lib/media/       classification, delivery, rebuild
  lib/search/      query parsing, rank fusion, the Ask layer
  db/              Drizzle schema and every query
workers/           the Worker entry, the queue consumer, the Durable Object
content/posts/     the source of truth
content/generated/ committed, gated artifacts
drizzle/           hand-written migrations
scripts/           build steps and the gate family
public/            static assets, indexed in place
```

`CLAUDE.md` carries the working rules for this repo in more detail than a README
should. Read it before making changes.
