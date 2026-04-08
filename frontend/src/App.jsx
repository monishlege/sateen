import React, { useEffect, useMemo, useState } from "react";
import { subscribeReadings, subscribeLatestPrediction, triggerDemoTick } from "./services/dataService";
import { log, warn } from "./utils/logger";
import SignalChart from "./components/SignalChart.jsx";
import PredictionCard from "./components/PredictionCard.jsx";
import BandStatus from "./components/BandStatus.jsx";
import ISSLiveFeed from "./components/ISSLiveFeed.jsx";

function Dashboard() {
  const [readings, setReadings] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const unsubR = subscribeReadings(
      (data) => {
        setReadings(data);
        setErrors(prev => prev.filter(e => !e.startsWith("Readings error:")));
      },
      (err) => setErrors(prev => [...prev, `Readings error: ${err?.message || err}`])
    );
    const unsubP = subscribeLatestPrediction(
      (p) => {
        setPrediction(p);
        setErrors(prev => prev.filter(e => !e.startsWith("Prediction error:")));
      },
      (err) => setErrors(prev => [...prev, `Prediction error: ${err?.message || err}`])
    );
    return () => {
      try { unsubR(); } catch {}
      try { unsubP(); } catch {}
    };
  }, []);

  useEffect(() => {
    const autoTickEnabled = import.meta.env.VITE_DEMO_AUTOTICK !== "false";
    if (!autoTickEnabled) return;
    log("Auto-seeding enabled for demo");
    triggerDemoTick().catch(e => warn("initial demo tick failed", e));
    const interval = setInterval(() => {
      triggerDemoTick().catch(e => warn("demo tick failed", e));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const latestReading = useMemo(() => readings[readings.length - 1] || null, [readings]);

  const locationInfo = useMemo(() => {
    if (!latestReading || !latestReading.location) return "Locating ISS...";
    const { lat, lon } = latestReading.location;
    const name = latestReading.location.name || latestReading.locationName;
    const coordStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
    if (name && name !== "Unknown Area" && name !== "Unknown") {
      return `ISS monitoring over ${name} (${coordStr})`;
    }
    return `ISS monitoring over ${coordStr}`;
  }, [latestReading]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Adaptive Multi-Band Satellite Selector</h1>
        <div className="text-sm font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded mt-1">
          {locationInfo}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded p-3">
          <div className="font-semibold">Issues</div>
          <ul className="list-disc pl-5">
            {errors.slice(-3).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SignalChart readings={readings} />
          <div className="mt-4">
            <PredictionCard prediction={prediction} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ISSLiveFeed />
          <BandStatus latestReading={latestReading} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <Dashboard />;
}
