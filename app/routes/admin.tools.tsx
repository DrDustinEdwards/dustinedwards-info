import { Form, data } from "react-router";

import { timed, timedLoader } from "~/lib/timing";
import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";
import { Pill, Status } from "capsomer/react/status";
import { Row, RowList } from "capsomer/react/row-list";

import { PageHead } from "capsomer/react/page-head";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import {
  askSyncConfirmCount,
  regeneratePosts,
  resetAskBudgetAndReport,
  syncAskIndex,
} from "~/lib/admin/tools-actions.server";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { errorMessage } from "~/lib/error-message.mjs";
import { askAvailable, askStatusContext } from "~/lib/search/ask.server";
import { readAskBudget } from "~/lib/search/ask-guard.server";
import { topZeroResults } from "~/lib/search/zero-result.server";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const askOn = askAvailable(env);
    /* Uncached: the page that repairs drift must not act on the layout's cached count. */
    const askPromise = timed(timings, "ask_status_uncached", () => context.get(askStatusContext)());
    /*
     * The catch is attached at creation: a promise that rejects before it is awaited is an unhandled
     * rejection. A failing budget read must not take the page down, and it renders as a failure.
     */
    const budgetPromise = askOn
      ? timed(timings, "ask_budget_do", () => readAskBudget(env)).then(
          (budget) => ({ budget, budgetError: null }),
          (error: unknown) => {
            console.error(JSON.stringify({ alert: "ask-budget-read-failed", detail: errorMessage(error) }));
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
 * Posts are written in Carrel. What stays here is upkeep of what the site derives from them: the
 * rendered rows and the answer index. The destructive intent checks its typed confirmation in its own
 * branch, where check:destructive reads it, before the handler runs.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const env = getEnv(context);
  const intent = form.get("intent");

  if (intent === "regenerate") return regeneratePosts(env);

  // Separate from Regenerate: D1 search must not be held hostage to the AI index, and the AI index
  // must never be repaired by touching D1.
  if (intent === "sync-ask") {
    if (!askAvailable(env)) {
      return { message: "Ask is not enabled: no AI Search binding.", failed: true as const };
    }
    /*
     * "Sync" reads as additive and is not: `pruneAskCorpus` deletes every record this run did not
     * upload. The count is 1 because how many it removes cannot be known first.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { confirmSyncAsk: await askSyncConfirmCount(env) };
    }
    return syncAskIndex(env);
  }

  if (intent === "reset-ask-budget") return resetAskBudgetAndReport(env);

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
  const confirmSyncAsk =
    actionData && "confirmSyncAsk" in actionData ? actionData.confirmSyncAsk : undefined;
  const message = actionData && "message" in actionData ? actionData.message : undefined;
  const failed = actionData && "failed" in actionData ? actionData.failed === true : false;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

  return (
    <div className="app-page">
      <PageHead
        title="Tools"
        lead="The site's upkeep: the search index, which secrets this deployment holds, and searches that found nothing."
      />

      {/*
        The status region is always in the DOM, because a region inserted already holding its text is
        often not read; a failure is an alert, which is read on insertion.
      */}
      <div role="status">{message && !failed ? <Banner tone="ok">{message}</Banner> : null}</div>
      {message && failed ? <Alert tone="crit">{message}</Alert> : null}

      {confirmSyncAsk !== undefined ? (
        <ConfirmDialog
          title="Rebuild the search answer index?"
          body={
            <p>
              Every record not in this run is removed from the index, and saved answers are dropped. The
              site currently has <strong>{confirmSyncAsk}</strong> post(s), so that is what the index will
              hold afterwards.
            </p>
          }
          requireTyped="1"
          confirmLabel="Rebuild the index"
          cancelHref="/admin/tools"
        >
          <input type="hidden" name="intent" value="sync-ask" />
        </ConfirmDialog>
      ) : null}

      <Panel
        title="Search"
        src={
          !askOn ? (
            <Pill variant="outline">answers off</Pill>
          ) : !ask ? (
            <Status tone="warn">status unknown</Status>
          ) : askDrifted ? (
            <Status tone="warn">{`${ask.missing.length + ask.stale.length} behind`}</Status>
          ) : (
            <Status tone="ok">up to date</Status>
          )
        }
        footer={
          <Form method="post" className="cap-cluster">
            {askOn ? (
              <Button type="submit" name="intent" value="sync-ask" variant={askDrifted ? "primary" : undefined}>
                Rebuild the answer index
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
              : askDrifted
                ? `${ask.missing.length} post(s) are missing from the answer index and ${ask.stale.length} ` +
                  "record(s) in it no longer match the site, so an answer may quote text that has changed."
                : `The answer index has all ${ask.expected} posts.`}
          {budget
            ? ` ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
            : null}
          {budgetError ? ` The answer budget could not be read: ${budgetError}` : null}
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
