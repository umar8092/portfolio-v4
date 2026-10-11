import { PROJECTS, CATALOG, LOGO, APPS_SNAPSHOT } from "./data.js";
import { icon } from "./icons.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const narrow = () => innerWidth < 980;
const BOOK = "https://cal.com/muhammad-umar-8092/15min";
const CASE = id => `https://umar8092.github.io/projects/${id}/`;
const STAR = s => { let p = ""; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8 - Math.PI / 2, r = (k % 4 === 0 ? .5 : k % 2 === 0 ? .3 : .12) * s; p += `${(s / 2 + r * Math.cos(a)).toFixed(2)},${(s / 2 + r * Math.sin(a)).toFixed(2)} `; }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="currentColor" aria-hidden="true"><polygon points="${p.trim()}"/></svg>`; };
const LK = Object.keys(LOGO).filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
const logoFor = name => LOGO[key(name)] || (LK.find(k => key(name).startsWith(k)) ? LOGO[LK.find(k => key(name).startsWith(k))] : null);
const tile = (src, alt = "") => `<span class="logo-tile"><img src="${src}" alt="${esc(alt)}"></span>`;

/* ---------- smooth scroll (off for reduced motion) ---------- */
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, anchors: { offset: -76 } });
  root.classList.add("lenis");
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
}
const scrollToEl = el => { if (!el) return; if (lenis) lenis.scrollTo(el, { offset: -76 }); else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); };

/* ---------- nav: solid once the page moves, brand once the big name is gone ---------- */
const nav = $("#nav"), sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => nav.classList.toggle("solid", !e.isIntersecting)).observe(sentinel);
new IntersectionObserver(([e]) => nav.classList.toggle("brand-on", !e.isIntersecting), { rootMargin: "-68px 0px 0px 0px" }).observe($("#name"));

/* ---------- reveal on scroll (content is visible without JS) ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .1 });
$$(".rise").forEach(e => io.observe(e));

/* ---------- the sky ---------- */
let sky = null;
try {
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("no webgl");
  const { createSky } = await import("./sky.js");
  sky = createSky({ canvas: $("#sky"), ui: $("#sky-ui"), top: $("#sky-top"), catalog: CATALOG, projects: PROJECTS, logo: LOGO, reduced, coarse });
} catch (err) { root.classList.add("no-webgl"); console.warn("Sky disabled:", err.message); }

const GLYPHS = [[/signup/i, "user-plus"], [/\bai\b|agent|think/i, "sparkle"], [/web search|search/i, "globe-simple"], [/traffic/i, "chart-line-up"],
  [/crm/i, "address-book"], [/tech stack/i, "stack"], [/maps/i, "map-pin"], [/prospect/i, "target"], [/lead or company|compan/i, "buildings"],
  [/product/i, "package"], [/sync/i, "arrows-clockwise"], [/editor|template|provider/i, "envelope-simple"], [/sdk/i, "code"], [/capture/i, "lightning"],
  [/mapping/i, "arrows-left-right"], [/daily|schedule/i, "clock"], [/commit/i, "git-commit"], [/ticket/i, "ticket"], [/database/i, "database"],
  [/website/i, "browser"], [/registration|setup/i, "key"], [/permission|scope selection/i, "list-checks"], [/verification|review|domain/i, "shield-check"],
  [/verified|live app/i, "seal-check"], [/consent/i, "check-circle"], [/candidate/i, "funnel"], [/livestorm|webinar/i, "video-camera"]];
const glyphFor = name => icon((GLYPHS.find(([re]) => re.test(name)) || [, "sparkle"])[1]);
if (sky) sky.setGlyphs(glyphFor);
if (new URLSearchParams(location.search).has("debug")) window.__sky = sky; // test hook, only with ?debug

/* ---------- theme: a labelled switch, remembered ---------- */
const sw = $("#theme"), meta = document.querySelector('meta[name="theme-color"]');
function applyTheme(t, save) {
  root.dataset.theme = t; sw.setAttribute("aria-checked", t === "night");
  meta.setAttribute("content", t === "night" ? "#071F25" : "#E3ECEA");
  if (sky) sky.setTheme(t);
  if (save) try { localStorage.setItem("umar.sky.theme", t); } catch (e) {}
}
sw.addEventListener("click", () => {
  const next = root.dataset.theme === "night" ? "day" : "night", cv = $("#sky");
  if (reduced || !sky) return applyTheme(next, true);
  cv.style.transition = "opacity .28s"; cv.style.opacity = 0;
  setTimeout(() => { applyTheme(next, true); cv.style.opacity = 1; }, 280);
});
applyTheme(root.dataset.theme === "day" ? "day" : "night", false);

/* ---------- director: each section turns the dome to its own view ---------- */
const P = PROJECTS, byId = id => P.find(p => p.id === id);
let current = P[0].id, section = "hero", focused = null;
const stage = $("#stage");
function stageNdc() { const r = stage.getBoundingClientRect(); return [((r.left + r.width / 2) / innerWidth) * 2 - 1, -(((r.top + r.height / 2) / innerHeight) * 2 - 1)]; }
const VIEWS = {
  hero: () => ({ ...sky.frame(sky.constellationDir("signup"), innerWidth < 641 ? 0 : narrow() ? .2 : .4, innerWidth < 641 ? .5 : narrow() ? .45 : .36), dim: 0, cat: 1, cons: 1, drift: reduced ? 0 : .012 }),
  find: () => (focused ? { ...sky.frame(focused.dir, narrow() ? 0 : .5, narrow() ? .62 : .08), dim: .04, cat: 1, cons: .4, drift: 0 }
    : { yaw: sky.view.yaw + .9, pitch: .45, dim: .05, cat: 1, cons: .45, drift: reduced ? 0 : .006 }),
  work: () => ({ ...sky.frame(sky.constellationDir(current), 0, narrow() ? .35 : 0), dim: .62, cat: .38, cons: .14, drift: 0 }),
  platforms: () => ({ yaw: sky.view.yaw + .55, pitch: .7, dim: .5, cat: .8, cons: .28, drift: reduced ? 0 : .01 }),
  experience: () => ({ yaw: sky.view.yaw + .4, pitch: .32, dim: .5, cat: .75, cons: .35, drift: reduced ? 0 : .01 }),
  apps: () => ({ yaw: sky.view.yaw + .4, pitch: .86, dim: .5, cat: .8, cons: .28, drift: reduced ? 0 : .01 }),
  faq: () => ({ yaw: sky.view.yaw + .3, pitch: .6, dim: .66, cat: .6, cons: .3, drift: reduced ? 0 : .008 }),
  contact: () => ({ yaw: sky.view.yaw + .5, pitch: 1.36, dim: .08, cat: 1, cons: .9, drift: reduced ? 0 : .014 })
};
function go(name, dur = 1.9) {
  if (!sky) return;
  const v = VIEWS[name](), d = reduced ? 0 : dur;
  gsap.to(sky.view, { ...v, duration: d, ease: "power2.inOut", overwrite: "auto" });
}
if (sky) {
  Object.assign(sky.view, VIEWS.hero());
  sky.onPick = id => { select(id); scrollToEl($("#work")); };
  const fine = !coarse;
  ["hero", "find", "work", "platforms", "experience", "apps", "faq", "contact"].forEach(name => {
    const el = name === "hero" ? $("#top") : $("#" + name);
    ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 45%", onToggle: self => {
      if (name === "work") { if (self.isActive) { sky.setStage(stage); sizeStage(); sky.showProject(current); } else sky.hideProject(); }
      if (!self.isActive) return;
      section = name; go(name);
      sky.setInteractive(fine && (name === "hero" || name === "find"));
      sky.setDemo(name === "find" && !narrow()); sky.showTags(name === "find" || name === "hero");
      root.classList.toggle("can-drag", fine && (name === "hero" || name === "find"));
    } });
  });
}

/* ---------- find your app ---------- */
const ALL = CATALOG.flatMap((c, ci) => c.apps.map(a => ({ name: a, cat: c.cat, ci })));
const q = $("#q"), lb = $("#lb"), result = $("#result");
const inProjects = name => P.filter(p => [...(p.flow || []).flatMap(c => c.nodes), ...(p.tracks || []).flatMap(t => t.steps)].some(n => key(n[0]).startsWith(key(name)) || key(name).startsWith(key(n[0])) && key(n[0]).length > 3)
  || (p.tags || []).some(t => key(t) === key(name)));
let opts = [], act = -1;
function renderList() {
  const v = q.value.trim().toLowerCase();
  if (!v) { lb.hidden = true; q.setAttribute("aria-expanded", "false"); return; }
  opts = ALL.filter(a => a.name.toLowerCase().includes(v))
    .sort((a, b) => (b.name.toLowerCase().startsWith(v) - a.name.toLowerCase().startsWith(v)) || (!!logoFor(b.name) - !!logoFor(a.name)) || a.name.localeCompare(b.name)).slice(0, 8);
  act = opts.length ? 0 : -1;
  lb.innerHTML = opts.length ? opts.map((a, i) => { const lg = logoFor(a.name);
    return `<li role="option" id="opt-${i}" aria-selected="${i === act}" data-i="${i}">${lg ? tile(lg) : `<span class="logo-tile" style="background:none;color:var(--gold)">${STAR(16)}</span>`}<span>${esc(a.name)}</span><small>${esc(a.cat)}</small></li>`; }).join("")
    : `<li class="none" role="option" aria-disabled="true" id="opt-none">No app called "${esc(q.value.trim())}" in my sky. Press Enter to ask about it.</li>`;
  lb.hidden = false; q.setAttribute("aria-expanded", "true");
  q.setAttribute("aria-activedescendant", act >= 0 ? `opt-${act}` : "");
}
function moveAct(d) { if (!opts.length) return; act = (act + d + opts.length) % opts.length;
  $$("li", lb).forEach((li, i) => li.setAttribute("aria-selected", i === act)); q.setAttribute("aria-activedescendant", `opt-${act}`);
  $(`#opt-${act}`).scrollIntoView({ block: "nearest" }); }
