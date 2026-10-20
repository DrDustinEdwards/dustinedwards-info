/**
 * Lets node:test load src/ as it is written. The source imports siblings
 * without an extension ("./api-client"), which the bundler resolves and Node
 * does not, so a relative import from a .ts file that names no extension is
 * retried with ".ts". Test plumbing only: nothing under src/ changes for it.
 *
 * `cloudflare:workers` exists only in the Workers runtime. The OAuth provider
 * imports it at load for its WorkerEntrypoint base class, which no test here
 * runs, so it resolves to a stub that names the class and nothing more.
 */
import { registerHooks } from "node:module";

const WORKERS_STUB = `data:text/javascript,${encodeURIComponent(
  "export class WorkerEntrypoint {} export class DurableObject {} export const env = {};",
)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: WORKERS_STUB, shortCircuit: true };
    const fromTs = context.parentURL?.endsWith(".ts");
    if (fromTs && /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
