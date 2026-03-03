import React, { useEffect, useMemo, useState } from "react";
import { subscribeReadings, subscribeLatestPrediction } from "./services/dataService";
import { log, warn } from "./utils/logger";
import SignalChart from "./components/SignalChart.jsx";
import PredictionCard from "./components/PredictionCard.jsx";
import BandStatus from "./components/BandStatus.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import Login from "./pages/Login.jsx";

function Dashboard() {
  const [readings, setReadings] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [errors, setErrors] = useState([]);
  const { token, setToken, user } = useAuth();

  useEffect(() => {
    const unsubR = subscribeReadings(
      (data) => setReadings(data),
      (err) => setErrors(prev => [...prev, `Readings error: ${err?.message || err}`])
    );
    const unsubP = subscribeLatestPrediction(
      (p) => setPrediction(p),
      (err) => setErrors(prev => [...prev, `Prediction error: ${err?.message || err}`])
    );
    return () => {
      try { unsubR(); } catch {}
      try { unsubP(); } catch {}
    };
  }, []);

  const latestReading = useMemo(() => readings[readings.length - 1] || null, [readings]);

  useEffect(() => {
    if (latestReading) log("latest reading", latestReading);
    if (prediction) log("latest prediction", prediction);
  }, [latestReading, prediction]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Adaptive Multi-Band Satellite Selector</h1>
        <div className="text-sm text-gray-600">ISS monitoring over Bengaluru (12.97°N, 77.59°E)</div>
        <div className="mt-2 text-xs text-gray-500">
          {user ? <>Signed in as <span className="font-medium">{user.username}</span> <button className="ml-2 text-blue-600" onClick={()=>setToken("")}>Logout</button></> : "Not signed in"}
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
          <BandStatus latestReading={latestReading} />
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        Data window: last 30 minutes. Values shown are sanitized and may omit invalid samples.
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Content />
    </AuthProvider>
  );
}

function Content() {
  const { token } = useAuth();
  return token ? <Dashboard /> : <Login />;
}
