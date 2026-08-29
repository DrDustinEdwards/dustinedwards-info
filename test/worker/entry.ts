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

export default {
  /** Never reached. Nothing in this layer drives `SELF`. */
  fetch() {
    return new Response("test entry", { status: 501 });
  },
} satisfies ExportedHandler;
