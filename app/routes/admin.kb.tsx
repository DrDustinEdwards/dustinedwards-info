import { Form, Link, data } from "react-router";

import { Empty } from "capsomer/react/empty";
import { Panel } from "capsomer/react/panel";
import { Row, RowList, type RowLinkProps } from "capsomer/react/row-list";
import { Status } from "capsomer/react/status";
import { TabsNav } from "capsomer/react/tabs";

import { PageHead } from "~/components/admin/page-head";
import { TabLink } from "~/components/admin/tab-link";
import { listProceduresForAdmin } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { KB_ADMIN_PATH, NEEDS_INFO, baseEntries, entryEditHref, kbTabs, needsInfo, resolveTab, tabHref } from "~/kb/admin.mjs";
import { BASES } from "~/kb/bases.mjs";
import { getEnv } from "~/lib/context";
import { timed, timedLoader } from "~/lib/timing";

import type { Route } from "./+types/admin.kb";

/*
 * The Knowledge Base (docs/KNOWLEDGE-BASE.md, steps 2 and 3): a tab per base listing its entries, and Needs info, every
 * recorded gap on one screen. This page has no action: a row opens its file in the editor (admin.kb.entry.tsx and
 * admin.kb.item.tsx), which saves through the save the operator API uses. Owner-only like every admin page.
 */

export function meta() {
  return [{ title: "Knowledge Base · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const url = new URL(request.url);
    const [entries, items] = await Promise.all([
      timed(timings, "d1_list_procedures", () => listProceduresForAdmin(env)),
      timed(timings, "d1_list_registry", () => listRegistry(env)),
    ]);
    const tab = resolveTab(url.searchParams.get("tab"));
    const q = (url.searchParams.get("q") ?? "").trim();
    const gaps = needsInfo(entries, items);
    return data({
      tab,
      q,
      tabs: kbTabs(entries, gaps),
      rows: baseEntries(entries, tab, q),
      gaps: tab === NEEDS_INFO ? gaps : [],
    });
  });
}

/** A row opens its file in the editor, inside the admin. */
function AdminLink({ href, children, ...rest }: RowLinkProps) {
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}

/** The public page, a document navigation since the public pages bring their own stylesheets; named for its row. */
function ViewLink({ href, what }: { href: string; what: string }) {
  return (
    <Link to={href} reloadDocument className="cap-btn" data-variant="quiet" data-size="sm" aria-label={`View the page for ${what}`}>
      View page
    </Link>
  );
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export default function AdminKnowledgeBase({ loaderData }: Route.ComponentProps) {
  const { tab, q, tabs, rows, gaps } = loaderData;
  const base = BASES.find((b) => b.id === tab);
  const total = tabs.find((t) => t.id === tab)?.count ?? 0;

  return (
    <div className="app-page">
      <PageHead
        title="Knowledge Base"
        lead={
          tab === NEEDS_INFO
            ? `${plural(gaps.length, "value", "values")} waiting on someone who has it, across every entry and registry item.`
            : "Protocols, software how-tos and recipes. Each entry is a file in the repository; this page reads them."
        }
      />

      <TabsNav aria-label="Knowledge bases" variant="line">
        {tabs.map((t) => (
          <TabLink
            key={t.id}
            to={tabHref(t.id, q)}
            current={t.id === tab}
            count={t.count}
            aria-label={`${t.label}, ${plural(t.count, t.id === NEEDS_INFO ? "gap" : "entry", t.id === NEEDS_INFO ? "gaps" : "entries")}`}
          >
            {t.label}
          </TabLink>
        ))}
      </TabsNav>

      {base ? (
        <>
          <Form method="get" action={KB_ADMIN_PATH} role="search" className="app-filters">
            <input type="hidden" name="tab" value={tab} />
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-q">
                Search {base.name.toLowerCase()}
              </label>
              <input
                id="kb-q"
                className="cap-input"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Title, description or slug"
              />
            </div>
          </Form>

          {rows.length === 0 ? (
            <Empty kind={total === 0 ? "nothing-yet" : "no-match"}>
              {total === 0 ? `No ${base.name.toLowerCase()} yet.` : `Nothing in ${base.name.toLowerCase()} matches "${q}".`}
            </Empty>
          ) : (
            <Panel title={base.name} count={rows.length} flush>
              <RowList label={base.name}>
                {rows.map((entry) => (
                  <Row
                    key={entry.slug}
                    title={entry.title}
                    href={entryEditHref(entry.slug)}
                    renderLink={AdminLink}
                    actions={<ViewLink href={entry.path} what={entry.title} />}
                    status={<Status tone={entry.draft ? "nodata" : "ok"}>{entry.draft ? "draft" : "published"}</Status>}
                    detail={entry.description}
                    meta={
                      <span>
                        {[
                          entry.path,
                          entry.version ? `version ${entry.version}` : "no version yet",
                          entry.updated ? `updated ${entry.updated}` : null,
                          entry.gaps.length > 0 ? plural(entry.gaps.length, "gap", "gaps") : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    }
                  />
                ))}
              </RowList>
            </Panel>
          )}
        </>
      ) : gaps.length === 0 ? (
        <Empty kind="all-clear">Nothing is waiting on information.</Empty>
      ) : (
        <Panel title="Needs info" count={gaps.length} flush>
          <RowList label="Needs info">
            {gaps.map((gap) => (
              <Row
                key={`${gap.href}#${gap.what}#${gap.field}`}
                title={gap.what}
                href={gap.editHref}
                renderLink={AdminLink}
                actions={<ViewLink href={gap.href} what={gap.what} />}
                status={<Status tone="warn">{gap.kindLabel}</Status>}
                // What is missing, in words, then why; the row opens the editor at the field it is filled in at.
                detail={
                  <>
                    <strong>{gap.label}</strong>: {gap.reason}
                  </>
                }
              />
            ))}
          </RowList>
        </Panel>
      )}
    </div>
  );
}
