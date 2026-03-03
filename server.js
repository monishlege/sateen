import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import pino from "pino";
import { z } from "zod";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();
const log = pino({ level: process.env.LOG_LEVEL || "info" });

const {
  PORT = 3000,
  ARDUINO_TOKEN = "dev-token",
  FASTAPI_URL,
  FIREBASE_DB_URL,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  JWT_SECRET,
  JWT_ISSUER,
  ADMIN_KEY
} = process.env;

const defaultUsers = [
  // For demo: replace with secure store or Firebase Auth integration
  { username: "admin", passwordHash: bcrypt.hashSync("admin123", 10), role: "user" }
];
let users = defaultUsers;
try {
  if (process.env.USERS_JSON) {
    const parsed = JSON.parse(process.env.USERS_JSON);
    if (Array.isArray(parsed)) users = parsed;
  }
} catch (e) {
  // keep default
}

const readingSchema = z.object({
  timestamp: z.number().positive(),
  l_dbm: z.number().nullable().optional(),
  s_dbm: z.number().nullable().optional(),
  c_dbm: z.number().nullable().optional(),
  x_dbm: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  elevation_deg: z.number().nullable().optional(),
  weather: z.string().max(64).optional(),
  location: z.object({ lat: z.number(), lon: z.number(), name: z.string().max(256).optional() }).optional(),
});

const app = express();
app.use(cors({ origin: ["http://localhost:5173"], credentials: false }));
app.use(express.json({ limit: "256kb" }));

const memReadings = new Map();
let latestPrediction = null;

let firebaseReady = false;
try {
  if (FIREBASE_DB_URL && FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: FIREBASE_DB_URL
    });
    firebaseReady = true;
    log.info("Firebase Admin initialized");
  } else {
    log.info("Firebase not configured; using in-memory dev store");
  }
} catch (e) {
  log.warn({ err: e?.message }, "Firebase init failed; continuing without Firebase");
}
const fdb = firebaseReady ? admin.database() : null;

function auth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice(7);
  if (ARDUINO_TOKEN && token === ARDUINO_TOKEN) {
    return next();
  }
  if (!JWT_SECRET) return res.status(401).json({ error: "Unauthorized" });
  try {
    const opts = JWT_ISSUER ? { issuer: JWT_ISSUER } : {};
    const decoded = jwt.verify(token, JWT_SECRET, opts);
    if (decoded && (decoded.role === "device" || decoded.scope === "device")) {
      req.device = decoded.sub || decoded.device_id || null;
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function weatherImpact(w) {
  const m = { "Clear":0, "Cloudy":5, "Light Rain":15, "Heavy Rain":30 };
  return m[w] ?? 0;
}

function rulePredict(r) {
  const wimp = weatherImpact(r.weather);
  const l = (r.l_dbm ?? -120) - wimp;
  const s = (r.s_dbm ?? -120) - wimp;
  const c = (r.c_dbm ?? -120) - wimp;
  const x = (r.x_dbm ?? -120) - wimp;
  const pairs = [ ["L", l], ["S", s], ["C", c], ["X", x] ];
  const best = pairs.reduce((a,b) => (b[1] > a[1] ? b : a));
  return {
    best_band: best[0],
    confidence: 0.5,
    reasoning: `Rule-based selection, max adjusted: ${best[0]} (${best[1].toFixed(1)} dBm)`,
    timestamp: Math.floor(r.timestamp),
    model_version: "rule-v1",
    latency_ms: 1.0
  };
}

app.post("/ingest", auth, async (req, res) => {
  const parse = readingSchema.safeParse(req.body);
  if (!parse.success) {
    log.warn({ err: parse.error }, "Invalid payload");
    return res.status(400).json({ error: "Invalid payload", details: parse.error.flatten() });
  }
  const r = parse.data;
  const key = Math.floor(r.timestamp);
  memReadings.set(key, r);
  // keep last 2000
  if (memReadings.size > 2000) {
    const oldest = [...memReadings.keys()].sort((a,b)=>a-b)[0];
    memReadings.delete(oldest);
  }
  if (fdb) {
    try {
      await fdb.ref(`/readings/${key}`).set(r);
    } catch (e) {
      log.warn({ err: e?.message }, "Firebase write /readings failed");
    }
  }
  // predict
  let pred;
  try {
    if (FASTAPI_URL) {
      const resp = await axios.post(`${FASTAPI_URL}/predict`, r, { timeout: 2000 });
      pred = resp.data;
    } else {
      pred = rulePredict(r);
    }
  } catch (e) {
    log.warn({ err: e?.message }, "FASTAPI predict failed; using rule");
    pred = rulePredict(r);
  }
  latestPrediction = pred;
  if (fdb) {
    try {
      await fdb.ref(`/predictions/latest`).set(pred);
      await fdb.ref(`/predictions/${pred.timestamp || key}`).set(pred);
    } catch (e) {
      log.warn({ err: e?.message }, "Firebase write /predictions failed");
    }
  }
  res.json({ ok: true, key, pred });
});

app.post("/auth/issue", (req, res) => {
  const key = req.headers["x-admin-key"];
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(403).json({ error: "Forbidden" });
  const device_id = req.body?.device_id;
  if (!device_id) return res.status(400).json({ error: "device_id required" });
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT not configured" });
  const signOpts = { expiresIn: "30d" };
  if (JWT_ISSUER && typeof JWT_ISSUER === "string") signOpts.issuer = JWT_ISSUER;
  const token = jwt.sign({ sub: device_id, role: "device" }, JWT_SECRET, signOpts);
  res.json({ token });
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT not configured" });
  const signOpts2 = { expiresIn: "7d" };
  if (JWT_ISSUER && typeof JWT_ISSUER === "string") signOpts2.issuer = JWT_ISSUER;
  const token = jwt.sign({ sub: username, role: user.role || "user" }, JWT_SECRET, signOpts2);
  res.json({ token, user: { username, role: user.role || "user" } });
});

app.get("/auth/me", (req, res) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_ISSUER ? { issuer: JWT_ISSUER } : {});
    res.json({ sub: decoded.sub, role: decoded.role });
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
});
app.get("/readings", (req, res) => {
  const limit = Number(req.query.limit || 1000);
  const now = Date.now();
  const arr = [...memReadings.entries()]
    .map(([k,v])=>({ ...v, timestamp: k }))
    .filter(r => now - r.timestamp <= 30*60*1000)
    .sort((a,b)=>a.timestamp-b.timestamp)
    .slice(-limit);
  res.json(arr);
});

app.get("/prediction/latest", (req, res) => {
  res.json(latestPrediction || null);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(Number(PORT), () => {
  log.info({ port: PORT }, "Dev Node API listening");
});
