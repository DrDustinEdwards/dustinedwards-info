import { defineConfig } from "oxlint";
import { base, react, node, ignorePatterns } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base, react],
  ignorePatterns: [
    ...ignorePatterns,
    // mcp/ is its own package (own lockfile, own CI job); content/ and public/ hold built and vendored files.
    "mcp/",
    "content/",
    "public/",
  ],
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
