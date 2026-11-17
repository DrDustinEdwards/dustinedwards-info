import { ADMIN_FORM_BYTES } from "~/lib/body.server";
import { readForm } from "@dustinedwards/site-runtime/body";
import { Form, data } from "react-router";

import { timed } from "@dustinedwards/site-runtime/server-timing";
import { timedLoader } from "~/lib/timing";
import "capsomer/layout.css";
import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";
import { Pill, Status } from "capsomer/react/status";
import { Row, RowList } from "capsomer/react/row-list";

import { PageHead } from "capsomer/react/page-head";
import { RouterConfirmModal } from "capsomer/react/router";
import { confirmationSatisfied } from "@dustinedwards/site-runtime/confirm";
import {
  regeneratePosts,
  resetAskBudgetAndReport,
  syncAskIndex,
} from "~/lib/admin/tools-actions.server";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import { siteAssetTotal, rebuildSiteAssetIndex } from "~/lib/media/actions.server";
import { askAvailable, askIndexStatus } from "~/lib/search/ask.server";
import { readAskBudget } from "~/lib/search/ask-guard.server";
import { topZeroResults } from "~/lib/search/zero-result.server";
import type { Route } from "./+types/admin.tools";
import { plural } from "@drdustinedwards/site-helpers/text";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const askOn = askAvailable(env);
    /* Null rather than throwing: a status read must not take the page down. */
    const askPromise = askOn
      ? timed(timings, "ask_status", () => askIndexStatus(env)).catch((error: unknown) => {
          console.error(
            JSON.stringify({ alert: "ask-index-status-failed", detail: errorMessage(error) }),
          );
          return null;
        })
      : Promise.resolve(null);
    /*
     * The catch is attached at creation: a promise that rejects before it is awaited is an unhandled
     * rejection. A failing budget read must not take the page down, and it renders as a failure.
     */
    const budgetPromise = askOn
      ? timed(timings, "ask_budget_do", () => readAskBudget(env)).then(
          (budget) => ({ budget, budgetError: null }),
          (error: unknown) => {
            console.error(
              JSON.stringify({ alert: "ask-budget-read-failed", detail: errorMessage(error) }),
            );
            return { budget: null, budgetError: errorMessage(error) };
          },
        )
      : Promise.resolve({ budget: null, budgetError: null });
    /* Presence only: a name and a boolean per secret, never a value. */
    // Spread rather than asserted: `Env` is an interface, so it has no implicit index signature.
    const secrets = auditSecrets({ ...env });
    const misses = await topZeroResults(env);
    const ask = await askPromise;
    const { budget, budgetError } = await budgetPromise;
    return data({ secrets, misses, askOn, ask, budget, budgetError });
  });
}

/*
 * Posts are written in Carrel. What stays here is upkeep of what the site derives: the rendered rows,
 * the answer index and the site file index. Each destructive intent checks its typed confirmation in its
 * own branch, where check:destructive reads it, before the handler runs.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await readForm(request, ADMIN_FORM_BYTES);
  const env = getEnv(context);
  const intent = form.get("intent");

  if (intent === "regenerate") return regeneratePosts(env);

  // AI Search reads D1 itself, so a sync only asks it to read now instead of on its schedule.
  if (intent === "sync-ask") return syncAskIndex(env);

  if (intent === "reset-ask-budget") return resetAskBudgetAndReport(env);

  if (intent === "rebuild") {
    /* A rebuild prunes rows whose source is gone. Count 1: the rows at risk are unknowable beforehand. */
    if (!confirmationSatisfied(form, "1")) {
      return { confirmRebuild: await siteAssetTotal(env) };
    }
    return rebuildSiteAssetIndex(env);
  }

  return data(
    {
      message: `Nothing was done: ${String(intent ?? "(none)")} is not an action this page knows.`,
      failed: true as const,
    },
    { status: 400 },
  );
}

