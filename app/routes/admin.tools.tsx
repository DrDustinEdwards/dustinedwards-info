import { data } from "react-router";

import { timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The audit is not a button: reading the bindings costs nothing, so a control
 * would add a click and a state to a question the page can simply answer.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  /*
   * PRESENCE ONLY. `auditSecrets` returns a name and a boolean per ratified secret
   * and nothing else, asserted behaviourally in `test/secrets-audit.test.mjs`: a
   * value, a masked prefix or a length reaching this payload fails two independent
   * assertions. Not timed: it reads bindings already in memory.
   */
  // Spread rather than asserted: `Env` is an interface, so it carries no implicit
  // index signature where the anonymous type a spread produces does. The audit
  // only reads, so a shallow copy is the same answer.
  const secrets = auditSecrets({ ...env });
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
       * THE COUNT IS NOT RESTATED HERE: `REQUIRED_SECRETS` is the owner and the chip
       * derives from it. NAMES AND A WORD, never a value.
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
            {/*
             * `chip-error`, whose token pair `check:contrast` already measures. The WORD
             * carries the state, so the hue is the second channel.
             */}
            <span className={secret.present ? "chip" : "chip chip-error"}>
              {secret.present ? "set" : "NOT SET"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
