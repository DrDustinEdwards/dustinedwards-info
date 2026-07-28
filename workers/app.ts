import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "~/lib/context";

// Re-exported so the runtime can find the class its binding names. The Ask
// spend ceiling lives in a Durable Object rather than KV because it has to be
// exact; the measurement that settled it is in the file.
export { AskBudget } from "./ask-budget";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
