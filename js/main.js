import { APP_VERSION, BASEMAP_STYLE, TILE_URL, TILE_ZOOM, BOUNDS, START } from "./config.js";
import { compile, score, classify, colorize, describe, lngLatToTilePixel, isInSeason } from "./habitat.js";
import { LANGS, T, pickLang } from "./i18n.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

$("version").textContent = "v" + APP_VERSION;

let lang = pickLang(new URLSearchParams(location.search).get("lang") || store.get("pilz.lang"), navigator.languages || [navigator.language]);
let t = T[lang];

// fail soft if the map library did not load: say so instead of a blank screen
if (typeof maplibregl === "undefined") {
  $("card").innerHTML = `<p>${esc(t.libFail)}</p>`;
  throw new Error("maplibregl missing");
}

const [cfg, validation] = await Promise.all([
  fetch("data/species.json?v=" + APP_VERSION).then((r) => r.json()),
  fetch("data/validation.json?v=" + APP_VERSION).then((r) => (r.ok ? r.json() : null)).catch(() => null),
]);
const species = cfg.species;
const compiled = Object.fromEntries(species.map((s) => [s.id, compile(s)]));
const month = new Date().getMonth() + 1;
let current = species.find((s) => s.id === new URLSearchParams(location.search).get("s"))
  || species.find((s) => s.id === store.get("pilz.species")) || species[0];

// ---------- code tiles: fetch once, decode exactly, cache ----------
const codeCache = new Map();
const CACHE_MAX = 400;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}

async function loadCodes(z, x, y, signal) {
  const key = `${z}/${x}/${y}`;
  if (codeCache.has(key)) return codeCache.get(key);
  const p = (async () => {
    const res = await fetch(TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y), { signal });
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const c = makeCanvas(256, 256);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, 256, 256).data;
  })();
  codeCache.set(key, p);
  if (codeCache.size > CACHE_MAX) codeCache.delete(codeCache.keys().next().value);
  p.catch(() => codeCache.delete(key));
  return p;
}

let emptyPng;
async function transparentPng() {
  if (!emptyPng) {
    const c = makeCanvas(1, 1);
    const blob = c.convertToBlob ? await c.convertToBlob() : await new Promise((r) => c.toBlob(r));
    emptyPng = await blob.arrayBuffer();
  }
  return emptyPng;
}

maplibregl.addProtocol("pilz", async (params, abort) => {
  const m = params.url.match(/^pilz:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/);
  const sp = compiled[m[1]];
  const codes = await loadCodes(+m[2], +m[3], +m[4], abort.signal);
  if (!codes || !sp) return { data: await transparentPng() };
  const out = new ImageData(256, 256);
  colorize(codes, out.data, sp, cfg.classes);
  const c = makeCanvas(256, 256);
  c.getContext("2d").putImageData(out, 0, 0);
  const blob = c.convertToBlob ? await c.convertToBlob({ type: "image/png" }) : await new Promise((r) => c.toBlob(r));
  return { data: await blob.arrayBuffer() };
});