function closeList() { lb.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); }
function chooseApp(a) {
  q.value = a.name; closeList(); setCat(-1, false);
  const ps = inProjects(a.name), lg = logoFor(a.name);
  result.innerHTML = `<div class="hit">${lg ? tile(lg, a.name) : `<span class="logo-tile" style="background:var(--plate);color:var(--gold)">${STAR(26)}</span>`}
    <div><h3>${esc(a.name)}</h3><p>${esc(a.cat)}. I've built, shipped or maintained an integration with ${esc(a.name)}.</p>
    ${ps.length ? `<p>It runs through ${ps.map(p => `<a href="#work" data-p="${p.id}">${esc(p.title)}</a>`).join(" and ")}.</p>` : ""}</div></div>`;
  if (sky) { focused = sky.focusApp(a.name); if (section === "find" || section === "hero") go("find", 1.6); }
}
function missApp(text) {
  closeList(); if (sky) { sky.clearFocus(); focused = null; }
  result.innerHTML = `<div class="hit miss"><div><h3>${esc(text)} is not charted yet</h3><p>If it has an API (REST, GraphQL or webhooks), I can usually connect it. Tell me what it needs to talk to.</p>
    <div class="cta" style="margin-top:16px"><a class="btn" href="${BOOK}" target="_blank" rel="noopener">${icon("calendar-blank")}Book a call</a></div></div></div>`;
}
q.addEventListener("input", renderList);
q.addEventListener("focus", () => q.value.trim() && renderList());
q.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { e.preventDefault(); if (lb.hidden) renderList(); else moveAct(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveAct(-1); }
  else if (e.key === "Enter") { e.preventDefault(); if (act >= 0 && opts[act]) chooseApp(opts[act]); else if (q.value.trim()) missApp(q.value.trim()); }
  else if (e.key === "Escape") { closeList(); }
});
lb.addEventListener("pointerdown", e => { const li = e.target.closest("li[data-i]"); if (!li) return; e.preventDefault(); chooseApp(opts[+li.dataset.i]); });
document.addEventListener("click", e => { if (!e.target.closest("#search")) closeList();
  const a = e.target.closest("a[data-p]"); if (a) { e.preventDefault(); select(a.dataset.p); scrollToEl($("#work")); } });

