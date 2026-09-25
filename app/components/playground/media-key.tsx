import { Form, Link } from "react-router";

import playgroundData from "../../../content/playground.json";
import { DemoHeader, Problem } from "~/components/playground/demo-parts";
import { KEY_CAP } from "~/lib/playground/limits";
import type { mediaKeyDemo } from "~/lib/playground/media-key";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

const KEY_PRESETS = playgroundData.keyPresets;

type Props = ReturnType<typeof mediaKeyDemo> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function MediaKeyDemo({ keyResult, keyError, keyRaw, carry }: Props) {
  return (
    <section id={demoAnchor("media-key")} className="playground-demo">
      <DemoHeader slug="media-key" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <div className="playground-field playground-field-wide">
          <label htmlFor="pg-key">Key or path</label>
          <input
            id="pg-key" name="key" type="text" inputMode="text"
            maxLength={KEY_CAP} spellCheck={false}
            defaultValue={keyRaw}
            aria-describedby="pg-key-cap"
          />
        </div>
        <button type="submit">Parse</button>
        <p id="pg-key-cap" className="playground-cap">
          Up to {KEY_CAP} characters. Nothing you type is stored, and
          nothing here reads a bucket: every answer below is a function of
          the string and nothing else.
        </p>
      </Form>

      <ul className="playground-swatches">
        {KEY_PRESETS.map((preset) => (
          <li key={preset.key}>
            <Link
              to={`${PLAYGROUND_URL}?key=${encodeURIComponent(preset.key)}#${demoAnchor("media-key")}`}
            >
              {preset.label}
            </Link>
          </li>
        ))}
      </ul>

      {keyError && <Problem>{keyError}</Problem>}

      {keyResult && (
        <div className="playground-result">
          <dl className="playground-metrics">
            <div>
              <dt>Content key</dt>
              <dd>{keyResult.contentKey ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Content digest</dt>
              <dd>{keyResult.digest ?? "none"}</dd>
            </div>
            <div>
              <dt>Intrinsic dimensions</dt>
              <dd>{keyResult.dimensions ?? "none"}</dd>
            </div>
            <div>
              <dt>Storage tier</dt>
              <dd>{keyResult.storage}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{keyResult.role}</dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd>{keyResult.classification?.kind ?? "refused"}</dd>
            </div>
            <div>
              <dt>Media type</dt>
              <dd>{keyResult.classification?.mime ?? "refused"}</dd>
            </div>
            <div>
              <dt>Transformable raster</dt>
              <dd>{keyResult.raster ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Safe to crop</dt>
              <dd>{keyResult.cropSafe ? "Yes" : "No"}</dd>
            </div>
          </dl>

          {keyResult.classifyRefusal && (
            <>
              <Problem>{keyResult.classifyRefusal}</Problem>
              <p className="playground-note">
                That is the classifier doing its job. It throws on an
                unrecognised extension rather than returning a default,
                which is the whole reason it is a function and not a
                lookup at the call site: a new file type appearing under{" "}
                <code>public/</code> has to stop a build, not acquire a
                plausible kind nobody chose. Adding a type means adding it
                to the table in the same commit as the file.
              </p>
            </>
          )}

          {keyResult.excluded && (
            <p className="playground-note">
              Excluded from the asset index: {keyResult.excluded}
            </p>
          )}

          <p className="playground-note">
            The three shapes above are one grammar, stated once. A key is
            sixteen hex digits of the content digest, optionally the
            intrinsic dimensions, then the extension; nothing else is a
            content key. Four functions read that one statement, and they
            do not all take the same argument: the digest and dimension
            readers accept a bare key OR a <code>/media/</code> path and
            strip any transform query, because a width is a request for a
            different rendering rather than a different object, while the
            boolean documents a bare key and the classifier reads
            everything after the last dot. Every one of those contracts is
            visible in the presets above, which is the reason they are the
            presets.
          </p>
          <p className="playground-note">
            Why one statement rather than four: there used to be more, and
            they had already drifted. Collapsing them was done as a
            differential over generated and negative cases, and the two
            spellings disagreed on a key with a leading zero in its
            dimension, where the loose reader returned a size for a key the
            strict readers were simultaneously refusing to give a digest
            for. A grammar with two spellings fails exactly when the writer
            moves, which is the one moment it is needed.
          </p>
        </div>
      )}
    </section>
  );
}
