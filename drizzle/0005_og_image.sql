-- Generated social card for a post.
--
-- Additive. Stores the R2 key's public path, for example
-- /media/og/my-post-7f17f8a2.png. Set by `sync:content` after `build:og` has
-- uploaded the object, so the column never names an object that does not exist.
--
-- Deliberately NOT in content/generated/posts.json. The key is deterministic
-- from the post's content, but whether the object has actually been written is
-- a fact about R2, not about the markdown, and the artifact is byte-compared.
--
-- A post with its own `cover` never gets one: the cover wins at render time.

ALTER TABLE posts ADD COLUMN og_image TEXT;
