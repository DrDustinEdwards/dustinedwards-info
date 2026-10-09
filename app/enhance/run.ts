import {
  clock,
  finishRun,
  newRun,
  parseRun,
  pauseTimer,
  resetTimer,
  runMarkdown,
  runProgress,
  runRecord,
  setNote,
  setRunNote,
  setScale,
  startTimer,
  tickTimers,
  timerKey,
  timerMs,
  timerRemaining,
  toggleDone,
  type Run,
  type StepTimer,
} from "~/kb/procedures/run.mjs";

/*
 * Run mode (docs/PROCEDURES.md): a procedure page, worked at the bench. The page is complete as served; this adds,
 * for a person who starts a run, a checklist over the steps it already has: a Done check, a note and the stored
 * timers on each step, the critical and pause flags kept in view, the scale changed in place, and a record that
 * downloads or prints. The run lives in this browser only (localStorage), and says so if it cannot even do that.
 *
 * The server stays the one place amounts are computed: a new scale is fetched as the page at that scale and the
 * materials table and each step's words are swapped in, so nothing here knows a unit conversion. If that fetch
 * fails the browser navigates to the scaled page, which is what the Scale button does with no script.
 */

const root = document.querySelector<HTMLElement>(".procedure[data-run-path]");
if (!root) throw new Error("run: this page has no .procedure[data-run-path] to run");
const procedure = {
  path: root.dataset.runPath ?? "",
  version: root.dataset.runVersion ?? "",
  title: root.dataset.runTitle ?? "",
};
const KEY = `dustinedwards.run:${procedure.path}`;
const stepItems = Array.from(root.querySelectorAll<HTMLElement>("li.procedure-step[data-step]"));
if (stepItems.length === 0) throw new Error("run: this procedure has no steps to run");
// A step is addressed by its section and its number: numbering restarts in a section that starts its own list, so the
// number alone is not unique ("step 1" is in two places in a procedure with a second method).
const sectionOf = (li: HTMLElement) => li.closest("section[aria-labelledby]")?.getAttribute("aria-labelledby") ?? "";
const keyOf = (li: HTMLElement) => `${sectionOf(li)}.${li.dataset.step}`;
const stepKeys = stepItems.map(keyOf);
// Where each timer's alert says the step is: its printed number.
const timerStep = new Map<string, string>();
const scaleForm = root.querySelector<HTMLFormElement>("form.procedure-scale");
const scaleField = scaleForm?.querySelector<HTMLInputElement>("input[name]") ?? null;

let run: Run | null = null;
let storageNote = "";
let wakeLock: WakeLockSentinel | null = null;
let audio: AudioContext | null = null;
let ticker: number | undefined;

// appendChild and insertBefore, not append, before and after: this project also compiles against the Worker's
// own DOM-like types, which type those three for a different purpose.
const add = (parent: Node, ...kids: Array<Node | string>) => {
  for (const kid of kids) parent.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
};
const placeBefore = (ref: Node, ...kids: Node[]) => {
  for (const kid of kids) ref.parentNode?.insertBefore(kid, ref);
};
const placeAfter = (ref: Node, ...kids: Node[]) => {
  let at: Node = ref;
  for (const kid of kids) {
    ref.parentNode?.insertBefore(kid, at.nextSibling);
    at = kid;
  }
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: Array<Node | string>) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) node.setAttribute(k, v);
  add(node, ...kids);
  return node;
};
const button = (label: string, className: string, onClick: () => void) => {
  const b = el("button", { type: "button", class: className }, label);
  b.addEventListener("click", onClick);
  return b;
};
const stepText = (li: HTMLElement) => li.querySelector(".procedure-step-text")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
const sectionTitle = (li: HTMLElement) => {
  const id = li.closest("section[aria-labelledby]")?.getAttribute("aria-labelledby");
  return (id ? document.getElementById(id)?.textContent : "")?.replace(/\s+/g, " ").trim() ?? "";
};
const stepRecords = () => stepItems.map((li) => ({ key: keyOf(li), number: Number(li.dataset.step), section: sectionTitle(li), text: stepText(li) }));

// ---------------------------------------------------------------- storage

function load(): Run | null {
  try {
    const stored = parseRun(localStorage.getItem(KEY));
    return stored && stored.path === procedure.path ? stored : null;
  } catch (error) {
    storageNote = `This run cannot be saved on this device (${error instanceof Error ? error.message : "storage is blocked"}). Download the record before you leave.`;
    return null;
  }
}

