"""Assemble the 20 m habitat code raster for Berlin + Brandenburg.

Bands (uint8), layout shared with js/habitat.js:
  1 tree    : 0..9 DLR species class, 10 canopy loss, 255 no forest
  2 soil    : low nibble nutrient 0..10 (0 unknown), 0x10 carbonate, 0x20 peat,
              0x40 spoil heap, 0x80 forest edge (+-40 m)
  3 water   : low nibble water class 0..8 (0 unknown), 0x10 NSG, 0x20 national park
  4 alpha   : 255 inside Berlin/Brandenburg, 0 outside

Usage: python3 -I pipeline/build_habitat.py SCRATCH OUT.tif
  SCRATCH must contain work/trees20.tif, sites/*.npz, raw/berlin/forst.json,
  raw/protected/{nsg,natp,be_nsg}.json, raw/admin/de_states.geojson
"""
import glob
import json
import os
import sys

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.warp import transform_geom

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import grid  # noqa: E402
import render_sites as rs  # noqa: E402
import site_codes as sc  # noqa: E402

EDGE, NSG, NATP = 0x80, 0x10, 0x20


def lut_from_rules():
    """Lookup tables: NUT_RULES index -> (prefix, nutrient, flags); WAT_RULES index -> (digit, suffix)."""
    nut = {0: None}
    for i, pat in enumerate(rs.NUT_RULES, start=1):
        core = pat.rstrip("%")
        prefix = core[:-1] if core[-1] not in "+Cv" else core[:-2]
        if core[-1] in "+Cv":
            letter, mod = core[-2], core[-1]
        else:
            letter, mod = core[-1], ""
        code = prefix + letter + mod + ("1" if prefix != "O" else "4")  # dummy water digit
        n, _, flags = sc.parse(code)
        nut[i] = (prefix, n, flags)
    wat = {0: None}
    for i, pat in enumerate(rs.WAT_RULES, start=1):
        core = pat.lstrip("%")
        wat[i] = (core[0], core[1:])
    return nut, wat


def mode3(a):
    """3x3 block mode of a 2D uint16 array (dims divisible by 3)."""
    h, w = a.shape[0] // 3, a.shape[1] // 3
    blocks = a.reshape(h, 3, w, 3).transpose(0, 2, 1, 3).reshape(h, w, 9)
    counts = (blocks[..., :, None] == blocks[..., None, :]).sum(axis=3)
    return np.take_along_axis(blocks, counts.argmax(axis=2)[..., None], axis=2)[..., 0]


