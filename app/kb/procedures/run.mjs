// The pure half of run mode (docs/PROCEDURES.md "Run mode"): what a bench run is, how its timers count, and what
// the saved record says. A run is a person working through one procedure once: which steps are done, a note on
// each, the timers they started, the scale they chose. It lives in the browser (localStorage), is downloadable and
// printable, and never reaches the server: nothing here touches the DOM, a clock or storage, so the same functions
// run in a test. The browser module (app/enhance/run.ts) passes `now` in.
//
// A timer's remaining time is computed from the moment it ends, not counted down, so a phone that sleeps or a page
// that reloads mid-incubation still knows how long is left.

export const RUN_VERSION = 1;

/** Seconds in each unit a timer mark can use (validate.mjs TIME_UNITS). */
export const UNIT_SECONDS = Object.freeze(
  /** @type {Record<string, number>} */ ({
    second: 1, seconds: 1, sec: 1, s: 1,
    minute: 60, minutes: 60, min: 60,
    hour: 3600, hours: 3600, h: 3600,
    day: 86400, days: 86400,
  }),
);

/**
 * @typedef {{ label: string, text: string, min: number | null, max: number | null, unit: string }} StepTimer
 * @typedef {{ state: "running" | "paused" | "done", endsAt: number | null, remainingMs: number, totalMs: number }} TimerState
 * @typedef {{ done: boolean, doneAt: number | null, note: string }} StepState
 * @typedef {{
 *   v: number, path: string, version: string, title: string, scale: number | null,
 *   startedAt: number, finishedAt: number | null, note: string,
 *   steps: Record<string, StepState>, timers: Record<string, TimerState>,
 * }} Run
 */

/**
 * A timer's length in milliseconds: the longer end of a range ("5 to 10 minutes" runs 10), because a timer that
 * rings early is the mistake that costs a prep. Null when the mark carries no usable number.
 *
 * @param {StepTimer} timer
 */
export function timerMs(timer) {
  const seconds = UNIT_SECONDS[String(timer.unit).toLowerCase()];
  const amount = timer.max ?? timer.min;
  if (seconds === undefined || amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * seconds * 1000);
}

/** The key a step's nth timer is stored under. */
export const timerKey = (/** @type {number | string} */ step, /** @type {number} */ index) => `${step}.${index}`;

/**
 * @param {{ path: string, version: string, title: string, scale: number | null }} procedure
 * @param {number} now
 * @returns {Run}
 */
export function newRun(procedure, now) {
  return { v: RUN_VERSION, path: procedure.path, version: procedure.version, title: procedure.title, scale: procedure.scale, startedAt: now, finishedAt: null, note: "", steps: {}, timers: {} };
}

const stepOf = (/** @type {Run} */ run, /** @type {number | string} */ step) => run.steps[String(step)] ?? { done: false, doneAt: null, note: "" };

/** @param {Run} run @param {number | string} step @param {number} now */
export function toggleDone(run, step, now) {
  const current = stepOf(run, step);
  return { ...run, steps: { ...run.steps, [String(step)]: { ...current, done: !current.done, doneAt: current.done ? null : now } } };
}

/** @param {Run} run @param {number | string} step @param {string} note */
export function setNote(run, step, note) {
  return { ...run, steps: { ...run.steps, [String(step)]: { ...stepOf(run, step), note: note.slice(0, 2000) } } };
}

/** @param {Run} run @param {string} note */
export function setRunNote(run, note) {
  return { ...run, note: note.slice(0, 4000) };
}

/** @param {Run} run @param {number | null} scale */
export function setScale(run, scale) {
  return { ...run, scale };
}

/** @param {Run} run @param {number} now */
export function finishRun(run, now) {
  return { ...run, finishedAt: run.finishedAt ?? now };
}

/** Starts a timer, or resumes a paused one from where it stopped. @param {Run} run @param {string} key @param {number} ms @param {number} now */
export function startTimer(run, key, ms, now) {
  const current = run.timers[key];
  const remainingMs = current && current.state === "paused" ? current.remainingMs : ms;
  return { ...run, timers: { ...run.timers, [key]: { state: /** @type {const} */ ("running"), endsAt: now + remainingMs, remainingMs, totalMs: ms } } };
}

/** @param {Run} run @param {string} key @param {number} now */
export function pauseTimer(run, key, now) {
  const current = run.timers[key];
  if (!current || current.state !== "running" || current.endsAt === null) return run;
  return { ...run, timers: { ...run.timers, [key]: { ...current, state: /** @type {const} */ ("paused"), endsAt: null, remainingMs: Math.max(0, current.endsAt - now) } } };
}

/** @param {Run} run @param {string} key */
export function resetTimer(run, key) {
  const { [key]: _gone, ...rest } = run.timers;
  return { ...run, timers: rest };
}

