import time, os
from joblib import load
import numpy as np
import pytest

@pytest.mark.parametrize("model_path", ["model.joblib"])
def test_model_load_and_predict_speed(model_path):
  assert os.path.exists(model_path), "Model file missing; run train.py"
  bundle = load(model_path)
  clf = bundle["model"]; feats = bundle["features"]
  sample = {
    "l_dbm": -70, "s_dbm": -65, "c_dbm": -55, "x_dbm": -45,
    "temperature": 25, "humidity": 60, "elevation_deg": 45,
    "weather_impact_db": 5,
    "l_adj": -75, "s_adj": -70, "c_adj": -60, "x_adj": -50
  }
  X = np.array([[sample[f] for f in feats]])
  t0 = time.time()
  pred = clf.predict(X)[0]
  latency_ms = (time.time() - t0) * 1000.0
  assert latency_ms < 100.0
  assert pred in ["L","S","C","X"]
