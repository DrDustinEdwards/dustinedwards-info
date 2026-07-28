-- Table of contents for a rendered post.
--
-- Additive. Stored as a JSON array of { depth, id, text }, produced by the
-- content generator from the same pass that assigns heading ids, so the anchors
-- in the contents always match the ids in the body.
--
-- Kept as its own column rather than parsed out of the stored HTML at request
-- time, which would mean shipping an HTML parser into the Worker to recover
-- something the generator already knew.

ALTER TABLE posts ADD COLUMN toc TEXT;
