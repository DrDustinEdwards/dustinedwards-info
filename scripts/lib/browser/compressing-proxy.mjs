// A brotli proxy in front of the preview server, for Lighthouse. The preview serves every response
// uncompressed and Cloudflare serves the deployed site with brotli, so Lighthouse on the bare
// preview charges a slow-4G phone for bytes no visitor downloads. Measured 2026-10-21: /systems is
// 92.8 KB from the preview and 15.3 KB brotli from dustinedwards.info, and LCP on the bare preview
// sat 70ms under its 2.5s budget.
import { createServer, request } from "node:http";
import { constants, createBrotliCompress } from "node:zlib";

/** Text responses only; fonts and images are compressed already. */
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|ld\+json|manifest\+json)|image\/svg\+xml)/;
/** Cloudflare's default brotli level for responses it compresses on the fly. */
const BROTLI_QUALITY = 4;

/**
 * Starts the proxy on `port`, forwarding to `target` (an http origin on this machine).
 * @param {string} target
 * @param {number} port
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export async function startCompressingProxy(target, port) {
  const upstream = new URL(target);
  const server = createServer((req, res) => {
    const forward = request(
      { hostname: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: { ...req.headers, host: upstream.host, "accept-encoding": "identity" } },
      (up) => {
        const type = String(up.headers["content-type"] ?? "");
        const wantsBrotli = /\bbr\b/.test(String(req.headers["accept-encoding"] ?? ""));
        if (!wantsBrotli || !COMPRESSIBLE.test(type) || up.headers["content-encoding"]) {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
          return;
        }
        const headers = { ...up.headers, "content-encoding": "br", vary: "accept-encoding" };
        delete headers["content-length"];
        res.writeHead(up.statusCode ?? 502, headers);
        up.pipe(createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })).pipe(res);
      },
    );
    forward.on("error", (error) => res.destroy(error));
    req.pipe(forward);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(undefined));
  });
  return {
    origin: `http://localhost:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