export default function AdminTools({ loaderData, actionData }: Route.ComponentProps) {
  const { secrets, misses, askOn, ask, budget, budgetError } = loaderData;
  const missing = secrets.filter((s) => !s.present);
  const confirmRebuild =
    actionData && "confirmRebuild" in actionData ? actionData.confirmRebuild : undefined;
  const message = actionData && "message" in actionData ? actionData.message : undefined;
  const failed = actionData && "failed" in actionData ? actionData.failed === true : false;
  const askBehind = ask ? ask.present !== ask.expected || ask.failed > 0 : false;
  const lastSync = ask?.lastSync?.ended_at ?? ask?.lastSync?.started_at;

  return (
    <div className="app-page">
      <PageHead
        title="Tools"
        lead="The site's upkeep: the search and site file indexes, which secrets this deployment holds, and searches that found nothing."
      />

      {/*
        The status region is always in the DOM, because a region inserted already holding its text is
        often not read; a failure is an alert, which is read on insertion.
      */}
      <div role="status">{message && !failed ? <Banner tone="ok">{message}</Banner> : null}</div>
      {message && failed ? <Alert tone="crit">{message}</Alert> : null}

      <Panel
        title="Search"
        src={
          !askOn ? (
            <Pill variant="outline">answers off</Pill>
          ) : !ask ? (
            <Status tone="warn">status unknown</Status>
          ) : askBehind ? (
            <Status tone="warn">{ask.indexing > 0 ? "indexing" : "behind"}</Status>
          ) : (
            <Status tone="ok">up to date</Status>
          )
        }
        footer={
          <Form method="post" className="cap-cluster">
            {askOn ? (
              <Button
                type="submit"
                name="intent"
                value="sync-ask"
                variant={askBehind ? "primary" : undefined}
              >
                Sync the answer index now
              </Button>
            ) : null}
            <Button type="submit" name="intent" value="regenerate">
              Re-render every post
            </Button>
            {askOn ? (
              <Button type="submit" name="intent" value="reset-ask-budget">
                Reset today's answer budget
              </Button>
            ) : null}
          </Form>
        }
      >
        <p>
          {!askOn
            ? "Answers are not enabled: this deployment has no AI Search binding. Site search still works."
            : !ask
              ? "The answer index status could not be read, so whether answers are up to date is unknown."
              : askBehind
                ? `The answer index holds ${ask.present} of the ${ask.expected} post sections and paper parts` +
                  (ask.failed > 0 ? `, and refused ${ask.failed}` : "") +
                  (ask.indexing > 0 ? `; ${ask.indexing} are being indexed now.` : ".")
                : `The answer index has all ${ask.expected} post sections and paper parts.`}
          {ask
            ? " It reads them from the site's database by itself every 15 minutes and whenever a post or paper is published or withdrawn" +
              (lastSync ? `; the last sync was ${lastSync} UTC.` : ".")
            : null}
          {budget
            ? ` ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
            : null}
          {budgetError ? ` The answer budget could not be read: ${budgetError}` : null}
        </p>
      </Panel>

      {confirmRebuild !== undefined ? (
        <RouterConfirmModal
          title="Rebuild the site file index?"
          lead={
            <p>
              Every row is derived again from the OG bucket and the repository, and a row whose file
              is gone is removed. The media library is not touched. The index holds{" "}
              <strong>{confirmRebuild}</strong> row(s) now.
            </p>
          }
          typeToConfirm="1"
          action_label="Rebuild the site file index"
          cancelHref="/admin/tools"
        >
          <input type="hidden" name="intent" value="rebuild" />
          <input type="hidden" name="confirmed" value="1" />
        </RouterConfirmModal>
      ) : null}

      <Panel
        title="Site file index"
        footer={
          <Form method="post" className="cap-cluster">
            <Button type="submit" name="intent" value="rebuild">
              Rebuild the site file index
            </Button>
          </Form>
        }
      >
        <p>
          An index of the site's own files: every static asset in the repository and every card and
          document the Worker generates in OG. A rebuild derives it again from both, for when the
          health check reports drift. The media library keeps its own rows.
        </p>
      </Panel>

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
                secret.present ? (
                  <Status tone="ok">set</Status>
                ) : (
                  <Status tone="crit">NOT SET</Status>
                )
              }
              tone={secret.present ? undefined : "crit"}
            />
          ))}
        </RowList>
      </Panel>

      <Panel
        title="Searches that found nothing"
        src={
          <Pill variant="outline">{misses.length === 0 ? "none" : `${misses.length} shown`}</Pill>
        }
        flush={misses.length > 0}
        footer={
          <p className="cap-muted">
            {"Queries nobody has repeated recently are removed on a schedule, by the site's daily " +
              "purge-zero-results job; there is no button here for it any more."}
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
                status={<Pill variant="outline">{plural(miss.count, "time")}</Pill>}
              />
            ))}
          </RowList>
        )}
      </Panel>
    </div>
  );
}
