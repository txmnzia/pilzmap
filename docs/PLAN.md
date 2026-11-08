# Pilzmap: scientific plan (draft v1)

Goal: a map of Berlin and Brandenburg showing, per mushroom species, where the habitat
is suitable, built only from authoritative datasets, with its uncertainty stated.

## 0. What this map can and cannot be

- It is a **habitat suitability map**, not a "mushrooms are here" map. No dataset records
  mycelium. The best we can say is "the host tree, soil and water regime this species
  needs are present here".
- Fruiting is driven by **weather** (rain then warmth, 1 to 3 weeks lag). A perfect habitat
  is empty in a dry September. Static layers answer "where", only a weather layer answers
  "when".
- Reliable inputs do not make a reliable prediction. Every species layer gets a stated
  confidence and is validated against independent occurrence records (section 5).

## 1. Ecological criteria per species

Most edible boletes and chanterelles are **ectomycorrhizal**: they live in symbiosis with
the roots of specific trees. Host tree is therefore a hard requirement, soil and water
are modulators. Ranked importance for mycorrhizal species:

1. Host tree genus present (hard filter)
2. Soil trophic level / acidity (nutrient-poor acidic sands favour most target species)
3. Site water regime (dry, fresh, moist, wet)
4. Stand age / structure (secondary, data limited)
5. Recent weather (dynamic trigger, phase 2)
6. Nitrogen deposition (lowers chanterelle fruiting; marginal, optional)

| Species (DE) | Ecology | Hosts | Trophic level (A arm .. R reich) | Water | Season | Confidence of model |
|---|---|---|---|---|---|---|
| Steinpilz, *Boletus edulis* | ECM | spruce, pine, beech, oak, birch | A to M, best Z | fresh to moderately dry | Jul to Oct | medium |
| Kiefern-Steinpilz, *B. pinophilus* | ECM | pine (spruce) | A to Z, sandy | dry to fresh | Jun to Oct | medium |
| Maronenröhrling, *Imleria badia* | ECM | pine, spruce, also beech, oak | A to Z, very acidic | fresh | Aug to Nov | high (common, broad) |
| Pfifferling, *Cantharellus cibarius* | ECM, N-sensitive | pine, oak, beech, spruce, birch | A to Z | fresh to moist, mossy | Jun to Oct | low (rare in much of BB, map will over-predict) |
| Birkenpilz, *Leccinum scabrum* | ECM | birch only | broad | fresh to moist | Jun to Oct | high (host-driven) |
| Rotkappe, *Leccinum versipelle* / *aurantiacum* | ECM | birch / aspen, poplar | acidic | fresh to moist | Jul to Oct | low (aspen is not in any tree map) |
| Butterpilz, *Suillus luteus* | ECM | pine only, young stands | A to M, sandy | dry to fresh | Jul to Nov | medium |
| Sandröhrling, *Suillus variegatus* | ECM | pine only | A to Z, sandy | dry | Aug to Oct | medium |
| Krause Glucke, *Sparassis crispa* | parasite on pine roots | old pine | broad | broad | Aug to Oct | low |
| Parasol, *Macrolepiota procera* | saprotroph | none (edges, clearings, grassland) | Z to K | fresh | Jul to Oct | low (not host-driven) |

Deliberately excluded:
- **Grünling, *Tricholoma equestre***: a traditional Brandenburg pine-sand mushroom, but
  repeated consumption causes rhabdomyolysis, with deaths documented. No edible map for it.
- **Morcheln**: spring, calcareous or disturbed floodplain sites (Oder valley). Our soil
  data does not capture the micro-sites and false morels (*Gyromitra*) are deadly. Revisit
  later if validation data exists.

These criteria come from standard field mycology (DGfM, Gminder/Krieglsteiner). The numeric
weights in section 4 are expert priors, then calibrated against occurrence data. They are
not published constants and the UI must not pretend they are.

## 2. Pushback on the original layer list

| Proposed layer | Verdict | Why | Replacement |
|---|---|---|---|
| Soil acidity (pH map) | Replace | Regional pH maps (LUCAS 500 m, BÜK 1:300 000) are coarse and dominated by farmland samples. Forest topsoil pH is driven by the stand and humus form. | **Forest site map trophic level** (Stamm-Nährkraftstufe), which is itself derived from humus form, pH, C/N, mapped at 1:10 000 for forests only |
| Humidity | Replace | Air humidity grids are coarse and do not predict fruiting. | Static: site water regime (Stamm-Feuchtestufe, groundwater class). Dynamic: DWD daily soil moisture + precipitation |
| Type of ground | Keep, via the same forest site map | Substrate (sand, loam, peat) is embedded in the site units | Forest site map, BÜK 300 substrate only outside mapped forest |
| Tree types | Keep | Hard requirement for mycorrhizal species | Sentinel tree species map 10 m |

## 3. Datasets (all open licence, checked in metadata, not yet downloaded)

