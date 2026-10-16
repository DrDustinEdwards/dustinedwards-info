// EXPERIMENT: one small script for every page. No framework.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

// theme
const themeBtn = $("#theme");
const setThemeLabel = () => { if (themeBtn) themeBtn.querySelector("span").textContent = root.dataset.theme === "dark" ? "Light" : "Dark"; };
setThemeLabel();
themeBtn?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  const apply = () => { root.dataset.theme = next; setThemeLabel(); try { localStorage.setItem("de-x-theme", next); } catch {} };
  if (document.startViewTransition) document.startViewTransition(apply); else apply();
});

// local time in Stephenville
const clock = $("#clock");
const tick = () => { if (clock) clock.textContent = "Stephenville " + new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Chicago" }).format(new Date()); };
tick(); setInterval(tick, 15000);

// header hides on the way down, returns on the way up
const bar = $(".bar");
let lastY = scrollY;
addEventListener("scroll", () => {
  const y = scrollY;
  if (bar && !document.body.classList.contains("ov-open")) bar.classList.toggle("hide", y > 200 && y > lastY);
  lastY = y;
}, { passive: true });

// index overlay
const ov = $("#overlay");
const openOv = (o) => { ov.classList.toggle("open", o); document.body.classList.toggle("ov-open", o); document.body.style.overflow = o ? "hidden" : ""; };
$$("[data-open-index]").forEach((b) => b.addEventListener("click", () => openOv(true)));
$$("[data-close-index]").forEach((b) => b.addEventListener("click", () => openOv(false)));
addEventListener("keydown", (e) => {
  if (e.key === "Escape") openOv(false);
  if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) { e.preventDefault(); openOv(!ov.classList.contains("open")); }
});

// reveal on scroll, and count-ups
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in");
  $$("[data-count]", e.target).forEach(countUp);
  io.unobserve(e.target);
}), { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
$$(".rv").forEach((el) => io.observe(el));
function countUp(el) {
  const to = Number(el.dataset.count); if (!to || el.dataset.done) return; el.dataset.done = 1;
  const fmt = (n) => el.dataset.fmt === "plain" ? String(n) : n.toLocaleString("en-US");
  const t0 = performance.now(), dur = 1400;
  const step = (t) => { const p = Math.min(1, (t - t0) / dur); const v = Math.round(to * (1 - Math.pow(1 - p, 4))); el.textContent = fmt(v); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// hero numbers start at once
$$(".figs [data-count]").forEach((el) => setTimeout(() => countUp(el), 700));

// tooltip
const tip = document.createElement("div"); tip.className = "tip"; document.body.append(tip);
document.addEventListener("pointerover", (e) => { const d = e.target.closest("[data-tip]"); if (!d) return; tip.textContent = d.dataset.tip; tip.classList.add("show"); });
document.addEventListener("pointermove", (e) => { if (!tip.classList.contains("show")) return; tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14) + "px"; tip.style.top = (e.clientY + 16) + "px"; });
document.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) tip.classList.remove("show"); });

