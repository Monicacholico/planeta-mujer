"""
Clean OECD Time Use Database Excel into a flat CSV.

Input:  data/raw/OECD-time-use-database-updates.xlsx
Output: data/time-use.csv

Columns: country, gender, paid_work, unpaid_work, personal_care, leisure, other
Values are in minutes per day.
"""

import os
import pandas as pd

script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(script_dir)
input_path = os.path.join(project_dir, "data", "raw", "OECD-time-use-database-updates.xlsx")
output_path = os.path.join(project_dir, "data", "time-use.csv")

MAIN_CATEGORIES = {
    1: "paid_work",
    2: "unpaid_work",
    3: "personal_care",
    4: "leisure",
    5: "other",
}

OECD_COUNTRIES_COLS = range(2, 32)  # columns C through AF (30 OECD countries)


def extract_sheet(sheet_name, gender_label):
    df = pd.read_excel(input_path, sheet_name=sheet_name, header=None)

    countries = df.iloc[0, list(OECD_COUNTRIES_COLS)].tolist()
    countries = [c.strip().rstrip("*").strip() for c in countries if isinstance(c, str)]

    rows = []
    for _, row in df.iterrows():
        cat_id = row.iloc[0]
        if cat_id in MAIN_CATEGORIES:
            cat_name = MAIN_CATEGORIES[cat_id]
            for i, col_idx in enumerate(OECD_COUNTRIES_COLS):
                if i >= len(countries):
                    break
                val = row.iloc[col_idx]
                if isinstance(val, (int, float)) and pd.notna(val):
                    minutes = round(val, 1)
                else:
                    minutes = None
                rows.append({
                    "country": countries[i],
                    "gender": gender_label,
                    "category": cat_name,
                    "minutes": minutes,
                })
    return rows


all_rows = extract_sheet("Men", "men") + extract_sheet("Women", "women")
df_long = pd.DataFrame(all_rows)

df_long = df_long.dropna(subset=["minutes"])

df_wide = df_long.pivot_table(
    index=["country", "gender"],
    columns="category",
    values="minutes",
    aggfunc="first",
).reset_index()

df_wide.columns.name = None
df_wide = df_wide[["country", "gender", "paid_work", "unpaid_work", "personal_care", "leisure", "other"]]
df_wide = df_wide.sort_values(["country", "gender"]).reset_index(drop=True)

df_wide.to_csv(output_path, index=False)
print(f"Saved {len(df_wide)} rows to {output_path}")
print(f"Countries: {df_wide['country'].nunique()}")
print(f"\nSample:\n{df_wide.head(10)}")
