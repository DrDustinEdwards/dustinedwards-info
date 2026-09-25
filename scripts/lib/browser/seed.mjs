// The rows the preview run seeds into local storage: two approved mentions, one of them hostile,
// and the math fixture's draft row with its preview token. Every seed goes through --file.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readArtifact } from "../artifact.mjs";
import { sqlLiteral as q } from "../sql-literal.mjs";
import { runWrangler } from "../wrangler-run.mjs";
import { DRIVES_PREVIEW, root } from "./harness.mjs";
import { refuseUnlessRan, registry } from "./preview-server.mjs";

/* Hand-written: the endpoint refuses the hostile row `safeHttpHref` must render. */
export const MENTION_POST_PATH = "/blog/ten-years-on-cloudflare";
const MENTION_SLUG = MENTION_POST_PATH.slice("/blog/".length);
const MENTION_SEED_PREFIX = "https://gate.example/";
/** A fixed instant, so the rendered date is the same in every fetch. */
const MENTION_DECIDED_AT = Math.floor(Date.UTC(2026, 7, 20) / 1000);
const MENTION_HOSTILE_NAME = "<script>alert(1)</script>";

const MENTION_SEED_ROWS = 2;

/* `--file`, because the HTML's double quotes would break a cmd command string. */
const MATH_SLUG = "math-typesetting-fixture";
/** Fixed, so a re-run overwrites one KV record. `isWellFormedToken` is length-exact. */
export const MATH_PREVIEW_TOKEN = "gate0000000000000000000000000000000000math0";
export const MATHLESS_POST_PATH = "/blog/ten-years-on-cloudflare";

/**
 * Writes every seed a preview run needs, and refuses the run when one does not apply. Returns whether
 * the math preview was seeded, which only the preview-driving mode does.
 *
 * @returns {boolean}
 */
export function seedPreview() {
  /**
   * Seeds go through files, never a cmd command string: the hostile row carries <script>, quotes and
   * a %, and cmd.exe quoting is not SQL quoting. One directory for every seed, removed once each has
   * been applied, so a run does not leave the fixture SQL in the temp folder.
   */
  const SEED_DIR = DRIVES_PREVIEW ? mkdtempSync(join(tmpdir(), "gate-seed-")) : "";
  const removeSeedDir = () => {
    if (SEED_DIR) rmSync(SEED_DIR, { recursive: true, force: true });
  };
  /* On every exit too, refusals included; removing it twice is harmless. */
  process.on("exit", removeSeedDir);

  if (DRIVES_PREVIEW) {
    /* Delete then insert, so the count means this run wrote the rows. */
    const mentionFile = join(SEED_DIR, "mentions.sql");
    writeFileSync(
      mentionFile,
      [
        `DELETE FROM webmentions WHERE source_url LIKE ${q(`${MENTION_SEED_PREFIX}%`)};`,
        `INSERT INTO webmentions ` +
          `(source_url, target_slug, status, author_name, author_url, excerpt, received_at, decided_at) VALUES (` +
          [
            q(`${MENTION_SEED_PREFIX}ordinary`),
            q(MENTION_SLUG),
            q("approved"),
            q("A Reader"),
            q("https://gate.example/about"),
            q("A sentence somebody wrote about this post."),
            String(MENTION_DECIDED_AT),
            String(MENTION_DECIDED_AT),
          ].join(", ") +
          `);`,
        `INSERT INTO webmentions ` +
          `(source_url, target_slug, status, author_name, author_url, excerpt, received_at, decided_at) VALUES (` +
          [
            q(`${MENTION_SEED_PREFIX}hostile`),
            q(MENTION_SLUG),
            q("approved"),
            q(MENTION_HOSTILE_NAME),
            q("javascript:alert(1)"),
            q("An excerpt from a page that cannot be linked to."),
            String(MENTION_DECIDED_AT - 60),
            String(MENTION_DECIDED_AT - 60),
          ].join(", ") +
          `);`,
      ].join("\n"),
      "utf8",
    );

    const seeded = runWrangler(`d1 execute dustinedwards --local --file "${mentionFile}"`, { cwd: root });
    refuseUnlessRan(seeded, seeded.output, [
      "check:browser failed. the mention seed did not apply, so the byte-identity",
      "case below would compare two renders of a page with no Mentions section.",
    ]);
    console.log(`  seeded ${MENTION_SEED_ROWS} approved mention(s) on ${MENTION_POST_PATH}`);
  }

  let mathPreviewSeeded = false;

  if (DRIVES_PREVIEW) {
    const artifact = readArtifact();
    const fixture = artifact.posts.find((/** @type {any} */ p) => p.slug === MATH_SLUG);

    /* Fails rather than skips: `check:content` already requires the fixture. */
    if (!fixture) {
      console.error(
        `check:browser failed. content/generated/posts.json carries no post "${MATH_SLUG}", ` +
          `so the math cases below would have no page to visit. Run npm run build:content.`,
      );
      registry.clear();
      process.exit(1);
    }
    if (fixture.draft !== true) {
      console.error(
        `check:browser failed. "${MATH_SLUG}" is not a draft. The fixture must stay ` +
          `unpublished (it is a fixture), and the preview door below only opens for a draft.`,
      );
      registry.clear();
      process.exit(1);
    }

    const publishAt = Math.floor(new Date(fixture.publishAt).getTime() / 1000);
    const sqlFile = join(SEED_DIR, "math.sql");
    writeFileSync(
      sqlFile,
      [
        `DELETE FROM posts WHERE slug = ${q(MATH_SLUG)};`,
        `INSERT INTO posts (slug, kind, title, body, status, publish_at, html, description, ` +
          `toc, reading_time_minutes, source_path, featured) VALUES (` +
          [
            q(fixture.slug),
            q("post"),
            q(fixture.title),
            q(fixture.markdown),
            q("draft"),
            String(publishAt),
            q(fixture.html),
            q(fixture.description),
            q(JSON.stringify(fixture.toc)),
            String(fixture.readingTimeMinutes ?? 1),
            q(fixture.sourcePath),
            "0",
          ].join(", ") +
          `);`,
      ].join("\n"),
      "utf8",
    );

    const row = runWrangler(`d1 execute dustinedwards --local --file "${sqlFile}"`, { cwd: root });
    refuseUnlessRan(row, row.output, [
      "check:browser failed. the math fixture row did not apply, so /preview",
      "would answer 404 and every math case below would report the wrong cause.",
    ]);

    /* `resolvePreview` re-checks post status, so a stale record cannot leak. */
    const record = JSON.stringify({
      slug: MATH_SLUG,
      createdAt: Date.UTC(2026, 8, 6),
      label: "check:browser math fixture",
    });
    /* The value from a file too: JSON with escaped quotes inside a cmd string held only by MSVCRT rules. */
    const recordFile = join(SEED_DIR, "preview-token.json");
    writeFileSync(recordFile, record, "utf8");
    const kv = runWrangler(
      `kv key put --binding APP_KV --local "preview:token:${MATH_PREVIEW_TOKEN}" --path "${recordFile}"`,
      { cwd: root },
    );
    removeSeedDir();
    refuseUnlessRan(kv, kv.output, ["check:browser failed. the preview token did not reach local KV."]);

    mathPreviewSeeded = true;
    console.log(`  seeded the ${MATH_SLUG} draft row and its preview token`);
  }
  return mathPreviewSeeded;
}
