# CLAUDE.md - dustinedwards.info

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `dustinedwards/core.md`. This file holds only what is true of this repo.

## What this is

Personal site for Dr. Dustin Edwards, Professor of Virology, Tarleton State University. React Router 8 (SSR) + Vite + @cloudflare/vite-plugin, native on Cloudflare Workers. Drizzle on D1, Better Auth (Google, single admin) with sessions in KV, R2 for media. Node 24.14.1 (.nvmrc). Also the flagship site and a Capsid CMS consumer.

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
5. Do not modify `.claude/settings.json` without explicit instruction. A PostToolUse hook rejects em dashes; that enforcement is deliberate.
