import { RateLimiter } from "@drdustinedwards/rate-limit/durable-object";

/**
 * The per-key rate limits are the shared class's `hit` (@drdustinedwards/rate-limit), which this class
 * extends so the binding and the stored class keep their name and need no migration; `consume` is the
 * site-wide daily budget, which stays here. Not the `ratelimit` binding or KV: the binding is documented
 * as eventually consistent and not for accounting, and KV read-modify-writes race. Synchronous SQL,
 * because a DO sequence spanning `await` is not atomic.
 */
export class AskBudget extends RateLimiter<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // `day` is the UTC date of the daily budget. Rows an earlier per-IP limit left here are never read again.
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
    );
  }

  /**
   * Counts one use in the window `key` unless `limit` is already reached, and forgets every other
   * window. No `await` anywhere in the body, or the count can be raced.
   */
  private increment(key: string, limit: number): { ok: boolean; count: number } {
    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, key)
      .toArray();
    const current = rows[0]?.count ?? 0;

    if (current >= limit) {
      return { ok: false, count: current };
    }

    const next = current + 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO budget (day, count) VALUES (?, ?)
         ON CONFLICT(day) DO UPDATE SET count = excluded.count`,
      key,
      next,
    );
    this.ctx.storage.sql.exec(`DELETE FROM budget WHERE day <> ?`, key);
    return { ok: true, count: next };
  }

  /** The site-wide daily budget, keyed by the UTC date. */
  consume(limit: number): { ok: boolean; spent: number } {
    const { ok, count } = this.increment(new Date().toISOString().slice(0, 10), limit);
    return { ok, spent: count };
  }

  peek(): { day: string; count: number } {
    const day = new Date().toISOString().slice(0, 10);
    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, day)
      .toArray();
    return { day, count: rows[0]?.count ?? 0 };
  }

  reset(): void {
    this.ctx.storage.sql.exec(`DELETE FROM budget`);
  }
}
