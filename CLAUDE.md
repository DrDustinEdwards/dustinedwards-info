# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site, https://dustinedwards.info: React Router 8 on Workers, D1, R2. Content is written through Carrel.

## Rules every repo shares

- **Tests.** Reproduce a reported failure first: red before, green after. Keep the set minimal; delete a test that pins design or repeats coverage.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, intros or hints a label already gives (Dustin, 2026-11-18).
- **Shared code.** Check devkit's [SHARED.md](https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md) before writing anything another repo might have. Change shared code in place and delete what it replaces.
- **Secrets.** Never commit or print a key or token. AI provider keys stay on the server.
- **Production.** Never deploy, tag, release or run production DDL from a session; a merge deploys. Back up and restore D1 only with d1-dump.
- **Copy.** Site copy says only what the current build does.

## Rules for this repo

- **Privacy.** The site stores no visitor data: no IP address, cookie, identifier or third-party tracker (Cloudflare Web Analytics is the one outside script); a logged search keeps only its query and date; traces stay off. Anything new it records is named on the privacy page.

## Commands

- `npm run check:changed` picks the gates the diff needs; `npm run check` is the offline tier.