def mosaic_sites(sites_dir):
    nut, wat = lut_from_rules()
    soil = np.zeros((grid.HEIGHT, grid.WIDTH), np.uint8)
    water = np.zeros((grid.HEIGHT, grid.WIDTH), np.uint8)
    for f in sorted(glob.glob(os.path.join(sites_dir, "sites_*.npz"))):
        d = np.load(f)
        x0, y0, x1, y1 = d["bbox"]
        combo = mode3(d["n"].astype(np.uint16) * 32 + d["w"])
        n_idx, w_idx = combo // 32, combo % 32
        s_t = np.zeros_like(n_idx, dtype=np.uint8)
        w_t = np.zeros_like(n_idx, dtype=np.uint8)
        for ni in np.unique(n_idx):
            if ni == 0:
                continue
            prefix, nv, flags = nut[int(ni)]
            m = n_idx == ni
            s_t[m] = nv | flags
            wprefix = "" if prefix in ("p", "D") else prefix
            for wi in np.unique(w_idx[m]):
                if wi == 0:
                    continue
                digit, suffix = wat[int(wi)]
                w_t[m & (w_idx == wi)] = sc.WATER.get((wprefix, digit, suffix), 0)
        col = int((x0 - grid.XMIN) // grid.RES)
        row = int((grid.YMAX - y1) // grid.RES)
        h, w = s_t.shape
        r0, r1 = max(row, 0), min(row + h, grid.HEIGHT)
        c0, c1 = max(col, 0), min(col + w, grid.WIDTH)
        if r0 >= r1 or c0 >= c1:
            continue
        soil[r0:r1, c0:c1] = s_t[r0 - row:r1 - row, c0 - col:c1 - col]
        water[r0:r1, c0:c1] = w_t[r0 - row:r1 - row, c0 - col:c1 - col]
    return soil, water


def burn(shapes, dtype=np.uint8):
    shapes = list(shapes)
    if not shapes:
        return np.zeros((grid.HEIGHT, grid.WIDTH), dtype)
    return rasterize(shapes, out_shape=(grid.HEIGHT, grid.WIDTH), transform=grid.TRANSFORM,
                     fill=0, dtype=dtype)


def berlin_sites(path):
    d = json.load(open(path))
    s_shapes, w_shapes = [], []
    for f in d["features"]:
        p = sc.parse(f["properties"].get("stammstand"))
        if not p:
            continue
        n, wv, flags = p
        s_shapes.append((f["geometry"], n | flags))
        if wv:
            w_shapes.append((f["geometry"], wv))
    return burn(s_shapes), burn(w_shapes)


def wgs_features(path, crs_in="EPSG:4326"):
    d = json.load(open(path))
    for f in d["features"]:
        if f.get("geometry"):
            yield transform_geom(crs_in, grid.CRS, f["geometry"])


def dilate(mask, r=2):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy == 0 and dx == 0:
                continue
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def main():
    scratch, out = sys.argv[1], sys.argv[2]
    with rasterio.open(os.path.join(scratch, "work/trees20.tif")) as t:
        tree = t.read(1)
    soil, water = mosaic_sites(os.path.join(scratch, "sites"))
    print("brandenburg sites mapped km2", round((soil > 0).sum() * 0.0004))

    bs, bw = berlin_sites(os.path.join(scratch, "raw/berlin/forst.json"))
    soil = np.where(bs > 0, bs, soil)
    water = np.where(bw > 0, bw, water)
    print("with berlin km2", round((soil > 0).sum() * 0.0004))

    states = json.load(open(os.path.join(scratch, "raw/admin/de_states.geojson")))
    bbbe = [transform_geom("EPSG:4326", grid.CRS, f["geometry"]) for f in states["features"]
            if f["properties"]["id"] in ("DE-BB", "DE-BE")]
    inside = burn((g, 1) for g in bbbe).astype(bool)
    print("study area km2", round(inside.sum() * 0.0004))

    nsg = burn((g, 1) for g in wgs_features(os.path.join(scratch, "raw/protected/nsg.json")))
    be_nsg = json.load(open(os.path.join(scratch, "raw/protected/be_nsg.json")))
    nsg |= burn((f["geometry"], 1) for f in be_nsg["features"] if f.get("geometry"))
    natp = burn((g, 1) for g in wgs_features(os.path.join(scratch, "raw/protected/natp.json")))
    water = water | np.where(nsg > 0, NSG, 0).astype(np.uint8) | np.where(natp > 0, NATP, 0).astype(np.uint8)

    forest = tree <= 10
    edge = (forest & dilate(~forest)) | (~forest & dilate(forest))
    soil = soil | np.where(edge, EDGE, 0).astype(np.uint8)

    alpha = np.where(inside, 255, 0).astype(np.uint8)
    for a in (tree, soil, water):
        a[~inside] = 0
    tree[~inside] = 255

    prof = dict(driver="GTiff", width=grid.WIDTH, height=grid.HEIGHT, count=4, dtype="uint8",
                crs=grid.CRS, transform=grid.TRANSFORM, compress="deflate", tiled=True)
    with rasterio.open(out + ".tmp", "w", **prof) as o:
        o.write(np.stack([tree, soil, water, alpha]))
    os.replace(out + ".tmp", out)
    fin = forest & inside
    print("forest in study km2", round(fin.sum() * 0.0004),
          "forest with site data", round((fin & ((soil & 0x0F) > 0)).sum() / fin.sum(), 3))


if __name__ == "__main__":
    main()