/** Milliseconds left on a timer, or null when it has not been started. @param {Run} run @param {string} key @param {number} now */
export function timerRemaining(run, key, now) {
  const t = run.timers[key];
  if (!t) return null;
  if (t.state === "paused" || t.state === "done") return t.state === "done" ? 0 : t.remainingMs;
  return Math.max(0, (t.endsAt ?? now) - now);
}

/**
 * Marks every running timer whose time has come as done, and returns which rang so the page can alert once.
 *
 * @param {Run} run @param {number} now
 * @returns {{ run: Run, rang: string[] }}
 */
export function tickTimers(run, now) {
  /** @type {string[]} */
  const rang = [];
  /** @type {Record<string, TimerState>} */
  const timers = { ...run.timers };
  for (const [key, t] of Object.entries(run.timers)) {
    if (t.state === "running" && t.endsAt !== null && t.endsAt <= now) {
      timers[key] = { ...t, state: /** @type {const} */ ("done"), endsAt: null, remainingMs: 0 };
      rang.push(key);
    }
  }
  return rang.length === 0 ? { run, rang } : { run: { ...run, timers }, rang };
}

/** "2:05", "1:30:00": a countdown in the form a person reads at the bench. @param {number} ms */
export function clock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** How far along a run is, over the steps the procedure has. @param {Run} run @param {Array<number | string>} steps */
export function runProgress(run, steps) {
  const done = steps.filter((n) => run.steps[String(n)]?.done).length;
  return { done, total: steps.length };
}

const when = (/** @type {number | null} */ ms) => (ms === null ? "" : new Date(ms).toISOString());

/**
 * The saved record as a plain object: what a download is, and what survives the browser. Only what the person
 * entered or did, with the procedure's own identity so the record says which version it followed.
 *
 * A step's `key` is unique in the procedure (its section and its number: numbering restarts in a section that starts
 * its own list), `number` is the one the page prints.
 *
 * @param {Run} run
 * @param {Array<{ key?: string, number: number | string, section?: string, text: string }>} steps
 */
export function runRecord(run, steps) {
  return {
    record: "dustinedwards.info run",
    format: RUN_VERSION,
    procedure: { path: run.path, title: run.title, version: run.version },
    scale: run.scale,
    startedAt: when(run.startedAt),
    finishedAt: when(run.finishedAt),
    note: run.note,
    steps: steps.map((s) => {
      const st = stepOf(run, s.key ?? s.number);
      return { step: s.number, section: s.section ?? "", text: s.text, done: st.done, doneAt: when(st.doneAt), note: st.note };
    }),
  };
}

/**
 * The same record as plain Markdown, for a notebook or an email: a heading, the run's facts, and each step as a
 * checked or unchecked line with its note under it.
 *
 * @param {Run} run
 * @param {Array<{ key?: string, number: number | string, section?: string, text: string }>} steps
 */
export function runMarkdown(run, steps) {
  const lines = [`# Run: ${run.title}`, ""];
  lines.push(`Protocol: ${run.path}${run.version ? `, version ${run.version}` : ""}`);
  if (run.scale !== null) lines.push(`Scale: ${run.scale}`);
  lines.push(`Started: ${when(run.startedAt)}`);
  if (run.finishedAt !== null) lines.push(`Finished: ${when(run.finishedAt)}`);
  if (run.note.trim()) lines.push("", run.note.trim());
  lines.push("", "## Steps", "");
  let section = "";
  for (const s of steps) {
    if ((s.section ?? "") !== section) {
      section = s.section ?? "";
      if (section) lines.push("", `### ${section}`, "");
    }
    const st = stepOf(run, s.key ?? s.number);
    lines.push(`- [${st.done ? "x" : " "}] ${s.number}. ${s.text.replace(/\s+/g, " ").trim()}${st.done && st.doneAt ? ` (${when(st.doneAt)})` : ""}`);
    if (st.note.trim()) lines.push(`  - Note: ${st.note.trim().replace(/\n+/g, " ")}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Parses a stored run, or returns null: a stored value from another format or one that is not a run is ignored, never
 * trusted. Only the shapes this module writes are accepted.
 *
 * @param {unknown} raw
 * @returns {Run | null}
 */
export function parseRun(raw) {
  if (typeof raw !== "string") return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || value.v !== RUN_VERSION) return null;
  // typeof null is "object", so a null `steps` must be refused by name.
  const plainObject = (/** @type {unknown} */ x) => x !== null && typeof x === "object" && !Array.isArray(x);
  if (typeof value.path !== "string" || typeof value.startedAt !== "number" || !plainObject(value.steps) || !plainObject(value.timers)) return null;
  return /** @type {Run} */ ({
    v: RUN_VERSION,
    path: value.path,
    version: typeof value.version === "string" ? value.version : "",
    title: typeof value.title === "string" ? value.title : "",
    scale: typeof value.scale === "number" ? value.scale : null,
    startedAt: value.startedAt,
    finishedAt: typeof value.finishedAt === "number" ? value.finishedAt : null,
    note: typeof value.note === "string" ? value.note : "",
    steps: value.steps,
    timers: value.timers,
  });
}
