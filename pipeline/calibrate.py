"""Calibrate species tables against GBIF records, with spatial cross-validation.

For each factor (host tree, nutrient letter, water class) and level L:
  ratio_L = P(L | species records) / P(L | forest background records), Laplace-smoothed
  cal_L   = ratio_L / max(ratio)                         (scaled to [0,1])
  final_L = prior_L + w_L * (cal_L - prior_L),  w_L = min(n_pres/(n_pres+K_P), n_bg_L/(n_bg_L+K_B))
so levels with little data keep the expert prior. Evaluated by 5-fold spatial CV
(20 km blocks): the calibrated model is fitted on 4 folds and scored (AUC vs forest
target-group background) on the held-out fold. The prior is adopted only where it wins.

Usage: python3 -I pipeline/calibrate.py habitat20.tif gbif.jsonl data/species.json OUT_species.json OUT_report.json
"""
import copy
import json
import os
import sys

import numpy as np
import rasterio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grid  # noqa: E402
import suitability as su  # noqa: E402
from validate import auc  # noqa: E402

K_P, K_B = 100, 200
LETTER_LEVELS = {"A": (1, 2, 3), "Z": (4, 5), "M": (6, 7), "K": (8, 9), "R": (10,)}
MIN_N = 30


def fit(sp, t, s, w, pres_idx, bg_idx):
    """Return calibrated copy of sp from presence / background cell indices."""
    out = copy.deepcopy(sp)
    npres = len(pres_idx)
    wp = npres / (npres + K_P)

    def norm(rr):
        """Scale by the largest ratio among well-sampled levels; rare levels cannot set it."""
        good = [r for r, cb, cp in rr.values() if cb >= 100 and cp >= 5]
        return max(good) if good else max(r for r, _, _ in rr.values())

    def ratios(values_p, values_b, levels):
        res = {}
        for L in levels:
            cp = np.isin(values_p, L).sum()
            cb = np.isin(values_b, L).sum()
            r = ((cp + 1) / (len(values_p) + len(levels))) / ((cb + 1) / (len(values_b) + len(levels)))
            res[L] = (r, cb, cp)
        return res

    # host tree
    tp, tb = t[pres_idx], t[bg_idx]
    rr = ratios(tp, tb, list(range(11)))
    mx = norm(rr)
    for L, (r, cb, _) in rr.items():
        wl = min(wp, cb / (cb + K_B))
        out["host"][L] = round(sp["host"][L] + wl * (min(r / mx, 1.0) - sp["host"][L]), 3)
    # nutrient letters (only cells with known site)
    np_, nb = s[pres_idx] & 15, s[bg_idx] & 15
    np_, nb = np_[np_ > 0], nb[nb > 0]
    rr = ratios(np_, nb, list(LETTER_LEVELS.values()))
    mx = norm(rr)
    for letter, lv in LETTER_LEVELS.items():
        r, cb, _ = rr[lv]
        wl = min(wp, cb / (cb + K_B))
        out["nutrient"][letter] = round(sp["nutrient"][letter] + wl * (min(r / mx, 1.0) - sp["nutrient"][letter]), 3)
    # water classes 1..8
    wp_, wb = w[pres_idx] & 15, w[bg_idx] & 15
    wp_, wb = wp_[wp_ > 0], wb[wb > 0]
    rr = ratios(wp_, wb, list(range(1, 9)))
    mx = norm(rr)
    for L, (r, cb, _) in rr.items():
        wl = min(wp, cb / (cb + K_B))
        out["water"][L - 1] = round(sp["water"][L - 1] + wl * (min(r / mx, 1.0) - sp["water"][L - 1]), 3)
    # structural zeros: a level the ecology excludes (prior 0) stays excluded; data noise
    # (e.g. 200 m position error next to a bog) must not create habitat
    for key in ("host", "water"):
        out[key] = [0.0 if p == 0 else v for p, v in zip(sp[key], out[key])]
    # rescale each factor to max 1: ranks unchanged, absolute class thresholds stay meaningful
    for key in ("host", "water"):
        m = max(out[key])
        out[key] = [round(v / m, 3) for v in out[key]]
    m = max(out["nutrient"].values())
    out["nutrient"] = {k: round(v / m, 3) for k, v in out["nutrient"].items()}
    return out


def main():
    hab, gbif_path, species_path, out_species, out_report = sys.argv[1:6]
    cfg = json.load(open(species_path))
    with rasterio.open(hab) as h:
        tree, soil, water, alpha = (b.ravel() for b in h.read())
    recs = [json.loads(l) for l in open(gbif_path)]
    xs = np.array([r["x"] for r in recs]); ys = np.array([r["y"] for r in recs])
    cols = (xs - grid.XMIN) // grid.RES; rows = (grid.YMAX - ys) // grid.RES
    ok = (cols >= 0) & (cols < grid.WIDTH) & (rows >= 0) & (rows < grid.HEIGHT)
    idx = np.where(ok, rows * grid.WIDTH + cols, 0)
    ok &= alpha[idx] > 0
    ok &= tree[idx] <= 10  # forest records only: the strict test
    keys = np.array([r.get("speciesKey") or -1 for r in recs])
    idx, keys = idx[ok], keys[ok]
    rows_, cols_ = idx // grid.WIDTH, idx % grid.WIDTH
    fold = ((rows_ // 1000) * 7 + (cols_ // 1000)) % 5  # 20 km blocks, scattered folds

    report = {}
    new_cfg = copy.deepcopy(cfg)
    for k, sp in enumerate(cfg["species"]):
        m = keys == sp["gbif"]
        pres_all = np.unique(idx[m])
        if len(pres_all) < MIN_N:
            report[sp["id"]] = {"n": int(len(pres_all)), "used": "prior (too few records)"}
            new_cfg["species"][k]["prior"] = None
            continue
        auc_prior, auc_cal = [], []
        for f in range(5):
            tr, te = fold != f, fold == f
            p_tr = np.unique(idx[m & tr]); b_tr = np.unique(idx[~m & tr])
            p_te = np.unique(idx[m & te]); b_te = np.unique(idx[~m & te])
            if len(p_te) < 5:
                continue
            cal = fit(sp, tree, soil, water, p_tr, b_tr)
            for model, acc in ((sp, auc_prior), (cal, auc_cal)):
                sc_p = su.score(model, tree[p_te], soil[p_te], water[p_te])
                sc_b = su.score(model, tree[b_te], soil[b_te], water[b_te])
                acc.append((auc(sc_p, sc_b), len(p_te)))
        wavg = lambda a: round(sum(x * n for x, n in a) / sum(n for _, n in a), 3)
        ap, ac = wavg(auc_prior), wavg(auc_cal)
        use_cal = ac > ap
        final = fit(sp, tree, soil, water, pres_all, np.unique(idx[~m])) if use_cal else sp
        report[sp["id"]] = {"n": int(len(pres_all)), "cv_auc_prior": ap, "cv_auc_calibrated": ac,
                            "used": "calibrated" if use_cal else "prior"}
        new_cfg["species"][k] = dict(final)
        new_cfg["species"][k]["prior"] = {key: sp[key] for key in ("host", "nutrient", "water")} if use_cal else None
        print(sp["id"], report[sp["id"]], flush=True)
    new_cfg["_calibration"] = "Tables calibrated against GBIF forest records with 5-fold spatial CV, shrunk toward the expert prior (see pipeline/calibrate.py). 'prior' holds the original expert table where calibration was adopted."
    json.dump(new_cfg, open(out_species, "w"), indent=1, ensure_ascii=False)
    json.dump(report, open(out_report, "w"), indent=1)


if __name__ == "__main__":
    main()
