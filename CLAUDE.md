# CLAUDE.md - dustinedwards.info

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `dustinedwards/core.md`. This file holds only what is true of this repo.

## What this is

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) + Vite + @cloudflare/vite-plugin, native on Cloudflare Workers. Drizzle on D1, Better Auth (Google, single admin) with sessions in KV, R2 for media. Node 24.14.1 (.nvmrc). Also the flagship site and a Capsid CMS consumer.

## Session ritual

Start: read `capsid/conventions.md`, then `dustinedwards/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the dustinedwards namespace.

## Bindings

Configured in wrangler.jsonc, read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

  DB      D1 database "dustinedwards"
  APP_KV  KV namespace (Better Auth session store)
  MEDIA   R2 bucket "dustinedwards-media"

## Commands

- `npm run dev`
- `npm run build`
- `npx tsc -b` typecheck (`tsc --noEmit` is a no-op here)
- `wrangler d1 migrations apply dustinedwards [--local|--remote]`
- `wrangler deploy` (auto-deploy is not wired; deploy is manual)

## Hard rules

1. Every public read goes through `publiclyVisible()`. It hides drafts and future publish_at rows. Do not query posts for public output without it.
2. Migrations are hand-written in `drizzle/`. drizzle-kit is intentionally not a dependency (esbuild advisory). Add a new numbered file, never edit an applied one.
3. Keep the worker lean. No heavy dependencies. Client bundles stay small; auth code loads only on admin and login routes. This is the repo's bundle-leanness rule, and it is why inline SVG is preferred here over an icon library.
4. Secrets are wrangler secrets, read only in `.server` modules and in loaders/actions: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, ADMIN_EMAIL.
5. Do not modify `.claude/settings.json` without explicit instruction. Two PreToolUse hooks block on exit 2: `no-em-dash.sh` on Write and Edit, and `scoped-git-add.sh` on Bash. A Stop hook runs `npx tsc -b`. That enforcement is deliberate. PreToolUse plus exit 2 is the only blocking combination; the older PostToolUse `.mjs` registration could not block a write and was retired in d36dbf2.
6. `public/publications/` and `public/phage-hunters/` hold 31 PDFs and 9 photos from retired content. They are orphaned on purpose, reachable by direct URL and linked from nowhere, kept for citation integrity in other people's published work. Do not delete them as hygiene, and never write a redirect or gone rule that matches `/publications/*` or `/phage-hunters/*` as a prefix.
