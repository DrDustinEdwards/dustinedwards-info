/**
 * Served by devkit's `siteScript()` (vite.config.ts), one entry per `app/enhance/*.ts`. The names are stated here
 * because a type cannot read a directory, so this list has to be kept equal to the modules by hand when one is
 * added or removed.
 *
 * Its own file, with no import or export, so the declaration is ambient: inside a module such as env.d.ts it
 * would be read as an augmentation of a module that does not exist.
 */
declare module "virtual:islands" {
  type IslandName =
    | "ask"
    | "blog"
    | "catalog"
    | "cv"
    | "header"
    | "offline"
    | "palette"
    | "plate"
    | "platforms"
    | "podcast"
    | "pronounce"
    | "run"
    | "search"
    | "system-map"
    | "theme"
    | "tools";
  /** The built, content-hashed URL of each island (/islands/<name>-<hash>.js; the plain name in `vite dev`). */
  export const ISLAND_URLS: Readonly<Record<IslandName, string>>;
  /** Gzip level 9 over each island and the chunks it imports, measured by the build because the Worker has no filesystem. */
  export const ISLAND_GZIP_BYTES: Readonly<Record<IslandName, number>>;
}
