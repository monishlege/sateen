export function toNumber(v, def = null) {
  if (v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function isValidBand(band) {
  return ["L", "S", "C", "X"].includes(band);
}

export function sanitizeReading(raw) {
  const ts = toNumber(raw.timestamp, null);
  if (ts === null) return null;
  const lat = toNumber(raw?.location?.lat, null);
  const lon = toNumber(raw?.location?.lon, null);
  const locationName = typeof raw?.location?.name === "string" ? raw.location.name : null;
  const issApi = raw?.iss_api && typeof raw.iss_api === "object" ? {
    id: toNumber(raw.iss_api.id, null),
    name: typeof raw.iss_api.name === "string" ? raw.iss_api.name : null,
    altitude: toNumber(raw.iss_api.altitude, null),
    velocity: toNumber(raw.iss_api.velocity, null),
    visibility: typeof raw.iss_api.visibility === "string" ? raw.iss_api.visibility : null,
    footprint: toNumber(raw.iss_api.footprint, null),
    timestamp: toNumber(raw.iss_api.timestamp, null),
    daynum: toNumber(raw.iss_api.daynum, null),
    solar_lat: toNumber(raw.iss_api.solar_lat, null),
    solar_lon: toNumber(raw.iss_api.solar_lon, null),
    units: typeof raw.iss_api.units === "string" ? raw.iss_api.units : null
  } : null;
  return {
    timestamp: ts,
    l_dbm: toNumber(raw.l_dbm, null),
    s_dbm: toNumber(raw.s_dbm, null),
    c_dbm: toNumber(raw.c_dbm, null),
    x_dbm: toNumber(raw.x_dbm, null),
    temperature: toNumber(raw.temperature, null),
    humidity: toNumber(raw.humidity, null),
    elevation_deg: toNumber(raw.elevation_deg, null),
    weather: typeof raw.weather === "string" ? raw.weather : "Unknown",
    iss_api: issApi,
    location: lat !== null && lon !== null ? { lat, lon, ...(locationName ? { name: locationName } : {}) } : null
  };
}

export function sanitizePrediction(raw) {
  const band = typeof raw.best_band === "string" ? raw.best_band : null;
  if (!band || !isValidBand(band)) return null;
  return {
    best_band: band,
    confidence: toNumber(raw.confidence, null),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
    timestamp: toNumber(raw.timestamp, null),
    model_version: typeof raw.model_version === "string" ? raw.model_version : "unknown"
  };
}
