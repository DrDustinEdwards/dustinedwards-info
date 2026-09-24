/**
 * Miniflare resolves Durable Object bindings and `ctx.exports` against the script `main` names,
 * so the classes are re-exported here. Not `workers/app.ts`: that would pull the whole route
 * graph into every test file.
 */

export { AskBudget } from "../../workers/ask-budget";

export { Renderer } from "../../workers/app";

export default {
  fetch() {
    return new Response("test entry", { status: 501 });
  },
} satisfies ExportedHandler;
