"""Species suitability from habitat codes. Python mirror of js/habitat.js.
Parity is enforced by tests/vectors.json (generated here, checked by node tests).
"""
import numpy as np

LETTERS = "AZMKR"


def nutrient_table(sp):
    """Index 0..10 -> factor. Even = letter, odd = midpoint ('+' / 'v' half steps)."""
    vals = [sp["nutrient"][l] for l in LETTERS]
    t = [0.0] * 11
    for i in range(1, 11):
        if i % 2 == 0:
            t[i] = vals[i // 2 - 1]
        elif i == 1:
            t[i] = vals[0]
        else:
            t[i] = (vals[i // 2 - 1] + vals[i // 2]) / 2
    return t


def score(sp, tree, soil, water):
    """Vectorised suitability in [0,1]. tree/soil/water are uint8 arrays (habitat bands)."""
    tree = np.asarray(tree)
    soil = np.asarray(soil)
    water = np.asarray(water)
    host_t = np.array(sp["host"] + [0.0] * (256 - len(sp["host"])), dtype=np.float32)
    nut_t = np.array(nutrient_table(sp) + [0.0] * 5, dtype=np.float32)
    wat_t = np.array([0.0] + sp["water"] + [0.0] * 7, dtype=np.float32)
    n = soil & 0x0F
    w = water & 0x0F
    edge = (soil & 0x80) > 0
    host = host_t[tree]
    known = (n > 0) & (w > 0)
    site = np.where(known, nut_t[n] * wat_t[w], np.float32(sp["unknown"]))
    f32 = np.float32
    if sp.get("edge"):
        host = np.where(tree == 255, np.where(edge, f32(0.6), f32(0.0)), host).astype(f32)
        host = (host * np.where(edge, f32(1.0), f32(0.35)).astype(f32)).astype(f32)
    return (host.astype(f32) * site.astype(f32)).astype(f32)


def classify(s, classes):
    out = np.zeros(np.shape(s), np.uint8)
    out[s >= classes["low"]] = 1
    out[s >= classes["medium"]] = 2
    out[s >= classes["high"]] = 3
    return out
