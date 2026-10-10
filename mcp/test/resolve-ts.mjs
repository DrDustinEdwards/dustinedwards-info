/**
 * Lets node:test load src/ as it is written. The source imports siblings
 * without an extension ("./api-client"), which the bundler resolves and Node
 * does not, so a relative import from a .ts file that names no extension is
 * retried with ".ts". Test plumbing only: nothing under src/ changes for it.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromTs = context.parentURL?.endsWith(".ts");
    if (fromTs && /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
