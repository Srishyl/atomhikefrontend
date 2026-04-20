from pyspark.sql import SparkSession
from pyspark.ml import PipelineModel
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
 
spark = SparkSession.builder \
    .appName("BengaluruEvaluate") \
    .config("spark.hadoop.fs.defaultFS", "hdfs://localhost:9000") \
    .getOrCreate()
spark.sparkContext.setLogLevel("WARN")
 
df = spark.read.parquet(
    "hdfs://localhost:9000/weather/processed/bengaluru/features"
)
_, test = df.randomSplit([0.8, 0.2], seed=42)
 
model_t = PipelineModel.load(
    "hdfs://localhost:9000/weather/models/bengaluru/temperature_rf"
)
model_r = PipelineModel.load(
    "hdfs://localhost:9000/weather/models/bengaluru/rainfall_lr"
)
 
preds_t = model_t.transform(test).select("date","temp_c","prediction","month")
preds_r = model_r.transform(test).select("date","precip_mm","prediction","month")
 
pdf_t = preds_t.toPandas().sort_values("date")
pdf_r = preds_r.toPandas().sort_values("date")
pdf_r["prediction"] = pdf_r["prediction"].clip(lower=0)
 
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
fig.suptitle("Bengaluru Weather Forecast — Model Evaluation",
             fontsize=16, fontweight='bold')
 
# Plot 1: Temperature actual vs predicted over time
ax = axes[0][0]
recent = pdf_t.tail(365)
ax.plot(recent["date"], recent["temp_c"],       label="Actual",    alpha=0.7)
ax.plot(recent["date"], recent["prediction"],   label="Predicted", alpha=0.7)
ax.set_title("Temperature: Actual vs Predicted (last year)")
ax.set_ylabel("Temperature (°C)")
ax.legend()
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
plt.setp(ax.xaxis.get_majorticklabels(), rotation=30)
 
# Plot 2: Temperature scatter
ax = axes[0][1]
ax.scatter(pdf_t["temp_c"], pdf_t["prediction"], alpha=0.3, s=8)
mn, mx = pdf_t["temp_c"].min(), pdf_t["temp_c"].max()
ax.plot([mn, mx], [mn, mx], 'r--', label="Perfect fit")
ax.set_xlabel("Actual (°C)"); ax.set_ylabel("Predicted (°C)")
ax.set_title("Temperature Scatter"); ax.legend()
 
# Plot 3: Rainfall monthly averages
ax = axes[1][0]
monthly = pdf_r.groupby("month")[["precip_mm","prediction"]].mean()
monthly.plot(kind="bar", ax=ax, color=["steelblue","coral"])
ax.set_title("Mean Monthly Rainfall: Actual vs Predicted")
ax.set_xlabel("Month"); ax.set_ylabel("Rainfall (mm)")
ax.set_xticklabels(['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'], rotation=45)
 
# Plot 4: Temperature residuals
ax = axes[1][1]
pdf_t["residual"] = pdf_t["temp_c"] - pdf_t["prediction"]
ax.hist(pdf_t["residual"], bins=40, color="steelblue", edgecolor="white")
ax.axvline(0, color="red", linestyle="--")
ax.set_title("Temperature Residuals Distribution")
ax.set_xlabel("Residual (°C)"); ax.set_ylabel("Count")
 
plt.tight_layout()
plt.savefig("logs/evaluation_plots.png", dpi=150, bbox_inches="tight")
print("Plots saved to logs/evaluation_plots.png")
spark.stop()
