import { readFileSync } from "node:fs";

import { ts } from "./syntax.mjs";

/**
 * TypeScript's own JSONC reader, which knows a string from a comment. The regex it replaces took
 * the `/*` in a comment naming `/api/auth/*` as a block opener, so one later star-slash anywhere
 * would have silently deleted every key between them; it also refused a trailing comma.
 *
 * @param {string} path
 * @returns {any}
 */
export function parseJsonc(path) {
  // TypeScript asserts its file names are forward-slashed when it attaches a diagnostic.
  const result = ts.parseConfigFileTextToJson(path.replaceAll("\\", "/"), readFileSync(path, "utf8"));
  if (result.error) {
    throw new Error(
      `${path} is not valid JSONC: ${ts.flattenDiagnosticMessageText(result.error.messageText, "\n")}`,
    );
  }
  return result.config;
}

/**
 * Settings omit account-scoped identifiers: the tracked example carries placeholders for those.
 *
 * @type {Record<string, (config: any, out: Map<string, string>) => void>}
 */
const READERS = {
  d1_databases: (config, out) => {
    for (const db of config.d1_databases ?? []) {
      out.set(
        `d1:${db.binding}`,
        `database_name=${db.database_name} migrations_dir=${db.migrations_dir}`,
      );
    }
  },
  kv_namespaces: (config, out) => {
    for (const kv of config.kv_namespaces ?? []) out.set(`kv:${kv.binding}`, "");
  },
  r2_buckets: (config, out) => {
    for (const r2 of config.r2_buckets ?? []) {
      out.set(`r2:${r2.binding}`, `bucket_name=${r2.bucket_name}`);
    }
  },
  ai_search: (config, out) => {
    for (const ai of config.ai_search ?? []) {
      out.set(`ai_search:${ai.binding}`, `instance_name=${ai.instance_name}`);
    }
  },
  durable_objects: (config, out) => {
    for (const dobj of config.durable_objects?.bindings ?? []) {
      out.set(`durable_object:${dobj.name}`, `class_name=${dobj.class_name}`);
    }
  },
  images: (config, out) => {
    if (config.images?.binding) out.set(`images:${config.images.binding}`, "");
  },
  // The dataset name is compared, not omitted: it is the table the SQL API reads.
  analytics_engine_datasets: (config, out) => {
    for (const ae of config.analytics_engine_datasets ?? []) {
      out.set(`analytics_engine:${ae.binding}`, `dataset=${ae.dataset}`);
    }
  },
  assets: (config, out) => {
    if (config.assets?.binding) out.set(`assets:${config.assets.binding}`, "");
  },
  services: (config, out) => {
    for (const service of config.services ?? []) {
      out.set(
        `service:${service.binding}`,
        `service=${service.service}${service.environment ? ` environment=${service.environment}` : ""}`,
      );
    }
  },
  // Keyed by `name`, not `binding`. Restrictions are compared: they set the blast radius.
  send_email: (config, out) => {
    for (const mail of config.send_email ?? []) {
      const restriction = mail.destination_address
        ? `destination_address=${mail.destination_address}`
        : mail.allowed_destination_addresses
          ? `allowed_destination_addresses=${[...mail.allowed_destination_addresses].sort().join("|")}`
          : mail.allowed_sender_addresses
            ? `allowed_sender_addresses=${[...mail.allowed_sender_addresses].sort().join("|")}`
            : "unrestricted";
      out.set(`send_email:${mail.name}`, restriction);
    }
  },
  queues: (config, out) => {
    for (const q of config.queues?.consumers ?? []) {
      out.set(
        `queue_consumer:${q.queue}`,
        `max_retries=${q.max_retries} dead_letter_queue=${q.dead_letter_queue} ` +
          `max_batch_size=${q.max_batch_size} max_batch_timeout=${q.max_batch_timeout}`,
      );
    }
    for (const q of config.queues?.producers ?? []) {
      out.set(`queue_producer:${q.binding}`, `queue=${q.queue}`);
    }
  },
};

/**
 * @param {any} config
 * @returns {Map<string, string>}
 */
export function surfaceOf(config) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const read of Object.values(READERS)) read(config, out);
  return out;
}

/**
 * A kind no reader knows produces no rows on either side, so a comparison of two blind spots
 * agrees with itself. Detection is structural so a binding type that does not exist yet is caught.
 *
 * @param {any} config
 * @returns {string[]}
 */
export function unhandledBindingKinds(config) {
  const declaresBinding = (/** @type {any} */ value) => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) {
      return value.some(
        (v) => v && typeof v === "object" && ("binding" in v || "name" in v),
      );
    }
    if ("binding" in value) return true;
    return (
      Array.isArray(value.bindings) &&
      value.bindings.some(
        (/** @type {any} */ v) =>
          v && typeof v === "object" && ("binding" in v || "name" in v),
      )
    );
  };

  return Object.keys(config)
    .filter((key) => !(key in READERS))
    .filter((key) => declaresBinding(config[key]))
    .sort();
}
