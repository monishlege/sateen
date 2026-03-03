import argparse
import time
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from joblib import dump

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("train")

def weather_impact(w):
  m = {"Clear":0,"Cloudy":5,"Light Rain":15,"Heavy Rain":30}
  return m.get(w,0)

def build_features(df):
  df["weather_impact_db"] = df["weather"].map(weather_impact).fillna(0)
  df["l_adj"] = df["l_dbm"] - df["weather_impact_db"]
  df["s_adj"] = df["s_dbm"] - df["weather_impact_db"]
  df["c_adj"] = df["c_dbm"] - df["weather_impact_db"]
  df["x_adj"] = df["x_dbm"] - df["weather_impact_db"]
  num = ["l_dbm","s_dbm","c_dbm","x_dbm","temperature","humidity","elevation_deg","weather_impact_db","l_adj","s_adj","c_adj","x_adj"]
  X = df[num]
  y = df["best_band"]
  return X,y,num

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--csv", required=True)
  ap.add_argument("--model_out", default="model.joblib")
  args = ap.parse_args()
  df = pd.read_csv(args.csv)
  req = {"l_dbm","s_dbm","c_dbm","x_dbm","temperature","humidity","elevation_deg","weather","best_band"}
  miss = req - set(df.columns)
  if miss:
    log.error(f"Missing columns: {miss}")
    return
  df = df.dropna(subset=["best_band"])
  X,y,feats = build_features(df)
  Xtr,Xte,ytr,yte = train_test_split(X,y,test_size=0.25,random_state=42,stratify=y)
  clf = RandomForestClassifier(n_estimators=150,max_depth=12,min_samples_leaf=2,random_state=42,n_jobs=-1)
  t0 = time.time()
  clf.fit(Xtr,ytr)
  train_time = time.time()-t0
  yp = clf.predict(Xte)
  acc = accuracy_score(yte,yp)
  log.info(f"Accuracy: {acc:.3f}")
  log.info(f"Train time: {train_time:.2f}s")
  log.info("Report:\n"+classification_report(yte,yp))
  log.info("Confusion:\n"+str(confusion_matrix(yte,yp)))
  dump({"model":clf,"features":feats}, args.model_out)
  log.info(f"Saved to {args.model_out}")

if __name__=="__main__":
  main()
