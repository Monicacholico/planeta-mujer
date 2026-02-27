"""
Converts the WBL Excel file into a clean CSV for the D3 visualization.
Keeps only the latest year (2024) and the columns we need.

Usage:
    python3 scripts/clean_data.py

Input:  data/raw/WBL2024-1-0-Historical-Panel-Data.xlsx
Output: data/wbl-scores.csv
"""

import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(script_dir)

input_path = os.path.join(project_dir, "data", "raw", "WBL2024-1-0-Historical-Panel-Data.xlsx")
output_path = os.path.join(project_dir, "data", "wbl-scores.csv")

df = pd.read_excel(input_path, sheet_name="WBL Panel 2024")

# Filter to only the latest report year
df_latest = df[df["Report Year"] == 2024].copy()

columns_to_keep = [
    "Economy",
    "ISO Code",
    "Region",
    "Income Group",
    "WBL INDEX",
    "MOBILITY",
    "WORKPLACE",
    "PAY",
    "MARRIAGE",
    "PARENTHOOD",
    "ENTREPRENEURSHIP",
    "ASSETS",
    "PENSION",
]

df_clean = df_latest[columns_to_keep].copy()

# Rename for easier use in JavaScript
df_clean.columns = [
    "economy",
    "iso_code",
    "region",
    "income_group",
    "wbl_index",
    "mobility",
    "workplace",
    "pay",
    "marriage",
    "parenthood",
    "entrepreneurship",
    "assets",
    "pension",
]

df_clean = df_clean.sort_values("economy").reset_index(drop=True)

df_clean.to_csv(output_path, index=False)

print(f"Wrote {len(df_clean)} economies to {output_path}")
print(f"\nScore range: {df_clean['wbl_index'].min()} – {df_clean['wbl_index'].max()}")
print(f"\nSample:")
print(df_clean.head(10).to_string())
