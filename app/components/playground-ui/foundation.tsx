import { Icon, Select, Spec, State } from "~/components/playground-ui/specimen";

/** Foundation: the eight primitives both planes share, each in both themes. */
export function FoundationSection() {
  return (
    <section className="pgui-section" aria-labelledby="foundation-h">
      <h2 id="foundation-h">Foundation</h2>
      <p>
        Eight primitives, identical on both planes. They are plain on purpose: the character
        of a public page comes from type and spacing, and each control is finished by the kit
        that hosts it.
      </p>

      <Spec
        id="btn-text"
        title="Button, text variant"
        note="The default everywhere. Its border is --line-strong, the only thing identifying it as a control."
      >
        {() => (
          <div className="pgui-row">
            <State label="Default">
              <button type="button" className="btn">
                Copy BibTeX
              </button>
            </State>
            <State label="Hover">
              <button type="button" className="btn" data-demo="hover">
                Copy BibTeX
              </button>
            </State>
            <State label="Focus">
              <button type="button" className="btn" data-demo="focus">
                Copy BibTeX
              </button>
            </State>
            <State label="Active">
              <button type="button" className="btn" data-demo="active">
                Copy BibTeX
              </button>
            </State>
            <State label="With an icon">
              <button type="button" className="btn">
                <Icon name="download" />
                PDF
              </button>
            </State>
            <State label="Disabled">
              <button type="button" className="btn" disabled>
                Copy BibTeX
              </button>
            </State>
          </div>
        )}
      </Spec>

      <p className="pgui-note">
        A disabled control is identified by the attribute, by its recess and by text beside
        it saying why. The cursor is not a cue: it is pointer only, and it arrives after the
        reader has already tried. Here the reason is that there is no citation to copy yet.
      </p>

      <Spec
        id="btn-filled"
        title="Button, filled variant"
        note="One per page at most, on the page's single primary action. Disabled loses the purple entirely."
      >
        {() => (
          <div className="pgui-row">
            <State label="Default">
              <button type="submit" className="btn btn-primary">
                Send
              </button>
            </State>
            <State label="Hover">
              <button type="submit" className="btn btn-primary" data-demo="hover">
                Send
              </button>
            </State>
            <State label="Focus">
              <button type="submit" className="btn btn-primary" data-demo="focus">
                Send
              </button>
            </State>
            <State label="Active">
              <button type="submit" className="btn btn-primary" data-demo="active">
                Send
              </button>
            </State>
            <State label="Disabled">
              <button type="submit" className="btn btn-primary" disabled>
                Send
              </button>
            </State>
          </div>
        )}
      </Spec>

      <Spec
        id="icon-only"
        title="Icon-only and labeled, one action twice"
        note="Allowed where the icon is universally understood. A primary action stays labeled, whatever icon it carries."
      >
        {() => (
          <div className="pgui-row">
            <State label="Icon only">
              <div>
                <button type="button" className="btn btn-icon" aria-label="Search">
                  <Icon name="search" />
                </button>
                <code className="pgui-aname">aria-label=&quot;Search&quot;</code>
              </div>
            </State>
            <State label="Icon only, focus">
              <div>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label="Search"
                  data-demo="focus"
                >
                  <Icon name="search" />
                </button>
                <code className="pgui-aname">aria-label=&quot;Search&quot;</code>
              </div>
            </State>
            <State label="Labeled, the same action">
              <div>
                <button type="button" className="btn">
                  <Icon name="search" />
                  Search
                </button>
                <code className="pgui-aname">named by its own text</code>
              </div>
            </State>
            <State label="Primary, never icon-only">
              <div>
                <button type="submit" className="btn btn-primary">
                  <Icon name="search" />
                  Search the site
                </button>
                <code className="pgui-aname">named by its own text</code>
              </div>
            </State>
          </div>
        )}
      </Spec>

      <p className="pgui-note">
        The header above carries the two icon-only controls this site actually ships, and
        both take their name from an <code>aria-label</code> rather than from visually
        hidden text: the search trigger, and the theme control&rsquo;s pair of buttons. The
        name is printed under each specimen here because it is the entire reason the form is
        allowed, and it is the one thing a screenshot of this page cannot hold.
      </p>

      <Spec
        id="field"
        title="Text field"
        note="The label is always a real label with a for. Error is aria-invalid, so the visual state and the announced state cannot drift apart."
      >
        {(ids) => (
          <div className="pgui-stack">
            <div className="field">
              <label className="field-label" htmlFor={ids("a")}>
                Email
              </label>
              <input
                className="field-input"
                id={ids("a")}
                name="email"
                type="email"
                defaultValue="jane@example.org"
                aria-describedby={ids("a-hint")}
              />
              <p className="field-hint" id={ids("a-hint")}>
                Used only to reply. Never published.
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor={ids("b")}>
                Email, placeholder and hover
              </label>
              <input
                className="field-input"
                id={ids("b")}
                name="email"
                type="email"
                placeholder="you@example.org"
                data-demo="hover"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={ids("c")}>
                Email, focus
              </label>
              <input
                className="field-input"
                id={ids("c")}
                name="email"
                type="email"
                defaultValue="jane@example.org"
                data-demo="focus"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={ids("d")}>
                Email, error
              </label>
              <input
                className="field-input"
                id={ids("d")}
                name="email"
                type="email"
                defaultValue="jane.example.org"
                aria-invalid="true"
                aria-describedby={ids("d-err")}
              />
              <p className="field-error" id={ids("d-err")}>
                <Icon name="alert-circle" className="icon icon-inline" />
                Enter an address with an @ in it.
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor={ids("e")}>
                Email, disabled
              </label>
              <input
                className="field-input"
                id={ids("e")}
                name="email"
                type="email"
                defaultValue="jane@example.org"
                disabled
                aria-describedby={ids("e-hint")}
              />
              <p className="field-hint" id={ids("e-hint")}>
                Locked while the address is being verified.
              </p>
            </div>
          </div>
        )}
      </Spec>

      <Spec
        id="select"
        title="Select, with its chevron"
        note="pointer-events:none on the chevron, or the square over the control swallows the click meant to open it. It is a currentColor stroke, so it survives forced-colors."
      >
        {(ids) => (
          <div className="pgui-stack">
            <div className="field">
              <label className="field-label" htmlFor={ids("a")}>
                Sort
              </label>
              <Select id={ids("a")} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={ids("b")}>
                Sort, disabled
              </label>
              <Select id={ids("b")} disabled />
              <p className="field-hint">One result, so there is nothing to order.</p>
            </div>
          </div>
        )}
      </Spec>

      <Spec id="textarea" title="Textarea" note="Twice the control height, and it resizes vertically only.">
        {(ids) => (
          <div className="pgui-stack">
            <div className="field">
              <label className="field-label" htmlFor={ids("a")}>
                Note
              </label>
              <textarea
                className="field-input field-textarea"
                id={ids("a")}
                name="note"
                rows={3}
                defaultValue="The cocktail worked in vitro and failed in the mouse."
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={ids("b")}>
                Note, error
              </label>
              <textarea
                className="field-input field-textarea"
                id={ids("b")}
                name="note"
                rows={3}
                aria-invalid="true"
                aria-describedby={ids("b-err")}
                defaultValue=""
              />
              <p className="field-error" id={ids("b-err")}>
                <Icon name="alert-circle" className="icon icon-inline" />
                A note cannot be empty.
              </p>
            </div>
          </div>
        )}
      </Spec>

      <Spec
        id="check"
        title="Checkbox"
        note="The 24px box meets 2.5.8 unaided; the 44px row is the enhanced target and is deliberate extra. The tick is two borders and a rotation."
      >
        {(ids) => (
          <div className="pgui-stack">
            <div className="check">
              <input className="check-box" id={ids("a")} type="checkbox" />
              <label className="check-label" htmlFor={ids("a")}>
                Email me when a reply is posted
              </label>
            </div>
            <div className="check">
              <input className="check-box" id={ids("b")} type="checkbox" defaultChecked />
              <label className="check-label" htmlFor={ids("b")}>
                Checked
              </label>
            </div>
            <div className="check">
              <input className="check-box" id={ids("c")} type="checkbox" data-demo="hover" />
              <label className="check-label" htmlFor={ids("c")}>
                Hover
              </label>
            </div>
            <div className="check">
              <input className="check-box" id={ids("d")} type="checkbox" data-demo="focus" />
              <label className="check-label" htmlFor={ids("d")}>
                Focus
              </label>
            </div>
            <div className="check">
              <input className="check-box" id={ids("e")} type="checkbox" disabled />
              <label className="check-label" htmlFor={ids("e")}>
                Disabled, and the setting is off
              </label>
            </div>
            <div className="check">
              <input
                className="check-box"
                id={ids("f")}
                type="checkbox"
                defaultChecked
                disabled
              />
              <label className="check-label" htmlFor={ids("f")}>
                Disabled and checked, so the value is still readable
              </label>
            </div>
          </div>
        )}
      </Spec>

      <Spec
        id="ring"
        title="Focus ring"
        note="One ring, one rule, every focusable element. It sits outside the control, so a focused error field shows both its doubled border and its ring."
      >
        {(ids) => (
          <div className="pgui-row">
            <State label="Link">
              <a href="/playground/ui" data-demo="focus">
                A link
              </a>
            </State>
            <State label="Button">
              <button type="button" className="btn" data-demo="focus">
                A button
              </button>
            </State>
            <State label="Field, focused and in error">
              <input
                className="field-input"
                id={ids("a")}
                aria-label="Focused and invalid"
                aria-invalid="true"
                data-demo="focus"
                defaultValue="not an address"
              />
            </State>
          </div>
        )}
      </Spec>

      <Spec
        id="icon"
        title="Icon"
        note="Lucide, inline, 20px at 1.5 stroke, always aria-hidden and always beside a label. There are no icon-only controls in this system."
      >
        {() => (
          <div className="pgui-row">
            <State label="download">
              <Icon name="download" />
            </State>
            <State label="search">
              <Icon name="search" />
            </State>
            <State label="alert-circle">
              <Icon name="alert-circle" />
            </State>
            <State label="alert-triangle">
              <Icon name="alert-triangle" />
            </State>
            <State label="check-circle">
              <Icon name="check-circle" />
            </State>
            <State label="chevron-down">
              <Icon name="chevron-down" />
            </State>
            <State label="In a button, taking its color">
              <button type="button" className="btn">
                <Icon name="download" />
                PDF
              </button>
            </State>
          </div>
        )}
      </Spec>

      <Spec
        id="table"
        title="Table"
        note="Horizontal rules only, two weights, no zebra and no vertical rules. The scroll container is focusable and named, with role=group rather than region."
      >
        {(ids) => (
          <div className="table-scroll" tabIndex={0} role="group" aria-labelledby={ids("cap")}>
            <table className="table">
              <caption className="table-caption" id={ids("cap")}>
                Isolates per host species
              </caption>
              <thead>
                <tr>
                  <th scope="col">Host</th>
                  <th scope="col" className="table-num">
                    Isolates
                  </th>
                  <th scope="col" className="table-num">
                    Plaques
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">E. coli</th>
                  <td className="table-num">412</td>
                  <td className="table-num">1,905</td>
                </tr>
                <tr>
                  <th scope="row">K. pneumoniae</th>
                  <td className="table-num">96</td>
                  <td className="table-num">340</td>
                </tr>
                <tr>
                  <th scope="row">P. aeruginosa</th>
                  <td className="table-num">54</td>
                  <td className="table-num">211</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Spec>
    </section>
  );
}
