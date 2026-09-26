/**
 * Served by `enhancePlugin()` in scripts/lib/enhance-bundle.mjs, one entry per `app/enhance/*.ts`.
 * The names are stated here because a type cannot read a directory; check:page-payload holds this
 * list equal to the modules in both directions.
 *
 * Its own file, with no import or export, so the declaration is ambient: inside a module such as
 * env.d.ts it would be read as an augmentation of a module that does not exist.
 */
declare module "virtual:enhance" {
  type EnhanceModuleName =
    | "ask"
    | "blog"
    | "header"
    | "login"
    | "palette"
    | "plate"
    | "podcast"
    | "search"
    | "theme";
  /** The served URL of each bundle, under Vite's base. */
  export const ENHANCE_URLS: Readonly<Record<EnhanceModuleName, string>>;
  /** Gzip level 9 over each bundle, measured by the build because the Worker has no filesystem. */
  export const ENHANCE_GZIP_BYTES: Readonly<Record<EnhanceModuleName, number>>;
}
