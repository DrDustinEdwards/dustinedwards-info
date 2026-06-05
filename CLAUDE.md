# CLAUDE.md - dustinedwards.info
## Read this at the start of every session.

---

## BEHAVIOR
Think before coding. Simplicity first. Surgical changes. Goal-driven execution.
Turn vague tasks into verifiable goals tied to real output before starting.

## AUTONOMY
Proceed without confirmation on clear tasks. Make decisions and continue.
Do not pause to check in mid-task. Stop only on an unresolvable error or a genuine
ambiguity where two readings produce meaningfully different code. Ask about scope
before starting, never during.

## HOOKS (deterministic enforcement)
CLAUDE.md rules are guidance. Hooks in .claude/settings.json are deterministic.
Do not modify .claude/settings.json without explicit instruction.
Active hooks: em dash check after every edit (PostToolUse); tsc --noEmit before
session end (Stop); done-notification (Notification).

## PROJECT
Personal site for Dr. Dustin Edwards, Professor of Virology, Tarleton State University.
Next.js App Router + TypeScript. Repo: github.com/DrDustinEdwards/dustinedwards-info
Deploy: Vercel, auto on push to main. Node 24.x.
Preview domain: next.dustinedwards.info. Apex dustinedwards.info stays on HostGator
until cutover. Supabase is wired (lib/supabase.ts) but unused so far.

## STRUCTURE
  content/site.ts      - all editable copy (start here for content changes)
  content/posts/*.md   - writing / lab-notes vault (read by lib/posts.ts)
  components/          - section + chrome components
  app/globals.css      - design tokens and all styling
  lib/                 - supabase client, posts reader, metadata builder

## COMMANDS
  npm run dev                 - local at http://localhost:3000
  npm run build               - production build
  npx tsc --noEmit            - run before every push

## ABSOLUTE RULES
1. No em dashes. Not one. Grep before pushing:
   grep -rn " - " app components content --include="*.ts" --include="*.tsx"
   (looking for the em dash character, not the hyphen above)
2. No cheesy copy. Banned: explore, discover, dive into, journey, compelling,
   must-read, "it's worth noting", importantly, furthermore. No exclamation marks
   on empty states.
3. No emoji in UI or copy.
4. No icon libraries. Inline SVG only.
5. Theming uses data-mode (light/dark), persisted to localStorage key 'mode'.
   Never data-theme.
6. Design tokens only. No hardcoded colors in components. Use the vocabulary in
   globals.css: --bg-base, --text-primary/secondary/tertiary, --brand-ui,
   --brand-text, --border-subtle/default/interactive/focus.
7. All text sizing in rem, never px.
8. Focus rings stay visible (:focus-visible). Color is never the only signal.
9. All editable copy lives in content/site.ts. Do not hardcode strings in components.
10. Metadata comes from lib/metadata.ts builders. No hardcoded metadata strings.
11. Fonts: Fraunces (display), Source Serif 4 (body), DM Sans (UI), DM Mono
    (technical). Loaded via <link> in app/layout.tsx.

## GIT WORKFLOW
Small focused commits, one concern each. Message says what it does, not why.
  Good: "Add publications section"
  Bad:  "Improve the site structure"
If the build fails, read the error, fix the specific file, push immediately.

## CONTEXT WINDOW
Fresh session per task. /clear between unrelated tasks. Wrap up around 60% usage.
