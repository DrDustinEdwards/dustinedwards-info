# dustinedwards.info: current state

**RULE FOR THIS FILE: current state ONLY, under 4KB.** Rewrite it, never append. Numbers that live in the repo are not copied here: a count recorded here cannot be gated and rots silently. Rewritten 2026-09-19, ruling 116.

## What this is

Dustin Edwards's personal site and a showcase of a full Cloudflare stack: React Router 8 on Workers, D1 with FTS5, KV, R2, Analytics Engine, Queues, Durable Objects, Better Auth, Drizzle. A template for further sites; the bar is "would a senior engineer copy this". Live at `dustinedwards.dustin-edwards.workers.dev`; the apex serves the legacy WordPress site until cutover.

Two planes. The **public plane** is server-rendered and not hydrated: hydration is opt-in by route, and a page carries only the prebuilt nonced bundles it uses. The **admin plane** is Better Auth, one Google admin, never edge-cached. Both: works without script, fast with it.

Git holds markdown only; D1 holds the only rendered copy and is derived, through one door, `renderAndWrite`. The `content-drift` health check converges D1 to the repository, so a markdown commit from any machine is live within one poll with no deploy.

## Where the rulings live

- **`decisions-vol-19.md`** is the active volume: standing rulings, open items, deadlines. Freeze at 20KB.
- **`retired-2026-09.md`** is ruling 116's record: what each retired ruling said, where it went, why. Nothing there is reversed; it is no longer read cold.
- **`decisions-vol-18.md`** and earlier are frozen history: read them for WHY a ruling exists.
- **The hard rules are CLAUDE.md**, twenty numbered headings, each tagged with its instrument or as UNGATED. Numbering is append-only: `check:invariants` section 15 binds every cited number to a heading, and all twenty are cited.

## The design loop

The canvas reads `main` directly with a lag of minutes, so anything it must see is merged first. Handoffs live in `part-a/` and `part-b/`, never in a synced path, because the sync overwrites every synced path on each run. The sync is **one way**, repo to canvas; when the two disagree the repo wins.

## The three homes, and the test

`NOTES.md` is how to run the sync, for the next sync agent, never uploaded. `guidelines/` is what the canvas needs to design: generated, gitignored, uploaded. `conventions.md` is the vocabulary, riding in the README's inline ceiling, rationed. Test before adding a line to any: who breaks if it is missing.

## Pending, 2026-09-19

- **Ruling 116 is landing**, this document with it: CLAUDE.md cut to standing law, slop, volumes and mail moved to a new report tier, the merge chains applied.
- **Part B is suspended.** Rulings 77 and 100 are suspended for the header, restored byte-identical to 94ded20; it changes again only when Dustin lifts that.
- **The admin design pass is next**, and R54 stays law until it lands. **Cutover is parked** behind the build-out; it gates the newsletter and item I.
- **`check:image-weight` needs a ruling.** 116 said to remove a gate that cannot be planted. This one cannot: every assertion reads remote D1 and the deployed origin. But the plant it names targets a weight floor the gate does not have, so it is kept pending.
- Open in vol 19: `check:worker`'s teardown carries the orphan exposure that wedged `check:tests`; gates 4 and 3d await Part A's scales.

**Dustin's open decisions:** newsletter, readership counting, taste queue, `check:image-weight`.

## How work runs

Dustin directs from chat. The seat writes prompts, triages, decides best-practice questions and keeps Capsid current. **Sessions READ Capsid and never write it.** Dustin holds aesthetics veto, spending, and reversals of his own rulings.

Ruling 60 is the shape of every session: this checkout belongs to the site session alone; every other actor works in a worktree under `dev/worktrees/` and lands by pull request on green CI.

**Standing rule:** a flaky gate gets one re-run and one preserved log, then a queued item, not an investigation. The queue stays empty until something breaks for a visitor or blocks a deploy.