function save() {
  if (!run) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
    storageNote = "";
  } catch (error) {
    storageNote = `This run cannot be saved on this device (${error instanceof Error ? error.message : "storage is full"}). Download the record before you leave.`;
  }
  renderBar();
}

function update(next: Run) {
  run = next;
  save();
}

// ---------------------------------------------------------------- the bar and the live regions

const live = el("div", { class: "run-live", role: "status", "aria-live": "polite" });
const alertRegion = el("div", { class: "run-alert", role: "alert" });
const bar = el("section", { class: "run-bar", "aria-label": "Run", hidden: "" });
const start = el("button", { type: "button", class: "run-start" }, "Run this procedure");
const summary = el("section", { class: "run-summary", "aria-labelledby": "run-summary-h", hidden: "" });

function say(message: string) {
  live.textContent = "";
  window.setTimeout(() => (live.textContent = message), 30);
}

function renderBar() {
  if (!run) return;
  const { done, total } = runProgress(run, stepKeys);
  const current = stepItems.find((li) => !run?.steps[keyOf(li)]?.done);
  bar.replaceChildren(
    el("p", { class: "run-progress" }, `${done} of ${total} steps done`),
    current ? button(`Go to step ${current.dataset.step}`, "run-next", () => focusStep(current)) : el("span", { class: "run-all" }, "Every step is done."),
    button("Finish run", "run-finish", finish),
    button("Stop", "run-stop", stop),
  );
  if (storageNote) add(bar, el("p", { class: "run-warning", role: "note" }, storageNote));
  for (const li of stepItems) {
    const isCurrent = li === current;
    if (isCurrent) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    li.classList.toggle("run-step-done", run.steps[keyOf(li)]?.done === true);
  }
}

function focusStep(li: HTMLElement) {
  li.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  li.querySelector<HTMLElement>(".run-done-check")?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- a step's tools

function timerButton(li: HTMLElement, step: number, index: number, timer: StepTimer): HTMLElement {
  const key = timerKey(keyOf(li), index);
  timerStep.set(key, String(step));
  const ms = timerMs(timer);
  const box = el("div", { class: "run-timer", "data-timer": key });
  if (ms === null) {
    add(box, el("span", { class: "run-timer-text" }, `${timer.text} (not a timer I can run)`));
    return box;
  }
  const clockEl = el("span", { class: "run-clock", role: "timer" }, "");
  const act = el("button", { type: "button", class: "run-timer-act" });
  const reset = el("button", { type: "button", class: "run-timer-reset" }, "Reset");
  const label = timer.label ? `${timer.label}, ${timer.text}` : timer.text;
  const draw = () => {
    if (!run) return;
    const t = run.timers[key];
    const remaining = timerRemaining(run, key, Date.now());
    box.dataset.state = t?.state ?? "idle";
    clockEl.textContent = remaining === null ? clock(ms) : clock(remaining);
    act.textContent = !t ? `Start ${label}` : t.state === "running" ? "Pause" : t.state === "paused" ? "Resume" : "Done: start again";
    act.setAttribute("aria-label", !t ? `Start timer for step ${step}: ${label}` : t.state === "running" ? `Pause the timer for step ${step}` : t.state === "paused" ? `Resume the timer for step ${step}` : `The timer for step ${step} finished; start it again`);
    reset.hidden = !t;
  };
  act.addEventListener("click", () => {
    if (!run) return;
    const t = run.timers[key];
    ensureAudio();
    if (t?.state === "running") update(pauseTimer(run, key, Date.now()));
    else if (t?.state === "done") update(startTimer(resetTimer(run, key), key, ms, Date.now()));
    else update(startTimer(run, key, ms, Date.now()));
    drawAllTimers();
    startTicker();
  });
  reset.addEventListener("click", () => {
    if (run) update(resetTimer(run, key));
    drawAllTimers();
  });
  add(box, clockEl, act, reset);
  (box as HTMLElement & { draw?: () => void }).draw = draw;
  draw();
  return box;
}

function drawAllTimers() {
  for (const box of root!.querySelectorAll<HTMLElement & { draw?: () => void }>(".run-timer")) box.draw?.();
}

function buildTools(li: HTMLElement) {
  const step = Number(li.dataset.step);
  const key = keyOf(li);
  const timers: StepTimer[] = li.dataset.timers ? JSON.parse(li.dataset.timers) : [];
  const done = el("input", { type: "checkbox", class: "run-done-check", id: `run-done-${key}` }) as HTMLInputElement;
  done.checked = run?.steps[key]?.done === true;
  done.addEventListener("change", () => {
    if (!run) return;
    update(toggleDone(run, key, Date.now()));
    say(done.checked ? `Step ${step} done.` : `Step ${step} not done.`);
  });
  const note = el("textarea", { class: "run-note-text", rows: "2", id: `run-note-${key}`, maxlength: "2000", "aria-label": `Note for step ${step}` }) as HTMLTextAreaElement;
  note.value = run?.steps[key]?.note ?? "";
  let pending: number | undefined;
  note.addEventListener("input", () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => run && update(setNote(run, key, note.value)), 400);
  });
  note.addEventListener("blur", () => {
    window.clearTimeout(pending);
    if (run) update(setNote(run, key, note.value));
  });
  const tools = el(
    "div",
    { class: "run-tools" },
    el("label", { class: "run-done", for: done.id }, done, el("span", {}, `Step ${step} done`)),
    ...timers.map((t, i) => timerButton(li, step, i, t)),
    el("details", { class: "run-note" }, el("summary", {}, note.value.trim() ? "Note (written)" : "Add a note"), note),
  );
  const text = li.querySelector(".procedure-step-text");
  if (text) placeAfter(text, tools);
}

