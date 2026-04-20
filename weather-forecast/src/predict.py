from pyspark.sql import SparkSession
from pyspark.ml import PipelineModel
from datetime import date
 
spark = SparkSession.builder \
    .appName("BengaluruWeatherPredict") \
    .config("spark.hadoop.fs.defaultFS", "hdfs://localhost:9000") \
    .getOrCreate()
spark.sparkContext.setLogLevel("WARN")
 
# Load saved models
model_temp = PipelineModel.load(
    "hdfs://localhost:9000/weather/models/bengaluru/temperature_rf"
)
model_rain = PipelineModel.load(
    "hdfs://localhost:9000/weather/models/bengaluru/rainfall_lr"
)
 
# ─── Example: Predict for a monsoon day in July ─────────────
new_data = spark.createDataFrame([{
    "month":              7,
    "day_of_year":        190,
    "dew_point_c":        22.0,
    "wind_speed":         14.0,
    "is_monsoon":         1,
    "temp_lag1":          26.5,
    "temp_lag2":          26.0,
    "temp_lag3":          25.8,
    "temp_7d_avg":        26.2,
    "temp_c":             26.5,   # for rainfall model
    "rain_lag1":          12.0,   # yesterday's rain (mm)
}])
 
t_pred = model_temp.transform(new_data).collect()[0]["prediction"]
r_pred = model_rain.transform(new_data).collect()[0]["prediction"]
 
print("═" * 45)
print("  BENGALURU WEATHER FORECAST")
print("═" * 45)
print(f"  Predicted Temperature : {t_pred:.1f} °C")
print(f"  Predicted Rainfall    : {max(0, r_pred):.2f} mm")
print("═" * 45)
spark.stop()