// categories, billed by how many apps each holds
const catBtns = CATALOG.map((c, ci) => ({ ...c, ci })).sort((a, b) => b.apps.length - a.apps.length);
$("#cats").innerHTML = catBtns.map(c => `<li><button type="button" aria-pressed="false" data-ci="${c.ci}">${esc(c.cat)}<span>${c.apps.length}</span></button></li>`).join("");
let catOn = -1;
function setCat(ci, slew = true) {
  catOn = ci; $$("#cats button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.ci === ci));
  const box = $("#catapps");
  if (ci < 0) { box.innerHTML = ""; return; }
  const c = CATALOG[ci];
  box.innerHTML = `<div class="chips">${[...c.apps].sort((a, b) => (!!logoFor(b) - !!logoFor(a)) || a.localeCompare(b)).map(a => { const lg = logoFor(a);
    return `<button type="button" class="chip${lg ? "" : " plain"}" data-app="${esc(a)}">${lg ? tile(lg) : ""}${esc(a)}</button>`; }).join("")}</div>`;
  if (sky && slew) { sky.focusCategory(ci); focused = { dir: sky.cats[ci].dir }; go("find", 1.6); result.innerHTML = ""; }
}
$("#cats").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const ci = +b.dataset.ci; setCat(catOn === ci ? -1 : ci); if (catOn < 0 && sky) { sky.clearFocus(); focused = null; } });
$("#catapps").addEventListener("click", e => { const b = e.target.closest("[data-app]"); if (!b) return; const a = ALL.find(x => x.name === b.dataset.app); if (a) chooseApp(a); });

