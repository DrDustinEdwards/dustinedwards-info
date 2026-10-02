// Where the CV's files are and what each holds (docs/CV.md). Pure: the registry the save, the sync, the build
// and the drift check share, so none of them names a file the others do not.

/** The repository directory the CV lives in, one markdown file per section plus the profile. */
export const CV_DIR = "content/cv";

/**
 * The files, in the order their entries make the CV's flat list (traditional CV order, which is also the
 * page's "by type" sort). `type` is the entry type a section file holds; the profile holds none.
 *
 * @type {ReadonlyArray<{ slug: string, type: import("./types.ts").CvType | "profile" }>}
 */
export const CV_FILES = [
  { slug: "profile", type: "profile" },
  { slug: "appointments", type: "appointment" },
  { slug: "education", type: "education" },
  { slug: "publications", type: "publication" },
  { slug: "grants", type: "grant" },
  { slug: "honors", type: "award" },
  { slug: "talks", type: "talk" },
  { slug: "courses", type: "course" },
  { slug: "mentoring", type: "mentoring" },
  { slug: "service", type: "service" },
  { slug: "development", type: "development" },
];

/** @param {string} slug */
export function cvSourcePath(slug) {
  return `${CV_DIR}/${slug}.md`;
}

/**
 * The file a slug names, or undefined. A save cannot create a file: the set of files is structure, so a
 * new one is a change to CV_FILES and to the code that reads it.
 *
 * @param {string} slug
 */
export function cvFileFor(slug) {
  return CV_FILES.find((file) => file.slug === slug);
}
