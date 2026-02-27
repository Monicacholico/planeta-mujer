import urllib.request
import json
import csv
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
RAW_DIR = os.path.join(OUTPUT_DIR, "raw")
os.makedirs(RAW_DIR, exist_ok=True)

INDICATOR = "SP.DYN.TFRT.IN"  # Fertility rate, total (births per woman)
BASE_URL = "https://api.worldbank.org/v2/country/WLD/indicator"

def fetch_world_bank():
    url = f"{BASE_URL}/{INDICATOR}?date=1960:2023&format=json&per_page=200"
    print(f"Fetching: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as response:
        raw = json.loads(response.read().decode())

    with open(os.path.join(RAW_DIR, "wb_fertility_raw.json"), "w") as f:
        json.dump(raw, f, indent=2)
    print(f"Raw data saved ({len(raw[1])} records)")

    records = [
        {"year": int(entry["date"]), "fertility_rate": entry["value"]}
        for entry in raw[1]
        if entry["value"] is not None
    ]
    records.sort(key=lambda r: r["year"])

    output_path = os.path.join(OUTPUT_DIR, "fertility-rate.csv")
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["year", "fertility_rate"])
        writer.writeheader()
        writer.writerows(records)

    print(f"Cleaned CSV saved: {output_path} ({len(records)} rows)")
    print(f"Range: {records[0]['year']}-{records[-1]['year']}")
    print(f"Fertility rate: {records[-1]['fertility_rate']:.2f} (latest) → {records[0]['fertility_rate']:.2f} (earliest)")

if __name__ == "__main__":
    fetch_world_bank()
