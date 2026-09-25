import { errorMessage } from "../error-message.mjs";

/**
 * A derived index against its source: the sizes, what it lacks and what it holds beyond the source,
 * each sorted. Kept apart so a missing key and an extra one cannot cancel out in a count.
 *
 * @param {Set<string>} expected
 * @param {Set<string>} present
 */
export function setDrift(expected, present) {
  return {
    expected: expected.size,
    present: present.size,
    missing: [...expected].filter((k) => !present.has(k)).sort(),
    extra: [...present].filter((k) => !expected.has(k)).sort(),
  };
}

/**
 * Both directions summed: a missing record and a stale one are each a wrong answer. Matches the admin badge.
 *
 * @param {{ expected: number, present: number, missing: string[], stale: string[] }} status
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function askDriftVerdict(status) {
  const drift = status.missing.length + status.stale.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `Ask index agrees with D1: ${status.expected} expected, ${status.present} present.`,
    };
  }
  return {
    ok: false,
    detail:
      `Ask index drift ${drift}: ${status.missing.length} missing, ` +
      `${status.stale.length} stale, ${status.expected} expected, ` +
      `${status.present} present. Repair with sync-ask on /admin/posts.`,
    counts: { expected: status.expected, present: status.present },
  };
}

/**
 * Both directions summed, since they can cancel in a count comparison while both are true. Here R2 is
 * the truth and D1 the projection; media-backup-drift is the other way round.
 *
 * @param {{ expected: number, present: number, missing: string[], extra: string[] }} status
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function mediaDriftVerdict(status) {
  const drift = status.missing.length + status.extra.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `Media index agrees with R2 and public/: ${status.expected} expected, ${status.present} present.`,
    };
  }
  return {
    ok: false,
    detail:
      `Media index drift ${drift}: ${status.missing.length} missing, ` +
      `${status.extra.length} extra, ${status.expected} expected, ` +
      `${status.present} present. Repair with sync_media on the operator API, ` +
      `or the rebuild action on /admin/media.`,
    counts: { expected: status.expected, present: status.present },
  };
}

/**
 * The counts travel so zero missing cannot mean zero examined. Mismatched is counted apart from missing:
 * a wrong copy, not an absent one, means something rewrote the mirror.
 *
 * @param {{ objects: number, twins: number, missing: string[], mismatched: string[] }} status
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function mediaBackupDriftVerdict(status) {
  const missing = status.missing.length;
  const mismatched = status.mismatched.length;

  if (status.objects === 0) {
    return {
      ok: true,
      detail:
        "MEDIA bucket holds no objects, so the mirror has nothing to hold either. " +
        "0 objects, 0 twins, 0 missing: examined nothing rather than verified anything.",
    };
  }

  if (missing === 0 && mismatched === 0) {
    return {
      ok: true,
      detail:
        `Every MEDIA object has a byte-identical twin: ${status.objects} objects, ` +
        `${status.twins} twins, 0 missing.`,
    };
  }

  return {
    ok: false,
    detail:
      `Media backup drift: ${status.objects} objects, ${status.twins} twins, ` +
      `${missing} missing, ${mismatched} mismatched. ` +
      `First missing: ${status.missing[0] ?? "none"}. ` +
      `First mismatched: ${status.mismatched[0] ?? "none"}. ` +
      `Repair with backup_media on the operator API, which only ever copies.`,
    counts: { expected: status.objects, present: status.twins },
  };
}

/**
 * Shared with the sync_posts repair, so what the check calls drift and what the repair repairs agree.
 *
 *   changed  a slug present on both sides whose blob sha differs: the file
 *            moved and the row has not followed (or a row's provenance was
 *            corrupted, which repairs identically).
 *   unrowed  a file with no row: a post committed from a clone that no sync
 *            has landed yet, or a lost row.
 *   unfiled  a row with no file: a post deleted from the repository whose
 *            rows outlived it.
 *
 * @param {Array<{ slug: string, sha: string }>} files from the Contents
 *   directory listing, blob sha per markdown file
 * @param {Array<{ slug: string, source_blob_sha: string | null }>} rows
 * @returns {{ changed: string[], unrowed: string[], unfiled: string[] }}
 */
export function contentDriftCompare(files, rows) {
  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
  const fileSlugs = new Set(files.map((f) => f.slug));

  const changed = files
    .filter((f) => {
      const row = rowBySlug.get(f.slug);
      return row !== undefined && row.source_blob_sha !== f.sha;
    })
    .map((f) => f.slug)
    .sort();
  const unrowed = files
    .filter((f) => !rowBySlug.has(f.slug))
    .map((f) => f.slug)
    .sort();
  const unfiled = rows
    .filter((r) => !fileSlugs.has(r.slug))
    .map((r) => r.slug)
    .sort();

  return { changed, unrowed, unfiled };
}

