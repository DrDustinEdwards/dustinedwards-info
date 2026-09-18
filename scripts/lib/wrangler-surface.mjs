/**
 * The Worker's binding surface, derived from a wrangler config. ONE enumerator, so two walkers of
 * the same config cannot disagree about what this Worker binds.
 *
 * BOUNDARY: it knows the binding kinds it enumerates and reports the rest separately, because a
 * kind no reader understands is absent from both sides of every comparison built on this.
 */

import { readFileSync } from "node:fs";

/**
 * JSONC to JSON. Comments only; these configs have no trailing commas.
 *
 * @param {string} path
 * @returns {any}
 */
/*
 * WEAK ON PURPOSE, this being JSONC on its way to JSON.parse: the shared strong stripper's
 * line-comment rule eats a protocol-relative url and takes the rest of the line with it. Weak is
 * SUFFICIENT, because JSON.parse throws on any comment this fails to remove.
 */
export function parseJsonc(path) {
  const raw = readFileSync(path, "utf8");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

/**
 * How each binding kind is read, keyed by the config key that declares it. ONE table, so
 * `surfaceOf` and `unhandledBindingKinds` cannot disagree about what is handled. The settings
 * string omits account-scoped IDENTIFIERS, the tracked example carrying placeholders for those.
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
  // The dataset NAME is compared rather than omitted as account-scoped: it is the table the SQL
  // API reads, and two files disagreeing would have the Worker writing where nothing queries.
  analytics_engine_datasets: (config, out) => {
    for (const ae of config.analytics_engine_datasets ?? []) {
      out.set(`analytics_engine:${ae.binding}`, `dataset=${ae.dataset}`);
    }
  },
  assets: (config, out) => {
    if (config.assets?.binding) out.set(`assets:${config.assets.binding}`, "");
  },
  // The SERVICE NAME is compared rather than omitted: it names which Worker is called, and two
  // files disagreeing would point the watchdog at nothing.
  services: (config, out) => {
    for (const service of config.services ?? []) {
      out.set(
        `service:${service.binding}`,
        `service=${service.service}${service.environment ? ` environment=${service.environment}` : ""}`,
      );
    }
  },
  /*
   * Email Sending. KEYED BY `name`, NOT `binding`, which every other binding kind uses: that put
   * it through the detector's array arm unread, so it was invisible to the comparison AND to the
   * detector meant to catch exactly that. The RESTRICTIONS are settings, not just the name, since a
   * binding pinned in one file and unrestricted in the other describes a different blast radius.
   */
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
 * Every binding the config declares, as `KIND:NAME`, mapped to the settings that are not
 * account-scoped identifiers.
 *
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
 * Config keys that DECLARE BINDINGS and that `surfaceOf` cannot read. **The absence of this was
 * a live hole**: a kind no reader knows about produces no rows on either side of every comparison,
 * and a gate that compares two blind spots agrees with itself.
 *
 * Detection is STRUCTURAL rather than a list of Cloudflare's products, so a binding type that does
 * not exist yet is still caught. A declaration is one of exactly three shapes:
 *
 *   an object with a `binding`                     assets, images, browser
 *   an array of objects carrying `binding` or      d1, kv, r2, vectorize, ai,
 *     `name`                                         services, send_email
 *   an object with a `bindings` array              durable_objects, workflows
 *
 * `queues` matches none of these, correctly: a consumer has no `binding` and is handled above.
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
