/**
 * Puts the redacted values into the bootstrapped wrangler configs.
 *
 *   node scripts/apply-config-ids.mjs
 *
 * FOR CI ONLY, and it exists because of the split .gitignore already
 * documents: each real `wrangler*.jsonc` is gitignored and its `.example` is
 * tracked, differing in exactly the values that cannot live in the repository.
 * `postinstall` bootstraps a checkout by COPYING the examples, so a fresh
 * checkout holds placeholders, and `wrangler deploy` against a placeholder
 * database_id would bind a database that does not exist.
 *
 * ## TWO CONFIGS SINCE 2026-08-29, AND THE SECOND ONE FAILS QUIETLY
 *
 * The watchdog Worker's `ALERT_EMAIL` is here for a sharper reason than the
 * ids. A placeholder database_id fails LOUDLY: wrangler binds nothing and the
 * deploy falls over. A placeholder ALERT_EMAIL deploys perfectly and mails
 * every alert to `alerts@example.com`, which is a reserved domain nobody reads,
 * so the watchdog would look healthy while being unable to reach anybody. That
 * is the exact failure shape this whole arc exists to end, reintroduced by the
 * fix for it, and it is why this refuses rather than warns.
 *
 * ## WHY TWO SECRETS AND NOT THE WHOLE FILE
 *
 * The obvious alternative is to store the real `wrangler.jsonc` as one secret
 * and write it out. That is refused: the file describes every binding, the
 * compatibility date, the flags and the Durable Object migrations, and a copy
 * of it in GitHub is a SECOND OWNER of all of that, free to drift from the
 * tracked example that `check:config` reconciles. Rule 17. Only the values that
 * cannot live in the repository come from secrets; everything else still comes
 * from the examples, which are the one description of these Workers.
 *
 * ## IT REFUSES RATHER THAN PATCHING PARTIALLY
 *
 * Five ways to fail and each one is named, because every one of them otherwise
 * produces a deploy that looks fine and binds the wrong thing:
 *
 *   a missing variable        nothing is written
 *   a config that is absent   nothing is written
 *   a placeholder not found   the example changed shape and this would have
 *                             silently patched nothing
 *   more than one occurrence  ambiguous, so it refuses rather than guessing
 *   a placeholder surviving   the write did not take
 *
 * ## THE ACCOUNT ID IS PATCHED TOO, SINCE 2026-08-29
 *
 * It was not, and it had to be from the moment it became a placeholder in the
 * example on 2026-08-28. The Worker READS `CLOUDFLARE_ACCOUNT_ID` at runtime:
 * it is the account the Analytics Engine SQL API is queried against, so a
 * deploy carrying the placeholder would leave the cockpit's origin-requests
 * panel reading a URL for an account of thirty-two zeros. deploy.yml already
 * held the secret and already refused without it; nothing spent it.
 *
 * ## THE IDS ARE NOT PRINTED
 *
 * They are account-scoped identifiers rather than credentials, and they are
 * still not echoed: this runs in a public-by-default log, the repository keeps
 * them out of git deliberately, and a script that prints them makes the
 * gitignore rule pointless. What is printed is WHICH field was patched.
 *
 * A TEXT REPLACEMENT, never a parse-and-reserialise. Re-emitting the JSON would
 * strip every comment in a file whose comments are load bearing, and would turn
 * a two-value patch into a whole-file rewrite that `check:config` then has to
 * reconcile against the example line by line.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} why @returns {never} */
function refuse(why) {
  console.error(`\napply-config-ids REFUSED: ${why}\n`);
  process.exit(1);
}

/**
 * The placeholders the tracked example carries. Stated here as the values this
 * script expects to REPLACE, so a change to the example fails loudly here
 * rather than leaving a deploy bound to a database that does not exist.
 */