// ---------- map ----------
const ATTRIB = [
  'Baumarten © <a href="https://doi.org/10.15489/smh8w3j8i962" target="_blank">DLR</a> (CC BY 4.0)',
  'Standortskarte © Landesbetrieb Forst Brandenburg (dl-de/by-2.0), Berliner Forsten (dl-de/zero-2.0)',
  'Schutzgebiete © LfU Brandenburg (dl-de/by-2.0), Land Berlin',
  "Basemap © OpenFreeMap © OpenMapTiles © OpenStreetMap",
].join(" · ");

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: START.center, zoom: START.zoom, minZoom: 6.5, maxZoom: 16,
  maxBounds: [[BOUNDS[0] - 1.5, BOUNDS[1] - 1], [BOUNDS[2] + 1.5, BOUNDS[3] + 1]],
  hash: "map", attributionControl: false,
});
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIB }), "bottom-right");
// compact attribution starts expanded on small screens: collapse it, the (i) reopens it
map.once("idle", () => document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");

const tilesFor = (sp) => [`pilz://${sp.id}/{z}/{x}/{y}`];

function addHabitat() {
  if (map.getSource("hab")) return;
  // below roads and paths (field use: trails must stay visible), else below labels
  const layers = map.getStyle().layers;
  const firstLabel = (layers.find((l) => l["source-layer"] === "transportation") || layers.find((l) => l.type === "symbol"))?.id;
  map.addSource("hab", { type: "raster", tiles: tilesFor(current), tileSize: 256,
    minzoom: TILE_ZOOM.min, maxzoom: TILE_ZOOM.max, bounds: BOUNDS });
  map.addLayer({ id: "hab", type: "raster", source: "hab",
    paint: { "raster-resampling": "nearest", "raster-opacity": 0.85, "raster-fade-duration": 0 } }, firstLabel);
}
map.on("load", addHabitat);
// basemap failed (offline / blocked): keep a plain background so the habitat layer still shows
map.on("error", (e) => {
  if (!map.isStyleLoaded() && !map.getSource("hab")) {
    map.setStyle({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eceee6" } }] });
    map.once("styledata", addHabitat);
  }
  console.warn(e.error || e);
});

// ---------- species UI ----------
const nameOf = (s) => s.name[lang];

// Headline quality = out-of-sample (spatially cross-validated) AUC of the model in use.
function cvAuc(v) {
  const cv = v?.cv;
  if (!cv || cv.cv_auc_prior === undefined) return null;
  return cv.used === "calibrated" ? cv.cv_auc_calibrated : cv.cv_auc_prior;
}

function validationBadge(sp) {
  const v = validation?.species?.[sp.id];
  if (!v) return "";
  const a = cvAuc(v);
  if (a === null) return `<span class="badge warn">${esc(t.unvalidated(v.n))}</span>`;
  const label = t.quality[a >= 0.7 ? 2 : a >= 0.6 ? 1 : 0];
  return `<span class="badge ${a >= 0.7 ? "ok" : "warn"}">${esc(t.accuracy(label, a.toFixed(2), v.cv.n))}</span>`;
}

function renderLang() {
  $("lang").innerHTML = LANGS.map((l) =>
    `<button data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`).join("");
}

function renderChips() {
  $("chips").innerHTML = species.map((s) => {
    const on = isInSeason(s, month);
    return `<button class="chip" role="tab" data-id="${esc(s.id)}" aria-selected="${s.id === current.id}">
      <span class="dot ${on ? "" : "off"}" title="${esc(on ? t.inSeason : t.outSeason)}"></span>${esc(nameOf(s))}
    </button>`;
  }).join("");
}

function renderCard() {
  const s = current;
  const others = ["de", "en", "fr"].filter((l) => l !== lang).map((l) => s.name[l]).filter((n) => n !== nameOf(s));
  $("card").innerHTML = `
    <h2>${esc(nameOf(s))}</h2><div class="sci">${esc(s.sci)}${others.length ? " · " + esc([...new Set(others)].join(" · ")) : ""}</div>
    <div class="badges">
      <span class="badge">${esc(t.season(t.months[s.season[0]], t.months[s.season[1]]))}</span>
      ${s.protected ? `<span class="badge legal">${esc(t.protectedBadge)}</span>` : ""}
      ${validationBadge(s)}
    </div>
    <p>${esc(s.notes[lang])}</p>`;
}

function renderStatic() {
  document.documentElement.lang = lang;
  $("legend").innerHTML = ["sw-3", "sw-2", "sw-1", "sw-nsg"].map((c, i) => `<span><i class="sw ${c}"></i>${esc(t.legend[i])}</span>`).join("");
  $("close-btn").textContent = t.close;
  $("info-btn").setAttribute("aria-label", t.infoLabel);
  $("map").setAttribute("aria-label", t.mapLabel);
  $("chips").setAttribute("aria-label", t.speciesLabel);
  $("lang").setAttribute("aria-label", t.langLabel);
}

function renderAll() { renderLang(); renderStatic(); renderChips(); renderCard(); }

function setUrlParam(k, v) {
  const u = new URL(location.href); u.searchParams.set(k, v); history.replaceState(null, "", u);
}

function select(id) {
  current = species.find((s) => s.id === id) || current;
  store.set("pilz.species", current.id);
  setUrlParam("s", current.id);
  renderChips(); renderCard();
  map.getSource("hab")?.setTiles(tilesFor(current));
}

function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l; t = T[l];
  store.set("pilz.lang", l);
  setUrlParam("lang", l);
  document.querySelectorAll(".maplibregl-popup").forEach((p) => p.remove());
  renderAll();
  if ($("info").open) $("info-body").innerHTML = infoHtml();
}

$("chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (b) select(b.dataset.id);
});
$("lang").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-lang]");
  if (b) setLang(b.dataset.lang);
});
renderAll();
document.querySelector(`.chip[aria-selected="true"]`)?.scrollIntoView({ inline: "center", block: "nearest" });