// phage table: filter, search, sort, matrix link
const ptable = $("#ptable");
if (ptable) {
  const rows = $$("tbody tr", ptable);
  const q = $("#pq"), cnt = $("#pcount");
  let host = "all";
  const apply = () => {
    const s = (q?.value || "").toLowerCase();
    let n = 0;
    rows.forEach((r) => {
      const ok = (host === "all" || (host === "pub" ? r.dataset.pub === "1" : r.dataset.host === host)) && r.textContent.toLowerCase().includes(s);
      r.hidden = !ok; if (ok) n++;
    });
    $$(".matrix .dot").forEach((d) => d.classList.toggle("off", !(host === "all" || (host === "pub" ? d.classList.contains("pub") : d.dataset.host === host))));
    if (cnt) cnt.textContent = n + " of " + rows.length + " phages";
  };
  $$("[data-host-f]").forEach((b) => b.addEventListener("click", () => { host = b.dataset.hostF; $$("[data-host-f]").forEach((x) => x.setAttribute("aria-pressed", x === b)); apply(); }));
  q?.addEventListener("input", apply);
  $$("th button", ptable).forEach((b, i) => b.addEventListener("click", () => {
    const dir = b.dataset.dir === "asc" ? "desc" : "asc";
    $$("th button", ptable).forEach((x) => delete x.dataset.dir); b.dataset.dir = dir;
    const key = b.dataset.k;
    const sorted = rows.slice().sort((a, c) => { const x = a.dataset[key], y = c.dataset[key]; const nx = Number(x), ny = Number(y); const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y); return dir === "asc" ? r : -r; });
    const tb = $("tbody", ptable); sorted.forEach((r) => tb.append(r));
  }));
  $$(".matrix .dot").forEach((d) => d.addEventListener("click", () => {
    const r = $(`tr[data-name="${d.dataset.name}"]`, ptable); if (!r) return;
    rows.forEach((x) => x.classList.remove("hl")); $$(".matrix .dot").forEach((x) => x.classList.remove("sel"));
    r.classList.add("hl"); d.classList.add("sel");
    const wrap = r.closest(".tw"); wrap.scrollTo({ top: r.offsetTop - 60, behavior: "smooth" });
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}

// publications filter
const plist = $("#plist");
if (plist) {
  const items = $$("li", plist), q = $("#pubq"), cnt = $("#pubcount");
  let topic = "all";
  const apply = () => {
    const s = (q?.value || "").toLowerCase(); let n = 0;
    items.forEach((li) => { const ok = (topic === "all" || li.dataset.topics.split(" ").includes(topic)) && li.textContent.toLowerCase().includes(s); li.classList.toggle("hide", !ok); if (ok) n++; });
    $$(".hist s").forEach((x) => x.classList.toggle("dim", topic !== "all" && x.dataset.t !== topic));
    if (cnt) cnt.textContent = n + " of " + items.length;
  };
  $$("[data-topic]").forEach((b) => b.addEventListener("click", () => { topic = b.dataset.topic; $$("[data-topic]").forEach((x) => x.setAttribute("aria-pressed", x === b)); apply(); }));
  q?.addEventListener("input", apply);
}

// writing tag filter
const postList = $("#postlist");
if (postList) {
  $$("[data-tag]").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.tag; $$("[data-tag]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $$("li", postList).forEach((li) => li.classList.toggle("hide", t !== "all" && !li.dataset.tags.split(" ").includes(t)));
  }));
}

// titer calculator
const calc = $("#calc");
if (calc) {
  const pl = $("#c-pl"), vol = $("#c-vol"), dil = $("#c-dil"), out = $("#c-out");
  const run = () => {
    const p = Number(pl.value), v = Number(vol.value) / 1000, d = Number(dil.value);
    if (!(p > 0 && v > 0)) { out.innerHTML = "&mdash;"; return; }
    const t = p / (v * Math.pow(10, -d)); const e = Math.floor(Math.log10(t)); const m = t / Math.pow(10, e);
    out.innerHTML = `${m.toFixed(2)} &times; 10<sup>${e}</sup> <small>pfu/ml</small>`;
  };
  [pl, vol, dil].forEach((x) => x.addEventListener("input", run)); run();
}

// article: progress + toc spy
const prose = $(".prose");
const prog = $(".progress");
if (prose && prog) {
  const upd = () => { const r = prose.getBoundingClientRect(); const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight * .6))); prog.style.transform = `scaleX(${p})`; };
  addEventListener("scroll", upd, { passive: true }); upd();
}
const spy = (links) => {
  const targets = links.map((a) => [a, document.getElementById(a.getAttribute("href").slice(1))]).filter(([, t]) => t);
  const upd = () => {
    let cur = null;
    for (const [a, t] of targets) if (t.getBoundingClientRect().top < innerHeight * 0.3) cur = a;
    links.forEach((a) => a.classList.toggle("on", a === cur));
  };
  addEventListener("scroll", upd, { passive: true }); upd();
};
if ($$(".toc a[href^='#']").length) spy($$(".toc a[href^='#']"));
if ($$(".cv-nav a").length) spy($$(".cv-nav a"));

// cite tabs
const cite = $(".cite");
if (cite) {
  const tabs = $$("[role=tab]", cite), pres = $$("pre", cite);
  tabs.forEach((t, i) => t.addEventListener("click", () => { tabs.forEach((x, j) => x.setAttribute("aria-selected", i === j)); pres.forEach((p, j) => (p.hidden = i !== j)); }));
  $(".copy", cite)?.addEventListener("click", async (e) => {
    const p = pres.find((x) => !x.hidden); try { await navigator.clipboard.writeText(p.textContent); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1400); } catch {}
  });
}
