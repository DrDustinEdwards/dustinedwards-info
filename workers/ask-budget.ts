import {
  consume,
  ensureBudgetTable,
  resetBudget,
  spent,
  windowKey,
} from "@dustinedwards/site-runtime/ai-caps";
import { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

/**
 * The per-key rate limits are the shared class's `hit` (@dustinedwards/site-runtime/rate-limit), which this class
 * extends so the binding and the stored class keep their name and need no migration; `consume` is the
 * site-wide daily budget, whose counting is site-runtime's ai-caps core. Not the `ratelimit` binding or KV: the binding is documented
 * as eventually consistent and not for accounting, and KV read-modify-writes race. Synchronous SQL,
 * because a DO sequence spanning `await` is not atomic.
 */
export class AskBudget extends RateLimiter<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rows an earlier per-IP limit left in `budget` are never read again.
    ensureBudgetTable(this.ctx.storage.sql);
  }

  /** The site-wide daily budget, keyed by the UTC date. */
  consume(limit: number): { ok: boolean; spent: number } {
    return consume(this.ctx.storage.sql, windowKey("day", new Date()), limit);
  }

  /** The day's spend, counting nothing. Not `peek`, which is the shared class's per-key read (site-runtime 0.51.0). */
  peekBudget(): { day: string; count: number } {
    const day = windowKey("day", new Date());
    return { day, count: spent(this.ctx.storage.sql, day) };
  }

  reset(): void {
    resetBudget(this.ctx.storage.sql);
  }
}
