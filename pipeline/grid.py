"""Common 20 m analysis grid for Berlin + Brandenburg (EPSG:25833)."""
from rasterio.transform import from_origin

CRS = "EPSG:25833"
RES = 20
XMIN, YMIN, XMAX, YMAX = 258000, 5691000, 498000, 5931000
WIDTH = (XMAX - XMIN) // RES   # 12000
HEIGHT = (YMAX - YMIN) // RES  # 12000
TRANSFORM = from_origin(XMIN, YMAX, RES, RES)
