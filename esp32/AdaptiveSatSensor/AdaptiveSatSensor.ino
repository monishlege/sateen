#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <TinyGPSPlus.h>

#define WIFI_SSID "YOUR_WIFI"
#define WIFI_PASSWORD "YOUR_PASS"
#define BACKEND_URL "http://<node-host>:3000/ingest"
#define ARDUINO_JWT "paste-preissued-jwt"

#define DHTPIN 4
#define DHTTYPE DHT22
#define L_PIN 32
#define S_PIN 33
#define C_PIN 34
#define X_PIN 35
#define GPS_RX 16
#define GPS_TX 17

DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

struct Reading {
  uint64_t timestamp;
  float l_dbm, s_dbm, c_dbm, x_dbm;
  float temperature;
  float humidity;
  float elevation_deg;
  String weather;
  double lat, lon;
  bool hasLocation;
};

const int POST_INTERVAL_MS = 2000;
const int QUEUE_MAX = 64;
Reading queueBuf[QUEUE_MAX];
int queueHead = 0, queueTail = 0;

void enqueue(const Reading &r) {
  int nextTail = (queueTail + 1) % QUEUE_MAX;
  if (nextTail == queueHead) queueHead = (queueHead + 1) % QUEUE_MAX;
  queueBuf[queueTail] = r;
  queueTail = nextTail;
}

bool dequeue(Reading &out) {
  if (queueHead == queueTail) return false;
  out = queueBuf[queueHead];
  queueHead = (queueHead + 1) % QUEUE_MAX;
  return true;
}

float adcToDbm(int raw) {
  float v = (float)raw / 4095.0f;
  return -100.0f + v * 120.0f;
}

uint64_t epochMillis() {
  time_t nowSecs = time(nullptr);
  if (nowSecs > 100000) return (uint64_t)nowSecs * 1000ULL;
  return millis();
}

Reading readSensors() {
  Reading r;
  r.timestamp = epochMillis();
  int lRaw = analogRead(L_PIN);
  int sRaw = analogRead(S_PIN);
  int cRaw = analogRead(C_PIN);
  int xRaw = analogRead(X_PIN);
  r.l_dbm = adcToDbm(lRaw);
  r.s_dbm = adcToDbm(sRaw);
  r.c_dbm = adcToDbm(cRaw);
  r.x_dbm = adcToDbm(xRaw);
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  r.temperature = isnan(t) ? NAN : t;
  r.humidity = isnan(h) ? NAN : h;
  r.hasLocation = false;
  while (GPSSerial.available()) gps.encode(GPSSerial.read());
  if (gps.location.isValid()) {
    r.lat = gps.location.lat();
    r.lon = gps.location.lng();
    r.hasLocation = true;
  }
  r.elevation_deg = NAN;
  r.weather = "";
  return r;
}

void toJson(const Reading &r, String &out) {
  StaticJsonDocument<512> doc;
  doc["timestamp"] = r.timestamp;
  doc["l_dbm"] = isfinite(r.l_dbm) ? r.l_dbm : nullptr;
  doc["s_dbm"] = isfinite(r.s_dbm) ? r.s_dbm : nullptr;
  doc["c_dbm"] = isfinite(r.c_dbm) ? r.c_dbm : nullptr;
  doc["x_dbm"] = isfinite(r.x_dbm) ? r.x_dbm : nullptr;
  doc["temperature"] = isfinite(r.temperature) ? r.temperature : nullptr;
  doc["humidity"] = isfinite(r.humidity) ? r.humidity : nullptr;
  doc["elevation_deg"] = isfinite(r.elevation_deg) ? r.elevation_deg : nullptr;
  if (r.weather.length()) doc["weather"] = r.weather;
  if (r.hasLocation) {
    JsonObject loc = doc.createNestedObject("location");
    loc["lat"] = r.lat;
    loc["lon"] = r.lon;
  }
  serializeJson(doc, out);
}

bool postReading(const Reading &r) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  String payload;
  toJson(r, payload);
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + ARDUINO_JWT);
  int code = http.POST(payload);
  String resp = http.getString();
  http.end();
  return code >= 200 && code < 300;
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(500);
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");
}

void setup() {
  Serial.begin(115200);
  pinMode(L_PIN, INPUT);
  pinMode(S_PIN, INPUT);
  pinMode(C_PIN, INPUT);
  pinMode(X_PIN, INPUT);
  dht.begin();
  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  ensureWifi();
}

void loop() {
  ensureWifi();
  Reading r = readSensors();
  if (!postReading(r)) enqueue(r);
  Reading q;
  while (dequeue(q) && postReading(q)) {}
  delay(POST_INTERVAL_MS);
}
