import { Link } from "react-router";

import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

const LENS_CHIPS = [
  {
    id: "unattached",
    label: "Unattached",
    hint:
      "No post cites these. Not the same as unused: an asset placed by page code, " +
      "like the roster photographs, is unattached by this measure and is live. " +
      "Verify before deleting.",
  },
  {
    id: "duplicates",
    label: "Duplicates",
    hint: "Files with byte-identical twins, matched on content hash alone.",
  },
  { id: "no-alt", label: "No alt text", hint: "Images with no alt text written yet." },
  { id: "large", label: "Over 1 MB", hint: "Files over one mebibyte." },
] as const;

/** The lens chips, with the trash beside them, and the tag chips when any tag exists. */
export function MediaFacets({
  view,
  lensCounts,
  trashedCount,
  tagCounts,
  linkTo,
}: {
  view: Parameters<typeof sortHref>[0];
  lensCounts: Listing["lensCounts"];
  trashedCount: Listing["trashedCount"];
  tagCounts: Listing["tagCounts"];
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  const activeLens = LENS_CHIPS.find((l) => l.id === view.lens);
  const tagHref = (tag: string) => linkTo({ tag: view.tag === tag ? "" : tag, page: 1 });

  return (
    <>
      <div className="media-facet">
        <span className="media-facet-label" id="media-facet-lens">
          Show
        </span>
        <nav aria-labelledby="media-facet-lens" className="media-filters">
          <Link
            to={linkTo({ lens: "", trash: false, page: 1 })}
            className={`admin-chip${!view.lens && !view.trash ? " is-active" : ""}`}
            aria-current={!view.lens && !view.trash ? "page" : undefined}
          >
            All <span className="admin-chip-count">{lensCounts.all}</span>
          </Link>
          {LENS_CHIPS.map((lens) => {
            const n = lensCounts[lens.id === "no-alt" ? "noAlt" : lens.id];
            return (
              <Link
                key={lens.id}
                to={linkTo({ lens: lens.id, trash: false, page: 1 })}
                className={`admin-chip${view.lens === lens.id ? " is-active" : ""}`}
                aria-current={view.lens === lens.id ? "page" : undefined}
                title={lens.hint}
              >
                {n > 0 ? (
                  <span className="media-lens-dot" data-lens={lens.id} aria-hidden="true" />
                ) : null}
                {lens.label} <span className="admin-chip-count">{n}</span>
              </Link>
            );
          })}
          <Link
            to={linkTo({ trash: !view.trash, lens: "", page: 1, key: "" })}
            className={`admin-chip${view.trash ? " is-active" : ""}`}
            aria-current={view.trash ? "page" : undefined}
            title="A library view, not a takedown. A trashed file keeps its address and any page using it is unchanged."
          >
            Trash <span className="admin-chip-count">{trashedCount}</span>
          </Link>
        </nav>
        <span className="media-facet-hint">
          {activeLens ? activeLens.hint : "everything the library knows about"}
        </span>
      </div>

      {tagCounts.length > 0 ? (
        <div className="media-facet">
          <span className="media-facet-label" id="media-facet-tag">
            Tags
          </span>
          <nav aria-labelledby="media-facet-tag" className="media-filters">
            {tagCounts.map((t) => (
              <Link
                key={t.tag}
                to={tagHref(t.tag)}
                className={`admin-chip${view.tag === t.tag ? " is-active" : ""}`}
                aria-current={view.tag === t.tag ? "page" : undefined}
              >
                {t.tag} <span className="admin-chip-count">{t.n}</span>
              </Link>
            ))}
          </nav>
          <span className="media-facet-hint">yours, in the inspector</span>
        </div>
      ) : null}
    </>
  );
}
