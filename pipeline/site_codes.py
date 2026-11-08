"""Parse Brandenburg / Berlin forest site group codes (Stamm-Standortsgruppe, SEA 95).

Source of the matrix: Legende zur Forstlichen Standortskarte (LFE, Stand 12/2008),
table "Stamm-Standortsformengruppen". Code layout: [prefix][nutrient][mods][water][suffix]
  prefix   : '' terrestrial, N mineral wet, Ü floodplain, O organic (peat), p/D spoil heap,
             W legacy wechselfeucht (Berlin)
  nutrient : A arm, Z ziemlich arm, M mittel, K kräftig, R reich
  mods     : '+' richer subsoil, 'C' carbonate, 'v' impoverished (Verhagerung)
  water    : digit, meaning depends on prefix (see WATER below)
  suffix   : g (schwach grundfrisch), w (wechsel-), ü (überflutungs-)

Encoded values (shared with js/habitat.js, keep in sync):
  nutrient 1..10 : A=2 Z=4 M=6 K=8 R=10, '+' adds 1, 'v' subtracts 1, 0 unknown
  water    1..8  : 1 dry, 2 mod. fresh, 3 weakly groundwater-fresh, 4 fresh,
                   5 very fresh, 6 damp, 7 wet, 8 swampy, 0 unknown
  flags          : CARBONATE, PEAT, SPOIL (bit flags)
"""
import re

NUTRIENT = {"A": 2, "Z": 4, "M": 6, "K": 8, "R": 10}
CARBONATE, PEAT, SPOIL = 0x10, 0x20, 0x40

# (prefix, digit, suffix) -> water class
WATER = {
    ("", "3", ""): 1, ("", "2", ""): 2, ("", "2", "g"): 3,
    ("", "1", ""): 4, ("", "1", "w"): 4,
    ("N", "3", ""): 5,
    ("N", "2", ""): 6, ("N", "2", "w"): 6, ("Ü", "2", ""): 6,
    ("N", "1", ""): 7, ("N", "1", "w"): 7, ("Ü", "1", ""): 7,
    ("N", "0", ""): 8, ("Ü", "0", ""): 8,
    ("O", "4", ""): 6, ("O", "4", "w"): 6, ("O", "4", "ü"): 6,
    ("O", "3", ""): 7, ("O", "3", "ü"): 7,
    ("O", "2", ""): 8, ("O", "1", ""): 8,
    # legacy W prefix (legend footnote 3: W...2 is now N...2w, W...1 is (T)...1w)
    ("W", "2", ""): 6, ("W", "1", ""): 4,
}

CODE_RE = re.compile(r"^\(?T?\)?([NÜOWpD]?)([AZMKR])([+Cv]*)\(?T?\)?([0-4])([gwü]?)$")


def parse(code):
    """Return (nutrient, water, flags) or None if the code is not a site group."""
    if not code:
        return None
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    prefix, letter, mods, digit, suffix = m.groups()
    nutrient = NUTRIENT[letter] + ("+" in mods) - ("v" in mods)
    flags = (CARBONATE if "C" in mods else 0) | (PEAT if prefix == "O" else 0) | (SPOIL if prefix in "pD" and prefix else 0)
    wprefix = "" if prefix in ("p", "D") else prefix
    water = WATER.get((wprefix, digit, suffix), 0)
    return nutrient, water, flags
