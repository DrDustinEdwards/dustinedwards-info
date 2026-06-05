import fs from "fs";
import path from "path";
import matter from "gray-matter";

// Reads markdown files from /content/posts as your writing/lab-notes vault.
// Drop a .md file in that folder with frontmatter (title, date) and it shows up.
// Not surfaced on the homepage yet — this is the foundation for a /writing route.

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export type Post = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  content: string;
};

export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: data.title ?? file,
        date: data.date ?? "",
        excerpt: data.excerpt ?? "",
        content,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
