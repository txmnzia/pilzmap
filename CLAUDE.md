Load the txmnzia-conventions skill before editing.

Pilzmap: static map of mushroom habitat suitability for Berlin + Brandenburg. Zero-build
static app (MapLibre vendored, native ES modules), do not add npm. Data is produced
offline by the Python pipeline and committed as PNG code tiles + JSON.

## Commands
- Serve: `python3 -m http.server 8000`
- Test: `node --test tests/*.test.mjs`; syntax: `for f in js/*.js; do node --check "$f"; done`
- Data regeneration: see README.

## Map
| Path | Role |
|---|---|
| `js/habitat.js` | pure: tile code layout, suitability scoring, colouring (tested) |
| `js/main.js` | UI: map, custom `pilz://` protocol colouring code tiles, species card, popup, info |
| `js/i18n.js` | pure: UI strings en/de/fr (tested for key parity); species names/notes are in species.json |
| `js/config.js` | APP_VERSION, basemap, tile URL |
| `data/species.json` | species tables in use (shared by JS and Python) |
| `data/species_prior.json` | original expert tables |
| `data/validation.json` | GBIF validation + cross-validated AUC (`cv`) |
| `data/tiles/{z}/{x}/{y}.png` | habitat code tiles z7-12 (RGBA = tree, soil, water, inside) |
| `pipeline/*.py` | data pipeline; `suitability.py` mirrors `js/habitat.js` |
| `tests/vectors.json` | Python-generated scores the JS must reproduce |
| `docs/PLAN.md` | scientific plan, results, limits |

## Hard rules
- Commits as `txmnzia <14270570+txmnzia@users.noreply.github.com>`, author and committer. No trailers.
- Work on the session branch, then merge to main and push.
- No secrets, no personal data (no personal finds or locations).
- Bump APP_VERSION and `?v=` in index.html on user-visible changes.
- Tests before merge. Changing scoring in Python or JS: change both, regenerate vectors.
- Tile codes are categorical: never resample with anything but nearest/mode, never set a
  nodata value that collides with class 0 (pine).
- Validation numbers shown in the app must be recomputed, never hand-edited.
- Keep attribution for every dataset (licences require it).
- Every user-facing string exists in en, de and fr (tests enforce it). No em dashes.

## Skills
| Skill | Use |
|---|---|
| `release-checklist` | anything shipping to main |
