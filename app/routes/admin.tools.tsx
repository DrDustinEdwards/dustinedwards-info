import { Form, data } from "react-router";

import { timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import { purgeZeroResults, topZeroResults } from "~/lib/search/zero-result.server";
/* The window comes from the client-safe module: the component below reads it, and importing it
   from the .server one would pull that module into the client bundle. */
import { ZERO_RESULT_RETENTION_SECONDS } from "~/lib/search/zero-result.mjs";
import type { Route } from "./+types/admin.tools";

/** Days, derived from the one owner of the window rather than typed beside it. Hard rule 17. */
const RETENTION_DAYS = ZERO_RESULT_RETENTION_SECONDS / 86400;

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
  /*
   * WHAT READERS LOOKED FOR AND DID NOT FIND. A writing queue rather than an analytics panel:
   * the rows carry a query and three counters and there is nowhere in the schema for a reader.
   */
  const misses = await topZeroResults(env);
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ secrets, misses });
}

/**
 * THE RETENTION SWEEP IS A BUTTON, NOT A CRON, which is the same shape the webmentions table's
 * retention has and for the same recorded reason. It is worth stating why rather than leaving it
 * to look like an omission: this Worker has NO cron at all (`triggers.crons` is empty), and the
 * watchdog, which does have one, holds no DB binding and so cannot reach this table. A sweep that
 * runs when somebody looks at the page is honest about when it runs; a cron that does not exist
 * is not.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "purge-zero-results") {
    return data({ purged: null }, { status: 400 });
  }
  const purged = await purgeZeroResults(getEnv(context));
  return data({ purged });
}


export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { secrets, misses } = loaderData;
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

      {/*
       * WHAT READERS LOOKED FOR AND DID NOT FIND. A writing queue, not analytics: every row is a
       * query and three counters, and the table has nowhere to put a reader. No IP, no user
       * agent, no session.
       */}
      <h3 className="tool-heading">
        Searches that found nothing
        <span className="chip">{misses.length === 0 ? "none" : `${misses.length} shown`}</span>
      </h3>
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
      <Form method="post">
        <input type="hidden" name="intent" value="purge-zero-results" />
        <p className="muted">
          {`Queries nobody has repeated in ${RETENTION_DAYS} days are removed by this button. ` +
            `There is no cron: this Worker has none, and the watchdog that does cannot reach ` +
            `the database.`}
        </p>
        {/*
         * DISABLED AT ZERO, WITH THE SAME LABEL, matching the mentions sweep: a control that
         * changes its words when it has nothing to do makes the reader read it twice to learn
         * there is nothing to do.
         */}
        <button type="submit" className="btn-secondary" disabled={misses.length === 0}>
          Remove expired queries
        </button>
      </Form>
    </Panel>
  );
}
