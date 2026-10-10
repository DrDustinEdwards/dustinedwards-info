// Platform tabs on a software how-to (docs/KNOWLEDGE-BASE.md, S4). The server renders every platform's command under
// its name, with links to each, which is the whole page with script off and what a machine reads. This turns each set
// into tabs: one platform shows, the links become tabs (arrow keys move between them), and the reader's platform is
// remembered on the device and used for every set on every how-to. With nothing remembered it starts from the system the
// browser reports, else the first tab.

const KEY = "dustinedwards.platform";

const guess = () => {
  const ua = navigator.userAgent;
  return /Windows/.test(ua) ? "windows" : /Mac OS X|Macintosh/.test(ua) ? "macos" : /Linux|X11/.test(ua) ? "linux" : null;
};

let chosen: string | null = null;
try {
  chosen = localStorage.getItem(KEY);
} catch {
  // Storage refused: the choice lasts the page.
}
chosen ??= guess();

const sets = [...document.querySelectorAll<HTMLElement>("[data-platforms]")];

function paint() {
  for (const set of sets) {
    const tabs = [...set.querySelectorAll<HTMLAnchorElement>(".procedure-platform-tabs a[data-platform]")];
    const panels = [...set.querySelectorAll<HTMLElement>(".procedure-platform[data-platform]")];
    const shown = panels.some((p) => p.dataset.platform === chosen) ? chosen : (panels[0]?.dataset.platform ?? null);
    for (const tab of tabs) {
      const on = tab.dataset.platform === shown;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.platform !== shown;
  }
}

function choose(platform: string, focus: HTMLAnchorElement | null) {
  chosen = platform;
  try {
    localStorage.setItem(KEY, platform);
  } catch {
    // Not remembered; this page still follows the choice.
  }
  paint();
  focus?.focus();
}

for (const set of sets) {
  const list = set.querySelector<HTMLElement>(".procedure-platform-tabs");
  if (!list) continue;
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Platform");
  const tabs = [...list.querySelectorAll<HTMLAnchorElement>("a[data-platform]")];
  for (const tab of tabs) {
    const panel = set.querySelector<HTMLElement>(`.procedure-platform[data-platform="${tab.dataset.platform}"]`);
    if (!panel) continue;
    tab.setAttribute("role", "tab");
    tab.id ||= `${panel.id}-tab`;
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      choose(tab.dataset.platform ?? "", tab);
    });
    tab.addEventListener("keydown", (event) => {
      const at = tabs.indexOf(tab);
      const by = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!by) return;
      event.preventDefault();
      const next = tabs[(at + by + tabs.length) % tabs.length];
      if (next) choose(next.dataset.platform ?? "", next);
    });
  }
  set.dataset.enhanced = "";
}

paint();
