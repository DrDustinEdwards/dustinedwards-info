import { webmentionToVerify } from "~/db";
import { readVerifyMessage } from "~/lib/webmention/queue";
import { errorMessage } from "~/lib/error-message.mjs";

/**
 * The webmention queue consumer. Queues delivers at least once, so each message re-reads its row and
 * fetches nothing unless the row is still `unverified`: a redelivery after the verdict is a no-op.
 * `verifyWebmention` never throws and records a verdict for every source failure, so a row still
 * `unverified` afterwards means the verdict write failed, and only that is retried.
 */
export async function handleWebmentionVerify(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const mention = readVerifyMessage(message.body);
    if (!mention) {
      console.error(JSON.stringify({ alert: "webmention-message-unreadable", body: message.body }));
      message.ack();
      continue;
    }

    try {
      const row = await webmentionToVerify(env, mention.id);
      // Gone (rejected and swept), already decided, or reset under another source: nothing to do.
      if (row?.status !== "unverified" || row.sourceUrl !== mention.source) {
        message.ack();
        continue;
      }

      // Imported here, not at the top: linkedom has no place in the chunk every cold isolate evaluates.
      const { verifyWebmention } = await import("~/lib/webmention/verify.server");
      await verifyWebmention(env, mention.id, mention.source, mention.target);

      const after = await webmentionToVerify(env, mention.id);
      if (after?.status === "unverified") message.retry();
      else message.ack();
    } catch (error) {
      // D1 or the chunk failed: retried, then the dead-letter queue, and the row stays `unverified`.
      console.error(
        JSON.stringify({ alert: "webmention-verify-failed", id: mention.id, detail: errorMessage(error) }),
      );
      message.retry();
    }
  }
}