/* ---------- work: ten constellations ---------- */
const PLAT = { n8n: ["n8n", "https://n8n.io", 116], zapier: ["Zapier", "https://zapier.com", 108], make: ["Make", "https://www.make.com", 124],
  integry: ["Integry", "https://integry.ai", 124], squig: ["Squig", "https://squig.com", 92], gohighlevel: ["GoHighLevel", "https://www.gohighlevel.com", 136] };
const platImg = k => `<span class="on"><img src="assets/platforms/${k}.webp" alt="${PLAT[k][0]}"></span>`;
const GROUPS = [["agents", "AI agents", `<img src="assets/co/squig.webp" alt="Squig" width="46" height="18">`, "2026"],
  ["integrations", "Integrations", `<span class="co"><img class="on-dark" src="assets/co/integry-dark.webp" alt="Integry" width="75" height="19"><img class="on-light" src="assets/co/integry-light.webp" alt="Integry" width="75" height="19"></span>`, "2021 - 2026"]];
$("#toc").innerHTML = GROUPS.map(([g, t, lg, yrs]) => `<div class="grp"><span class="label">${t}, ${yrs}</span>${lg}</div>
  <ol role="tablist" aria-label="${t}">${P.filter(p => p.group === g).map(p => `<li role="presentation"><button type="button" role="tab" id="tab-${p.id}" data-id="${p.id}" aria-selected="false" aria-controls="detail" tabindex="-1">
  <span class="n">${STAR(12)}</span><span>${esc(p.title)}</span>${p.on ? platImg(p.on[0]) : ""}</button></li>`).join("")}</ol>`).join("");
