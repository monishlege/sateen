import { db } from "../firebase";
import { ref, query, orderByKey, limitToLast, onValue } from "firebase/database";
import { sanitizeReading, sanitizePrediction } from "../utils/validation";
import { warn, error } from "../utils/logger";

const MS_30_MIN = 30 * 60 * 1000;
const NODE_URL = import.meta.env.VITE_NODE_URL || (import.meta.env.DEV ? "http://localhost:3000" : "");
const POLL_INTERVAL_MS = 1000;

export async function triggerDemoTick() {
  try {
    const resp = await fetch(`${NODE_URL}/demo/tick`);
    return await resp.json();
  } catch (e) {
    error("triggerDemoTick failed", e.message);
    return null;
  }
}

export function subscribeReadings(onData, onErr) {
  try {
    if (!db) {
      let stop = false;
      async function poll() {
        try {
          const resp = await fetch(`${NODE_URL}/readings?limit=1000`);
          const arr = await resp.json();
          const now = Date.now();
          const items = (arr || [])
            .map(sanitizeReading)
            .filter(Boolean)
            .filter(r => now - r.timestamp <= MS_30_MIN)
            .sort((a, b) => a.timestamp - b.timestamp);
          onData(items);
        } catch (e) {
          onErr?.(e);
        } finally {
          if (!stop) setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
      poll();
      return () => { stop = true; };
    }
    const readingsRef = query(ref(db, "/readings"), orderByKey(), limitToLast(1000));
    const unsub = onValue(
      readingsRef,
      snap => {
        const data = snap.val();
        if (!data) return onData([]);
        const now = Date.now();
        const items = Object.entries(data)
          .map(([key, value]) => sanitizeReading({ ...value, timestamp: Number(key) }))
          .filter(Boolean)
          .filter(r => now - r.timestamp <= MS_30_MIN)
          .sort((a, b) => a.timestamp - b.timestamp);
        onData(items);
      },
      err => onErr?.(err),
      { onlyOnce: false }
    );
    return unsub;
  } catch (e) {
    warn("subscribeReadings failed", e?.message);
    onErr?.(e);
    return () => {};
  }
}

export function subscribeLatestPrediction(onData, onErr) {
  try {
    if (!db) {
      let stop = false;
      async function poll() {
        try {
          const resp = await fetch(`${NODE_URL}/prediction/latest`);
          const val = await resp.json();
          onData(val ? sanitizePrediction(val) : null);
        } catch (e) {
          onErr?.(e);
        } finally {
          if (!stop) setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
      poll();
      return () => { stop = true; };
    }
    const latestRef = ref(db, "/predictions/latest");
    return onValue(latestRef, snap => {
      const val = snap.val();
      onData(val ? sanitizePrediction(val) : null);
    }, err => onErr?.(err), { onlyOnce: false });
  } catch (e) {
    error("subscribeLatestPrediction failed", e?.message);
    onErr?.(e);
    return () => {};
  }
}
