import { data } from "react-router";

import { timedLoader } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import { topZeroResults } from "~/lib/search/zero-result.server";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async () => {
    const env = getEnv(context);
    /* Presence only: a name and a boolean per secret, never a value. */
    // Spread rather than asserted: `Env` is an interface, so it has no implicit index signature.
    const secrets = auditSecrets({ ...env });
    const misses = await topZeroResults(env);
    return data({ secrets, misses });
  });
}

export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { secrets, misses } = loaderData;
  const missing = secrets.filter((s) => !s.present);
  return (
    <Panel
      title="Tools"
      description="Which of the ratified secrets this deployment holds. Names and a word, never a value."
    >
      <h2 className="tool-audit-heading">
        Secrets{" "}
        <span className="chip">
          {missing.length === 0
            ? `all ${secrets.length} set`
            : `${missing.length} of ${secrets.length} missing`}
        </span>
      </h2>
      <ul className="tool-list">
        {secrets.map((secret) => (
          <li key={secret.name} className="tool-row">
            <p className="tool-row-label">{secret.name}</p>
            <span className={secret.present ? "chip" : "chip chip-error"}>
              {secret.present ? "set" : "NOT SET"}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="tool-audit-heading">
        Searches that found nothing
        <span className="chip">{misses.length === 0 ? "none" : `${misses.length} shown`}</span>
      </h2>
      {misses.length === 0 ? (
        <p className="muted">Nothing recorded yet, which is the good case.</p>
      ) : (
        <ul className="tool-list">
          {misses.map((miss) => (
            <li key={miss.query} className="tool-row">
              <p className="tool-row-label">{miss.query}</p>
              <span className="chip">
                {miss.count} time{miss.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        {"Queries nobody has repeated recently are removed on a schedule, by the watchdog's daily " +
          "purge_zero_results call; there is no button here for it any more."}
      </p>
    </Panel>
  );
}