// ---------- click inspection ----------
map.on("click", async (e) => {
  const z = TILE_ZOOM.max;
  const { tx, ty, px, py } = lngLatToTilePixel(e.lngLat.lng, e.lngLat.lat, z);
  const codes = await loadCodes(z, tx, ty).catch(() => null);
  const i = (py * 256 + px) * 4;
  if (!codes || !codes[i + 3]) return;
  const [tr, so, w] = [codes[i], codes[i + 1], codes[i + 2]];
  const d = describe(tr, so, w);
  const p = t.pop;
  const ranked = species.map((s) => ({ s, v: score(compiled[s.id], tr, so, w) }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
  const cls = t.classes[classify(score(compiled[current.id], tr, so, w), cfg.classes)];
  const row = (k, v) => `<div class="row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`;
  const html = `<div class="pop">
    <h4>${esc(nameOf(current))}${esc(t.colon)}${esc(cls)}</h4>
    ${row(p.trees, d.tree === null ? t.noForest : t.trees[d.tree])}
    ${row(p.nutrients, d.siteKnown ? t.nutrient[d.nutrient] : p.noSite)}
    ${d.siteKnown ? row(p.water, t.water[d.water]) : ""}
    ${d.peat ? row(p.soil, p.peat) : ""}
    ${d.nsg || d.nationalpark ? row(p.protected, `${d.nationalpark ? p.natp : p.nsg}${t.colon}${p.banned}`) : ""}
    ${ranked.length ? `<div class="rank">${ranked.map((r) => `<div class="row"><span>${esc(nameOf(r.s))}</span><span><i class="bar" style="width:${Math.round(r.v * 50)}px"></i></span></div>`).join("")}</div>` : ""}
  </div>`;
  new maplibregl.Popup({ maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
});

// ---------- info dialog ----------
function infoHtml() {
  const I = t.info;
  const rows = species.map((s) => {
    const cv = validation?.species?.[s.id]?.cv;
    const model = t.model[cv?.used === "calibrated" ? "calibrated" : cv?.used === "prior" ? "prior" : "untested"];
    const cell = (v) => `<td>${esc(v ?? "·")}</td>`;
    return `<tr><td>${esc(nameOf(s))}</td>${cell(cv?.n ?? validation?.species?.[s.id]?.n)}${cell(cv?.cv_auc_prior)}${cell(cv?.cv_auc_calibrated)}<td>${esc(model)}</td></tr>`;
  }).join("");
  const sec = ([h, body]) => `<h3>${esc(h)}</h3><p>${body}</p>`; // body: trusted static HTML from i18n.js
  return `
  ${sec(I.what)}
  ${sec(I.method)}
  ${sec(I.valid)}
  <table><tr>${t.table.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows}</table>
  <p>${esc(I.honest)}</p>
  ${sec(I.limits)}
  ${sec(I.law)}
  <p>${esc(I.excluded)} ${cfg.excluded.map((x) => `${esc(x.name[lang])}${esc(t.colon)}${esc(x.why[lang])}`).join(" ")}</p>
  <h3>${esc(I.data)}</h3>
  <p>DLR Tree Species Germany 2022, Wegler et al. 2025 (CC BY 4.0) · Forstliche Standortskarte © Landesbetrieb Forst Brandenburg (dl-de/by-2.0) · Forstliche Standorteinheiten © Berliner Forsten (dl-de/zero-2.0) · Schutzgebiete © LfU Brandenburg (dl-de/by-2.0), Land Berlin · GBIF.org · BKG VG250 · © OpenFreeMap, OpenMapTiles, OpenStreetMap · <a href="https://github.com/txmnzia/pilzmap" target="_blank">github.com/txmnzia/pilzmap</a></p>`;
}
$("info-btn").addEventListener("click", () => { $("info-body").innerHTML = infoHtml(); $("info").showModal(); });
