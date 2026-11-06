import { defineConfig } from "oxfmt";
import { format } from "@dustinedwards/devkit/oxfmt";

export default defineConfig({
  ...format,
  ignorePatterns: [
    ...(format.ignorePatterns ?? []),
    // The prose and data Carrel writes, hashed and served as written: a reflow could change what a visitor reads.
    "content/",
    // Built, vendored and binary files (fonts, audio, diagrams, _headers).
    "public/",
    "assets/",
    // Reference sequences and the data files other tools write.
    "data/",
    // drizzle-kit writes the migrations and their snapshots.
    "drizzle/",
    // Fixtures must stay byte-exact.
    "test/fixtures/",
    // The Worker config examples are copied to wrangler.jsonc and stay as written.
    "**/wrangler.jsonc*",
  ],
});