function removeTools() {
  for (const tools of root!.querySelectorAll(".run-tools")) tools.remove();
  for (const li of stepItems) {
    li.removeAttribute("aria-current");
    li.classList.remove("run-step-done");
  }
}

// ---------------------------------------------------------------- timers ring

function ensureAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  gain.gain.value = 0.15;
  osc.frequency.value = 880;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.35);
}

function tick() {
  if (!run) return;
  const { run: next, rang } = tickTimers(run, Date.now());
  if (rang.length > 0) {
    update(next);
    for (const key of rang) {
      const step = timerStep.get(key) ?? "";
      alertRegion.textContent = `The timer for step ${step} has finished.`;
      document.title = `Timer done, step ${step}: ${procedure.title}`;
      navigator.vibrate?.([220, 100, 220]);
      beep();
    }
  }
  drawAllTimers();
  if (!Object.values(run.timers).some((t) => t.state === "running")) {
    window.clearInterval(ticker);
    ticker = undefined;
  }
}

function startTicker() {
  if (ticker === undefined) ticker = window.setInterval(tick, 500);
}

// ---------------------------------------------------------------- the screen stays on

async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    // Not every browser lets a page hold the screen. Said, not hidden: the bar tells the person.
    wakeLock = null;
    add(bar, el("p", { class: "run-warning", role: "note" }, "This browser would not keep the screen on; it may sleep between steps."));
  }
}

async function letSleep() {
  try {
    await wakeLock?.release();
  } catch {
    // Already released by the browser: nothing to undo.
  }
  wakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && run && !run.finishedAt) {
    void keepAwake();
    tick();
  }
});

// ---------------------------------------------------------------- the scale, changed in place

