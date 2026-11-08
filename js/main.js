import { APP_VERSION, BASEMAP_STYLE, TILE_URL, TILE_ZOOM, BOUNDS, START } from "./config.js";
import { compile, score, classify, colorize, describe, lngLatToTilePixel, isInSeason } from "./habitat.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

$("version").textContent = "v" + APP_VERSION;

// fail soft if the map library did not load: say so instead of a blank screen
if (typeof maplibregl === "undefined") {
  $("card").innerHTML = "<p>The map library failed to load. Reload the page.</p>";
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
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("hab", { type: "raster", tiles: tilesFor(current), tileSize: 256,
    minzoom: TILE_ZOOM.min, maxzoom: TILE_ZOOM.max, bounds: BOUNDS });
  map.addLayer({ id: "hab", type: "raster", source: "hab",
    paint: { "raster-resampling": "nearest", "raster-opacity": 0.85, "raster-fade-duration": 0 } }, firstLabel);
}
map.on("load", addHabitat);
// basemap failed (offline / blocked): keep a plain background so the habitat layer still shows
map.on("error", (e) => {
  if (!map.isStyleLoaded() && !map.getSource("hab")) {
    map.setStyle({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0e1220" } }] });
    map.once("styledata", addHabitat);
  }
  console.warn(e.error || e);
});

// ---------- species UI ----------
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLASS_NAMES = ["none", "low", "medium", "high"];

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
  if (a === null) return `<span class="badge warn">unvalidated (${esc(v.n)} records)</span>`;
  const label = a >= 0.7 ? "useful" : a >= 0.6 ? "weak" : "barely better than chance";
  return `<span class="badge ${a >= 0.7 ? "ok" : "warn"}">Accuracy ${esc(label)} (AUC ${esc(a.toFixed(2))}, ${esc(v.cv.n)} records)</span>`;
}

function renderChips() {
  $("chips").innerHTML = species.map((s) => {
    const on = isInSeason(s, month);
    return `<button class="chip" role="tab" data-id="${esc(s.id)}" aria-selected="${s.id === current.id}">
      <span class="dot ${on ? "" : "off"}" title="${on ? "in season" : "out of season"}"></span>${esc(s.en)}
    </button>`;
  }).join("");
}

function renderCard() {
  const s = current;
  $("card").innerHTML = `
    <h2>${esc(s.en)}</h2><div class="sci">${esc(s.sci)} · ${esc(s.de)}</div>
    <div class="badges">
      <span class="badge">Season ${esc(MONTHS[s.season[0]])}–${esc(MONTHS[s.season[1]])}</span>
      ${s.protected ? '<span class="badge legal">Protected (BArtSchV): small amounts, own use only</span>' : ""}
      ${validationBadge(s)}
    </div>
    <p>${esc(s.notes)}</p>
    <div class="label">Lookalikes</div>
    <p>${esc(s.lookalikes)}</p>`;
}

function select(id) {
  current = species.find((s) => s.id === id) || current;
  store.set("pilz.species", current.id);
  const u = new URL(location.href); u.searchParams.set("s", current.id); history.replaceState(null, "", u);
  renderChips(); renderCard();
  map.getSource("hab")?.setTiles(tilesFor(current));
}

$("chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (b) select(b.dataset.id);
});
renderChips(); renderCard();
document.querySelector(`.chip[aria-selected="true"]`)?.scrollIntoView({ inline: "center", block: "nearest" });

