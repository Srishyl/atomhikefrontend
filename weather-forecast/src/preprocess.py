# src/preprocess.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, to_date, month, dayofyear, year, when,
    lag, isnan, isnull, avg, stddev
)
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("BengaluruWeatherPreprocess") \
    .config("spark.hadoop.fs.defaultFS", "hdfs://localhost:9000") \
    .config("spark.sql.shuffle.partitions", "4") \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

# ─── Load raw data from HDFS ─────────────────────────────────
raw_data_path = "hdfs://localhost:9000/weather/raw/bengaluru/bengaluru_combined.csv"
df = spark.read.csv(
    raw_data_path,
    header=True,
    inferSchema=True
)

print(f"Raw rows loaded: {df.count()}")
df.printSchema()

# ─── Select and rename columns with sentinel handling ──────────────────
# NOAA flags: 99.9 (PRCP), 999.9 (TEMP/DEWP/WDSP), 99.99 (PRCP), 9999.9 (SLP)
df = df.select(
    to_date(col("DATE")).alias("date"),
    when(col("TEMP") == 999.9, None).otherwise(col("TEMP")).alias("temp_f"),
    when(col("MAX") == 999.9, None).otherwise(col("MAX")).alias("temp_max_f"),
    when(col("MIN") == 999.9, None).otherwise(col("MIN")).alias("temp_min_f"),
    when(col("PRCP") == 99.99, None).otherwise(col("PRCP")).alias("precip_in"),
    when(col("DEWP") == 999.9, None).otherwise(col("DEWP")).alias("dew_point_f"),
    when(col("WDSP") == 999.9, None).otherwise(col("WDSP")).alias("wind_speed_knots"),
    when(col("SLP") == 9999.9, None).otherwise(col("SLP")).alias("sea_level_pressure_f"),
)

# ─── Unit conversion (Imperial → Metric) ─────────────────────
df = df \
    .withColumn("temp_c",      (col("temp_f")     - 32) * 5 / 9) \
    .withColumn("temp_max_c",  (col("temp_max_f") - 32) * 5 / 9) \
    .withColumn("temp_min_c",  (col("temp_min_f") - 32) * 5 / 9) \
    .withColumn("dew_point_c", (col("dew_point_f")- 32) * 5 / 9) \
    .withColumn("precip_mm",   col("precip_in")   * 25.4) \
    .withColumn("wind_speed",  col("wind_speed_knots") * 0.514444) \
    .withColumn("sea_level_pressure", col("sea_level_pressure_f"))

# ─── Drop rows missing ESSENTIAL data only ───────────────────
initial_count = df.count()
df = df.dropna(subset=["date", "temp_c"])
valid_count = df.count()
print(f"Rows after dropping missing essential data (date/temp): {valid_count} (Dropped {initial_count - valid_count})")

# ─── Extract time features ───────────────────────────────────
df = df \
    .withColumn("year",       year("date")) \
    .withColumn("month",      month("date")) \
    .withColumn("day_of_year",dayofyear("date"))

# ─── Bengaluru-specific season labels ────────────────────────
df = df.withColumn("season",
    when((col("month") >= 6)  & (col("month") <= 9),  "SW_Monsoon")
   .when((col("month") >= 10) & (col("month") <= 11), "NE_Monsoon")
   .when((col("month") >= 3)  & (col("month") <= 5),  "Summer")
   .otherwise("Winter")
)
df = df.withColumn("is_monsoon",
    when((col("month") >= 6) & (col("month") <= 9), 1).otherwise(0))

# ─── Lag features (last 3 days' temperature) ─────────────────
# We use fillna(0) for precipitation because missing PRCP usually means no rain in many GHCN/NOAA subsets
df = df.fillna(0, subset=["precip_mm"])

window = Window.orderBy("date")
df = df \
    .withColumn("temp_lag1", lag("temp_c", 1).over(window)) \
    .withColumn("temp_lag2", lag("temp_c", 2).over(window)) \
    .withColumn("temp_lag3", lag("temp_c", 3).over(window)) \
    .withColumn("rain_lag1", lag("precip_mm", 1).over(window))

# ─── 7-day rolling average temperature ───────────────────────
window7 = Window.orderBy("date").rowsBetween(-6, 0)
df = df.withColumn("temp_7d_avg", avg("temp_c").over(window7))

# ─── Final cleanup ──────────────────────────────────────────
# Drop rows that don't have enough history for lag/averages (first few days)
df = df.dropna(subset=["temp_lag3", "temp_7d_avg"])

print(f"Final processed rows: {df.count()}")
df.describe(["temp_c", "precip_mm", "wind_speed"]).show()
df.groupBy("season").count().show()

# ─── Save as Parquet to HDFS ─────────────────────────────────
df.write.mode("overwrite").parquet(
    "hdfs://localhost:9000/weather/processed/bengaluru/features"
)
print("Preprocessing complete. Output in HDFS:/weather/processed/bengaluru/features")
spark.stop()