const tabs = $$("#toc [role=tab]");
function sizeStage() { if (!sky) return; stage.style.height = sky.neededHeight(current, stage.getBoundingClientRect().width) + "px"; ScrollTrigger.refresh(); }
function stepsOf(p) {
  if (p.flow) return p.flow.map((c, i) => ({ label: c.label || (i === 1 && p.id === "accounting" ? "Sync" : "Step"), names: c.nodes.map(n => n[0]).join(" + "), sub: c.nodes.map(n => n[1]).filter(Boolean).join("; ") }));
  return p.tracks[0].steps.map((s, si) => ({ label: `Step ${si + 1}`, names: p.tracks.map(t => t.steps[si][0]).join(" / "), sub: "" }));
}
function select(id, focusTab = false) {
  current = id; const p = byId(id);
  tabs.forEach(b => { const on = b.dataset.id === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focusTab) b.focus();
    if (on && narrow()) { const t = $("#toc"), r = b.getBoundingClientRect(), tr = t.getBoundingClientRect(); t.scrollTo({ left: t.scrollLeft + r.left - tr.left - 16, behavior: reduced ? "auto" : "smooth" }); } });
  const pl = p.on && PLAT[p.on[0]];
  $("#detail").innerHTML = `<div class="where"><span class="label">${esc(p.where)}</span>${pl ? `<span class="label">Built on</span>${platImg(p.on[0])}` : ""}</div>
    <h3>${esc(p.title)}</h3><p class="sum">${esc(p.summary)}</p>
    ${p.outcome ? `<p class="outcome">${STAR(18)}<span>${esc(p.outcome)}</span></p>` : ""}
    <div class="cols"><div><span class="label">What I built</span><ul class="built">${p.built.map(b => `<li>${STAR(12)}<span>${esc(b)}</span></li>`).join("")}</ul>
      ${p.objects ? `<span class="label" style="display:block;margin-top:22px">What stays in sync</span><div class="chips">${p.objects.map(o => `<span class="chip plain">${esc(o)}</span>`).join("")}</div>` : ""}</div>
      <div><span class="label">Tools</span><div class="chips">${p.tags.map(t => { const lg = logoFor(t); return `<span class="chip${lg ? "" : " plain"}">${lg ? tile(lg) : ""}${esc(t)}</span>`; }).join("")}</div>
      <a class="more" href="${CASE(p.id)}">Read the full case study ${icon("arrow-right")}</a></div></div>`;
  const steps = stepsOf(p);
  $("#log").innerHTML = `<div class="label"><span>Example run, step by step</span><span class="pt">${esc(p.title)}</span></div><ol>${steps.map((s, i) => `<li data-i="${i}"><i>${esc(s.label)}</i><span><b>${esc(s.names)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ""}</span></li>`).join("")}</ol>`;
  if (reduced || !sky) $$("#log li").forEach(li => li.classList.add("in"));
  if (sky) { sizeStage(); if (section === "work") { sky.showProject(id); go("work", 1.4); } }
}
if (sky) sky.onColumn((id, ci) => { if (id !== current) return; $$("#log li").forEach(li => li.classList.toggle("in", +li.dataset.i <= ci)); });
$("#toc").addEventListener("click", e => { const b = e.target.closest("[role=tab]"); if (b) select(b.dataset.id); });
$("#toc").addEventListener("keydown", e => {
  if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
  e.preventDefault(); const i = tabs.findIndex(b => b.dataset.id === current);
  const n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (/Down|Right/.test(e.key) ? 1 : -1) + tabs.length) % tabs.length;
  select(tabs[n].dataset.id, true);
});
select(current);
addEventListener("resize", () => { if (sky) sizeStage(); });

