"""Rasterise the Brandenburg forest site map from the open WMS using custom SLD styles.

The WFS is closed ("not authorized") but the WMS accepts SLD_BODY, so each class is drawn
in an exact palette colour and decoded back to class ids. Two passes:
  pass "n": prefix + nutrient letter (+ modifiers)   -> NUT_RULES index
  pass "w": water digit + suffix                       -> WAT_RULES index
Anti-aliased edge pixels are snapped to the nearest palette colour within a tolerance,
otherwise left 0 and filled later by the 20 m mode resampling.

Usage: python3 -I pipeline/render_sites.py OUTDIR xmin ymin xmax ymax [px_m=5] [tile_px=4000]
Writes OUTDIR/sites_{xmin}_{ymin}.npz with uint8 arrays n, w.
Data: Landesbetrieb Forst Brandenburg, dl-de/by-2.0.
"""
import io
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image

WMS = "https://www.brandenburg-forst.de/ogc/stok"
PREFIXES = ["", "N", "Ü", "O", "p", "D"]
LETTERS = "AZMKR"
# order matters: later rules paint over earlier ones (modifier variants after base)
NUT_RULES = [p + l + "%" for p in PREFIXES for l in LETTERS] + \
            [p + l + m + "%" for m in "+Cv" for p in PREFIXES for l in LETTERS]
WAT_RULES = ["%3", "%2", "%2g", "%1", "%1w", "%2w", "%0", "%4", "%4w", "%4ü", "%3ü"]


def palette(n):
    """n well separated RGB colours, index i -> colour; 0 reserved for background."""
    cols = []
    for i in range(1, n + 1):
        cols.append(((i * 53) % 256, (i * 97 + 40) % 256, (i * 151 + 80) % 256))
    assert len(set(cols)) == n
    return cols


def sld(rules, cols):
    parts = []
    for pat, (r, g, b) in zip(rules, cols):
        parts.append(
            '<Rule><ogc:Filter><ogc:PropertyIsLike wildCard="%" singleChar="_" escape="!">'
            f'<ogc:PropertyName>nfgr1</ogc:PropertyName><ogc:Literal>{pat}</ogc:Literal>'
            '</ogc:PropertyIsLike></ogc:Filter><PolygonSymbolizer><Fill>'
            f'<CssParameter name="fill">#{r:02x}{g:02x}{b:02x}</CssParameter>'
            '</Fill></PolygonSymbolizer></Rule>')
    return ('<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" '
            'xmlns:ogc="http://www.opengis.net/ogc"><NamedLayer><Name>stok_fskf</Name>'
            '<UserStyle><FeatureTypeStyle>' + "".join(parts) +
            '</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>')


def fetch(bbox, size, body):
    params = {"SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap", "LAYERS": "stok_fskf",
              "STYLES": "", "SRS": "EPSG:25833", "BBOX": ",".join(str(v) for v in bbox),
              "WIDTH": size, "HEIGHT": size, "FORMAT": "image/png", "SLD_BODY": body}
    data = urllib.parse.urlencode(params).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(WMS, data=data)  # POST: SLD is too long for GET
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            return np.asarray(img)
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
            print("retry", e, file=sys.stderr)


def decode(rgb, cols, tol=12):
    """Map each pixel to 1-based palette index, 0 for background / unmatched."""
    pal = np.array([(255, 255, 255)] + list(cols), dtype=np.int32)
    flat = rgb.reshape(-1, 3).astype(np.int32)
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    uniq, inv = np.unique(packed, return_inverse=True)
    u = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], axis=1)
    d = np.abs(u[:, None, :] - pal[None, :, :]).sum(axis=2)  # unique colours x palette
    idx = d.argmin(axis=1).astype(np.uint8)
    idx[d.min(axis=1) > tol] = 0
    return idx[inv].reshape(rgb.shape[:2])


NUT_COLS = palette(len(NUT_RULES))
WAT_COLS = palette(len(WAT_RULES))
NUT_SLD = sld(NUT_RULES, NUT_COLS)
WAT_SLD = sld(WAT_RULES, WAT_COLS)


def render(bbox, size):
    n = decode(fetch(bbox, size, NUT_SLD), NUT_COLS)
    w = decode(fetch(bbox, size, WAT_SLD), WAT_COLS)
    return n, w


def main():
    out = sys.argv[1]
    xmin, ymin, xmax, ymax = (int(v) for v in sys.argv[2:6])
    px = float(sys.argv[6]) if len(sys.argv) > 6 else 5.0
    tile = int(sys.argv[7]) if len(sys.argv) > 7 else 4000
    os.makedirs(out, exist_ok=True)
    span = int(px * tile)
    for y in range(ymin, ymax, span):
        for x in range(xmin, xmax, span):
            path = os.path.join(out, f"sites_{x}_{y}.npz")
            if os.path.exists(path):
                continue
            t = time.time()
            n, w = render((x, y, x + span, y + span), tile)
            tmp = path + ".tmp.npz"
            np.savez_compressed(tmp, n=n, w=w, bbox=np.array([x, y, x + span, y + span]))
            os.replace(tmp, path)
            print(f"{path} {time.time()-t:.1f}s forest={np.mean(n>0):.2f}", flush=True)


if __name__ == "__main__":
    main()
