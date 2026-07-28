import { DurableObject } from "cloudflare:workers";

/**
 * The exact spend ceiling for Ask mode.
 *
 * WHY THIS EXISTS RATHER THAN A KV COUNTER, measured on this deployment
 * 2026-07-28 rather than assumed. Twelve concurrent requests against a
 * `ratelimit` binding configured for 5 per 60 seconds produced ELEVEN
 * generations. That is not a defect in the binding: Cloudflare documents it as
 * "permissive, eventually consistent, and intentionally designed to not be used
 * as an accurate accounting system". A KV counter fails the same way and worse,
 * because concurrent read-modify-writes each read the same stale value.
 *
 * WHY THE COUNTER IS SYNCHRONOUS SQL RATHER THAN `storage.get`/`storage.put`,
 * also measured. The first version of this class did an async read, then an
 * async write. A Durable Object is single-threaded but that does NOT make a
 * sequence spanning `await` atomic: fourteen concurrent requests against a
 * ceiling of three produced EIGHT generations, because several of them had
 * already read the old count before any of them wrote. The SQLite storage API
 * is synchronous, so the read and the write below sit in one uninterrupted
 * block and the count cannot be raced. That is the entire reason this class is
 * registered as a `new_sqlite_classes` migration.
 */
export class AskBudget extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Synchronous, so it is done before any call can observe the table missing.
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
    );
  }

  /**
   * Reserves one answer, or refuses. No `await` anywhere in the body.
   *
   * Returns the count AFTER a successful reservation, so a caller that logs it
   * is logging what it actually consumed rather than what it read.
   */
  consume(limit: number): { ok: boolean; spent: number } {
    const day = new Date().toISOString().slice(0, 10);

    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, day)
      .toArray();
    const current = rows.length > 0 ? rows[0].count : 0;

    if (current >= limit) {
      return { ok: false, spent: current };
    }

    const next = current + 1;
    // One statement, so there is no window between deciding and recording.
    // Rows for previous days are dropped rather than accumulating: the ceiling
    // is a daily question and yesterday's number answers nothing.
    this.ctx.storage.sql.exec(
      `INSERT INTO budget (day, count) VALUES (?, ?)
         ON CONFLICT(day) DO UPDATE SET count = excluded.count`,
      day,
      next,
    );
    this.ctx.storage.sql.exec(`DELETE FROM budget WHERE day <> ?`, day);

    return { ok: true, spent: next };
  }

  /**
   * Per-IP burst counting, on a fixed window. One instance per IP.
   *
   * WHY NOT THE `ratelimit` BINDING, measured across four runs on this
   * deployment 2026-07-28. Twelve concurrent requests against a binding
   * configured for 5 per 60 seconds were refused 1, then 2, then 9, then 0
   * times. Cloudflare documents exactly this ("permissive, eventually
   * consistent"), and it is fine for shedding sustained load. It is not fine as
   * the only thing standing between one abusive client and the entire daily
   * budget, because a client that burns 200 answers in a burst has denied Ask
   * to every other reader for the rest of the day. That is the failure this
   * method exists to prevent, and it needs a real count rather than a hint.
   *
   * Synchronous, for the same reason `consume` is: a read and a write spanning
   * `await` inside a Durable Object is not atomic, and interleaving is what
   * made the first version of this class leak.
   */
  hit(limit: number, windowSeconds: number): { ok: boolean; used: number } {
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, String(window))
      .toArray();
    const current = rows.length > 0 ? rows[0].count : 0;

    if (current >= limit) {
      return { ok: false, used: current };
    }

    const next = current + 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO budget (day, count) VALUES (?, ?)
         ON CONFLICT(day) DO UPDATE SET count = excluded.count`,
      String(window),
      next,
    );
    // Only the current window is kept, so an instance cannot grow without bound
    // however long the IP keeps coming back.
    this.ctx.storage.sql.exec(`DELETE FROM budget WHERE day <> ?`, String(window));
    return { ok: true, used: next };
  }

  /** Reads the count without consuming. Used by the admin panel. */
  peek(): { day: string; count: number } {
    const day = new Date().toISOString().slice(0, 10);
    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, day)
      .toArray();
    return { day, count: rows.length > 0 ? rows[0].count : 0 };
  }

  /** Clears today's count. Admin-only recovery, never reachable from a page. */
  reset(): void {
    this.ctx.storage.sql.exec(`DELETE FROM budget`);
  }
}
