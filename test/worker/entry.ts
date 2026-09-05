/**
 * The worker script `main` points at, and nothing more.
 *
 * Miniflare resolves a Durable Object binding against the script named by
 * `main`, so the class has to be defined somewhere for `env.ASK_BUDGET` to
 * exist at all. This re-exports it and stops.
 *
 * NOT `workers/app.ts`, deliberately. Pointing `main` at the real entry would
 * pull the whole route graph into every test file that only wanted a rate
 * limiter. The tests that DO want the real entry import it directly and call
 * `worker.fetch(...)`, which runs the same module in the same isolate.
 */

export { AskBudget } from "../../workers/ask-budget";

/**
 * `Renderer` TOO, since 2026-09-05, and this one is not about a binding.
 *
 * `ctx.exports` is resolved against the script `main` names, NOT against
 * whichever module a test happened to import. So a case that drives the gateway
 * in `workers/app.ts` reached `ctx.exports.Renderer` and found nothing: the
 * pool's entry was this file, and this file exported no such class. MEASURED as
 * `TypeError: ctx.exports.Renderer is not a function` across fourteen cases on
 * the first run after the split.
 *
 * Re-exporting it here is what makes the loopback resolvable in the harness.
 * It is the SAME class the Worker exports, imported from the same module, so
 * nothing is stubbed: what the tests drive is the real gateway calling the real
 * renderer. What the harness still cannot provide is the CACHE between them,
 * which miniflare does not implement; that half is verify-live's.
 *
 * The paragraph below about not pointing `main` at `workers/app.ts` is
 * unchanged and is still the reason this file exists: a re-export is one symbol,
 * where `main` would be the whole route graph in every test file.
 */
export { Renderer } from "../../workers/app";

export default {
  /** Never reached. Nothing in this layer drives `SELF`. */
  fetch() {
    return new Response("test entry", { status: 501 });
  },
} satisfies ExportedHandler;
