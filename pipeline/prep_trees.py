"""Reproject DLR Tree Species Germany 2022 (10 m, EPSG:3035) to the 20 m grid, mode
resampling. Output uint8: 0..9 species classes, 10 canopy loss, 255 no forest / nodata.

Usage: python3 -I pipeline/prep_trees.py treespecies_de_2022.tif OUT.tif
Data: DLR, Wegler et al. 2025, CC BY 4.0.
"""
import sys

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import grid  # noqa: E402

NODATA = 255


def main():
    src_path, out = sys.argv[1], sys.argv[2]
    dst = np.full((grid.HEIGHT, grid.WIDTH), NODATA, dtype=np.uint16)
    with rasterio.open(src_path) as src:
        reproject(source=rasterio.band(src, 1), destination=dst, src_nodata=src.nodata,
                  dst_transform=grid.TRANSFORM, dst_crs=grid.CRS, dst_nodata=NODATA,
                  resampling=Resampling.mode, num_threads=4)
    dst[dst == 666] = 10
    dst[dst > 10] = NODATA
    dst = dst.astype(np.uint8)
    prof = dict(driver="GTiff", width=grid.WIDTH, height=grid.HEIGHT, count=1, dtype="uint8",
                crs=grid.CRS, transform=grid.TRANSFORM, nodata=NODATA, compress="deflate", tiled=True)
    with rasterio.open(out + ".tmp", "w", **prof) as o:
        o.write(dst, 1)
    import os
    os.replace(out + ".tmp", out)
    vals, cnt = np.unique(dst, return_counts=True)
    print(dict(zip(vals.tolist(), (cnt * 0.0004).round(1).tolist())), "km2")


if __name__ == "__main__":
    main()
