"""Download GBIF occurrences for validation (never used as model input).

Writes JSONL rows {key, taxonKey, species, x, y, unc, year, dataset} in EPSG:25833.
Target species + all Agaricomycetes (classKey 186) as the target-group background,
which approximates observer effort for the bias-aware validation.

Usage: python3 -I pipeline/fetch_gbif.py OUT.jsonl
Data: GBIF.org occurrence records, licences per record (CC0 / CC BY / CC BY-NC).
"""
import json
import sys
import time
import urllib.parse
import urllib.request

from pyproj import Transformer

API = "https://api.gbif.org/v1/occurrence/search"
MAX_UNC = 200  # metres; drop obscured / imprecise records
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)


def pages(params):
    offset = 0
    while True:
        q = dict(params, limit=300, offset=offset)
        for attempt in range(4):
            try:
                with urllib.request.urlopen(API + "?" + urllib.parse.urlencode(q, doseq=True), timeout=60) as r:
                    data = json.load(r)
                break
            except Exception as e:
                print("retry", offset, e, file=sys.stderr, flush=True)
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))
        print(f"offset {offset}/{data.get('count')}", file=sys.stderr, flush=True)
        yield from data["results"]
        if data["endOfRecords"] or offset > 99000:
            return
        offset += 300


def main():
    out = sys.argv[1]
    params = {"classKey": 186, "country": "DE", "stateProvince": ["Brandenburg", "Berlin"],
              "hasCoordinate": "true", "hasGeospatialIssue": "false", "occurrenceStatus": "PRESENT"}
    n = kept = 0
    seen = set()
    # the search API stops paging around offset 10 000, so query in year slices < 10k
    slices = ["*,2014", "2015,2019", "2020,2021", "2022,2022", "2023,2023", "2024,2024",
              "2025,2025", "2026,2026"]
    with open(out + ".tmp", "w") as f:
        for r in (rec for yr in slices for rec in pages(dict(params, year=yr))):
            if r["key"] in seen:
                continue
            seen.add(r["key"])
            n += 1
            unc = r.get("coordinateUncertaintyInMeters")
            if unc is not None and unc > MAX_UNC:
                continue
            x, y = TO_UTM.transform(r["decimalLongitude"], r["decimalLatitude"])
            f.write(json.dumps({
                "key": r["key"], "taxonKey": r.get("acceptedTaxonKey") or r.get("taxonKey"),
                "speciesKey": r.get("speciesKey"), "species": r.get("species"),
                "x": round(x), "y": round(y), "unc": unc, "year": r.get("year"),
                "month": r.get("month"), "dataset": r.get("datasetKey"), "license": r.get("license"),
            }) + "\n")
            kept += 1
    import os
    os.replace(out + ".tmp", out)
    print(f"fetched {n}, kept {kept} (uncertainty <= {MAX_UNC} m or unknown)")


if __name__ == "__main__":
    main()
