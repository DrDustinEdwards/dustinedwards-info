import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // An import map with every chunk's integrity and `integrity` on each modulepreload, which Integrity-Policy needs
  // (site-runtime's registry entry stages it Report-Only).
  subResourceIntegrity: true,
} satisfies Config;
