# dustinedwards.info

Personal site for Dr. Dustin Edwards, Professor of Virology at Tarleton State University.
Next.js (App Router) + TypeScript, deployed on Vercel, Supabase wired in for later.
Built to match the conventions in the Foxing / Recova ecosystem.

## Stack
- Next.js 15 (App Router, React 19), TypeScript
- Plain CSS design system in app/globals.css (token vocabulary, light/dark via data-mode)
- House fonts: Fraunces, Source Serif 4, DM Sans, DM Mono
- Supabase client stubbed in lib/supabase.ts (not used yet)
- Markdown vault in content/posts read by lib/posts.ts (for a future /writing route)

## Where everything lives
- content/site.ts: all editable copy. Start here.
- content/posts/*.md: writing / lab-notes vault.
- components/: section components plus Nav, ThemeToggle, ScrollReveal.
- app/globals.css: design tokens and styling. Brand is --brand-ui #4F2D7F.
- lib/metadata.ts: metadata builder (no hardcoded metadata strings in pages).
- CLAUDE.md and .claude/settings.json: Claude Code context and deterministic hooks.

## Run locally
    npm install
    cp .env.local.example .env.local   # fill in Supabase values when ready
    npm run dev                        # http://localhost:3000

## Deploy to Vercel
1. Push to GitHub (github.com/DrDustinEdwards/dustinedwards-info).
2. Vercel: New Project, import the repo. It auto-detects Next.js. Deploy.
3. Add Supabase env vars under Vercel Settings, Environment Variables.

## Point next.dustinedwards.info at the build
The live site stays on HostGator. This preview gets its own subdomain.
1. Vercel, Project, Settings, Domains: add next.dustinedwards.info. Vercel shows a CNAME target.
2. In the DNS zone for dustinedwards.info, add a CNAME record: name "next", value cname.vercel-dns.com (use whatever Vercel shows).
3. Wait for propagation. Vercel issues SSL automatically.
When ready to go live, repeat for the apex dustinedwards.info, then remove HostGator hosting.

## House rules (enforced by hooks)
- No em dashes. The PostToolUse hook blocks any edit that introduces one.
- tsc --noEmit runs before every session ends.
- No cheesy copy, no emoji, inline SVG icons only, rem units, design tokens only.
See CLAUDE.md for the full list.

## TODO before launch
- Confirm title, email (dcedwards@tarleton.edu?), and the Phage Program stat numbers in content/site.ts.
- Microbiome blurb and a personal About line.
- Real Google Scholar and CV links.
- Decide single-page vs multi-page (course pages, REV/LPDV sub-pages, knowledge base) and whether the old login area needs Supabase auth.
