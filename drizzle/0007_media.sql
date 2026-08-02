-- The minimal media table, per media-module-architecture.md ruling 2 (amended).
--
-- IT DESCRIBES THE IMAGE, NEVER THE CITATIONS. Usage stays derived: R2 plus a
-- content scan through the resolver seam remains the truth for who cites what.
-- Putting citations here would introduce a sync problem the amended ruling
-- explicitly refuses to take on, because a stale row would then be able to
-- authorise a delete that a fresh scan would refuse.
--
-- The table exists because alt text is a property of the IMAGE and this editor
-- made Dustin retype it at every insertion, which guarantees drift across uses
-- of the same picture. Insertion now pre-fills from `alt` here and still allows
-- a per-use override, because alt is contextual as well as intrinsic.
--
-- `r2_key` is the primary key rather than a surrogate id: the key is already
-- unique, already immutable (the uploader never overwrites), and is the only
-- thing R2 and the content scan both speak. A surrogate would need a lookup on
-- every path and would let a row and an object disagree about identity.
--
-- Rows are NOT authoritative for existence. An object can exist in R2 without a
-- row (uploaded before this table, or a backfill not yet run) and the library
-- lists it either way, with empty metadata. The bucket is the truth for what
-- exists; this is annotation.
CREATE TABLE IF NOT EXISTS media (
  r2_key      TEXT PRIMARY KEY,
  alt         TEXT NOT NULL DEFAULT '',
  caption     TEXT NOT NULL DEFAULT '',
  -- Mirrored from R2 at row creation so the library can sort and display
  -- without a HEAD per object. R2 remains authoritative if the two ever differ.
  uploaded    TEXT,
  -- Intrinsic pixel dimensions, read from the bytes by the Images binding at
  -- upload or backfill. NULL is a real value here and means "not measured":
  -- an SVG has no intrinsic pixel size, and 0 would be a measurement rather
  -- than the absence of one.
  width       INTEGER,
  height      INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The library lists newest first, and the backfill fills this in from R2.
CREATE INDEX IF NOT EXISTS media_uploaded_idx ON media (uploaded DESC);
