from pyspark.sql import SparkSession
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.regression import RandomForestRegressor, LinearRegression
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.tuning import CrossValidator, ParamGridBuilder
 
spark = SparkSession.builder \
    .appName("BengaluruWeatherTraining") \
    .config("spark.hadoop.fs.defaultFS", "hdfs://localhost:9000") \
    .config("spark.sql.shuffle.partitions", "4") \
    .getOrCreate()
spark.sparkContext.setLogLevel("WARN")
 
# ─── Load processed features ─────────────────────────────────
df = spark.read.parquet(
    "hdfs://localhost:9000/weather/processed/bengaluru/features"
)
print(f"Training rows: {df.count()}")
 
# ─── Feature sets ────────────────────────────────────────────
temp_features = [
    "month", "day_of_year", "dew_point_c", "wind_speed",
    "is_monsoon",
    "temp_lag1", "temp_lag2", "temp_lag3", "temp_7d_avg"
]
 
rain_features = temp_features + ["temp_c", "rain_lag1"]
 
# ─── Train/test split (80/20, time-aware) ────────────────────
train, test = df.randomSplit([0.8, 0.2], seed=42)
print(f"Train: {train.count()} | Test: {test.count()}")
 
# ════════════════════════════════════════════════════════════
# MODEL 1: Temperature — Random Forest Regressor
# ════════════════════════════════════════════════════════════
assembler_t = VectorAssembler(inputCols=temp_features, outputCol="raw_features_t",
                              handleInvalid="skip")
scaler_t    = StandardScaler(inputCol="raw_features_t", outputCol="features_t",
                             withMean=True, withStd=True)
rf          = RandomForestRegressor(
    labelCol="temp_c", featuresCol="features_t",
    numTrees=150, maxDepth=10, seed=42
)
pipeline_t = Pipeline(stages=[assembler_t, scaler_t, rf])
 
# Cross-validation grid search
paramGrid_t = ParamGridBuilder() \
    .addGrid(rf.numTrees, [100, 150]) \
    .addGrid(rf.maxDepth, [8, 10]) \
    .build()
 
cv_t = CrossValidator(
    estimator=pipeline_t,
    estimatorParamMaps=paramGrid_t,
    evaluator=RegressionEvaluator(labelCol="temp_c", metricName="rmse"),
    numFolds=3,
    seed=42
)
 
print("Training temperature model...")
cv_model_t = cv_t.fit(train)
best_model_t = cv_model_t.bestModel
 
preds_t = best_model_t.transform(test)
eval_t  = RegressionEvaluator(labelCol="temp_c", predictionCol="prediction")
rmse_t  = eval_t.setMetricName("rmse").evaluate(preds_t)
mae_t   = eval_t.setMetricName("mae").evaluate(preds_t)
r2_t    = eval_t.setMetricName("r2").evaluate(preds_t)
print(f"  [Temperature] RMSE={rmse_t:.2f}°C | MAE={mae_t:.2f}°C | R²={r2_t:.4f}")
 
best_model_t.write().overwrite().save(
    "hdfs://localhost:9000/weather/models/bengaluru/temperature_rf"
)
print("  Temperature model saved.")
 
# ════════════════════════════════════════════════════════════
# MODEL 2: Rainfall — Linear Regression with ElasticNet
# ════════════════════════════════════════════════════════════
assembler_r = VectorAssembler(inputCols=rain_features, outputCol="raw_features_r",
                              handleInvalid="skip")
scaler_r    = StandardScaler(inputCol="raw_features_r", outputCol="features_r",
                             withMean=True, withStd=True)
lr          = LinearRegression(
    labelCol="precip_mm", featuresCol="features_r",
    maxIter=200, regParam=0.1, elasticNetParam=0.5
)
pipeline_r = Pipeline(stages=[assembler_r, scaler_r, lr])
 
paramGrid_r = ParamGridBuilder() \
    .addGrid(lr.regParam, [0.05, 0.1, 0.2]) \
    .addGrid(lr.elasticNetParam, [0.3, 0.5, 0.7]) \
    .build()
 
cv_r = CrossValidator(
    estimator=pipeline_r,
    estimatorParamMaps=paramGrid_r,
    evaluator=RegressionEvaluator(labelCol="precip_mm", metricName="rmse"),
    numFolds=3, seed=42
)
 
print("Training rainfall model...")
cv_model_r = cv_r.fit(train)
best_model_r = cv_model_r.bestModel
 
preds_r = best_model_r.transform(test)
eval_r  = RegressionEvaluator(labelCol="precip_mm", predictionCol="prediction")
rmse_r  = eval_r.setMetricName("rmse").evaluate(preds_r)
r2_r    = eval_r.setMetricName("r2").evaluate(preds_r)
print(f"  [Rainfall]    RMSE={rmse_r:.2f}mm  | R²={r2_r:.4f}")
 
best_model_r.write().overwrite().save(
    "hdfs://localhost:9000/weather/models/bengaluru/rainfall_lr"
)
print("  Rainfall model saved.")
spark.stop()
