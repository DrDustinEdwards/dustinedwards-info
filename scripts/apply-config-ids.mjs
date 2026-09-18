/**
 * Puts the redacted values into the bootstrapped wrangler configs, for CI only.
 *
 *   node scripts/apply-config-ids.mjs
 *
 * BOUNDARY: it patches named placeholders by text and REFUSES rather than patching partially, five
 * ways, each named. It never prints an id, only which field was patched, and it never
 * parse-and-reserialises, which would strip comments this repo's configs depend on.
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
 * The placeholders the tracked example carries, stated as the values this script expects to
 * REPLACE, so a change to the example fails loudly here rather than leaving a deploy bound to a
 * database that does not exist.
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
 * The needle for one field: its JSON KEY and its placeholder together. The placeholder alone was
 * unambiguous only while every placeholder differed, and two fields legitimately share a value of
 * thirty-two zeros, so the occurrence count became 2 and this refused every run. That refusal was
 * RIGHT, which is why the defect was a stopped deploy rather than a Worker bound to the wrong
 * namespace; what was missing was a needle specific enough for two fields to share a value.
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

    // Counted before replacing: `replace` on a string swaps the FIRST match and reports nothing, so
    // a needle appearing twice would leave one behind and this would print success.
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
   * READ BACK, because a write that did not take is the failure this file exists to prevent and is
   * invisible from the exit code of writeFileSync.
   */
  const after = readFileSync(path, "utf8");
  for (const field of FIELDS.filter((f) => f.config === config)) {
    if (after.includes(needleFor(field))) {
      refuse(`${field.name} is still a placeholder in ${config} after the write.`);
    }
  }
}

console.log(`  ${CONFIGS.join(" and ")} carry every redacted value.`);
