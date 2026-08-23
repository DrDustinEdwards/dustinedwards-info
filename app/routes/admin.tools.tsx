import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { toolsSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * MARKED even though it is a STUB, and that is the point rather than an
   * oversight. `toolsSource` returns a literal with no I/O, so this should read
   * ~0ms forever. A mark that reads 0 is what makes the day it stops reading 0
   * visible: the whole finding behind this session is that three fixes landed
   * on 90ms because the expensive call was in the one loader nobody had marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  const result = await timed(timings, "tools_source", () => toolsSource.fetch(env));
  /*
   * PRESENCE ONLY. `auditSecrets` returns a name and a boolean per ratified
   * secret and nothing else, which is asserted behaviourally in
   * `test/secrets-audit.test.mjs`: a value, a masked prefix or a length
   * reaching this payload fails two independent assertions there.
   *
   * Not timed: it reads bindings already in memory and performs no I/O.
   */
  const secrets = auditSecrets(env as unknown as Record<string, unknown>);
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ result, secrets });
}


export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { result, secrets } = loaderData;
  const missing = secrets.filter((s) => !s.present);
  return (
    <Panel
      title="Tools"
      description="Admin-side controls. Each activates when its backing API is wired."
      result={result}
    >
      <ul className="tool-list">
        {(result.data ?? []).map((tool) => (
          <li key={tool.id} className="tool-row">
            <div>
              <p className="tool-row-label">
                {tool.label} <span className="chip">{tool.provider}</span>
              </p>
              <p className="muted">{tool.description}</p>
            </div>
            {/*
              NOT A BUTTON. It was `<button type="button">` with NO HANDLER, and
              the one tool here is `ready`, so it rendered ENABLED: a control an
              operator could click that did nothing at all.

              The comment below already said the right thing, that this tool's
              answer is rendered rather than run, and the markup just never
              agreed with it. A chip states the state without offering an
              action that does not exist.
            */}
            <span className="chip">{tool.ready ? "Answered below" : "Not wired"}</span>
          </li>
        ))}
      </ul>

      {/*
        THE AUDIT ITSELF, rendered rather than run behind a button.

        There is no "Run" for this one and that is deliberate: reading the
        bindings costs nothing, so a button would add a click and a state to a
        question the page can simply answer. The count is NOT restated here;
        `REQUIRED_SECRETS` is the owner and the chip below derives from it.
        The word "five" once sat in this file while check:secrets measured a
        different number, which is why.
        NAMES AND A WORD, never a value. See `auditSecrets`.
      */}
      <h3 className="tool-audit-heading">
        Secrets{" "}
        <span className="chip">
          {missing.length === 0
            ? `all ${secrets.length} set`
            : `${missing.length} of ${secrets.length} missing`}
        </span>
      </h3>
      <ul className="tool-list">
        {secrets.map((secret) => (
          <li key={secret.name} className="tool-row">
            <p className="tool-row-label">{secret.name}</p>
            {/* `chip-error`, which already exists and whose token pair
                check:contrast already measures. The WORD carries the state,
                so the hue is the second channel, per the rule stated at
                `.chip-live`. */}
            <span className={secret.present ? "chip" : "chip chip-error"}>
              {secret.present ? "set" : "NOT SET"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
