-- `role`: what an asset is FOR, as opposed to what it is or where it lives.
--
-- `kind` and `storage` were not enough, and the gap was LIVE rather than
-- theoretical. The picker filtered on `kind='image' AND storage IN
-- ('r2','static')` and offered 26 assets of which 9 were insertable. The other
-- 17 were the site logos, every favicon and touch icon, and both halves of
-- every rendered diagram.
--
-- The diagram pair is why this is a column and not a nicety.
-- `/diagrams/<hash>-light.svg` and `-dark.svg` are two renders of one drawing
-- and `app.css` shows whichever matches the theme. Picking one from the library
-- inserts HALF A PAIR and bypasses the `:::diagram` directive whose whole job is
-- to emit both. One click, one broken post.
--
-- DERIVED by `roleOf()` in app/lib/media/classify.mjs, never written by hand and
-- never reconstructed as a path list inside a query. `check:media` verifies
-- every row against that function in both directions, exactly as it already does
-- for `kind` and `storage`, so a value that drifts from the deriver is a gate
-- failure rather than a surprise in the picker.
--
-- Default 'content' matches the deriver's default, and the direction is
-- deliberate: an unrecognised asset appearing in the picker is a nuisance the
-- author fixes in a second, while an unrecognised asset silently excluded is an
-- image nobody can find and nobody knows is missing. Fail toward being seen.
--
-- Every existing row is re-derived by the next rebuild, so no data migration is
-- needed here: the column is derived, and the rebuild is what derives it.
ALTER TABLE media ADD COLUMN role TEXT NOT NULL DEFAULT 'content';

CREATE INDEX IF NOT EXISTS media_role_idx ON media (role);
