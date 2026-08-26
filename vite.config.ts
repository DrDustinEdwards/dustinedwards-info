import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    /*
     * The enhancement bundles are ALWAYS emitted as real assets, never inlined.
     * Two of the four sit under the default 4096-byte inline limit, and an
     * inlined bundle becomes a data: URI in a <script src>, which works only
     * because the element carries a nonce, bloats every page it rides on, and
     * is invisible to check:script-payload's byte-equality pass against
     * app/enhance/dist/. Everything else keeps the default behaviour.
     */
    assetsInlineLimit: (filePath) =>
      filePath.split("\\").join("/").includes("app/enhance/dist/") ? false : undefined,
  },
});
