-- Two provenance columns on posts, for the uncommitted-artifact arc.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- `source_blob_sha` is the git blob sha1 of the markdown file the row was
-- rendered from, computed the git way: sha1 of "blob <bytes>\0" plus the
-- bytes. It is what lets anything compare a D1 row to the repository without
-- fetching the file: GitHub's Contents directory listing reports each file's
-- blob sha for free, so drift detection is one listing against one column.
--
-- `render_hash` is the sha256 of the rendered HTML. Same source bytes rendered
-- by the Worker and by the Node build must produce the same hash; a row whose
-- source_blob_sha matches the file while render_hash differs from a fresh
-- build is Worker-versus-Node render drift, which is the class the committed
-- artifact's byte gate used to catch at commit time.
--
-- Both are computed only by app/lib/content/hashes.mjs, and both writers set
-- both columns on every write. NULL means "written before this migration";
-- rows converge to non-null on the next sync or save, per rule 18.

ALTER TABLE posts ADD COLUMN source_blob_sha text;
ALTER TABLE posts ADD COLUMN render_hash text;
