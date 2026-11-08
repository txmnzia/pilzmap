---
name: release-checklist
description: Steps before merging any Pilzmap change to main (tests, version, data regeneration, secrets scan, deploy check).
---
# Release checklist

1. `for f in js/*.js; do node --check "$f"; done && node --test tests/*.test.mjs`
2. If `data/species.json` or `pipeline/suitability.py` changed: regenerate
   `tests/vectors.json` (`python3 -I pipeline/make_vectors.py data/species.json tests/vectors.json`)
   and rerun tests. JS and Python scores must stay identical.
3. If species tables changed by hand: rerun `pipeline/validate.py` and `pipeline/calibrate.py`
   (see README), update `data/validation.json`. Never ship numbers that were not recomputed.
4. Bump `APP_VERSION` in `js/config.js` and the `?v=` in `index.html` on user-visible changes.
5. README / CLAUDE.md / docs/PLAN.md updated if behaviour, data or layout changed.
6. Scan the diff: `git diff main --stat`, grep for `ghp_`, `sk-`, `service_role`, `eyJ`.
   No personal locations or finds.
7. Merge to main, push, check the deploy:
   `gh api repos/txmnzia/pilzmap/actions/runs?per_page=1 --jq '.workflow_runs[0] | .status, .conclusion'`
8. Live page shows the new version tag.
