# Pilzmap

Habitat suitability map for edible mushrooms in Berlin and Brandenburg.
Live: https://txmnzia.github.io/pilzmap/

It shows where the **habitat** fits a species (host tree × soil nutrients × water regime),
not where mushrooms are today. Method, results and limits: [docs/PLAN.md](docs/PLAN.md).

## Run locally

```sh
python3 -m http.server 8000      # then open http://localhost:8000
node --test tests/*.test.mjs     # JS tests incl. Python/JS parity
```

## Regenerate the data

All steps write to a scratch directory `$S` first; only tiles and JSON are committed.
Needs `pip install rasterio pyproj shapely numpy pillow` and network access to the hosts
listed in docs/PLAN.md.

```sh
S=/path/to/scratch
# 1. tree species (DLR, 10 m) -> 20 m grid
curl -o $S/raw/dlr/treespecies_de_2022.tif https://download.geoservice.dlr.de/TREE_SPECIES_DE/files/treespecies_de_2022.tif
python3 -I pipeline/prep_trees.py $S/raw/dlr/treespecies_de_2022.tif $S/work/trees20.tif
# 2. Brandenburg forest site map via WMS + SLD (about 30 min, 144 requests x 2)
python3 -I pipeline/render_sites.py $S/sites 258000 5691000 498000 5931000 6.666666667 3000
# 3. Berlin sites, protected areas, state boundaries
curl -o $S/raw/berlin/forst.json "https://gdi.berlin.de/services/wfs/forststandort?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=forststandort:b_forststandort&OUTPUTFORMAT=application/json&SRSNAME=EPSG:25833"
curl -o $S/raw/protected/nsg.json  "https://inspire.brandenburg.de/services/schutzg_wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=app:nsg&OUTPUTFORMAT=application/geo%2Bjson"
curl -o $S/raw/protected/natp.json "https://inspire.brandenburg.de/services/schutzg_wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=app:natp&OUTPUTFORMAT=application/geo%2Bjson"
curl -o $S/raw/protected/be_nsg.json "https://gdi.berlin.de/services/wfs/schutzgebiete?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=schutzgebiete:h_nsg&OUTPUTFORMAT=application/json&SRSNAME=EPSG:25833"
curl -o $S/raw/admin/de_states.geojson https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/2_bundeslaender/2_hoch.geo.json
# 4. habitat code raster + tiles
python3 -I pipeline/build_habitat.py $S $S/work/habitat20.tif
python3 -I pipeline/make_tiles.py $S/work/habitat20.tif $S/tiles 7 12   # then replace data/tiles
# 5. GBIF records, calibration, validation
python3 -I pipeline/fetch_gbif.py $S/work/gbif.jsonl
python3 -I pipeline/calibrate.py $S/work/habitat20.tif $S/work/gbif.jsonl data/species_prior.json data/species.json $S/calib_report.json
python3 -I pipeline/validate.py $S/work/habitat20.tif $S/work/gbif.jsonl data/species.json $S/validation_raw.json
#    merge calib_report into data/validation.json under "cv" (see docs/PLAN.md)
python3 -I pipeline/make_vectors.py data/species.json tests/vectors.json
```

`data/species_prior.json` holds the original expert tables; `data/species.json` the
tables in use (calibrated where cross-validation favoured it, with the prior kept inline).

## Data and licences

- Tree species: DLR Tree Species Germany 2022, Wegler et al. 2025, CC BY 4.0
- Forest site map Brandenburg: © Landesbetrieb Forst Brandenburg, dl-de/by-2.0
- Forest site units Berlin: © Berliner Forsten, dl-de/zero-2.0
- Protected areas: © LfU Brandenburg (dl-de/by-2.0), Land Berlin
- Records: GBIF.org (per-record licences)
- State boundaries: BKG VG250 via isellsoap/deutschlandGeoJSON
- MapLibre GL JS 4.7.1 (BSD-3), vendored in `vendor/`
- Basemap: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors

This map does not identify mushrooms. Never eat one you cannot identify with certainty.