async function applyScale(href: string, focus = false) {
  try {
    const res = await fetch(href, { headers: { Accept: "text/html" }, credentials: "same-origin" });
    if (!res.ok) throw new Error(`run: ${href} answered ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const next = doc.querySelector<HTMLElement>(".procedure[data-run-path]");
    if (!next) throw new Error(`run: ${href} is not a procedure page`);
    const table = root!.querySelector('[data-run-swap="materials"]');
    const nextTable = next.querySelector('[data-run-swap="materials"]');
    if (table && nextTable) table.innerHTML = nextTable.innerHTML;
    for (const li of stepItems) {
      const mine = li.querySelector('[data-run-swap="step"]');
      const theirs = next.querySelector(`li[data-step="${li.dataset.step}"] [data-run-swap="step"]`);
      if (mine && theirs) mine.innerHTML = theirs.innerHTML;
    }
    const nextField = next.querySelector<HTMLInputElement>("form.procedure-scale input[name]");
    if (nextField && scaleField) scaleField.value = nextField.defaultValue;
    history.replaceState(history.state, "", href);
    if (run && nextField) update(setScale(run, Number(nextField.defaultValue)));
    if (focus) say(`Amounts now for ${nextField?.defaultValue ?? "the new scale"}.`);
  } catch (error) {
    console.error(error);
    location.assign(href);
  }
}

scaleForm?.addEventListener("submit", (e) => {
  if (!run || !scaleField) return;
  e.preventDefault();
  const url = new URL(scaleForm.action, location.href);
  url.searchParams.set(scaleField.name, scaleField.value);
  void applyScale(`${url.pathname}${url.search}`, true);
});

// ---------------------------------------------------------------- start, finish, stop

function begin(existing: Run | null) {
  run = existing ?? newRun({ ...procedure, scale: scaleField ? Number(scaleField.value) : null }, Date.now());
  root!.dataset.run = "on";
  start.hidden = true;
  bar.hidden = false;
  summary.hidden = true;
  removeTools();
  for (const li of stepItems) buildTools(li);
  save();
  renderBar();
  drawAllTimers();
  if (Object.values(run.timers).some((t) => t.state === "running")) startTicker();
  void keepAwake();
  say(existing ? "Run resumed." : "Run started.");
  const stored = run.scale;
  if (stored !== null && scaleField && Number(scaleField.value) !== stored && scaleForm) {
    const url = new URL(scaleForm.action, location.href);
    url.searchParams.set(scaleField.name, String(stored));
    void applyScale(`${url.pathname}${url.search}`);
  }
}

function stop() {
  const confirmRow = el(
    "p",
    { class: "run-confirm", role: "alert" },
    "Discard this run and its notes? ",
    button("Discard it", "run-discard", () => {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // Nothing was saved, so nothing to remove.
      }
      run = null;
      end();
    }),
    button("Keep going", "run-keep", () => {
      confirmRow.remove();
    }),
  );
  add(bar, confirmRow);
}

function end() {
  window.clearInterval(ticker);
  ticker = undefined;
  void letSleep();
  removeTools();
  delete root!.dataset.run;
  bar.hidden = true;
  summary.hidden = true;
  start.hidden = false;
  start.textContent = "Run this procedure";
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name });
  add(document.body, a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function finish() {
  if (!run) return;
  update(finishRun(run, Date.now()));
  void letSleep();
  const current = run;
  const slug = procedure.path.split("/").pop() ?? "run";
  const stamp = new Date(current.finishedAt ?? Date.now()).toISOString().slice(0, 10);
  const runNote = el("textarea", { class: "run-note-text", rows: "3", id: "run-summary-note", "aria-label": "Note on the whole run", maxlength: "4000" }) as HTMLTextAreaElement;
  runNote.value = current.note;
  runNote.addEventListener("input", () => run && update(setRunNote(run, runNote.value)));
  const { done, total } = runProgress(current, stepKeys);
  summary.replaceChildren(
    el("h2", { id: "run-summary-h" }, "Run record"),
    el("p", {}, `${done} of ${total} steps done${current.scale !== null ? `, at scale ${current.scale}` : ""}. Saved on this device only; nothing was sent anywhere.`),
    el("label", { for: runNote.id }, "Note on the whole run"),
    runNote,
    el(
      "p",
      { class: "run-actions" },
      button("Download as text", "run-download", () => run && download(`${slug}-${stamp}.md`, runMarkdown(run, stepRecords()), "text/markdown")),
      button("Download as JSON", "run-download", () => run && download(`${slug}-${stamp}.json`, `${JSON.stringify(runRecord(run, stepRecords()), null, 2)}\n`, "application/json")),
      button("Print", "run-print", () => window.print()),
      button("Start over", "run-again", () => {
        try {
          localStorage.removeItem(KEY);
        } catch {
          // Nothing was saved, so nothing to remove.
        }
        run = null;
        end();
      }),
    ),
  );
  summary.hidden = false;
  summary.scrollIntoView({ block: "start" });
  say("Run finished. The record is ready to download or print.");
}

// ---------------------------------------------------------------- mount

const links = root.querySelector(".procedure-links");
start.addEventListener("click", () => begin(load()));
add(links ?? root, start);
placeBefore(root, live, alertRegion);
placeAfter(root, bar, summary);

const existing = load();
if (existing && !existing.finishedAt) {
  const { done, total } = runProgress(existing, stepKeys);
  start.textContent = `Resume your run (${done} of ${total} done)`;
} else if (storageNote) {
  placeAfter(start, el("span", { class: "run-warning", role: "note" }, storageNote));
}