const FIELDS = [
  {
    config: "wrangler.jsonc",
    name: "d1_databases[0].database_id",
    key: "database_id",
    env: "D1_DATABASE_ID",
    placeholder: "00000000-0000-0000-0000-000000000000",
  },
  {
    config: "wrangler.jsonc",
    name: "kv_namespaces[0].id",
    key: "id",
    env: "KV_NAMESPACE_ID",
    placeholder: "00000000000000000000000000000000",
  },
  {
    config: "wrangler.jsonc",
    name: "vars.CLOUDFLARE_ACCOUNT_ID",
    key: "CLOUDFLARE_ACCOUNT_ID",
    env: "CLOUDFLARE_ACCOUNT_ID",
    placeholder: "00000000000000000000000000000000",
  },
  {
    config: "wrangler.watchdog.jsonc",
    name: "vars.ALERT_EMAIL",
    key: "ALERT_EMAIL",
    env: "ALERT_EMAIL",
    placeholder: "alerts@example.com",
  },
];

/**
 * The needle for one field: its JSON KEY and its placeholder together.
 *
 * ANCHORED TO THE KEY SINCE 2026-08-29, AND THE BARE FORM WAS ALREADY BROKEN.
 * The needle used to be the placeholder string alone, which was unambiguous
 * only while every placeholder differed. On 2026-08-28 `CLOUDFLARE_ACCOUNT_ID`
 * became a placeholder in the example and it is THIRTY-TWO ZEROS, exactly like
 * the KV namespace id, so the occurrence count for the KV field became 2 and
 * this script refused every run. The deploy button has been unable to complete
 * since that day.
 *
 * That refusal was the RIGHT behaviour and is why the defect is a stopped
 * deploy rather than a Worker bound to the wrong namespace: the ambiguity check
 * was added precisely so a duplicated placeholder could not be guessed at. What
 * was missing was a needle specific enough for two fields to share a value,
 * which they now legitimately do.
 *
 * Found 2026-08-29 by running the UNMODIFIED script from HEAD against the
 * tracked example, which is the control that proves this is not a defect the
 * same session introduced.
 *
 * @param {{ key: string, placeholder: string }} field
 */
const needleFor = (field) => `"${field.key}": "${field.placeholder}"`;

/** Every config any field above names, in the order they are first mentioned. */
const CONFIGS = [...new Set(FIELDS.map((f) => f.config))];

for (const config of CONFIGS) {
  if (!existsSync(join(root, config))) {
    refuse(
      `${config} does not exist. postinstall bootstraps it from ${config}.example; ` +
        `run npm ci first.`,
    );
  }
}

for (const config of CONFIGS) {
  const path = join(root, config);
  let text = readFileSync(path, "utf8");

  for (const field of FIELDS.filter((f) => f.config === config)) {
    const value = (process.env[field.env] ?? "").trim();
    if (!value) {
      refuse(
        `${field.env} is not set, so ${field.name} would stay a placeholder. Set it ` +
          `with: gh secret set ${field.env}`,
      );
    }
    if (value === field.placeholder) {
      refuse(`${field.env} is the placeholder value itself, which patches nothing.`);
    }

    // Counted before replacing. `replace` on a string swaps the FIRST match and
    // reports nothing, so a needle that appears twice would leave one behind
    // and this would print success.
    const needle = needleFor(field);
    const occurrences = text.split(needle).length - 1;
    if (occurrences === 0) {
      refuse(
        `the placeholder for ${field.name} was not found in ${config}. The ` +
          `example changed shape, and patching nothing would look exactly like ` +
          `patching correctly.`,
      );
    }
    if (occurrences > 1) {
      refuse(
        `the placeholder for ${field.name} appears ${occurrences} times in ${config}, so ` +
          `which one to patch is ambiguous. Refusing rather than guessing.`,
      );
    }

    text = text.replace(needle, `"${field.key}": "${value}"`);
    console.log(`  patched ${field.name} in ${config}`);
  }

  writeFileSync(path, text, "utf8");

  /*
   * READ BACK, because a write that did not take is the failure this whole file
   * exists to prevent, and it is invisible from the exit code of writeFileSync.
   */
  const after = readFileSync(path, "utf8");
  for (const field of FIELDS.filter((f) => f.config === config)) {
    if (after.includes(needleFor(field))) {
      refuse(`${field.name} is still a placeholder in ${config} after the write.`);
    }
  }
}

console.log(`  ${CONFIGS.join(" and ")} carry every redacted value.`);
