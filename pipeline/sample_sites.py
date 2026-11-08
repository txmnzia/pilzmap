"""Sample the Brandenburg forest site map (Forstliche Standortskarte, LFB) at random
points via WMS GetFeatureInfo. Used to (1) learn the class vocabulary and (2) build an
independent check sample for the rasterised site map.

Usage: python3 -I pipeline/sample_sites.py OUT.jsonl N [bbox xmin,ymin,xmax,ymax EPSG:25833]
Data: Landesbetrieb Forst Brandenburg, dl-de/by-2.0.
"""
import json
import random
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

WMS = "https://www.brandenburg-forst.de/ogc/stok"
BB_BBOX = (258617, 5691024, 483559, 5930249)  # layer extent, EPSG:25833


def query(x, y):
    half = 50  # 100 m window, 100 px: 1 m per px, well inside the scale limit
    params = {
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetFeatureInfo",
        "LAYERS": "stok_fskf", "QUERY_LAYERS": "stok_fskf", "SRS": "EPSG:25833",
        "BBOX": f"{x-half},{y-half},{x+half},{y+half}", "WIDTH": 100, "HEIGHT": 100,
        "X": 50, "Y": 50, "INFO_FORMAT": "text/plain", "FEATURE_COUNT": 1,
    }
    url = WMS + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        txt = r.read().decode("utf-8", "replace")
    attrs = {}
    for line in txt.splitlines():
        if " = " in line:
            k, v = line.split(" = ", 1)
            attrs[k.strip()] = v.strip().strip("'")
    return {"x": x, "y": y, "attrs": attrs or None}


def main():
    out, n = sys.argv[1], int(sys.argv[2])
    bbox = tuple(float(v) for v in sys.argv[3].split(",")) if len(sys.argv) > 3 else BB_BBOX
    rnd = random.Random(42)
    pts = [(round(rnd.uniform(bbox[0], bbox[2])), round(rnd.uniform(bbox[1], bbox[3]))) for _ in range(n)]

    def safe(p):
        try:
            return query(*p)
        except Exception as e:  # keep going, record the failure
            return {"x": p[0], "y": p[1], "error": str(e)}

    with ThreadPoolExecutor(6) as ex, open(out, "w") as f:
        for res in ex.map(safe, pts):
            f.write(json.dumps(res) + "\n")


if __name__ == "__main__":
    main()
