import React from "react";

const bandColor = {
  L: "bg-lband",
  S: "bg-sband",
  C: "bg-cband",
  X: "bg-xband"
};

export default function PredictionCard({ prediction }) {
  if (!prediction) {
    return (
      <div className="w-full bg-white rounded-lg shadow p-4">
        <div className="text-gray-600">Waiting for prediction...</div>
      </div>
    );
  }

  const { best_band, confidence, reasoning, model_version, timestamp } = prediction;
  const color = bandColor[best_band] || "bg-gray-200";

  return (
    <div className="w-full bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-12 rounded ${color}`} />
          <div>
            <div className="text-xl font-semibold">Best Band: {best_band}</div>
            <div className="text-sm text-gray-600">Confidence: {typeof confidence === "number" ? `${(confidence * 100).toFixed(1)}%` : "N/A"}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500">Model: {model_version}</div>
      </div>
      <div className="mt-3 text-gray-700">{reasoning || "No reasoning provided."}</div>
      <div className="mt-1 text-xs text-gray-400">Updated: {timestamp ? new Date(timestamp).toLocaleString() : "Unknown"}</div>
    </div>
  );
}
