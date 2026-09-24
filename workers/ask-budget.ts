// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { DurableObject } from "cloudflare:workers";

/**
 * Not the `ratelimit` binding or KV: the binding is documented as eventually consistent and not for
 * accounting, and KV read-modify-writes race. Synchronous SQL, because a DO sequence spanning
 * `await` is not atomic.
 */
export class AskBudget extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
    );
  }

  /** No `await` anywhere in the body, or the count can be raced. */
  consume(limit: number): { ok: boolean; spent: number } {
    const day = new Date().toISOString().slice(0, 10);

    const rows = this.ctx.storage.sql
      .exec<{ count: number }>(`SELECT count FROM budget WHERE day = ?`, day)
      .toArray();
    const current = rows[0]?.count ?? 0;

    if (current >= limit) {
      return { ok: false, spent: current };
    }

    const next = current + 1;
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
   * Per-IP fixed window, one instance per IP. An exact count, not the permissive `ratelimit` binding,
   * because one bursting client could otherwise burn the whole day's budget for every reader.
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
    this.ctx.storage.sql.exec(`DELETE FROM budget WHERE day <> ?`, String(window));
    return { ok: true, used: next };
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
