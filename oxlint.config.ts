import { defineConfig } from "oxlint";
import { base, react, node } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base, react],
  rules: {
    // off in devkit 0.24.0
    "typescript/no-non-null-assertion": "off",
    // off in devkit 0.24.0
    "react/only-export-components": "off",
    // off in devkit 0.24.0
    "jsx-a11y/prefer-tag-over-role": "off",
    // off in devkit 0.24.0
    "jsx-a11y/control-has-associated-label": "off",
    // off in devkit 0.24.0
    "jsx-a11y/media-has-caption": "off",
  },
  ignorePatterns: [
    // base's own, listed here until devkit 0.24.0 exports them: Oxlint does not carry ignorePatterns through extends.
    "build/",
    "dist/",
    ".react-router/",
    ".wrangler/",
    "worker-configuration.d.ts",
    "**/*.gen.ts",
    // mcp/ is its own package (own lockfile, own CI job); content/ and public/ hold built and vendored files.
    "mcp/",
    "content/",
    "public/",
  ],
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
