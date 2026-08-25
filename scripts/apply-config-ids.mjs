/**
 * Puts the two account-scoped resource ids into a bootstrapped wrangler.jsonc.
 *
 *   node scripts/apply-config-ids.mjs
 *
 * FOR CI ONLY, and it exists because of the split .gitignore already
 * documents: `wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is
 * tracked, and the example differs from the real file in EXACTLY TWO VALUES,
 * the D1 `database_id` and the KV namespace `id`. `postinstall` bootstraps a
 * checkout by COPYING the example, so a fresh checkout holds placeholders, and
 * `wrangler deploy` against a placeholder database_id would bind a database
 * that does not exist.
 *
 * ## WHY TWO SECRETS AND NOT THE WHOLE FILE
 *
 * The obvious alternative is to store the real `wrangler.jsonc` as one secret
 * and write it out. That is refused: the file describes every binding, the
 * compatibility date, the flags and the Durable Object migrations, and a copy
 * of it in GitHub is a SECOND OWNER of all of that, free to drift from the
 * tracked example that `check:config` reconciles. Rule 17. Only the two values
 * that cannot live in the repository come from secrets; everything else still
 * comes from the example, which is the one description of this Worker.
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
const CONFIG = join(root, "wrangler.jsonc");

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
    name: "d1_databases[0].database_id",
    env: "D1_DATABASE_ID",
    placeholder: "00000000-0000-0000-0000-000000000000",
  },
  {
    name: "kv_namespaces[0].id",
    env: "KV_NAMESPACE_ID",
    placeholder: "00000000000000000000000000000000",
  },
];

if (!existsSync(CONFIG)) {
  refuse(
    `${CONFIG} does not exist. postinstall bootstraps it from wrangler.jsonc.example; ` +
      `run npm ci first.`,
  );
}

let text = readFileSync(CONFIG, "utf8");

for (const field of FIELDS) {
  const value = (process.env[field.env] ?? "").trim();
  if (!value) {
    refuse(
      `${field.env} is not set, so ${field.name} would stay a placeholder and the ` +
        `deploy would bind a resource that does not exist. Set it with: ` +
        `gh secret set ${field.env}`,
    );
  }
  if (value === field.placeholder) {
    refuse(`${field.env} is the placeholder value itself, which patches nothing.`);
  }

  // Counted before replacing. `replace` on a string swaps the FIRST match and
  // reports nothing, so a placeholder that appears twice would leave one
  // behind and this would print success.
  const occurrences = text.split(field.placeholder).length - 1;
  if (occurrences === 0) {
    refuse(
      `the placeholder for ${field.name} was not found in wrangler.jsonc. The ` +
        `example changed shape, and patching nothing would look exactly like ` +
        `patching correctly.`,
    );
  }
  if (occurrences > 1) {
    refuse(
      `the placeholder for ${field.name} appears ${occurrences} times, so which one ` +
        `to patch is ambiguous. Refusing rather than guessing.`,
    );
  }

  text = text.replace(field.placeholder, value);
  console.log(`  patched ${field.name}`);
}

writeFileSync(CONFIG, text, "utf8");

/*
 * READ BACK, because a write that did not take is the failure this whole file
 * exists to prevent, and it is invisible from the exit code of writeFileSync.
 */
const after = readFileSync(CONFIG, "utf8");
for (const field of FIELDS) {
  if (after.includes(field.placeholder)) {
    refuse(`${field.name} is still a placeholder after the write.`);
  }
}

console.log("  wrangler.jsonc carries both account-scoped ids.");
