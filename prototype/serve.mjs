// Serves ./dist on http://localhost:4321 (PORT overrides). Clean URLs: /cv -> /cv/index.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 4321);

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.includes("..")) { res.writeHead(400).end(); return; }
  let file = join(DIST, p);
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { file = join(DIST, p, "index.html"); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not in the prototype. Links to pages it does not draw go to dustinedwards.info.");
  }
}).listen(port, () => console.log(`prototype on http://localhost:${port}`));
