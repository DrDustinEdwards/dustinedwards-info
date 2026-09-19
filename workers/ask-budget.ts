// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { DurableObject } from "cloudflare:workers";

/**
 * The exact spend ceiling for Ask mode.
 *
 * WHY NOT THE `ratelimit` BINDING OR A KV COUNTER. Cloudflare documents the binding as "permissive,
 * eventually consistent, and intentionally designed to not be used as an accurate accounting
 * system", and a KV counter is worse, because concurrent read-modify-writes each read the same stale
 * value.
 *
 * WHY SYNCHRONOUS SQL rather than `storage.get`/`storage.put`. A Durable Object is single-threaded,
 * but that does NOT make a sequence spanning `await` atomic. The SQLite storage API is synchronous,
 * so the read and the write below sit in one uninterrupted block and the count cannot be raced,
 * which is the entire reason this class is a `new_sqlite_classes` migration.
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
    // The value is read once and guarded, not the row count: a single-row
    // SELECT that returned nothing and a stored count of zero mean the same
    // thing here, which is what the original ternary said too.
    const current = rows[0]?.count ?? 0;

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
   * WHY NOT THE `ratelimit` BINDING. It is documented permissive and eventually consistent, which is
   * fine for shedding sustained load and is not fine as the only thing between one abusive client and
   * the entire daily budget: a client that burns the day's answers in a burst has denied Ask to every
   * other reader until tomorrow. That needs a real count rather than a hint.
   *
   * Synchronous, for the reason `consume` is: a read and a write spanning `await` inside a Durable
   * Object is not atomic.
   */
  hit(limit: number, windowSeconds: number): { ok: boolean; used: number } {
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, String(window))
      .toArray();
    // The value is read once and guarded, not the row count: a single-row
    // SELECT that returned nothing and a stored count of zero mean the same
    // thing here, which is what the original ternary said too.
    const current = rows[0]?.count ?? 0;

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
    return { day, count: rows[0]?.count ?? 0 };
  }

  /** Clears today's count. Admin-only recovery, never reachable from a page. */
  reset(): void {
    this.ctx.storage.sql.exec(`DELETE FROM budget`);
  }
}
