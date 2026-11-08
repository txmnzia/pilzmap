"""Cut the habitat code raster into XYZ PNG tiles (EPSG:3857), zooms ZMIN..ZMAX.

Codes are categorical: reprojection uses nearest, lower zooms use a 2x2 mode so no
code is ever blended. Fully transparent tiles are skipped.

Usage: python3 -I pipeline/make_tiles.py habitat20.tif OUTDIR [zmin=7] [zmax=12]
"""
import math
import os
import sys

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

ORIGIN = 20037508.342789244
TILE = 256


def mode2(a):
    """2x2 block mode of packed uint32 codes; ties prefer opaque, then top-left."""
    h, w = a.shape[0] // 2, a.shape[1] // 2
    b = a[:h * 2, :w * 2].reshape(h, 2, w, 2).transpose(0, 2, 1, 3).reshape(h, w, 4)
    counts = (b[..., :, None] == b[..., None, :]).sum(axis=3)
    counts = counts * 2 + ((b >> 24) > 0)  # opaque wins ties
    return np.take_along_axis(b, counts.argmax(axis=2)[..., None], axis=2)[..., 0]


def main():
    src_path, out = sys.argv[1], sys.argv[2]
    zmin = int(sys.argv[3]) if len(sys.argv) > 3 else 7
    zmax = int(sys.argv[4]) if len(sys.argv) > 4 else 12
    res = 2 * ORIGIN / (TILE * 2 ** zmax)
    with rasterio.open(src_path) as src:
        from rasterio.warp import transform_bounds
        l, b, r, t = transform_bounds(src.crs, "EPSG:3857", *src.bounds)
        # snap to the zmax tile grid
        tx0 = math.floor((l + ORIGIN) / (res * TILE))
        tx1 = math.ceil((r + ORIGIN) / (res * TILE))
        ty0 = math.floor((ORIGIN - t) / (res * TILE))
        ty1 = math.ceil((ORIGIN - b) / (res * TILE))
        # make the tile range even-aligned at every zoom down to zmin
        k = 2 ** (zmax - zmin)
        tx0, ty0 = tx0 // k * k, ty0 // k * k
        tx1, ty1 = -(-tx1 // k) * k, -(-ty1 // k) * k
        W, H = (tx1 - tx0) * TILE, (ty1 - ty0) * TILE
        dst_t = from_origin(tx0 * TILE * res - ORIGIN, ORIGIN - ty0 * TILE * res, res, res)
        bands = np.zeros((4, H, W), np.uint8)
        for i in range(4):
            reproject(rasterio.band(src, i + 1), bands[i], dst_transform=dst_t, dst_crs="EPSG:3857",
                      resampling=Resampling.nearest, src_nodata=None, dst_nodata=None, num_threads=4)
    packed = (bands[3].astype(np.uint32) << 24) | (bands[2].astype(np.uint32) << 16) | \
             (bands[1].astype(np.uint32) << 8) | bands[0]
    del bands
    total = n = 0
    for z in range(zmax, zmin - 1, -1):
        if z < zmax:
            packed = mode2(packed)
        f = 2 ** (zmax - z)
        x0, y0 = tx0 // f, ty0 // f
        nty, ntx = packed.shape[0] // TILE, packed.shape[1] // TILE
        for j in range(nty):
            for i in range(ntx):
                tile = packed[j * TILE:(j + 1) * TILE, i * TILE:(i + 1) * TILE]
                if not (tile >> 24).any():
                    continue
                rgba = np.stack([tile & 255, (tile >> 8) & 255, (tile >> 16) & 255, tile >> 24], axis=-1).astype(np.uint8)
                d = os.path.join(out, str(z), str(x0 + i))
                os.makedirs(d, exist_ok=True)
                p = os.path.join(d, f"{y0 + j}.png")
                Image.fromarray(rgba, "RGBA").save(p, optimize=True)
                total += os.path.getsize(p)
                n += 1
        print(f"z{z}: cumulative {n} tiles, {total / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    main()
