import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const keys = [
  "apiKey",
  "authDomain",
  "databaseURL",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];
const missing = keys.filter(k => !config[k]);
let dbInstance = null;
try {
  if (missing.length === 0) {
    const app = initializeApp(config);
    dbInstance = getDatabase(app);
  } else {
    console.warn(`[SAT-DASH] Firebase config missing: ${missing.join(", ")}. Running in no-data mode.`);
  }
} catch (e) {
  console.warn("[SAT-DASH] Firebase initialization failed:", e?.message || e);
}
export const db = dbInstance;
