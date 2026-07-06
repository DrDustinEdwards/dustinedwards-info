# CLAUDE.md - dustinedwards.info

Personal site for Dr. Dustin Edwards, Professor of Virology, Tarleton State University.
React Router (framework mode) running natively on Cloudflare Workers.

## STACK
React Router 8 (SSR) + Vite + @cloudflare/vite-plugin. No OpenNext.
Drizzle ORM on D1. Better Auth (Google, single admin) with sessions in KV.
R2 for media. Node 24.14.1 (.nvmrc).

## BINDINGS
Configured in wrangler.jsonc, read off the request context.
  DB      D1 database "dustinedwards"
  APP_KV  KV namespace (Better Auth session store)
  MEDIA   R2 bucket "dustinedwards-media"
Routes reach bindings with getEnv(context) from app/lib/context.ts. Never import
bindings globally.

## STRUCTURE
  app/routes/            route modules (home, admin, login, api.*, sitemap, robots, llms)
  app/db/schema.ts       posts + settings (Drizzle)
  app/db/auth-schema.ts  Better Auth tables
  app/db/index.ts        getDb, publiclyVisible, public read helpers
  app/lib/auth.server.ts Better Auth factory (createAuth)
  app/lib/context.ts     getEnv(context)
  app/lib/seo.ts         JSON-LD builders
  drizzle/0001_init.sql  hand-written migration (FTS5 + triggers)
  workers/app.ts         Worker entry, sets the request context

## COMMANDS
  npm run dev                              local dev
  npm run build                            production build
  npx tsc -b                               typecheck (tsc --noEmit is a no-op here)
  wrangler d1 migrations apply dustinedwards [--local|--remote]
  wrangler deploy

## ABSOLUTE RULES
1. No em dashes. Not one. Anywhere: code, copy, comments. A PostToolUse hook rejects
   them. Use a hyphen, a colon, or split the sentence.
2. Keep the worker lean. No heavy dependencies, no icon libraries, inline SVG only.
   Client bundles stay small; auth code loads only on admin and login routes.
3. Secrets never reach the client bundle. Read them only in .server modules and in
   loaders/actions. Google keys, BETTER_AUTH_SECRET, and ADMIN_EMAIL are wrangler
   secrets, not committed and not imported into client code.
4. Every public read goes through publiclyVisible(). It hides drafts and future
   publish_at rows. Do not query posts for public output without it.
5. Migrations are hand-written in drizzle/. drizzle-kit is intentionally not a
   dependency (esbuild advisory). Add a new numbered file, never edit an applied one.
6. Do not modify .claude/settings.json without explicit instruction.

## SECRETS (set with wrangler secret put, never commit)
  GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  BETTER_AUTH_SECRET  BETTER_AUTH_URL  ADMIN_EMAIL

## GIT
Small focused commits, one concern each. Message says what it does. Typecheck and
build before pushing. Auto-deploys to Cloudflare are not wired yet; deploy is manual.
