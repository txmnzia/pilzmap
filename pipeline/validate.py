"""Validate species suitability against independent GBIF records.

For each species, compares suitability at presence records with two backgrounds:
  area : random forest cells in the study area (classic expectation)
  bias : all other Agaricomycetes records (target-group background, i.e. places where
         people actually look for fungi). This removes most of the observer-effort bias.
Metrics:
  boyce : continuous Boyce index (Hirzel et al. 2006), Spearman of P/E over moving
          suitability windows. -1..1, > 0.5 useful, near 0 no better than random.
  auc   : rank AUC presence vs background (0.5 random).
  lift  : share of presences in medium+high divided by share of background there.

Usage: python3 -I pipeline/validate.py habitat20.tif gbif.jsonl data/species.json OUT.json
"""
import json
import os
import sys

import numpy as np
import rasterio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grid  # noqa: E402
import suitability as su  # noqa: E402

MIN_N = 30


def spearman(a, b):
    ra = np.argsort(np.argsort(a))
    rb = np.argsort(np.argsort(b))
    if ra.std() == 0 or rb.std() == 0:
        return float("nan")
    return float(np.corrcoef(ra, rb)[0, 1])


def boyce(pres, bg, nwin=10, width=0.1):
    lo, hi = 0.0, max(pres.max(initial=0), bg.max(initial=0), 1e-6)
    centers, ratios = [], []
    for start in np.linspace(lo, hi - width * hi, 101):
        end = start + width * hi
        p = ((pres >= start) & (pres <= end)).mean()
        e = ((bg >= start) & (bg <= end)).mean()
        if e > 0:
            centers.append(start)
            ratios.append(p / e)
    return spearman(np.array(centers), np.array(ratios))


def auc(pres, bg):
    allv = np.concatenate([pres, bg])
    ranks = np.argsort(np.argsort(allv, kind="mergesort"), kind="mergesort") + 1.0
    # average ranks for ties
    order = np.argsort(allv, kind="mergesort")
    sv = allv[order]
    r = np.empty_like(ranks)
    i = 0
    while i < len(sv):
        j = i
        while j + 1 < len(sv) and sv[j + 1] == sv[i]:
            j += 1
        r[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    rp = r[: len(pres)].sum()
    return float((rp - len(pres) * (len(pres) + 1) / 2) / (len(pres) * len(bg)))


def main():
    hab_path, gbif_path, species_path, out = sys.argv[1:5]
    cfg = json.load(open(species_path))
    with rasterio.open(hab_path) as h:
        tree, soil, water, alpha = h.read()
    inside = alpha > 0
    recs = [json.loads(l) for l in open(gbif_path)]
    xs = np.array([r["x"] for r in recs])
    ys = np.array([r["y"] for r in recs])
    cols = ((xs - grid.XMIN) // grid.RES).astype(int)
    rows = ((grid.YMAX - ys) // grid.RES).astype(int)
    ok = (cols >= 0) & (cols < grid.WIDTH) & (rows >= 0) & (rows < grid.HEIGHT)
    ok[ok] &= inside[rows[ok], cols[ok]]
    rows, cols = rows[ok], cols[ok]
    recs = [r for r, k in zip(recs, ok) if k]
    sp_key = np.array([r.get("speciesKey") or -1 for r in recs])
    # one record per 20 m cell and species: removes duplicate uploads of the same find
    rng = np.random.default_rng(0)
    forest_idx = np.flatnonzero((inside & (tree <= 10)).ravel())
    area_sample = rng.choice(forest_idx, size=min(200000, len(forest_idx)), replace=False)

    results = {"n_records_in_area": len(recs), "species": {}}
    for sp in cfg["species"]:
        s = su.score(sp, tree, soil, water)
        m = sp_key == sp["gbif"]
        cells = np.unique(rows[m] * grid.WIDTH + cols[m])
        pres = s.ravel()[cells]
        bg_cells = np.unique(rows[~m] * grid.WIDTH + cols[~m])
        bg_bias = s.ravel()[bg_cells]
        bg_area = s.ravel()[area_sample]
        # strictest test: only background finds made inside forest, so the model gets no
        # credit for the trivial "mushrooms grow in forests"
        bg_forest = s.ravel()[bg_cells[tree.ravel()[bg_cells] <= 10]]
        pres_forest = s.ravel()[cells[tree.ravel()[cells] <= 10]]
        cls = su.classify(pres, cfg["classes"])
        res = {"n": int(len(pres)), "validated": bool(len(pres) >= MIN_N),
               "share_in_class": {k: float((cls == v).mean()) if len(pres) else None
                                  for k, v in (("none", 0), ("low", 1), ("medium", 2), ("high", 3))}}
        if len(pres) >= MIN_N:
            res["share_records_in_forest"] = round(len(pres_forest) / len(pres), 3)
            for name, p_, bg in (("area", pres, bg_area), ("bias", pres, bg_bias),
                                 ("bias_forest", pres_forest, bg_forest)):
                pres = p_
                medhi_p = (pres >= cfg["classes"]["medium"]).mean()
                medhi_b = (bg >= cfg["classes"]["medium"]).mean()
                res[name] = {"boyce": round(boyce(pres, bg), 3), "auc": round(auc(pres, bg), 3),
                             "lift": round(float(medhi_p / medhi_b), 2) if medhi_b else None,
                             "bg_share_medhi": round(float(medhi_b), 3)}
        results["species"][sp["id"]] = res
        print(sp["id"], json.dumps(res))
    json.dump(results, open(out, "w"), indent=1)


if __name__ == "__main__":
    main()
