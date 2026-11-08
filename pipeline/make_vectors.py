"""Generate tests/vectors.json: random habitat codes with Python scores, so the JS
implementation (js/habitat.js) is tested against the exact same numbers.

Usage: python3 -I pipeline/make_vectors.py data/species.json tests/vectors.json
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import suitability as su  # noqa: E402


def main():
    cfg = json.load(open(sys.argv[1]))
    rng = np.random.default_rng(1)
    n = 400
    tree = rng.choice(list(range(11)) + [255], n).astype(np.uint8)
    soil = (rng.integers(0, 11, n) | (rng.integers(0, 2, n) * 0x80) | (rng.integers(0, 2, n) * 0x20)).astype(np.uint8)
    water = (rng.integers(0, 9, n) | (rng.integers(0, 2, n) * 0x10)).astype(np.uint8)
    out = {"codes": [[int(a), int(b), int(c)] for a, b, c in zip(tree, soil, water)], "scores": {}}
    for sp in cfg["species"]:
        s = su.score(sp, tree, soil, water)
        out["scores"][sp["id"]] = {"score": [float(v) for v in s],
                                   "class": su.classify(s, cfg["classes"]).tolist()}
    json.dump(out, open(sys.argv[2], "w"))


if __name__ == "__main__":
    main()
