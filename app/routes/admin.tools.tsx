import { data } from "react-router";

import { timedLoader } from "~/lib/timing";
import { Panel } from "capsomer/react/panel";
import { Pill, Status } from "capsomer/react/status";
import { Row, RowList } from "capsomer/react/row-list";

import { PageHead } from "~/components/admin/page-head";
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
    <div className="app-page">
      <PageHead
        title="Tools"
        lead="Which of the ratified secrets this deployment holds. Names and a word, never a value."
      />

      <Panel
        title="Secrets"
        src={
          missing.length === 0 ? (
            <Status tone="ok">{`all ${secrets.length} set`}</Status>
          ) : (
            <Status tone="crit">{`${missing.length} of ${secrets.length} missing`}</Status>
          )
        }
        flush
      >
        <RowList label="Secrets">
          {secrets.map((secret) => (
            <Row
              key={secret.name}
              title={secret.name}
              status={
                secret.present ? <Status tone="ok">set</Status> : <Status tone="crit">NOT SET</Status>
              }
              tone={secret.present ? undefined : "crit"}
            />
          ))}
        </RowList>
      </Panel>

      <Panel
        title="Searches that found nothing"
        src={<Pill variant="outline">{misses.length === 0 ? "none" : `${misses.length} shown`}</Pill>}
        flush={misses.length > 0}
        footer={
          <p className="cap-muted">
            {"Queries nobody has repeated recently are removed on a schedule, by the watchdog's daily " +
              "purge_zero_results call; there is no button here for it any more."}
          </p>
        }
      >
        {misses.length === 0 ? (
          <p>Nothing recorded yet, which is the good case.</p>
        ) : (
          <RowList label="Searches that found nothing">
            {misses.map((miss) => (
              <Row
                key={miss.query}
                title={miss.query}
                status={<Pill variant="outline">{`${miss.count} time${miss.count === 1 ? "" : "s"}`}</Pill>}
              />
            ))}
          </RowList>
        )}
      </Panel>
    </div>
  );
}
