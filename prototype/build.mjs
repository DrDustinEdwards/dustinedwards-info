// EXPERIMENT build: reads ../content and writes a static site to ./dist.
// Run: npm start (builds, then serves on http://localhost:4321).
import { mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, cpSync } from "node:fs";
const FONT_PKGS = ["inter-tight", "jetbrains-mono", "newsreader"];
const FONT_CSS = ["inter-tight/wght.css", "inter-tight/wght-italic.css", "jetbrains-mono/wght.css", "newsreader/opsz.css", "newsreader/opsz-italic.css"];
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import * as D from "./src/data.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "dist");
const LIVE = "https://dustinedwards.info";
const { identity: ID, phages, publications: PUBS, posts: POSTS, pages: PAGES, projects: PROJECTS, cv: CV } = D;

// ---------- which pages this prototype draws ----------
const PUB_SLUG = "10-1371-journal-ppat-1004454";
const POST_SLUG = "carrel-a-writing-desk-apart-from-the-site";
const PRODUCT_SLUG = "foxhound";
const LOCAL = new Set(["/", "/research", `/research/publications/${PUB_SLUG}`, "/software", `/software/${PRODUCT_SLUG}`, "/writing", `/writing/${POST_SLUG}`, "/cv", "/about"]);
const norm = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
/** A link to a page this prototype draws stays local; anything else goes to the live site. */
export function href(p) {
  if (!p || /^(https?:|mailto:|#)/.test(p)) return p;
  const [path, hash] = p.split("#");
  const n = norm(path || "/");
  if (LOCAL.has(n)) return (n === "/" ? "/" : n + "/") + (hash ? "#" + hash : "");
  return LIVE + p;
}

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const minutes = (w) => Math.max(1, Math.round(w / 230));
const ext = (u) => `<span class="arrow ne">&#8599;</span>`;
const arrow = `<span class="arrow">&rarr;</span>`;
const splitLetters = (text, start = 0) => {
  let i = start;
  return [...text].map((c) => (c === " " ? " " : `<span class="ch" style="--i:${i++}">${esc(c)}</span>`)).join("");
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const strip = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");
const inlineMd = (s) => markedFor().parseInline(s);

function markedFor(headings) {
  const m = new Marked({ gfm: true });
  m.use({
    renderer: {
      link({ href: h, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const u = href(h);
        const out = /^https?:/.test(u) && !u.startsWith(LIVE);
        return `<a href="${esc(u)}"${title ? ` title="${esc(title)}"` : ""}${out ? ' rel="noopener"' : ""}>${text}</a>`;
      },
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        if (headings && depth === 2) headings.push({ id, text: strip(text) });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  return m;
}
const md = (text, headings) => markedFor(headings).parse(D.resolveTemplate(text));

// ---------- the mark: geometry copied unchanged from public/dustin-edwards-logo*.svg ----------
const LOGO_SRC = readFileSync(join(HERE, "..", "public", "dustin-edwards-logo-header.svg"), "utf8");
const LOGO_DARK_SRC = readFileSync(join(HERE, "..", "public", "dustin-edwards-logo-header-dark.svg"), "utf8");
const LOGO_PATHS = (src) => src.match(/<path[^>]*\/>/g).join("");
const logo = (cls = "") =>
  `<svg class="${cls} mark-l" viewBox="78 15 232 328" aria-hidden="true">${LOGO_PATHS(LOGO_SRC)}</svg><svg class="${cls} mark-d" viewBox="78 15 232 328" aria-hidden="true">${LOGO_PATHS(LOGO_DARK_SRC)}</svg>`;

// ---------- shared numbers, computed ----------
const presentations = CV.profile.presentations.international + CV.profile.presentations.national;
const N = {
  phages: phages.length,
  pubs: PUBS.length,
  presentations,
  presFrom: CV.profile.presentations.from,
  joined: ID.joined,
  firstPhageYear: D.phageYears[0],
  posts: POSTS.length,
  protocols: D.procedures.length,
  tools: Object.keys(PAGES).filter((k) => /^research-tools-/.test(k)).length,
  pubFirst: Math.min(...PUBS.map((p) => p.year)),
  pubLast: Math.max(...PUBS.map((p) => p.year)),
};
const paperOf = (slug) => PUBS.find((p) => p.slug === slug);
const pubHref = (p) => href(`/research/publications/${p.slug}`);

// ---------- research areas, from content/pages/research.md ----------
const researchAreas = (() => {
  const sec = PAGES.research.body.split("## Research areas")[1].split("\n## ")[0];
  return sec.trim().split("\n").filter((l) => l.startsWith("- ")).map((l) => {
    const m = /^- \[([^\]]+)\]\(([^)]+)\):?\s*(.*)$/.exec(l);
    const t = strip(m[3]).trim();
    return { name: m[1], path: m[2], text: t[0].toUpperCase() + t.slice(1) };
  });
})();
const AREA_TOPICS = { "/research/retroviruses": ["human-simian-retroviruses", "avian-retroviruses"], "/research/bacteriophages": ["bacteriophages"], "/research/science-education": ["science-education"] };

// ---------- software groups, from content/pages/software.md ----------
const softwareGroups = (() => {
  const body = PAGES.software.body;
  return ["Products", "Sites", "Infrastructure"].map((g) => {
    const sec = body.split(`## ${g}`)[1].split("\n## ")[0];
    const items = sec.trim().split("\n").filter((l) => l.startsWith("- ")).map((l) => {
      const m = /^- \[([^\]]+)\]\(\/software\/([^)]+)\)\s*(.*)$/.exec(l);
      if (m) {
        const slug = m[2], page = PAGES[`software-${slug}`], proj = PROJECTS.find((p) => p.slug === slug);
        const url = page?.data.product_url ?? proj?.url ?? page?.data.code_repository ?? null;
        return { name: m[1], slug, path: `/software/${slug}`, line: proj?.oneLiner ?? cap(strip(m[3]).replace(/^is /, "")), sentence: strip(m[3]), status: proj?.status ?? null, url, stack: proj?.stack ?? [] };
      }
      const t = /^- (\w+) is (.*?)\[([^\]]+)\]\(([^)]+)\)/.exec(l);
      if (t) return { name: t[1], slug: t[1].toLowerCase(), path: null, line: strip(t[2]).trim(), sentence: strip(t[2]).trim(), status: null, url: t[4], stack: [] };
      return null;
    }).filter(Boolean).filter((x) => !/^This site/.test(x.name));
    return { group: g, items };
  });
})();
const host = (u) => (u ? u.replace(/^https?:\/\//, "").replace(/\/$/, "") : "");

// ---------- layout ----------
const NAV = [
  ["Research", "/research"],
  ["Teaching", "/teaching"],
  ["Software", "/software"],
  ["Writing", "/writing"],
  ["About", "/about"],
];
// The profile links are read from the site's own app/lib/seo.ts, not retyped here.
const PROFILES = (() => {
  const seo = readFileSync(join(HERE, "..", "app", "lib", "seo.ts"), "utf8");
  const grab = (name) => (new RegExp(`${name}\\s*=\\s*"([^"]+)"`).exec(seo) || [])[1];
  return [["ORCID", "OWNER_ORCID"], ["Google Scholar", "OWNER_SCHOLAR"], ["PubMed", "OWNER_PUBMED"], ["GitHub", "OWNER_GITHUB"], ["LinkedIn", "OWNER_LINKEDIN"]]
    .map(([l, k]) => [l, grab(k)]).filter(([, u]) => u);
})();

function overlay() {
  const recent = POSTS.slice(0, 3);
  const cols = [
    ["01", "Research", "/research", [
      ...researchAreas.map((a) => [a.name, a.path, ""]),
      ["Publications", "/research#papers", N.pubs],
      ["Every phage", "/research#phages", N.phages],
      ["Protocols", "/research#methods", N.protocols],
      ["Lab calculators", "/research/tools", N.tools],
    ]],
    ["02", "Teaching", "/teaching", [
      ["Phage Discovery Program", "/teaching/phage-discovery", ""],
      ["Virus Isolation", "/teaching/virus-isolation", "Fall"],
      ["Phage Bioinformatics", "/teaching/phage-bioinformatics", "Spring"],
      ["Central Dogma Tutorials", "/teaching/central-dogma", ""],
      ["Study Skills Guide", "/teaching/study-skills", ""],
    ]],
    ["03", "Software", "/software", softwareGroups.flatMap((g) => g.items.map((i) => [i.name, i.path ?? i.url, g.group.slice(0, -1)]))],
    ["04", "Writing", "/writing", [["All articles", "/writing", N.posts], ["Carrel, the series", "/writing#series", 3], ...recent.map((p) => [cap(p.title.replace(/^Carrel, part \d: /, "")), `/writing/${p.slug}`, fmtDate(p.date).replace(/ \d+,/, "")])]],
    ["05", "About", "/about", [["About", "/about", ""], ["CV", "/cv", CV.profile.edition], ["Colophon", "/colophon", ""], ["Privacy", "/privacy", ""]]],
  ];
  return `<div class="overlay" id="overlay" aria-label="Site index">
  <div class="w"><div class="top"><a class="me" href="/">${logo()}Dustin Edwards</a><button class="idx-btn" data-close-index>Close <span aria-hidden="true">&#10005;</span></button></div>
  <div class="ov-grid">${cols.map(([n, t, p, links]) => `<div class="ov-col"><span class="n">${n}</span><h2><a href="${href(p)}">${t}</a></h2><ul>${links.map(([l, u, s]) => `<li><a href="${esc(href(u))}"><span>${esc(l)}</span><small>${esc(s)}</small></a></li>`).join("")}</ul></div>`).join("")}</div>
  <div class="ov-foot"><span class="m">Press / or Ctrl K to open this index anywhere. Esc closes it.</span></div></div></div>`;
}

function layout({ title, description, active, body, bodyClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${FONT_CSS.map((f) => `<link rel="stylesheet" href="/fonts/${f}">`).join("")}
<script>try{var t=localStorage.getItem('de-x-theme');var q=new URLSearchParams(location.search).get('theme');if(q)t=q;if(t)document.documentElement.dataset.theme=t;}catch(e){}document.documentElement.classList.add('js')</script>
<style>.mark-d{display:none}[data-theme="dark"] .mark-l{display:none}[data-theme="dark"] .mark-d{display:block}</style>
<link rel="stylesheet" href="/site.css">
</head>
<body class="${bodyClass}">
<header class="bar"><div class="w">
  <a class="me" href="/">${logo()}<span>Dustin Edwards</span></a>
  <nav aria-label="Main">${NAV.map(([l, p]) => `<a href="${href(p)}"${active === p ? ' class="on"' : ""}>${l}</a>`).join("")}<a href="${href("/cv")}"${active === "/cv" ? ' class="on"' : ""}>CV</a></nav>
  <div class="tools"><span class="m clock" id="clock"></span><button class="t" id="theme"><i class="dot-theme"></i><span>Dark</span></button><button class="idx-btn" data-open-index><i><b></b><b></b></i>Index</button></div>
</div></header>
${overlay()}
<main>
${body}
</main>
${footer()}
<script src="/site.js" type="module"></script>
</body>
</html>`;
}

function footer() {
  return `<footer class="site"><div class="w">
  <div class="grid cols">
    <div class="wide"><span class="lbl">Dustin Edwards</span><p>${esc(ID.rank)} and ${esc(ID.adminTitle)}, ${esc(ID.department)}, ${esc(ID.affiliation)}. ${esc(ID.town)}.</p></div>
    <div><span class="lbl">Site</span><ul>${NAV.map(([l, p]) => `<li><a href="${href(p)}">${l}</a></li>`).join("")}<li><a href="${href("/cv")}">CV</a></li></ul></div>
    <div><span class="lbl">Research</span><ul><li><a href="${href("/research#papers")}">Publications</a></li><li><a href="${href("/research#phages")}">Phages</a></li><li><a href="${href("/research#methods")}">Protocols</a></li><li><a href="${href("/research/tools")}">Calculators</a></li></ul></div>
    <div><span class="lbl">Elsewhere</span><ul>${PROFILES.map(([l, u]) => `<li><a href="${u}" rel="noopener">${l}</a></li>`).join("")}</ul></div>
    <div><span class="lbl">Feeds</span><ul><li><a href="${LIVE}/blog/rss.xml">RSS</a></li><li><a href="${LIVE}/llms.txt">llms.txt</a></li><li><a href="${LIVE}/colophon">Colophon</a></li></ul></div>
  </div>
  <div class="wordmark" aria-hidden="true">Dustin Edwards</div>
</div>
<div class="fine"><div class="w" style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;width:100%"><span>&copy; ${new Date().getFullYear()} Dustin Edwards</span><span>Prototype, built from the repository's content/. Not the live site.</span></div></div>
</footer>`;
}

const sh = (n, h, p, id) => `<div class="grid sh rv"${id ? ` id="${id}"` : ""}><span class="n">${n}</span><h2>${h}</h2><p>${p}</p></div>`;

// ---------- reusable blocks ----------
function phageMatrix() {
  const years = D.phageYears;
  let i = 0;
  return `<div class="matrix" style="--cols:${years.length}">${years.map((y) => {
    const list = phages.filter((p) => p.year === y);
    return `<div class="col"><span class="yr"><b>${list.length}</b>${y}</span>${list.map((p) => `<button class="dot${p.paper ? " pub" : ""}" style="--i:${i++}" data-host="${p.host}" data-name="${esc(p.name)}" data-tip="${esc(p.name)} · ${y} · ${esc(p.county)}${p.bp ? " · " + p.bp.toLocaleString("en-US") + " bp" : ""}" aria-label="${esc(p.name)}, ${y}"></button>`).join("")}</div>`;
  }).join("")}</div>
  <div class="legend"><span><i></i>${D.HOSTS.foliorum.full}, ${phages.filter((p) => p.host === "foliorum").length}</span><span><i class="s"></i>${D.HOSTS.smegmatis.full}, ${phages.filter((p) => p.host === "smegmatis").length}</span><span><i class="p"></i>genome paper published, ${phages.filter((p) => p.paper).length}</span></div>`;
}

function pubHist() {
  const years = [];
  for (let y = N.pubFirst; y <= N.pubLast; y++) years.push(y);
  const max = Math.max(...years.map((y) => PUBS.filter((p) => p.year === y).length));
  let i = 0;
  return `<div class="hist" style="--u:${(92 / max).toFixed(2)}px" aria-hidden="true">${years.map((y) => {
    const list = PUBS.filter((p) => p.year === y);
    return `<div data-tip="${y}: ${list.length} ${list.length === 1 ? "paper" : "papers"}">${list.map((p) => `<s class="t-${p.topics[0]}" data-t="${p.topics[0]}" style="--i:${i++}"></s>`).join("")}${y % 5 === 0 || y === N.pubFirst || y === N.pubLast ? `<em>${y}</em>` : ""}</div>`;
  }).join("")}</div>`;
}

function pubItem(p) {
  return `<li data-topics="${p.topics.join(" ")}"><a href="${pubHref(p)}"><span class="y">${p.year}</span><div><h4>${esc(p.title)}</h4><p>${esc(p.summary)}</p></div><div class="jr"><b>${esc(p.journal)}</b>${p.topics.map((t) => `<span class="tkey t-${t}"></span>`).join("")}${p.topics.map((t) => D.TOPICS[t]).join(", ")}</div></a></li>`;
}

function postItem(p) {
  return `<li data-tags="${p.tags.join(" ")}"><a href="${href(`/writing/${p.slug}`)}"><span class="d">${fmtDate(p.date)}</span><div><h4>${esc(p.title)}</h4><p>${esc(p.description)}</p></div><span class="rt">${minutes(p.words)} min read</span></a></li>`;
}

// =====================================================================
// HOME
// =====================================================================
function home() {
  const recentPubs = PUBS.slice(0, 5);
  const firstTar = CV.appointments.entries.filter((e) => e.section === "Positions");
  const about = PAGES.about.body;
  const quote = /The two halves are the same habit\.([^\n]*\n[^\n]*\n?[^\n]*)/.exec(about);
  const habit = about.split("\n\n").find((p) => p.startsWith("The two halves"))?.replace(/\n/g, " ") ?? "";
  const [h1, ...hRest] = habit.split(". ");
  const path = [
    ...firstTar.map((e) => ({ y: `${e.year}${e.endYear ? (e.endYear === "present" ? " to now" : " to " + e.endYear) : ""}`, now: e.endYear === "present", t: e.title, o: e.org.split(",").slice(0, 2).join(",") })),
    ...CV.education.entries.map((e) => ({ y: String(e.year), t: e.title.replace(/ \(.*?\)/, ""), o: e.org.split(",")[0] })),
  ].sort((a, b) => parseInt(b.y) - parseInt(a.y));
  const body = `
<section class="hero w">
  <h1 class="display split" aria-label="Dustin Edwards"><span class="ln">${splitLetters("Dustin")}</span><span class="ln">${splitLetters("Edwards", 6)}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.55s">${esc(ID.discipline)}. I study how viruses <em>stay</em> in their hosts, from a human leukemia virus to the bacteriophages students find in Texas soil.</p>
    <div class="fade-up" style="--d:.7s"><span class="lbl">Position</span><p>${esc(ID.rank)} and ${esc(ID.adminTitle)}, ${esc(ID.departmentSubject)}, ${esc(ID.affiliation)}</p></div>
    <div class="fade-up" style="--d:.8s"><span class="lbl">Also</span><p>Runs the HHMI SEA-PHAGES program at Tarleton. Builds software on Cloudflare.</p></div>
  </div>
  <div class="grid figs fade-up" style="--d:.9s">
    <div class="fig"><b data-count="${N.phages}">0</b><span>phages isolated by students since ${N.firstPhageYear}</span></div>
    <div class="fig"><b data-count="${N.pubs}">0</b><span>papers, chapters and abstracts</span></div>
    <div class="fig"><b data-count="${N.presentations}">0</b><span>presentations since ${N.presFrom}</span></div>
    <div class="fig"><b data-count="${N.joined}" data-fmt="plain">0</b><span>joined ${esc(ID.affiliation)}</span></div>
  </div>
</section>

<section class="sec w" id="research">
  ${sh("01", "Research", "One question runs through the work: how a virus sets up a lasting infection, and what that costs the host.")}
  <div class="grid areas">${researchAreas.map((a) => `<a class="rv" href="${href(a.path)}"><span class="lbl">${PUBS.filter((p) => p.topics.some((t) => AREA_TOPICS[a.path]?.includes(t))).length} papers</span><h3>${esc(a.name)}</h3><p>${esc(a.text)}</p><span class="go">Read more ${arrow}</span></a>`).join("")}</div>
</section>

<section class="sec w">
  ${sh("02", "Every phage, by year", `Each block is one bacteriophage isolated in the Tarleton lab. Hover for a name. The <a class="ul" href="${href("/research#phages")}">full table</a> is on Research.`)}
  <div class="rv">${phageMatrix()}</div>
</section>

<section class="sec w">
  <div class="rv" style="border-top:1px solid var(--rule-2);padding-top:22px">
    <span class="lbl">From the About page</span>
    <p class="display-3" style="max-width:22ch">${esc(h1)}. <span class="muted">${esc(hRest.join(". "))}</span></p>
  </div>
</section>

<section class="sec w">
  ${sh("03", "Publications", `${N.pubs} papers, chapters and abstracts from ${N.pubFirst} to ${N.pubLast}, each with one sentence on what it found.`)}
  <div class="rv">${pubHist()}</div>
  <ul class="pubs rv">${recentPubs.map(pubItem).join("")}</ul>
  <p style="margin-top:22px"><a class="ul" style="font-weight:600" href="${href("/research#papers")}">All ${N.pubs} publications ${arrow}</a></p>
</section>

<section class="sec w">
  ${sh("04", "Software", "Products and tools built solo by directing AI coding agents, all running on Cloudflare. This site is one of them.")}
  ${softwareGroups.map((g) => g.items.filter((i) => g.group !== "Sites" || i.path).map((i) => swRow(i)).join("")).join("")}
  <p style="margin-top:22px"><a class="ul" style="font-weight:600" href="${href("/software")}">Everything, grouped ${arrow}</a></p>
</section>

<section class="sec w">
  ${sh("05", "Writing", "Writing on building for the web, mostly on Cloudflare: what was measured, what worked, what failed.")}
  <ul class="posts rv">${POSTS.slice(0, 5).map(postItem).join("")}</ul>
  <p style="margin-top:22px"><a class="ul" style="font-weight:600" href="${href("/writing")}">All ${N.posts} articles ${arrow}</a></p>
</section>

<section class="sec w">
  ${sh("06", "Path", `From a doctorate in molecular virology, through the National Cancer Institute, to Tarleton since ${N.joined}. <a class="ul" href="${href("/cv")}">Full CV</a>.`)}
  <ul class="rows rv">${path.map((r) => `<li><span class="yr${r.now ? " now" : ""}">${esc(r.y)}</span><div><b>${esc(r.t)}</b><small>${esc(r.o)}</small></div><span></span></li>`).join("")}</ul>
</section>`;
  return layout({ title: "Dustin Edwards", description: `${ID.name}, ${ID.degree}. ${ID.rank}, ${ID.discipline} and ${ID.adminTitle} of ${ID.departmentSubject} at ${ID.affiliation}.`, active: "/", body });
}

function swRow(i) {
  const link = i.path ? href(i.path) : i.url;
  return `<a class="sw-row rv" href="${esc(link)}"><h3>${esc(i.name)}</h3><p>${esc(i.line)}</p><span class="st${i.status === "live" ? " live" : ""}">${i.status === "live" ? "Live" : ""}${i.url ? `${i.status === "live" ? "<br>" : ""}${esc(host(i.url))}` : ""}</span><span class="go">${arrow}</span></a>`;
}

// =====================================================================
// RESEARCH
// =====================================================================
function research() {
  const topicsCount = Object.keys(D.TOPICS).map((t) => [t, PUBS.filter((p) => p.topics.includes(t)).length]);
  const tools = Object.entries(PAGES).filter(([k]) => /^research-tools-/.test(k)).map(([, p]) => p);
  const intro = D.resolveTemplate(PAGES.research.body.trim().split("\n\n")[0]).replace(/^This is the hub for Dustin Edwards's research\. /, "");
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><span>Research</span></div>
  <h1 class="display split"><span class="ln">${splitLetters("Research")}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.4s">Retroviruses that <em>persist</em>, from HTLV-1 in people to REV and LPDV in wild birds, and bacteriophages dug out of Texas soil by undergraduates.</p>
    <div class="fade-up" style="--d:.55s"><span class="lbl">On this page</span><p><a class="ul" href="#areas">Areas</a><br><a class="ul" href="#phages">Phages</a><br><a class="ul" href="#papers">Publications</a><br><a class="ul" href="#methods">Methods</a></p></div>
    <div class="fade-up" style="--d:.65s"><span class="lbl">Lab</span><p>${esc(ID.department)}, ${esc(ID.affiliation)}, ${esc(ID.town)}</p></div>
  </div>
  <p class="fade-up" style="--d:.8s;max-width:72ch;color:var(--ink-2);margin-top:40px">${inlineMd(intro)}</p>
</section>

<section class="sec w" id="areas">
  ${sh("01", "Areas", "Three lines of work, one habit: find out what a virus needs to stay, and write it down so anyone can repeat it.")}
  <div class="grid areas">${researchAreas.map((a) => `<a class="rv" href="${href(a.path)}"><span class="lbl">${PUBS.filter((p) => p.topics.some((t) => AREA_TOPICS[a.path]?.includes(t))).length} papers</span><h3>${esc(a.name)}</h3><p>${esc(a.text)}</p><span class="go">Read more ${arrow}</span></a>`).join("")}</div>
</section>

<section class="sec w" id="phages">
  ${sh("02", "Every phage", `All ${N.phages} bacteriophages isolated in the Tarleton SEA-PHAGES lab from ${D.phageYears[0]} to ${D.phageYears.at(-1)}. Click a block to find it in the table.`)}
  <div class="rv">${phageMatrix()}</div>
  <div class="toolbar"><button data-host-f="all" aria-pressed="true">All<sup>${N.phages}</sup></button><button data-host-f="foliorum" aria-pressed="false">M. foliorum<sup>${phages.filter((p) => p.host === "foliorum").length}</sup></button><button data-host-f="smegmatis" aria-pressed="false">M. smegmatis<sup>${phages.filter((p) => p.host === "smegmatis").length}</sup></button><button data-host-f="pub" aria-pressed="false">Published genomes<sup>${phages.filter((p) => p.paper).length}</sup></button><input id="pq" type="search" placeholder="Search phages or counties" aria-label="Search phages"></div>
  <div class="tw"><table id="ptable"><thead><tr><th><button data-k="name">Phage</button></th><th><button data-k="year">Year</button></th><th><button data-k="host">Host</button></th><th><button data-k="county">Found in</button></th><th class="num"><button data-k="bp">Genome</button></th><th>Record</th></tr></thead><tbody>
  ${phages.map((p) => `<tr data-name="${esc(p.name)}" data-year="${p.year}" data-host="${p.host}" data-county="${esc(p.county)}" data-bp="${p.bp ?? 0}" data-pub="${p.paper ? 1 : 0}"><td><b>${esc(p.name)}</b>${p.formerly ? ` <span class="muted">(formerly ${esc(p.formerly)})</span>` : ""}</td><td>${p.year}</td><td><span class="hostc${p.host === "smegmatis" ? " s" : ""}"></span><i>${D.HOSTS[p.host].label}</i></td><td>${esc(p.county)}</td><td class="num">${p.bp ? p.bp.toLocaleString("en-US") + " bp" : '<span class="muted">n/a</span>'}</td><td><a href="https://phagesdb.org/phages/${encodeURIComponent(p.phagesdb)}/" rel="noopener">PhagesDB</a>${p.paper && paperOf(p.paper) ? ` · <a href="${pubHref(paperOf(p.paper))}">Paper</a>` : ""}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="count-line" id="pcount">${N.phages} of ${N.phages} phages</div>
</section>

<section class="sec w" id="papers">
  ${sh("03", "Publications", `${N.pubs} papers, chapters and abstracts, ${N.pubFirst} to ${N.pubLast}. Each with one sentence on what it found. The bars are papers per year, coloured by area.`)}
  <div class="rv">${pubHist()}</div>
  <div class="toolbar" style="margin-top:12px"><button data-topic="all" aria-pressed="true">All<sup>${N.pubs}</sup></button>${topicsCount.map(([t, n]) => `<button data-topic="${t}" aria-pressed="false"><span class="tkey t-${t}"></span>${D.TOPICS[t]}<sup>${n}</sup></button>`).join("")}<input id="pubq" type="search" placeholder="Search titles, journals, findings" aria-label="Search publications"></div>
  <ul class="pubs" id="plist" style="border-top:0">${PUBS.map(pubItem).join("")}</ul>
  <div class="count-line" id="pubcount">${N.pubs} of ${N.pubs}</div>
</section>

<section class="sec w" id="methods">
  ${sh("04", "Methods", "The protocols are public, written the way they are actually run, with every primer and reagent in a registry. The arithmetic of the bench is a calculator.")}
  <div class="grid two">
    <div class="rv"><ul class="idx">${D.procedures.map((p, i) => `<li><a href="${href(p.path)}"><span class="k">${String(i + 1).padStart(2, "0")}</span><span><b>${esc(p.title)}</b><small>${esc(p.description)}</small></span><span class="ar">${arrow}</span></a></li>`).join("")}<li><a href="${href("/research/lab")}"><span class="k">${String(D.procedures.length + 1).padStart(2, "0")}</span><span><b>Lab registry</b><small>Every primer with computed length and melting temperature, every strain and reagent.</small></span><span class="ar">${arrow}</span></a></li></ul></div>
    <div class="rv">
      <div class="calc" id="calc"><span class="lbl">Phage titer calculator</span>
        <div class="f"><label><span>Plaques</span><input id="c-pl" type="number" value="42" min="0"></label><label><span style="text-transform:none">VOLUME, µl</span><input id="c-vol" type="number" value="10" min="0"></label><label><span>Dilution</span><select id="c-dil">${Array.from({ length: 11 }, (_, i) => `<option value="${i}"${i === 6 ? " selected" : ""}>10^-${i}</option>`).join("")}</select></label></div>
        <output id="c-out"></output>
        <p class="eq">titer = plaques / (volume in ml &times; dilution)</p>
        <p style="margin-top:24px"><a class="ul" style="font-weight:600" href="${href("/research/tools")}">All ${tools.length} lab calculators ${arrow}</a></p>
        <div class="tags" style="margin-top:14px">${tools.map((t) => `<a class="tag" style="text-decoration:none" href="${href(t.data.path)}">${esc(t.data.title.replace(/ (Calculator|Planner)$/, ""))}</a>`).join("")}</div>
      </div>
    </div>
  </div>
</section>`;
  return layout({ title: "Research · Dustin Edwards", description: PAGES.research.data.description, active: "/research", body });
}

// =====================================================================
// PUBLICATION
// =====================================================================
function publication() {
  const p = paperOf(PUB_SLUG);
  const related = PUBS.filter((x) => x.slug !== p.slug && x.topics.some((t) => p.topics.includes(t)) && x.type === "article").slice(0, 4);
  const me = (a) => /Dustin Edwards/.test(a);
  const auth = p.authors.map((a) => (me(a) ? `<b>${esc(a)}</b>` : esc(a))).join(", ");
  const position = p.authors.findIndex(me) + 1;
  const apaAuthors = p.authors.map((a) => {
    const parts = a.split(" ");
    let i = parts.length - 1;
    while (i > 1 && /^(de|da|van|von|der|del)$/.test(parts[i - 1])) i--;
    const family = parts.slice(i).join(" "), given = parts.slice(0, i);
    return `${family}, ${given.map((x) => x.split("-").map((y) => y[0] + ".").join("-")).join(" ")}`;
  });
  const apaList = apaAuthors.length > 1 ? apaAuthors.slice(0, -1).join(", ") + ", & " + apaAuthors.at(-1) : apaAuthors[0];
  const apa = `${apaList} (${p.year}). ${p.title}. ${p.journal}, ${p.volume}(${p.issue}), ${p.pages ?? ""}. https://doi.org/${p.doi}`;
  const bib = `@article{edwards${p.year}codependence,\n  title   = {${p.title}},\n  author  = {${p.authors.join(" and ")}},\n  journal = {${p.journal}},\n  year    = {${p.year}},\n  volume  = {${p.volume}},\n  number  = {${p.issue}},\n  doi     = {${p.doi}}\n}`;
  const page = PUBS.find((x) => x.slug === p.slug);
  const pagesStr = page.pages ?? (readFileSync(join(HERE, "..", "content", "publications", p.slug + ".md"), "utf8").match(/^pages:\s*"?([^"\n]+)/m)?.[1] ?? "");
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><a href="${href("/research")}">Research</a><span>/</span><a href="${href("/research#papers")}">Publications</a><span>/</span><span>${p.year}</span></div>
  <span class="lbl fade-up" style="--d:.1s"><span class="tkey t-${p.topics[0]}"></span>${D.TOPICS[p.topics[0]]} · Research article · ${esc(p.journal)}</span>
  <h1 class="display-2 fade-up" style="--d:.2s;max-width:18ch">${esc(p.title)}</h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.4s">${esc(p.summary)}</p>
  </div>
</section>
<div class="w grid pub-grid">
  <div class="pub-main">
    <div class="rv"><span class="lbl">Authors · ${p.authors.length}, Edwards ${position}${["st", "nd", "rd"][position - 1] ?? "th"}</span><p class="authors">${auth}</p></div>
    <div class="btns rv">${p.pdf ? `<a class="cta" href="${LIVE}${p.pdf}">Read the PDF ${arrow}</a>` : ""}<a class="cta ghost" href="https://doi.org/${p.doi}" rel="noopener">doi.org ${ext()}</a>${p.pmcUrl ? `<a class="cta ghost" href="${p.pmcUrl}" rel="noopener">PubMed Central ${ext()}</a>` : ""}</div>
    <div class="sec rv" style="padding-top:72px"><div style="border-top:1px solid var(--rule-2);padding-top:16px"><span class="lbl">Abstract</span><p class="abstract">${esc(p.abstract)}</p></div></div>
    <div class="sec rv" style="padding-top:72px"><span class="lbl">Cite</span>
      <div class="cite"><div class="tabs" role="tablist"><button role="tab" aria-selected="true">APA</button><button role="tab" aria-selected="false">BibTeX</button><button class="copy">Copy</button></div><pre>${esc(apa)}</pre><pre hidden>${esc(bib)}</pre></div>
    </div>
    ${p.citing.length ? `<div class="sec rv" style="padding-top:72px"><span class="lbl">Recently cited by · newest 6 of ${p.citedBy}, from OpenAlex</span><ul class="citing">${p.citing.slice(0, 6).map((c) => `<li><a href="https://doi.org/${esc(c.doi)}" rel="noopener"><span>${c.year}</span><span style="font:inherit;color:inherit;padding:0">${esc(c.title)}<small>${esc(c.venue)}</small></span></a></li>`).join("")}</ul></div>` : ""}
  </div>
  <aside class="pub-side rv">
    ${p.citedBy != null ? `<div class="big-num" data-count="${p.citedBy}">0</div><p style="margin:10px 0 32px;color:var(--ink-2);font-size:14px">citations, OpenAlex, read ${esc(D.citedByFetchedAt)}</p>` : ""}
    <dl class="kv">
      <div><dt>Journal</dt><dd>${esc(p.journal)}</dd></div>
      <div><dt>Published</dt><dd>${p.date ? longDate(p.date) : p.year}</dd></div>
      <div><dt>Volume</dt><dd>${esc(p.volume)}, issue ${esc(p.issue)}${pagesStr ? `, ${esc(pagesStr)}` : ""}</dd></div>
      <div><dt>DOI</dt><dd><a href="https://doi.org/${p.doi}">${esc(p.doi)}</a></dd></div>
      ${p.pmid ? `<div><dt>PMID</dt><dd><a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/">${p.pmid}</a></dd></div>` : ""}
      ${p.pmcid ? `<div><dt>PMCID</dt><dd><a href="${p.pmcUrl}">${p.pmcid}</a></dd></div>` : ""}
      <div><dt>Access</dt><dd>${p.openAccess ? "Open access" : "Subscription"}${p.license ? `, ${esc(p.license.replace("-", " "))}` : ""}</dd></div>
      <div><dt>Area</dt><dd>${p.topics.map((t) => D.TOPICS[t]).join(", ")}</dd></div>
    </dl>
  </aside>
</div>
<section class="sec w">
  ${sh("+", "Related", `More on ${D.TOPICS[p.topics[0]].toLowerCase()}.`)}
  <ul class="pubs rv">${related.map(pubItem).join("")}</ul>
</section>`;
  return layout({ title: `${p.title} · Dustin Edwards`, description: p.summary, active: "/research", body });
}

// =====================================================================
// SOFTWARE
// =====================================================================
function software() {
  const lede = strip(PAGES.software.body.split("\n\n")[0]);
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><span>Software</span></div>
  <h1 class="display split"><span class="ln">${splitLetters("Software")}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.4s">Products, sites and the <em>infrastructure</em> under them, built solo on Cloudflare. Each product has a short page that links out rather than replacing the product's own site.</p>
    <div class="fade-up" style="--d:.55s"><span class="lbl">Groups</span><p>${softwareGroups.map((g) => `<a class="ul" href="#${g.group.toLowerCase()}">${g.group}</a> <span class="muted m">${g.items.length}</span>`).join("<br>")}</p></div>
    <div class="fade-up" style="--d:.65s"><span class="lbl">Lab tools</span><p>The phage calculators live <a class="ul" href="${href("/research#methods")}">under Research</a>.</p></div>
  </div>
</section>
<section class="sec w">
${softwareGroups.map((g) => `<div class="sw-group" id="${g.group.toLowerCase()}"><span class="lbl">${g.group} · ${g.items.length}</span>${g.items.map(swRow).join("")}</div>`).join("")}
</section>
<section class="w">
  <div class="rv" style="border-top:1px solid var(--rule-2);padding-top:22px">
    <span class="lbl">And this site</span>
    <p class="display-3" style="max-width:24ch">This site has no page here. It is the working example: a Worker, a SQLite database, an object store and a search index. <a class="ul sig" href="${LIVE}/colophon">Read the colophon ${arrow}</a></p>
  </div>
</section>`;
  return layout({ title: "Software · Dustin Edwards", description: PAGES.software.data.description, active: "/software", body });
}

function product() {
  const proj = PROJECTS.find((p) => p.slug === PRODUCT_SLUG);
  const page = PAGES[`software-${PRODUCT_SLUG}`];
  const all = softwareGroups.flatMap((g) => g.items).filter((i) => i.path);
  const idx = all.findIndex((i) => i.slug === PRODUCT_SLUG);
  const prev = all[(idx - 1 + all.length) % all.length], next = all[(idx + 1) % all.length];
  const section = /## (.+)\n\n([\s\S]+)/.exec(page.body);
  const body = `
<section class="prod-hero w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><a href="${href("/software")}">Software</a><span>/</span><span>Products</span></div>
  <h1 class="display split"><span class="ln">${splitLetters(proj.name)}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.45s">${esc(proj.oneLiner)}</p>
    <div class="fade-up" style="--d:.6s;grid-column:9 / span 4"><span class="lbl">Status</span><p><span class="sig">&#9679;</span> ${proj.status === "live" ? "Live" : esc(proj.status)} at <a class="ul" href="${proj.url}">${host(proj.url)}</a></p><div class="btns" style="margin-top:20px"><a class="cta" href="${proj.url}" rel="noopener">Open ${host(proj.url)} ${ext()}</a></div></div>
  </div>
</section>
<section class="sec w">
  <div class="grid" style="row-gap:48px;align-items:end">
    <div class="metric rv" style="grid-column:span 5"><b><span data-count="${parseInt(proj.metric.value)}">0</span>${esc(proj.metric.value.replace(/^[\d,.]+/, ""))}</b><span>${esc(proj.metric.label[0].toUpperCase() + proj.metric.label.slice(1))}, read from the product on ${longDate(proj.metric.asOf)}.</span></div>
    <div class="rv" style="grid-column:7 / span 6"><span class="lbl">${esc(section[1])}</span><p class="lede" style="font-size:clamp(20px,1.9vw,26px)">${esc(strip(section[2]).replace(/\s+/g, " ").trim())}</p></div>
  </div>
</section>
<section class="sec w">
  ${sh("01", "How it works", esc(proj.description))}
  <ol class="notable rv">${proj.notable.map((n) => `<li><p>${esc(n)}</p></li>`).join("")}</ol>
</section>
<section class="sec w">
  <div class="facts rv">
    <div><span class="lbl">Role</span><p>${esc(proj.role)}</p></div>
    <div><span class="lbl">Type</span><p>${esc((page.data.application_category ?? proj.schemaType).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/ A/, " a"))}</p></div>
    <div><span class="lbl">Address</span><p><a class="ul" href="${proj.url}">${host(proj.url)}</a></p></div>
    <div><span class="lbl">Stack</span><div class="tags" style="margin-top:0">${proj.stack.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div></div>
  </div>
</section>
<section class="sec w">
  <div class="pager rv"><a href="${href(prev.path)}"><span class="lbl">Previous</span><b>${esc(prev.name)}</b></a><a href="${href(next.path)}"><span class="lbl">Next</span><b>${esc(next.name)}</b></a></div>
</section>`;
  return layout({ title: `${proj.name} · Software · Dustin Edwards`, description: page.data.description, active: "/software", body });
}

// =====================================================================
// WRITING
// =====================================================================
function writing() {
  const series = POSTS.filter((p) => p.series === "Carrel").sort((a, b) => a.part - b.part);
  const tags = [...new Set(POSTS.flatMap((p) => p.tags))].map((t) => [t, POSTS.filter((p) => p.tags.includes(t)).length]).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalWords = POSTS.reduce((s, p) => s + p.words, 0);
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><span>Writing</span></div>
  <h1 class="display split"><span class="ln">${splitLetters("Writing")}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.4s">Writing on building for the web, mostly on <em>Cloudflare</em>. Written like papers: what was measured, what worked, what failed and why.</p>
    <div class="fade-up" style="--d:.55s"><span class="lbl">Articles</span><p><b style="font-size:28px;font-weight:500;letter-spacing:-.04em">${N.posts}</b></p></div>
    <div class="fade-up" style="--d:.65s"><span class="lbl">Reading time, all of it</span><p><b style="font-size:28px;font-weight:500;letter-spacing:-.04em">${Math.round(minutes(totalWords) / 6) / 10} h</b></p></div>
  </div>
</section>
<section class="sec w" id="series">
  <div class="series-card rv">
    <div><span class="lbl">A series in ${series.length} parts · ${fmtDate(series[0].date)}</span><h3>Carrel</h3><p style="margin:20px 0 0;opacity:.7;max-width:36ch">${esc(PAGES["software-carrel"].data.description)}</p></div>
    <ol>${series.map((p) => `<li><a href="${href(`/writing/${p.slug}`)}"><span>0${p.part}</span><span style="font:inherit;opacity:1;padding:0"><b>${esc(cap(p.title.replace(/^Carrel, part \d: /, "")))}</b><small>${minutes(p.words)} min read</small></span></a></li>`).join("")}</ol>
  </div>
</section>
<section class="sec w" style="padding-top:clamp(56px,7vw,96px)">
  <div class="toolbar" style="margin:0 0 0"><button data-tag="all" aria-pressed="true">All<sup>${N.posts}</sup></button>${tags.map(([t, n]) => `<button data-tag="${t}" aria-pressed="false">${t}<sup>${n}</sup></button>`).join("")}</div>
  <ul class="posts" id="postlist" style="border-top:0">${POSTS.map(postItem).join("")}</ul>
</section>`;
  return layout({ title: "Writing · Dustin Edwards", description: "Writing on building for the web, mostly on Cloudflare.", active: "/writing", body });
}

function article() {
  const p = POSTS.find((x) => x.slug === POST_SLUG);
  const heads = [];
  const html = md(p.body, heads);
  const series = POSTS.filter((x) => x.series === p.series).sort((a, b) => a.part - b.part);
  const next = series.find((x) => x.part === p.part + 1);
  const [kicker, rest] = p.title.split(": ");
  const body = `
<div class="progress" aria-hidden="true"></div>
<section class="art-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><a href="${href("/writing")}">Writing</a><span>/</span><a href="${href("/writing#series")}">${esc(p.series)}</a></div>
  <span class="lbl fade-up" style="--d:.1s">${esc(kicker)}</span>
  <h1 class="display-2 fade-up" style="--d:.2s">${esc(cap(rest))}</h1>
  <p class="lede fade-up" style="--d:.35s;max-width:46ch;margin-top:28px;color:var(--ink-2)">${esc(p.description)}</p>
  <div class="art-meta fade-up" style="--d:.5s"><span><b>Published</b>${longDate(p.date)}</span><span><b>Reading</b>${minutes(p.words)} minutes, ${p.words.toLocaleString("en-US")} words</span><span><b>Series</b>${esc(p.series)}, part ${p.part} of ${series.length}</span><span><b>Tags</b>${p.tags.join(", ")}</span></div>
</section>
<div class="w grid art">
  <aside><span class="lbl">Contents</span><ol class="toc">${heads.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ol>
    <span class="lbl">The series</span><ol class="toc">${series.map((s) => `<li><a ${s.slug === p.slug ? 'class="on" ' : ""}href="${href(`/writing/${s.slug}`)}">${s.part}. ${esc(cap(s.title.replace(/^Carrel, part \d: /, "")))}</a></li>`).join("")}</ol></aside>
  <article class="prose">${html}</article>
  <div class="side-r"><div class="take"><span class="lbl">Key takeaways</span><ol>${p.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>${p.audience ? `<p class="aud"><span class="lbl">Written for</span>${esc(p.audience)}</p>` : ""}</div>
</div>
${next ? `<section class="w series-nav"><div class="pager rv" style="grid-template-columns:1fr"><a href="${href(`/writing/${next.slug}`)}" style="text-align:left"><span class="lbl">Next in ${esc(p.series)} · part ${next.part}</span><b style="font-size:clamp(36px,6vw,96px)">${esc(cap(next.title.replace(/^Carrel, part \d: /, "")))} ${arrow}</b></a></div></section>` : ""}`;
  return layout({ title: `${p.title} · Dustin Edwards`, description: p.description, active: "/writing", body });
}

// =====================================================================
// CV
// =====================================================================
function cvPage() {
  const ap = CV.appointments.entries;
  const span = (e) => `${e.year}${e.endYear ? (e.endYear === "present" ? " to now" : e.endYear !== e.year ? " to " + e.endYear : "") : ""}`;
  const row = (y, t, s, amt = "", now = false) => `<li><span class="yr${now ? " now" : ""}">${esc(y)}</span><div><b>${esc(t)}</b>${s ? `<small>${esc(s)}</small>` : ""}</div><span class="amt">${amt}</span></li>`;
  const grants = CV.grants.entries;
  const gTotal = grants.reduce((s, g) => s + (g.amount || 0), 0);
  const gYears = [...new Set(grants.map((g) => g.year))].sort();
  const allY = []; for (let y = gYears[0]; y <= gYears.at(-1); y++) allY.push(y);
  const gBy = allY.map((y) => [y, grants.filter((g) => g.year === y).reduce((s, g) => s + (g.amount || 0), 0)]);
  const gMax = Math.max(...gBy.map(([, v]) => v));
  const money = (n) => "$" + n.toLocaleString("en-US");
  const mentoring = CV.mentoring.entries.filter((e) => e.unit === "students").reduce((s, e) => s + (e.count || 0), 0);
  const svc = CV.service.entries;
  const svcBy = [...new Set(svc.map((s) => s.section))].map((s) => [s, svc.filter((x) => x.section === s).length]);
  const cvPubs = CV.publications.entries.length;
  const sections = [["positions", "Positions"], ["leadership", "Leadership"], ["education", "Education"], ["honors", "Honors"], ["grants", "Grants"], ["publications", "Publications"], ["presentations", "Presentations"], ["teaching", "Teaching"], ["service", "Service and mentoring"]];
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><span>CV</span></div>
  <h1 class="display split"><span class="ln">${splitLetters("Curriculum")}</span><span class="ln">${splitLetters("vitae", 10)}</span></h1>
  <div class="grid head-meta">
    <p class="lede fade-up" style="--d:.45s">${esc(ID.name)}, ${esc(ID.degree)} ${esc(ID.rank)} and ${esc(ID.discipline)}, ${esc(ID.adminTitle)}. ${esc(ID.department)}, ${esc(ID.org)}.</p>
    <div class="fade-up" style="--d:.6s"><span class="lbl">Edition</span><p>${esc(CV.profile.edition)}</p></div>
    <div class="fade-up" style="--d:.7s"><span class="lbl">Download</span><p><a class="ul" href="${LIVE}/cv.pdf">PDF ${arrow}</a></p></div>
  </div>
  <div class="grid figs fade-up" style="--d:.85s">
    <div class="fig"><b data-count="${cvPubs}">0</b><span>publications on the CV</span></div>
    <div class="fig"><b data-count="${presentations}">0</b><span>presentations, ${CV.profile.presentations.from} to ${CV.profile.presentations.to}</span></div>
    <div class="fig"><b data-count="${Math.round(gTotal / 1000)}">0</b><span>thousand dollars in ${grants.length} grants</span></div>
    <div class="fig"><b data-count="${mentoring}">0</b><span>students mentored in labs and research courses</span></div>
  </div>
</section>
<div class="w grid cv-grid">
  <nav class="cv-nav" aria-label="CV sections">${sections.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</nav>
  <div class="cv-main">
    <section class="cv-sec" id="positions"><h2>Positions <small>${ap.filter((e) => e.section === "Positions").length}</small></h2><ul class="rows">${ap.filter((e) => e.section === "Positions").map((e) => row(span(e), e.title, e.org, "", e.endYear === "present")).join("")}</ul></section>
    <section class="cv-sec" id="leadership"><h2>Leadership <small>${ap.filter((e) => e.section !== "Positions").length}</small></h2><ul class="rows">${ap.filter((e) => e.section !== "Positions").map((e) => row(span(e), e.title, e.org, "", e.endYear === "present")).join("")}</ul></section>
    <section class="cv-sec" id="education"><h2>Education</h2><ul class="rows">${CV.education.entries.map((e) => row(String(e.year), e.title, `${e.org}${e.detail ? ". " + e.detail.split(". Advisor")[0] : ""}`)).join("")}</ul></section>
    <section class="cv-sec" id="honors"><h2>Honors <small>${CV.honors.entries.length}</small></h2><ul class="rows">${CV.honors.entries.map((e) => row(span(e), e.title, [e.org, e.place].filter(Boolean).join(", "))).join("")}</ul></section>
    <section class="cv-sec rv" id="grants"><h2>Grants <small>${money(gTotal)} in ${grants.length}</small></h2>
      <div class="bars">${gBy.map(([y, v], i) => `<div><s style="--h:${Math.max(1, (v / gMax) * 100).toFixed(1)}%;--i:${i}"></s><i>${money(v)}</i>${y % 2 === 0 ? `<em>${String(y).slice(2)}</em>` : ""}</div>`).join("")}</div>
      <ul class="rows">${grants.filter((g) => g.amount >= 10000).map((g) => row(String(g.year), g.title, [g.funder, g.note].filter(Boolean).join(", "), money(g.amount))).join("")}</ul>
      <p class="count-line">Showing the ${grants.filter((g) => g.amount >= 10000).length} awards of $10,000 or more. The PDF lists all ${grants.length}.</p></section>
    <section class="cv-sec" id="publications"><h2>Publications <small>${cvPubs}</small></h2><ul class="rows">${PUBS.slice(0, 12).map((p) => `<li><span class="yr">${p.year}</span><div><b><a class="ul" href="${pubHref(p)}">${esc(p.title)}</a></b><small>${esc(p.journal)}</small></div><span class="amt">${p.citedBy ? p.citedBy + " cited" : ""}</span></li>`).join("")}</ul><p style="margin-top:18px"><a class="ul" style="font-weight:600" href="${href("/research#papers")}">All publications, with a sentence each ${arrow}</a></p></section>
    <section class="cv-sec" id="presentations"><h2>Presentations <small>${presentations}</small></h2>
      <div class="stat-row"><div><b>${CV.profile.presentations.international}</b><span>international</span></div><div><b>${CV.profile.presentations.national}</b><span>national</span></div><div><b>${CV.talks.entries.length}</b><span>invited talks and seminars</span></div></div>
      <ul class="rows">${CV.talks.entries.map((t) => row(String(t.year), t.title, t.venue)).join("")}</ul></section>
    <section class="cv-sec" id="teaching"><h2>Teaching <small>${CV.courses.entries.length} courses</small></h2><ul class="rows">${CV.courses.entries.map((c) => row(c.term ?? span(c), c.title, c.code, "", c.endYear === "present")).join("")}</ul></section>
    <section class="cv-sec" id="service"><h2>Service and mentoring <small>${svc.length} roles</small></h2>
      <div class="stat-row">${svcBy.slice(0, 3).map(([s, n]) => `<div><b>${n}</b><span>${esc(s)}</span></div>`).join("")}</div>
      <ul class="rows">${svc.filter((s) => s.endYear === "present").slice(0, 10).map((s) => row(span(s), s.title, s.section, "", true)).join("")}</ul></section>
  </div>
</div>`;
  return layout({ title: "CV · Dustin Edwards", description: `${ID.name}, curriculum vitae, ${CV.profile.edition}.`, active: "/cv", body });
}

// =====================================================================
// ABOUT
// =====================================================================
function about() {
  const paras = D.resolveTemplate(PAGES.about.body).trim().split(/\n\n+/).filter((p) => !/mailto:|reach me/i.test(p));
  const [first, ...rest] = paras;
  const body = `
<section class="page-head w">
  <div class="crumb"><a href="/">Dustin Edwards</a><span>/</span><span>About</span></div>
  <h1 class="display split"><span class="ln">${splitLetters("About")}</span></h1>
</section>
<section class="w grid" style="margin-top:clamp(48px,6vw,96px);align-items:start;row-gap:56px">
  <div style="grid-column:span 4" class="fade-up"><div class="mark-wrap">${logo("mark-big")}<p class="m muted" style="margin-top:18px">The mark: a microscope, drawn in eight shapes.</p></div></div>
  <div style="grid-column:6 / span 7">
    <div class="about-body fade-up" style="--d:.3s">${[first, ...rest].map((p) => markedFor().parse(p.replace(/\n/g, " "))).join("")}</div>
    <div class="facts rv" style="margin-top:72px">
      <div><span class="lbl">Role</span><p>${esc(ID.rank)}, ${esc(ID.adminTitle)}</p></div>
      <div><span class="lbl">Field</span><p>${esc(ID.discipline)}</p></div>
      <div><span class="lbl">At</span><p>${esc(ID.affiliation)}</p></div>
      <div><span class="lbl">Since</span><p>${ID.joined}</p></div>
    </div>
    <div class="rv" style="margin-top:72px"><span class="lbl">Elsewhere</span><ul class="profiles">${PROFILES.map(([l, u]) => `<li><a href="${u}" rel="noopener"><span>${l}</span><small>${host(u).split("/")[0]} ${ext()}</small></a></li>`).join("")}</ul></div>
  </div>
</section>
<style>@media (max-width:900px){.page-head + .grid > div{grid-column:span 12 !important}.mark-big{max-width:160px}.mark-wrap{position:static}}</style>`;
  return layout({ title: "About · Dustin Edwards", description: D.resolveTemplate(PAGES.about.data.description), active: "/about", body });
}

// ---------- write ----------
rmSync(OUT, { recursive: true, force: true });
const write = (p, html) => { const dir = join(OUT, p); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "index.html"), html); };
write("", home());
write("research", research());
write(`research/publications/${PUB_SLUG}`, publication());
write("software", software());
write(`software/${PRODUCT_SLUG}`, product());
write("writing", writing());
write(`writing/${POST_SLUG}`, article());
write("cv", cvPage());
write("about", about());
copyFileSync(join(HERE, "src", "site.css"), join(OUT, "site.css"));
// Fonts are self-hosted from the OFL-licensed Fontsource packages: no request leaves the page.
for (const pkg of FONT_PKGS) cpSync(join(HERE, "node_modules", "@fontsource-variable", pkg), join(OUT, "fonts", pkg), { recursive: true, filter: (f) => !/scss|\.md$|\.ts$/.test(f) });
copyFileSync(join(HERE, "src", "site.js"), join(OUT, "site.js"));
copyFileSync(join(HERE, "..", "public", "dustin-edwards-favicon.svg"), join(OUT, "favicon.svg"));
console.log(`built ${LOCAL.size} pages into ${OUT}`);
