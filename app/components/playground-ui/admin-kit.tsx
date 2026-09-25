import { Spec } from "~/components/playground-ui/specimen";

const HEALTH = [
  { cls: "hc-ok", name: "D1 database", pill: "pill-live", state: "Healthy", now: true },
  { cls: "hc-degraded", name: "R2 media", pill: "pill-held", state: "Slow", now: true },
  { cls: "hc-down", name: "Ask index", pill: "pill-gone", state: "Failing", now: true },
  { cls: "hc-unknown", name: "Watchdog", pill: "pill-draft", state: "No data", now: true },
  { cls: "hc-checking", name: "KV cache", pill: "pill-draft", state: "Checking", now: false },
] as const;

/** The Admin kit: the authenticated plane's components, on the same palette and a denser grid. */
export function AdminKitSection() {
  return (
    <section className="pgui-section" aria-labelledby="admin-h">
      <h2 id="admin-h">The Admin kit</h2>
      <p>
        The authenticated plane, on the same palette and a denser grid. A row is a control
        here rather than a piece of reading, and the admin assumes script.
      </p>

      <Spec
        id="shell"
        title="Topbar and rail"
        note="The admin topbar is --paper with a rule beneath, never the purple chrome. The current rail item is marked by an inset brand bar, a surface change and weight."
      >
        {() => (
          <div className="admin">
            <div className="admin-topbar">
              <a className="admin-brand" href="/playground/ui">
                Admin
              </a>
              <p className="admin-context">dustinedwards.info</p>
              <form method="get" action="/playground/ui">
                <button className="btn" type="submit">
                  Sign out
                </button>
              </form>
            </div>
            <div className="admin-body">
              <nav className="admin-rail" aria-label="Admin sections">
                <a className="admin-rail-item" href="/playground/ui" aria-current="page">
                  Moderation <span className="admin-rail-count">12</span>
                </a>
                <a className="admin-rail-item" href="/playground/ui">
                  Posts
                </a>
                <a className="admin-rail-item" href="/playground/ui" data-demo="hover">
                  Publications
                </a>
                <a className="admin-rail-item" href="/playground/ui">
                  Health
                </a>
              </nav>
              <div className="admin-main">
                <p>The pending count sits in the rail, and it is why moderation is first.</p>
              </div>
            </div>
          </div>
        )}
      </Spec>

      <Spec
        id="dt"
        title="Data table, three selected"
        note="The whole table is one form and each selection is a checkbox with a name, so the browser collects them with no script. Every checkbox has a real label naming its row."
      >
        {(ids) => (
          <form className="dt-form" method="get" action="/playground/ui">
            <div className="dt-bulk" role="group" aria-label="Actions for selected posts">
              <p className="dt-bulk-count">3 selected</p>
              <p className="sr-only" id={ids("live")} aria-live="polite">
                3 posts selected
              </p>
              <button className="btn" type="submit" name="op" value="unpublish">
                Unpublish
              </button>
              <button className="btn" type="submit" name="op" value="delete">
                Delete
              </button>
            </div>
            <div className="table-scroll" tabIndex={0}>
              <table className="dt">
                <thead>
                  <tr>
                    <th scope="col" className="dt-pick">
                      <input
                        className="check-box"
                        type="checkbox"
                        id={ids("all")}
                        defaultChecked
                      />
                      <label className="sr-only" htmlFor={ids("all")}>
                        Select all posts on this page
                      </label>
                    </th>
                    <th scope="col">Title</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="dt-num">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "412", title: "Designing phage cocktails that hold", pick: true },
                    { id: "413", title: "What a titre actually tells you", pick: true },
                    { id: "414", title: "Counting plaques by hand", pick: true },
                    { id: "415", title: "Ten years on Cloudflare", pick: false },
                    { id: "416", title: "A row under the pointer", pick: false, hover: true },
                  ].map((row) => (
                    <tr
                      className="dt-row"
                      key={row.id}
                      {...(row.pick ? { "data-selected": "" } : {})}
                      {...("hover" in row ? { "data-demo": "hover" } : {})}
                    >
                      <td className="dt-pick">
                        <input
                          className="check-box"
                          type="checkbox"
                          name="id"
                          value={row.id}
                          id={ids(row.id)}
                          defaultChecked={row.pick}
                        />
                        <label className="sr-only" htmlFor={ids(row.id)}>
                          Select {row.title}
                        </label>
                      </td>
                      <th scope="row" className="dt-title">
                        <a
                          href="/playground/ui"
                          {...("hover" in row ? { "data-demo": "hover" } : {})}
                        >
                          {row.title}
                        </a>
                      </th>
                      <td>
                        <span className="pill pill-live">Published</span>
                      </td>
                      <td className="dt-num">
                        <time dateTime="2026-04-11">11 Apr</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </Spec>

      <Spec
        id="dt-zero"
        title="Bulk bar at zero selected"
        note="The bar is always present, never revealed on selection. The buttons are hidden and the count is the explanation for their absence, so it is never removed and never hidden."
      >
        {(ids) => (
          <div className="dt-bulk" role="group" aria-label="Actions for selected posts">
            <p className="dt-bulk-count">0 selected</p>
            <p className="sr-only" id={ids("live")} aria-live="polite" />
            <button className="btn" type="button" name="op" value="unpublish" hidden>
              Unpublish
            </button>
            <button className="btn" type="button" name="op" value="delete" hidden>
              Delete
            </button>
          </div>
        )}
      </Spec>

      <Spec
        id="pill"
        title="Status pills"
        note="A span, never a link, with a dot that is currentColor. The word is the status and the color confirms it."
      >
        {() => (
          <div className="pgui-row">
            <span className="pill pill-live">Published</span>
            <span className="pill pill-draft">Draft</span>
            <span className="pill pill-held">Held</span>
            <span className="pill pill-gone">Deleted</span>
          </div>
        )}
      </Spec>

      <Spec
        id="mq"
        title="Moderation queue row"
        note="Three actions, three forms, three URLs, and none of them a link: an action a crawler can follow is an action that eventually fires itself. Delete is the only one that looks different."
      >
        {() => (
          <ul className="mq-list">
            <li className="mq-row">
              <div className="mq-meta">
                <p className="mq-who">jane@example.org</p>
                <p className="mq-where">
                  on <a href="/playground/ui">Designing phage cocktails</a> ·{" "}
                  <time dateTime="2026-09-12T08:14">12 Sep, 08:14</time>
                </p>
              </div>
              <blockquote className="mq-text">
                <p>Did you try the T4 panel against the clinical isolates?</p>
              </blockquote>
              <div className="mq-acts">
                <form method="get" action="/playground/ui">
                  <button className="btn" type="submit">
                    Approve
                  </button>
                </form>
                <form method="get" action="/playground/ui">
                  <button className="btn" type="submit">
                    Reject
                  </button>
                </form>
                <form method="get" action="/playground/ui">
                  <button className="btn mq-delete" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          </ul>
        )}
      </Spec>

      <Spec
        id="hc"
        title="Health cards, five states"
        note="Unknown and checking share an accent: neither is a judgment about the service. Checking keeps the previous reading and relabels every fact as history."
      >
        {() => (
          <div className="pgui-stack">
            {HEALTH.map((card) => (
              <article className={`hc ${card.cls}`} key={card.cls}>
                <h4 className="hc-name">{card.name}</h4>
                <p className="hc-state">
                  <span className={`pill ${card.pill}`}>{card.state}</span>
                </p>
                <dl className="hc-facts">
                  <div>
                    <dt>{card.now ? "p95" : "Last p95"}</dt>
                    <dd>38 ms</dd>
                  </div>
                  <div>
                    <dt>{card.now ? "Checked" : "Last checked"}</dt>
                    <dd>
                      <time dateTime="2026-09-13T09:02">09:02</time>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Spec>

      <Spec
        id="af"
        title="Admin form and editor toolbar"
        note="Labels above fields, one column, at the measure. Save is the page's one filled button. The toolbar's buttons are type=button, so a formatting action can never submit the form."
      >
        {(ids) => (
          <form className="af" method="get" action="/playground/ui">
            <div className="af-group">
              <h4 className="af-group-h">Post</h4>
              <div className="field">
                <label className="field-label" htmlFor={ids("title")}>
                  Title
                </label>
                <input
                  className="field-input"
                  id={ids("title")}
                  name="title"
                  type="text"
                  defaultValue="Designing phage cocktails that hold"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={ids("slug")}>
                  Slug
                </label>
                <input
                  className="field-input af-mono"
                  id={ids("slug")}
                  name="slug"
                  type="text"
                  defaultValue="phage-cocktails"
                  aria-describedby={ids("slug-hint")}
                />
                <p className="field-hint" id={ids("slug-hint")}>
                  Changing this breaks existing links.
                </p>
              </div>
            </div>

            <div className="af-group">
              <h4 className="af-group-h">Body</h4>
              <div className="ed">
                <div className="ed-tools" role="toolbar" aria-label="Formatting">
                  <button
                    className="btn ed-tool"
                    type="button"
                    aria-pressed="true"
                    data-cmd="bold"
                  >
                    Bold
                  </button>
                  <button
                    className="btn ed-tool"
                    type="button"
                    aria-pressed="false"
                    data-cmd="italic"
                  >
                    Italic
                  </button>
                  <button
                    className="btn ed-tool"
                    type="button"
                    aria-pressed="false"
                    data-cmd="link"
                  >
                    Link
                  </button>
                  <button
                    className="btn ed-tool"
                    type="button"
                    aria-pressed="false"
                    data-cmd="code"
                  >
                    Code
                  </button>
                </div>
                <label className="sr-only" htmlFor={ids("body")}>
                  Body
                </label>
                <textarea
                  className="field-input ed-area af-mono"
                  id={ids("body")}
                  name="body"
                  rows={6}
                  defaultValue={"## Method\n\nThe panel was assembled from four isolates.\n"}
                />
              </div>
            </div>

            <div className="af-actions">
              <button className="btn btn-primary" type="submit" name="op" value="save">
                Save
              </button>
              <button className="btn" type="submit" name="op" value="save-publish">
                Save and publish
              </button>
            </div>
          </form>
        )}
      </Spec>

      <Spec
        id="dlg"
        title="Admin dialog"
        note="The system's only modal, and it lives only here. The specimen is rendered open and in flow, because a public page runs no script to call showModal."
      >
        {(ids) => (
          <dialog className="dlg" open aria-labelledby={ids("h")}>
            <div className="dlg-in">
              <h4 className="dlg-h" id={ids("h")}>
                Delete this comment?
              </h4>
              <p className="dlg-body">
                It is removed permanently. There is no undo and no trash.
              </p>
              <div className="dlg-acts">
                <button className="btn" type="button">
                  Cancel
                </button>
                <button className="btn dlg-go" type="button">
                  Delete
                </button>
              </div>
            </div>
          </dialog>
        )}
      </Spec>
    </section>
  );
}
