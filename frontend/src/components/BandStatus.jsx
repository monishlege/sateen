import React, { useMemo } from "react";

function Row({ label, value, unit, color }) {
  return (
    <div className="flex justify-between py-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded ${color}`} />
        <div className="text-sm text-gray-700">{label}</div>
      </div>
      <div className="text-sm font-medium">{value !== null && value !== undefined ? `${value}${unit || ""}` : "N/A"}</div>
    </div>
  );
}

export default function BandStatus({ latestReading }) {
  const rows = useMemo(() => {
    if (!latestReading) return [];
    return [
      { label: "L-band", value: latestReading.l_dbm, unit: " dBm", color: "bg-lband" },
      { label: "S-band", value: latestReading.s_dbm, unit: " dBm", color: "bg-sband" },
      { label: "C-band", value: latestReading.c_dbm, unit: " dBm", color: "bg-cband" },
      { label: "X-band", value: latestReading.x_dbm, unit: " dBm", color: "bg-xband" },
      { label: "Elevation", value: latestReading.elevation_deg, unit: "°", color: "bg-gray-300" },
      { label: "Temperature", value: latestReading.temperature, unit: "°C", color: "bg-gray-300" },
      { label: "Humidity", value: latestReading.humidity, unit: "%", color: "bg-gray-300" },
      { label: "Weather", value: latestReading.weather, unit: "", color: "bg-gray-300" }
    ];
  }, [latestReading]);

  const issRows = useMemo(() => {
    const iss = latestReading?.iss_api;
    if (!iss) return [];
    const units = iss.units || "km";
    return [
      { label: "ISS Altitude", value: iss.altitude, unit: ` ${units}`, color: "bg-blue-400" },
      { label: "ISS Velocity", value: iss.velocity, unit: ` ${units}/h`, color: "bg-blue-400" },
      { label: "ISS Visibility", value: iss.visibility, unit: "", color: "bg-blue-400" },
      { label: "ISS Footprint", value: iss.footprint, unit: ` ${units}`, color: "bg-blue-400" },
      { label: "ISS Timestamp", value: iss.timestamp, unit: "", color: "bg-blue-400" },
      { label: "ISS Daynum", value: iss.daynum, unit: "", color: "bg-blue-400" },
      { label: "ISS Solar Lat", value: iss.solar_lat, unit: "°", color: "bg-blue-400" },
      { label: "ISS Solar Lon", value: iss.solar_lon, unit: "°", color: "bg-blue-400" },
    ];
  }, [latestReading]);

  const locationName = useMemo(() => {
    if (!latestReading || !latestReading.location) return "Unknown";
    return latestReading.location.name || `${latestReading.location.lat.toFixed(2)}, ${latestReading.location.lon.toFixed(2)}`;
  }, [latestReading]);

  return (
    <div className="w-full bg-white rounded-lg shadow p-4">
      <div className="text-lg font-semibold mb-2">Sensor Snapshot</div>
      <div className="text-sm text-gray-500 mb-2">Over: {locationName}</div>
      {rows.length ? rows.map((r, i) => (
        <Row key={i} label={r.label} value={r.value} unit={r.unit} color={r.color} />
      )) : <div className="text-gray-600">Waiting for readings...</div>}
      {issRows.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {issRows.map((r, i) => (
            <Row key={`iss-${i}`} label={r.label} value={r.value} unit={r.unit} color={r.color} />
          ))}
        </div>
      )}
    </div>
  );
}
