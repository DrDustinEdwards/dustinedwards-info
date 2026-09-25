import { Form, Link } from "react-router";

import playgroundData from "../../../content/playground.json";
import { DemoHeader, Problem } from "~/components/playground/demo-parts";
import { COOKIE_CAP } from "~/lib/playground/limits";
import type { themeResolutionDemo } from "~/lib/playground/theme-resolution";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

const COOKIE_PRESETS = playgroundData.cookiePresets;

type Props = Omit<ReturnType<typeof themeResolutionDemo>, "cookieAsked"> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function ThemeResolutionDemo({ themeResult, themeError, cookieRaw, carry }: Props) {
  return (
    <section id={demoAnchor("theme-resolution")} className="playground-demo">
      <DemoHeader slug="theme-resolution" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <div className="playground-field playground-field-wide">
          <label htmlFor="pg-cookie">Cookie header</label>
          <input
            id="pg-cookie" name="cookie" type="text" inputMode="text"
            maxLength={COOKIE_CAP} spellCheck={false}
            defaultValue={cookieRaw}
            aria-describedby="pg-cookie-cap"
          />
        </div>
        <button type="submit">Resolve</button>
        <p id="pg-cookie-cap" className="playground-cap">
          Up to {COOKIE_CAP} printable characters. Your own cookie is not
          read and nothing you type is stored: the resolver is handed a
          request built from this box and from nothing else.
        </p>
      </Form>

      <ul className="playground-swatches">
        {COOKIE_PRESETS.map((preset) => (
          <li key={preset.label}>
            <Link
              to={`${PLAYGROUND_URL}?cookie=${encodeURIComponent(preset.cookie)}#${demoAnchor("theme-resolution")}`}
            >
              {preset.label}
            </Link>
          </li>
        ))}
      </ul>

      {themeError && <Problem>{themeError}</Problem>}

      {themeResult && (
        <div className="playground-result">
          <dl className="playground-metrics">
            <div>
              <dt>Cookie header</dt>
              <dd>{themeResult.cookie === "" ? "none sent" : themeResult.cookie}</dd>
            </div>
            <div>
              <dt>Resolved theme</dt>
              <dd>{themeResult.theme}</dd>
            </div>
            <div>
              <dt>data-theme</dt>
              <dd>{themeResult.attribute ?? "omitted"}</dd>
            </div>
            <div>
              <dt>meta color-scheme</dt>
              <dd>{themeResult.colorScheme}</dd>
            </div>
          </dl>

          <p className="playground-note">
            The choice is a cookie rather than local storage, and that is
            the whole anti-flash design. Local storage is unreadable on the
            server, so a site that keeps the theme there has to paint once
            and then correct itself, which is the flash. A cookie arrives
            with the request, so the server writes the right{" "}
            <code>data-theme</code> into the very first byte of HTML and
            nothing is ever corrected.
          </p>
          <p className="playground-note">
            Omitting the attribute is not a missing value, it is the
            mechanism: with no <code>data-theme</code> the stylesheet falls
            through to <code>prefers-color-scheme</code> and the machine
            decides. That is why a legacy <code>theme=system</code> cookie
            and no cookie at all resolve to the same thing here rather than
            to two states that merely look alike.
          </p>
          <p className="playground-note">
            The meta element is separate from the attribute and does a
            different job. <code>data-theme</code> tells the STYLESHEET
            which palette to use and tells the browser nothing, because the
            browser cannot know what that attribute means until it has
            parsed the CSS that gives it meaning. Until then the canvas it
            paints between documents is the default one, and the default is
            light: a white frame, for exactly one composited frame, for the
            reader whose choice disagrees with their machine.
          </p>
        </div>
      )}
    </section>
  );
}