// ---------- click inspection ----------
map.on("click", async (e) => {
  const z = TILE_ZOOM.max;
  const { tx, ty, px, py } = lngLatToTilePixel(e.lngLat.lng, e.lngLat.lat, z);
  const codes = await loadCodes(z, tx, ty).catch(() => null);
  const i = (py * 256 + px) * 4;
  if (!codes || !codes[i + 3]) return;
  const [t, so, w] = [codes[i], codes[i + 1], codes[i + 2]];
  const d = describe(t, so, w);
  const ranked = species.map((s) => ({ s, v: score(compiled[s.id], t, so, w) }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
  const cls = CLASS_NAMES[classify(score(compiled[current.id], t, so, w), cfg.classes)];
  const html = `<div class="pop">
    <h4>${esc(current.en)}: ${esc(cls)}</h4>
    <div class="row"><span class="k">Trees</span><span>${esc(d.tree)}</span></div>
    <div class="row"><span class="k">Nutrients</span><span>${esc(d.siteKnown ? d.nutrient : "no site data")}</span></div>
    <div class="row"><span class="k">Water</span><span>${esc(d.siteKnown ? d.water : "–")}</span></div>
    ${d.peat ? '<div class="row"><span class="k">Soil</span><span>peat</span></div>' : ""}
    ${d.nsg || d.nationalpark ? `<div class="row"><span class="k">Protected</span><span>${d.nationalpark ? "National park" : "Nature reserve"}: picking usually banned</span></div>` : ""}
    ${ranked.length ? `<div class="rank">${ranked.map((r) => `<div class="row"><span>${esc(r.s.en)}</span><span><i class="bar" style="width:${Math.round(r.v * 50)}px"></i></span></div>`).join("")}</div>` : ""}
  </div>`;
  new maplibregl.Popup({ maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
});

// ---------- info dialog ----------
function infoHtml() {
  const rows = species.map((s) => {
    const v = validation?.species?.[s.id];
    const cv = v?.cv;
    const model = cv?.used === "calibrated" ? "calibrated" : cv?.used === "prior" ? "expert" : "expert, untested";
    return `<tr><td>${esc(s.en)}</td><td>${esc(cv?.n ?? v?.n ?? "–")}</td><td>${esc(cv?.cv_auc_prior ?? "–")}</td><td>${esc(cv?.cv_auc_calibrated ?? "–")}</td><td>${esc(model)}</td></tr>`;
  }).join("");
  return `
  <h3>What this map shows</h3>
  <p>Where the <b>habitat</b> suits a species: host tree, soil nutrients and water regime. It does <b>not</b> show where mushrooms are right now. Fruiting depends on weather (rain, then warmth, 1 to 3 weeks later).</p>
  <h3>Method</h3>
  <p>Per 20 m cell: suitability = host tree × nutrient level × water regime. Tree species: DLR Tree Species Germany 2022 (Sentinel-1/2, 10 m). Soil: Forstliche Standortskarte Brandenburg (1:10 000) and Forstliche Standorteinheiten Berlin, the official forest site surveys. Where no site data exists (about 28 % of forest) a neutral factor is used.</p>
  <h3>Calibration and validation (GBIF records)</h3>
  <p>Expert tables were adjusted with about 27 000 fungi records from Berlin and Brandenburg (GBIF, mostly iNaturalist), shrunk toward the expert values by sample size. Ecological exclusions (e.g. porcini on waterlogged soil) stay fixed. Quality is measured out of sample (5-fold spatial cross-validation, 20 km blocks): can the map tell this species' finds from other fungi finds <i>inside forest</i>? AUC 0.5 = chance, 0.7 = useful. Calibration is only kept where it scores better.</p>
  <table><tr><th>Species</th><th>Records</th><th>AUC expert</th><th>AUC calibrated</th><th>Used</th></tr>${rows}</table>
  <p>Honest reading: the map mainly separates pine forest on poor sand from everything else. Inside that block (about half of all forest) it cannot rank further, because tree species and site class are the same there. Its value is ruling out unsuitable ground.</p>
  <h3>Limits</h3>
  <p>Only the dominant tree per cell is known, so birches mixed into pine stands are missing. Stand age, nitrogen deposition and weather are not modelled. Record positions are accurate to 200 m at best. Chanterelle is over-predicted. Munitions-contaminated land is not publicly mapped: obey closure signs.</p>
  <h3>Law and safety</h3>
  <p>Porcini, chanterelle, birch boletes and orange boletes are specially protected (BArtSchV): small amounts for your own use only, no selling. Picking is usually banned in nature reserves and the national park (hatched; check the local ordinance). Never eat a mushroom you cannot identify with certainty; ask a certified mushroom adviser (DGfM Pilzsachverständige). This map does not identify mushrooms.</p>
  <p>Deliberately left out: ${cfg.excluded.map((x) => `${esc(x.en)} (${esc(x.why)})`).join(" ")}</p>
  <h3>Data</h3>
  <p>DLR Tree Species Germany 2022, Wegler et al. 2025 (CC BY 4.0) · Forstliche Standortskarte © Landesbetrieb Forst Brandenburg (dl-de/by-2.0) · Forstliche Standorteinheiten © Berliner Forsten (dl-de/zero-2.0) · Protected areas © LfU Brandenburg (dl-de/by-2.0), Land Berlin · Records: GBIF.org · Boundaries: BKG VG250 · Basemap © OpenFreeMap, OpenMapTiles, OpenStreetMap contributors. Code and method: <a href="https://github.com/txmnzia/pilzmap" target="_blank">github.com/txmnzia/pilzmap</a>.</p>`;
}
$("info-btn").addEventListener("click", () => { $("info-body").innerHTML = infoHtml(); $("info").showModal(); });
