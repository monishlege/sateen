import argparse
import firebase_admin
from firebase_admin import credentials, db
import pandas as pd
import matplotlib.pyplot as plt

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--db_url", required=True)
  ap.add_argument("--service_account", required=True)
  ap.add_argument("--out", default="signals.png")
  args = ap.parse_args()

  cred = credentials.Certificate(args.service_account)
  firebase_admin.initializeApp(cred, {"databaseURL": args.db_url})
  ref = db.reference("/readings")
  data = ref.get() or {}

  rows = []
  for k, v in data.items():
    v["timestamp"] = int(k)
    rows.append(v)

  df = pd.DataFrame(rows).sort_values("timestamp")
  plt.figure(figsize=(12,6))
  for col,label in [("l_dbm","L"),("s_dbm","S"),("c_dbm","C"),("x_dbm","X")]:
    if col in df.columns:
      plt.plot(pd.to_datetime(df["timestamp"], unit="ms"), df[col], label=f"{label}-band")
  plt.legend(); plt.title("Signal Strengths"); plt.xlabel("Time"); plt.ylabel("dBm"); plt.grid(True, alpha=0.3)
  plt.tight_layout(); plt.savefig(args.out)
  print(f"Saved plot to {args.out}")

if __name__ == "__main__":
  main()