/**
 * present counts rows in full agreement, so equal totals with one sha changed still read as drift.
 *
 * @param {Array<{ slug: string, sha: string }>} files
 * @param {Array<{ slug: string, source_blob_sha: string | null }>} rows
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function contentDriftVerdict(files, rows) {
  const { changed, unrowed, unfiled } = contentDriftCompare(files, rows);
  const drift = changed.length + unrowed.length + unfiled.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `D1 agrees with the repository: ${files.length} post file(s), every blob sha matched by its row.`,
    };
  }
  return {
    ok: false,
    detail:
      `Content drift ${drift}: ${changed.length} sha-changed, ${unrowed.length} ` +
      `file(s) with no row, ${unfiled.length} row(s) with no file, against ` +
      `${files.length} post file(s). Repair with sync_posts on the operator API.`,
    counts: { expected: files.length, present: files.length - changed.length - unrowed.length },
  };
}

/**
 * Counted on the _docsize shadows: COUNT(*) on an external-content fts5 table reads through to its
 * content table and never fails. A count that cannot be read FAILS rather than comparing undefined.
 *
 * @param {Record<string, unknown>} counts
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function ftsEqualityVerdict(counts) {
  const NAMES = ["posts", "postsFts", "docs", "identity", "prose"];

  const unreadable = NAMES.filter((n) => !Number.isInteger(counts[n]) || Number(counts[n]) < 0);
  if (unreadable.length > 0) {
    return {
      ok: false,
      detail:
        `FTS counts unreadable: ${unreadable.join(", ")} ` +
        `${unreadable.length === 1 ? "is" : "are"} missing or not a whole number. ` +
        `A count that cannot be read is not a passing check.`,
    };
  }

  const posts = Number(counts.posts);
  const postsFts = Number(counts.postsFts);
  const docs = Number(counts.docs);
  const identity = Number(counts.identity);
  const prose = Number(counts.prose);

  const broken = [];
  if (posts !== postsFts) broken.push(`posts=${posts} but posts_fts_docsize=${postsFts}`);
  if (identity !== docs || prose !== docs) {
    broken.push(
      `search_docs=${docs} but search_identity_docsize=${identity} and ` +
        `search_prose_docsize=${prose}`,
    );
  }

  if (broken.length === 0) {
    return {
      ok: true,
      detail:
        `FTS indexes agree: posts=${posts}=posts_fts_docsize, ` +
        `search_docs=${docs}=identity=prose.`,
    };
  }

  return {
    ok: false,
    detail:
      `FTS index drift: ${broken.join("; ")}. ` +
      `Rebuild with INSERT INTO <index>(<index>) VALUES('rebuild'). ` +
      `Do NOT DELETE FROM either index; that corrupts it further.`,
    // The first disagreeing pair only; the full five are in detail, which stays off the wire.
    counts:
      posts !== postsFts
        ? { expected: posts, present: postsFts }
        : { expected: docs, present: identity !== docs ? identity : prose },
  };
}

/** Measured: ask-index-drift maxed at 2332 ms over 12 samples, so 3 s clears it without false alarms. */
export const CHECK_TIMEOUT_MS = 3000;

/**
 * A timeout is a failed check. It does not cancel the work: only the RESPONSE is bounded, and abandoned
 * work keeps accumulating under sustained timeouts.
 *
 * @param {Promise<{ ok: boolean, detail: string, counts?: { expected: number, present: number } }>} promise
 * @param {number} ms
 * @param {string} name
 * @returns {Promise<{ ok: boolean, detail: string, counts?: { expected: number, present: number } }>}
 */
export function withTimeout(promise, ms, name) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          ok: false,
          detail: `check ${name} did not answer within ${ms}ms and is reported failed`,
        }),
      ms,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          detail: `check threw: ${errorMessage(error)}`,
        });
      },
    );
  });
}

/**
 * Detail strings never reach this unauthenticated wire: they carry an R2 object key and shadow table
 * names. A FAILING check carries its two counts, so a flap can be sized; a passing one, name and ok.
 *
 * @param {{ checks: Array<{ name: string, ok: boolean, counts?: { expected: number, present: number } }> }} run
 * @returns {{ ok: boolean, checks: Array<{ name: string, ok: boolean, expected?: number, present?: number }> }}
 */
export function publicHealthBody(run) {
  return {
    ok: run.checks.every((c) => c.ok),
    checks: run.checks.map((c) => {
      // Field by field, not spread, so a field added to HealthCheck later cannot leak onto the wire.
      if (c.ok || !c.counts) return { name: c.name, ok: c.ok };
      return {
        name: c.name,
        ok: c.ok,
        expected: c.counts.expected,
        present: c.counts.present,
      };
    }),
  };
}

