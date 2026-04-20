#!/bin/bash
# scripts/02_download_data.sh
# Downloads NOAA GSOD data for Bengaluru stations
 
set -e
STATION_HAL="43296099999"
STATION_CITY="43295099999"
BASE_URL="https://www.ncei.noaa.gov/data/global-summary-of-the-day/access"
OUT_DIR="data/raw/bengaluru"
 
mkdir -p $OUT_DIR
 
echo "Downloading HAL Airport station data (2010-2024)..."
for year in $(seq 2010 2024); do
  FILE="${STATION_HAL}.csv"
  URL="${BASE_URL}/${year}/${FILE}"
  OUT="${OUT_DIR}/hal_${year}.csv"
  if [ ! -f "$OUT" ]; then
    echo "  Fetching $year..."
    if curl -s -f -o "$OUT" "$URL"; then
      echo "  OK: $year"
    else
      echo "  SKIP: $year (no data)"
      rm -f "$OUT"
    fi
  else
    echo "  Already exists: $year"
  fi
done
 
echo "Merging all years..."
# Keep header from first file, skip headers from rest
head -1 $(ls ${OUT_DIR}/hal_*.csv | head -1) > ${OUT_DIR}/bengaluru_combined.csv
for f in ${OUT_DIR}/hal_*.csv; do
  tail -n +2 "$f" >> ${OUT_DIR}/bengaluru_combined.csv
done
 
ROWS=$(wc -l < ${OUT_DIR}/bengaluru_combined.csv)
echo "Done. Total rows: $ROWS"
echo "Output: ${OUT_DIR}/bengaluru_combined.csv"
