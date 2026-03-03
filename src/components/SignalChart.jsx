import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import 'chartjs-adapter-date-fns';

Chart.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function ds(label, color, data) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    tension: 0.2,
    pointRadius: 0,
    borderWidth: 2
  };
}

export default function SignalChart({ readings }) {
  const chartData = useMemo(() => {
    const toPairs = (key) => readings
      .filter(r => typeof r[key] === "number")
      .map(r => ({ x: r.timestamp, y: r[key] }));
    return {
      datasets: [
        ds("L-band (dBm)", "#3b82f6", toPairs("l_dbm")),
        ds("S-band (dBm)", "#22c55e", toPairs("s_dbm")),
        ds("C-band (dBm)", "#f59e0b", toPairs("c_dbm")),
        ds("X-band (dBm)", "#ef4444", toPairs("x_dbm"))
      ]
    };
  }, [readings]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    scales: {
      x: {
        type: "time",
        time: { unit: "second", tooltipFormat: "HH:mm:ss" },
        grid: { display: false }
      },
      y: {
        title: { display: true, text: "Signal (dBm)" },
        grid: { color: "rgba(0,0,0,0.05)" }
      }
    },
    plugins: {
      legend: { position: "bottom" },
      tooltip: { intersect: false, mode: "index" }
    }
  };

  return (
    <div className="w-full h-80 bg-white rounded-lg shadow p-4">
      <Line data={chartData} options={options} />
    </div>
  );
}
