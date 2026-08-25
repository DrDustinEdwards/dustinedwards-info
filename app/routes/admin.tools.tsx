import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * THE CONTROLS LIST IS GONE; THE AUDIT IT POINTED AT IS THE PAGE.
 *
 * This loader called `toolsSource`, a `stubSource()` wrapping one literal row:
 * "Secrets audit / Which of the N ratified secrets this deployment holds",
 * with a chip reading "Answered below". It was a row of indirection announcing
 * the thing rendered directly underneath it, and its whole envelope existed to
 * carry a `provider` label and a "stubbed" chip. Both went with the fleet
 * typing on 2026-08-25.
 *
 * The audit itself is unchanged and is still not a button: reading the
 * bindings costs nothing, so a control would add a click and a state to a
 * question the page can simply answer.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
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
  return data({ secrets });
}


export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { secrets } = loaderData;
  const missing = secrets.filter((s) => !s.present);
  return (
    <Panel
      title="Tools"
      description="Which of the ratified secrets this deployment holds. Names and a word, never a value."
    >
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
