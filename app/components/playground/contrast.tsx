import { Form, Link } from "react-router";

import playgroundData from "../../../content/playground.json";
import { DemoHeader, Problem, inputDefault } from "~/components/playground/demo-parts";
import type { contrastDemo } from "~/lib/playground/contrast";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

/** From `content/playground.json`, which `check:features` asserts against; a copy here would let the gate check itself. */
const SWATCHES = playgroundData.swatches;

type Props = ReturnType<typeof contrastDemo> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function ContrastDemo({ lab, labError, fgRaw, bgRaw, carry }: Props) {
  return (
    <section id={demoAnchor("contrast")} className="playground-demo">
      <DemoHeader slug="contrast" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <div className="playground-field">
          <label htmlFor="pg-fg">Foreground</label>
          <input
            id="pg-fg" name="fg" type="text" inputMode="text"
            maxLength={7} size={9} spellCheck={false}
            defaultValue={fgRaw || inputDefault("contrast", "fg")}
            aria-describedby="pg-hex-cap"
          />
        </div>
        <div className="playground-field">
          <label htmlFor="pg-bg">Background</label>
          <input
            id="pg-bg" name="bg" type="text" inputMode="text"
            maxLength={7} size={9} spellCheck={false}
            defaultValue={bgRaw || inputDefault("contrast", "bg")}
            aria-describedby="pg-hex-cap"
          />
        </div>
        <button type="submit">Compute</button>
        <p id="pg-hex-cap" className="playground-cap">
          Three or six hex digits each, with or without the hash.
        </p>
      </Form>

      <ul className="playground-swatches">
        {SWATCHES.map((s) => (
          <li key={s.label}>
            <Link
              to={`${PLAYGROUND_URL}?fg=${encodeURIComponent(s.fg)}&bg=${encodeURIComponent(s.bg)}#${demoAnchor("contrast")}`}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>

      {labError && <Problem>{labError}</Problem>}

      {lab && (
        <div className="playground-result">
          <p
            className="playground-sample"
            style={{ color: lab.fg, background: lab.bg }}
          >
            The quick brown fox jumps over the lazy dog.
          </p>
          <dl className="playground-metrics">
            <div>
              <dt>WCAG 2.2 contrast ratio</dt>
              <dd>
                <strong>{lab.ratio.toFixed(2)}:1</strong>
              </dd>
            </div>
            <div>
              <dt>AA, normal text (4.5:1)</dt>
              <dd>{lab.passNormal ? "Pass" : "Fail"}</dd>
            </div>
            <div>
              <dt>AA, large text (3:1)</dt>
              <dd>{lab.passLarge ? "Pass" : "Fail"}</dd>
            </div>
            <div>
              <dt>AAA, normal text (7:1)</dt>
              <dd>{lab.passAAANormal ? "Pass" : "Fail"}</dd>
            </div>
            <div>
              <dt>APCA Lc</dt>
              <dd>
                {lab.lc >= 0 ? "+" : ""}
                {lab.lc.toFixed(1)}
              </dd>
            </div>
          </dl>
          <p className="playground-note">
            The ratio is the conformance number: WCAG 2.2 AA is what this
            site is measured against, and it is what the build gate fails
            on. APCA Lc is shown beside it as an experimental perceptual
            model, not part of any standard and not a pass or fail. It is
            here because it is what decided one real rule in the palette:
            the dark semantic pastels clear the ratio comfortably and APCA
            still rates them around Lc 57 to 60, which is why interactive
            elements in dark mode take solid fills instead.
          </p>
        </div>
      )}
    </section>
  );
}
