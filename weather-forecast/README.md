# Bengaluru Weather Forecasting Pipeline 🌦️

An end-to-end Big Data pipeline for processing historical weather data and predicting temperature and rainfall in Bengaluru using **Apache Spark** and **Hadoop (HDFS)**.

## 🚀 Project Overview
This project ingests historical weather data from NOAA, cleans and processes it using Spark's distributed computing capabilities, and trains machine learning models to forecast local weather patterns.

### Technical Stack
- **Spark 4.1.1**: Large-scale data processing and MLlib.
- **Hadoop (HDFS)**: Distributed storage for raw data, processed features, and trained models.
- **Python 3.10**: Core logic and script environment.
- **Models**: Random Forest Regressor (Temperature) and Linear Regression (Rainfall).

---

## 🛠️ Implementation Details

### Data Flow
1. **Ingestion**: Raw CSV data is uploaded to HDFS (`/weather/raw`).
2. **Preprocessing**: Data is cleaned (handling NOAA sentinel values like 999.9), unit-converted, and feature-engineered (seasonal lags, day of year).
3. **Storage**: Processed features are stored as **Parquet** in HDFS (`/weather/processed`).
4. **Modeling**: Spark MLlib handles cross-validation and training.
5. **Evaluation**: Predictions are compared against test sets to calculate RMSE and R² scores.

### Key Features Used
- `temp_lag1`, `temp_7d_avg`: Temporal dependencies.
- `is_monsoon`: Seasonal awareness.
- `dew_point`, `wind_speed`: Environmental indicators.

---

## 🏃 How to Run

### 1. Environment Setup
Ensure you set the Python environment for Spark:
```bash
export PYSPARK_PYTHON=/opt/homebrew/bin/python3.10
export PYSPARK_DRIVER_PYTHON=/opt/homebrew/bin/python3.10
```

### 2. Execution Sequence
Run the scripts in the following order:

| Step | Script | Description |
| :--- | :--- | :--- |
| 1. | `src/preprocess.py` | Cleans raw data and saves features to HDFS. |
| 2. | `src/train_model.py` | Trains ML models and persists them to HDFS. |
| 3. | `src/evaluate.py` | Generates performance metrics and plots. |
| 4. | `src/predict.py` | Runs a manual prediction for a specific day. |

Example command:
```bash
spark-submit --master "local[*]" src/preprocess.py
```

---

## 📊 Output & Results

### Model Performance
- **Temperature Prediction**:
  - **RMSE**: 0.86 °C
  - **R² Score**: 0.8888 (Excellent fit)
- **Rainfall Prediction**:
  - **RMSE**: 8.57 mm

### Visualizations
After running `src/evaluate.py`, you can find the performance plots at:
`logs/evaluation_plots.png`

### Manual Forecast Sample
```text
═════════════════════════════════════════════
  BENGALURU WEATHER FORECAST
═════════════════════════════════════════════
  Predicted Temperature : 26.6 °C
  Predicted Rainfall    : 0.00 mm
═════════════════════════════════════════════
```

---

## 📊 Evaluation Visualizations

The pipeline generates an evaluation dashboard at `logs/evaluation_plots.png` to help understand model performance.

![Evaluation Dashboard](logs/evaluation_plots.png)

### Understanding the Plots
1.  **Temperature: Actual vs Predicted (Time Series)**: Shows how well the model tracked temperature over the last year. Our Random Forest model captures the complex seasonal Bengaluru weather cycles with high fidelity.
2.  **Temperature Scatter Plot**: Points clustered tightly around the red dashed line (Perfect Fit) confirm the high **0.88 R² score**.
3.  **Mean Monthly Rainfall**: A bar chart verifying that the model properly identifies the **Southwest and Northeast monsoons** (peaks during July–October).
4.  **Temperature Residuals Distribution**: A histogram of errors. A narrow curve centered at **0** indicates the model is both highly precise and unbiased.

---

## 📁 HDFS Structure
- `/weather/raw/`: Raw input data (CSV).
- `/weather/processed/`: Feature-engineered data (Parquet).
- `/weather/models/`: Saved Spark ML Pipeline models.

> [!NOTE]
> If the system is rebooted and HDFS metadata is lost, re-upload the raw data and re-run the preprocessing script.
