# Capsid keep list (namespace dustinedwards)

Documents that describe the site as it is now. Ten keep; `build-history.md` (this job) is added as the eleventh. Architecture documents were checked against origin/main at 6363aec. "Edits" lists the stale parts to fix after the delete pass; none of them is wrong about the architecture itself.

## Keep as they are

- `dustinedwards/core.md`: the one-page current state every session reads (CLAUDE.md, the dustin-workflow skill and the global instructions all name it). Its "Where the rulings live" section needs rewriting once the volumes go; see the dependency section of delete-list.md.
- `dustinedwards/awards-2026-2027.md`: live reference for award deadlines, fees and criteria; core.md makes it required reading for award jobs and no deadline has passed yet.
- `dustinedwards/improve/scores.md`: live configuration, not history. The Capsid Worker reads it for the improve loop and its anchor section's sha256 is pinned in KV; `scripts/improve-report.mjs` names it.
- `dustinedwards/TASK-repo-public-temporarily.md`: a live reminder, since `gh repo view` shows the repo is still public. Delete it when the repo goes private again, or on 2026-10-01.

## Keep, with edits

- `dustinedwards/chart-stack.md`: the ruling and measurements behind `:::chart` and `:::diagram`, and the pinned versions match package.json. `.claude/skills/charts/SKILL.md` and comments in `chart.mjs`, `diagram.mjs` and `prose.css` cite it. Edits: drop the "zero-JS law" reasoning, the assertion counts and the Article 10 section; prose is Source Serif, not Inter; the directive list has grown.
- `dustinedwards/media-module-architecture.md`: matches the media code (role classification in classify.mjs, the R2 event queue and dead-letter queue, the width sets in widths.mjs), and `resolvers.server.ts` and migrations 0007 and 0009 cite it. Edits: remove the dated live-state counts and the check:logo and check:media gates (ruling 150), add the MEDIA_BACKUP mirror bucket, drop "zero-JS rule" wording.
- `dustinedwards/search-architecture.md`: the two FTS5 indexes, rank fusion, the Ask guard and keys, per-table backup and the FTS rebuild rule all match. Edits: drop record counts and timings and the "zero-JS path" framing (ruling 141), add ask-twins, ask-pacing, follow-up and zero-result logging, recheck the Open items.
- `dustinedwards/publish-pipeline.md`: the content model, the two writers, one renderer and the first-publish policy are current. Edits: delete the seventeen-gate table (ruling 150), "no CI behind it" (ci.yml and deploy.yml exist), the committed artifact (removed 2026-08-26), "five tools" (the operator API also has list_mentions and decide_mention), OG template version (4, not 2), Worker sizes.
- `dustinedwards/operator-mcp-wrapper.md`: the MCP front end in dustinedwards-mcp still follows its "no policy, one API" rule. Edits: tool count (add the two mention tools), dated spec-era measurements, the Open list.
- `dustinedwards/logo-spec.md`: the mark's geometry, which `scripts/build-icons.mjs` and `site-logo.tsx` build from. Edits: remove Hill Country and purple chrome color bindings (ruling 149 deletes the purple set), public files are now `dustin-edwards-*` (ruling 127), check:logo is being removed (ruling 150).
