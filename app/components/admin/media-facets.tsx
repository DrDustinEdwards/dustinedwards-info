import { TabsNav } from "capsomer/react/tabs";

import { TabLink } from "~/components/admin/tab-link";

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
      <div className="app-facet">
        <TabsNav aria-label="Show" variant="line">
          <TabLink
            to={linkTo({ lens: "", trash: false, page: 1 })}
            current={!view.lens && !view.trash}
            count={lensCounts.all}
          >
            All
          </TabLink>
          {LENS_CHIPS.map((lens) => {
            const n = lensCounts[lens.id === "no-alt" ? "noAlt" : lens.id];
            return (
              <TabLink
                key={lens.id}
                to={linkTo({ lens: lens.id, trash: false, page: 1 })}
                current={view.lens === lens.id}
                count={n}
                title={lens.hint}
              >
                {lens.label}
              </TabLink>
            );
          })}
          <TabLink
            to={linkTo({ trash: !view.trash, lens: "", page: 1, key: "" })}
            current={view.trash}
            count={trashedCount}
            title="A library view, not a takedown. A trashed file keeps its address and any page using it is unchanged."
          >
            Trash
          </TabLink>
        </TabsNav>
        <p className="cap-muted">
          {activeLens ? activeLens.hint : "everything the library knows about"}
        </p>
      </div>

      {tagCounts.length > 0 ? (
        <div className="app-facet">
          <TabsNav aria-label="Tags" variant="line">
            {tagCounts.map((t) => (
              <TabLink key={t.tag} to={tagHref(t.tag)} current={view.tag === t.tag} count={t.n}>
                {t.tag}
              </TabLink>
            ))}
          </TabsNav>
          <p className="cap-muted">yours, in the inspector</p>
        </div>
      ) : null}
    </>
  );
}