| Layer | Dataset | Resolution | Licence | Notes |
|---|---|---|---|---|
| Tree species | DLR Tree Species Germany 2022 (Wegler et al. 2025, IJRS) | 10 m | CC BY 4.0 | Classes: pine, spruce, Douglas fir, larch, fir, beech, oak, birch, alder, other, canopy loss. F1 about 0.88 overall, worse for minor species |
| Tree species (alt.) | Thünen dominant tree species 2017/18 (Blickensdörfer et al. 2024, RSE) | 10 m | CC BY 4.0 | 75.5 % overall accuracy incl. mixed stands. Use to cross-check DLR, agreement = higher confidence |
| Trophic level + water regime, Brandenburg | Forstliche Standortskarte (Landesbetrieb Forst Brandenburg), WMS/WFS `brandenburg-forst.de/ogc/stok` | 1:10 000 polygons | dl-de/by-2.0 per metadata | Key dataset. Need to confirm WFS (vector) export, not only WMS images |
| Same, Berlin | Forstliche Standorteinheiten (Berliner Forsten, GDI Berlin) | 1:10 000 | dl-de/zero-2.0 | Same classification system |
| Soil substrate outside forest | BÜK 300 Brandenburg (LBGR INSPIRE WFS), Umweltatlas Berlin 01.06 | 1:300 000 / block level | open | Only for Parasol and forest-site gaps |
| Soil moisture (dynamic) | DWD AMBAV 2.0 daily soil moisture grids | 1 km | DWD open data (CC BY 4.0) | Phase 2 |
| Precipitation (dynamic) | DWD daily gridded precipitation (HYRAS / RADOLAN-based) | 1 km | DWD open data | Phase 2 |
| Protected areas | NSG, Nationalpark, FFH (LfU Brandenburg, Berlin) | polygons | dl-de/by-2.0 | Legal layer, see section 6 |
| Restricted/military areas | OSM `landuse=military`, known closed former training grounds | polygons | ODbL | Brandenburg has large munitions-contaminated forests (Jüterbog, Lieberose, Kummersdorf). Official munitions map is not public: limitation |
| Validation | GBIF occurrences (country DE, BB + BE), Pilzkartierung DGfM if obtainable | points | per dataset, mostly CC BY / CC0 | Never used as model input in v1 |

## 4. Model

Per species, per 20 m cell:

```
suitability = host(tree) * trophic(nk) * water(fe) * [age/structure]
```

Each factor is a lookup in [0, 1] from section 1 (fuzzy membership, not yes/no). Host is
0 when no host genus, so non-forest is 0 for all ECM species. Output classes: none, low,
medium, high. Confidence per cell is lowered where DLR and Thünen disagree on species.

Options considered:

| Approach | Pro | Con |
|---|---|---|
| A. Rule-based (expert lookup tables) | Transparent, no training data needed, works for rare species | Weights are opinion until validated |
| B. Statistical SDM (MaxEnt, boosted trees) on GBIF points | Data-driven weights | GBIF records cluster on Berlin and popular trails: the model learns "where people walk". Too few records for rare species |
| **C. Hybrid (recommended)** | A as the model, GBIF used for independent validation (Boyce index, presence share in high class vs area share) and to adjust weights | Needs a bias-aware validation, more work |

## 5. Validation (what makes this "scientific")

- Hold out all GBIF records. For each species report: share of records falling in
  high/medium cells vs share of forest area in those classes (continuous Boyce index).
  A useful map puts far more records than area into the high class.
- Correct sampling bias with a target-group background (all fungi records in GBIF as
  proxy for observer effort).
- Publish the scores in the app per species. A species that fails validation is shown as
  "experimental" or dropped.

## 6. Legal and safety (shown in the app, not hidden in a footer)

- BArtSchV: Steinpilz, Pfifferling, Birkenpilz, Rotkappen, Morcheln and others are
  specially protected. Only small quantities for personal use (Landkreise commonly cite
  about 1 to 2 kg per person per day). Commercial picking prohibited.
- Naturschutzgebiete and Nationalpark Unteres Odertal: usually prohibited, rules vary per
  ordinance. Shown as a hatched overlay with "check local rules".
- Forest access: open to everyone in Germany (BWaldG, LWaldG Brandenburg), ownership does
  not matter, closed areas do.
- The app never helps identify a mushroom. Every species card names its toxic lookalikes.

## 7. Architecture

- **Pipeline** (Python: rasterio, geopandas): download, reproject to EPSG:25833, rasterise
  forest sites to the 20 m tree grid, encode a per-cell **habitat code** (tree class,
  trophic level, water regime, protected flag) into one RGB tile set.
- **App** (static, zero build: MapLibre GL + PMTiles): applies each species' lookup table
  client side to the habitat code tiles. Adding or tuning a species costs zero data.
  One tile set instead of one per species keeps size within GitHub Pages limits.
- **Phase 2**: daily GitHub Action pulls DWD rain and soil moisture (1 km), computes a
  "fruiting conditions" index, commits a small JSON grid.

## 8. Phases

1. Confirm data access (WFS exports, licences, class codes). Inspect real files before code.
2. Pipeline for the static habitat code, tested on one Landkreis (e.g. Dahme-Spreewald).
3. Species lookup tables + validation report.
4. App v0.1: species picker, suitability layer, legal overlay, species cards.
5. Scale to Berlin + all of Brandenburg.
6. Phase 2 weather layer.

## 9. Open blockers

- This cloud session cannot reach any data host (DLR, Brandenburg Forst, GDI Berlin, DWD,
  GBIF all blocked by the network policy). Either the hosts are allowed, or the pipeline
  runs in GitHub Actions.
- Brandenburg forest site map: confirm the WFS delivers attributes (Nährkraft, Feuchte)
  as vectors. If only WMS images exist, the model falls back to BÜK 300 and loses most of
  its value.
