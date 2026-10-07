"""Build a compact city list from GeoNames dumps (CC BY 4.0).
Usage: python -I build_cities.py <cities15000.txt> <countryInfo.txt> <out.json>
"""
import json, sys

cities_path, country_path, out_path = sys.argv[1:4]

countries = {}
with open(country_path, encoding="utf-8") as f:
    for line in f:
        if line.startswith("#"):
            continue
        cols = line.rstrip("\n").split("\t")
        if len(cols) > 4:
            countries[cols[0]] = cols[4]

best = {}
with open(cities_path, encoding="utf-8") as f:
    for line in f:
        c = line.rstrip("\n").split("\t")
        name, ascii_name, lat, lon, fcode, cc, admin1, pop = c[1], c[2], float(c[4]), float(c[5]), c[7], c[8], c[10], int(c[14] or 0)
        if fcode in ("PPLX", "PPLH", "PPLQ", "PPLW"):
            continue
        keep = (cc == "US" and pop >= 100_000) or pop >= 1_000_000 or fcode == "PPLC"
        if not keep:
            continue
        region = admin1 if cc == "US" else countries.get(cc, cc)
        label = f"{name}, {region}"
        if label not in best or best[label]["population"] < pop:
            best[label] = {"label": label, "name": name, "ascii": ascii_name, "country": cc,
                           "lat": round(lat, 4), "lon": round(lon, 4), "population": pop}

rows = sorted(best.values(), key=lambda r: -r["population"])
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
us = sum(1 for r in rows if r["country"] == "US")
print(f"{len(rows)} cities ({us} US). Top: {[r['label'] for r in rows[:5]]}")
print("Samples:", [r for r in rows if r["label"] in ("Austin, TX", "Birmingham, AL", "Ann Arbor, MI", "Columbus, OH", "San Francisco, CA", "Istanbul, Turkey", "London, United Kingdom")])