/* ---------- platforms, ranked by case studies ---------- */
const used = k => P.filter(p => (p.on || []).includes(k));
const ranked = Object.keys(PLAT).sort((a, b) => used(b).length - used(a).length);
$("#plats").innerHTML = ranked.map(k => { const n = used(k).length;
  return `<a class="pcard" href="${n ? "#work" : PLAT[k][1]}" ${n ? `data-pf="${k}"` : 'target="_blank" rel="noopener"'} aria-label="${PLAT[k][0]}${n ? `, ${n} case studies` : ", also used"}">
  <img src="assets/platforms/${k}.webp" alt="" style="--w:${PLAT[k][2]}"><span class="cap">${n ? `<b>${n}</b> case studies` : "Also used"}</span></a>`; }).join("");
$("#plats").addEventListener("click", e => { const c = e.target.closest("[data-pf]"); if (!c) return; e.preventDefault(); select(used(c.dataset.pf)[0].id); scrollToEl($("#work")); });
$("#plats").addEventListener("pointermove", e => { const c = e.target.closest(".pcard"); if (!c) return; const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); });

/* ---------- experience along the ecliptic ---------- */
function drawArc() {
  const box = $("#arc"), w = box.clientWidth, h = box.clientHeight; if (!w) return;
  const y0 = 2021.4, y1 = 2026.75, X = y => 14 + (y - y0) / (y1 - y0) * (w - 28);
  const curve = x => { const t = (x - 14) / (w - 28); return h * .78 - Math.sin(t * Math.PI) * h * .5; };
  const pathFor = (a, b, lift = 0) => { let d = ""; for (let i = 0; i <= 40; i++) { const x = X(a + (b - a) * i / 40); d += `${i ? "L" : "M"}${x.toFixed(1)},${(curve(x) - lift).toFixed(1)}`; } return d; };
  const roles = $$("#roles .job").map((r, i) => ({ from: +r.dataset.from, to: +r.dataset.to, lift: +(r.dataset.lane || 0), now: r.classList.contains("now"), i }));
  let s = `<path d="${pathFor(y0, y1)}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  for (let y = 2021; y <= 2026; y++) { if (y < y0) continue; const x = X(y), c = curve(x);
    s += `<line x1="${x}" y1="${c - 6}" x2="${x}" y2="${c + 6}" stroke="var(--gold)" stroke-width="1"/><text class="yr" x="${x}" y="${c + 24}" text-anchor="middle">${y}</text>`; }
  roles.forEach(r => { const lift = r.lift;
    if (r.to - r.from < .05) { const x = X(r.from), c = curve(x) - lift; s += `<circle cx="${x}" cy="${c}" r="4" fill="var(--gold)"/>`; return; }
    s += `<path class="span" d="${pathFor(r.from, r.to, lift)}" fill="none" stroke="var(--gold)" stroke-width="${r.now ? 3 : 2}" stroke-linecap="round" opacity="${r.now ? 1 : .8}"/>`;
    [r.from, r.to].forEach(y => { const x = X(y), c = curve(x) - lift; s += `<circle cx="${x}" cy="${c}" r="3" fill="var(--bg)" stroke="var(--gold)" stroke-width="1.5"/>`; });
  });
  box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${s}</svg>`;
}
drawArc(); addEventListener("resize", drawArc);

/* ---------- free apps: live from the apps hub, snapshot as fallback ---------- */
function renderApps(list) {
  $("#app-count").textContent = list.length;
  $("#applist").innerHTML = [...list].reverse().slice(0, 8).map(a => `<li><a class="app plate" href="https://umar8092.github.io/apps/${encodeURIComponent(a.slug)}/"><img src="https://umar8092.github.io/apps/${encodeURIComponent(a.slug)}/favicon.svg" alt="" width="52" height="52" loading="lazy"><span><b>${esc(a.name)}</b><small>${esc(a.description || "")}</small></span></a></li>`).join("");
}
fetch("https://umar8092.github.io/apps/apps.json", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject())
  .then(list => { if (Array.isArray(list) && list.length >= APPS_SNAPSHOT.length - 2) renderApps(list.filter(a => a && a.slug && a.name)); })
  .catch(() => {});

/* ---------- start ---------- */
document.fonts && document.fonts.ready.then(() => { ScrollTrigger.refresh(); drawArc(); });
