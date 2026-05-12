/**
 * AgriTraceX — ESP32-S3 Smart Agriculture Firmware
 * ─────────────────────────────────────────────────
 * Hardware:  ESP32-S3 Dev Module
 * Sensors:   DHT11/DHT22 | Soil Moisture (Analog) | GPS (UART) | CAM
 * Protocol:  WiFi → HTTP REST API (port 80) + WebSocket push
 * Backend:   POST http://<PC_IP>:3000/api/iot/ingest  every 5 s
 *
 * Arduino Library Dependencies (install via Library Manager):
 *   DHT sensor library by Adafruit
 *   ArduinoJson   by Benoit Blanchon
 *   TinyGPSPlus   by Mikal Hart
 *   WebSockets    by Markus Sattler  (optional WS client)
 *
 * Board: "ESP32S3 Dev Module" in Arduino IDE
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ═══════════════════════════════════════════════════════════
//  ① USER CONFIGURATION — Edit these values
// ═══════════════════════════════════════════════════════════

// WiFi credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// AgriTraceX backend (your Mac's local IP running Node.js on :3000)
// Find it with: ipconfig getifaddr en0   (Mac) or   ipconfig (Windows)
const char* BACKEND_HOST  = "http://192.168.1.XXX:3000";
const char* INGEST_URL    = "http://192.168.1.XXX:3000/api/iot/ingest";

// Device identity
const char* DEVICE_ID     = "ESP32-AGR-01";
const char* DEVICE_ZONE   = "Zone-Alpha";

// ═══════════════════════════════════════════════════════════
//  ② PIN CONFIGURATION
// ═══════════════════════════════════════════════════════════

#define DHT_PIN         4      // GPIO4  — DHT11/DHT22 data pin
#define DHT_TYPE        DHT22  // Change to DHT11 if using DHT11
#define SOIL_PIN        A0     // GPIO1  — Soil moisture analog input
#define GPS_RX_PIN      16     // GPIO16 — GPS TX → ESP RX
#define GPS_TX_PIN      17     // GPIO17 — GPS RX → ESP TX
#define STATUS_LED_PIN  2      // Onboard LED — blinks on send

// ═══════════════════════════════════════════════════════════
//  ③ CONSTANTS & INTERVALS
// ═══════════════════════════════════════════════════════════

#define SEND_INTERVAL_MS   5000   // Push to backend every 5 seconds
#define WIFI_RETRY_MS      10000  // Retry WiFi every 10 seconds
#define SOIL_DRY_VAL       4095   // ADC value = dry soil (12-bit)
#define SOIL_WET_VAL       1500   // ADC value = wet soil

// ═══════════════════════════════════════════════════════════
//  ④ OBJECTS
// ═══════════════════════════════════════════════════════════

DHT dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);   // UART1 for GPS
WebServer localServer(80);     // Local REST server for /sensor endpoint
HTTPClient http;

// ═══════════════════════════════════════════════════════════
//  ⑤ SENSOR DATA STRUCT
// ═══════════════════════════════════════════════════════════

struct SensorData {
  float temperature;
  float humidity;
  int   soilRaw;
  float soilPct;         // 0–100%
  double gpsLat;
  double gpsLng;
  float  gpsAlt;
  bool   gpsValid;
  unsigned long timestamp;
};

SensorData latest = { 0, 0, 0, 0, 0.0, 0.0, 0.0, false, 0 };
unsigned long lastSendMs = 0;
bool backendOnline = false;

// ═══════════════════════════════════════════════════════════
//  ⑥ HELPER — Map soil raw ADC to percentage
// ═══════════════════════════════════════════════════════════

float soilToPercent(int raw) {
  // Invert: high ADC = dry (0%), low ADC = wet (100%)
  int clamped = constrain(raw, SOIL_WET_VAL, SOIL_DRY_VAL);
  return 100.0f - ((float)(clamped - SOIL_WET_VAL) / (SOIL_DRY_VAL - SOIL_WET_VAL)) * 100.0f;
}

// ═══════════════════════════════════════════════════════════
//  ⑦ READ ALL SENSORS
// ═══════════════════════════════════════════════════════════

void readSensors() {
  // — DHT temperature & humidity —
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && t > -40 && t < 85)   latest.temperature = t;
  if (!isnan(h) && h >= 0  && h <= 100) latest.humidity    = h;

  // — Soil moisture (analog) —
  latest.soilRaw = analogRead(SOIL_PIN);
  latest.soilPct = soilToPercent(latest.soilRaw);

  // — GPS —
  unsigned long start = millis();
  while (gpsSerial.available() && millis() - start < 200) {
    gps.encode(gpsSerial.read());
  }
  if (gps.location.isValid()) {
    latest.gpsLat   = gps.location.lat();
    latest.gpsLng   = gps.location.lng();
    latest.gpsAlt   = gps.altitude.meters();
    latest.gpsValid = true;
  }

  latest.timestamp = millis();
}

// ═══════════════════════════════════════════════════════════
//  ⑧ BUILD JSON PAYLOAD
// ═══════════════════════════════════════════════════════════

String buildPayload() {
  StaticJsonDocument<512> doc;
  doc["deviceId"]     = DEVICE_ID;
  doc["zone"]         = DEVICE_ZONE;
  doc["temperature"]  = round(latest.temperature * 10) / 10.0;
  doc["humidity"]     = round(latest.humidity    * 10) / 10.0;
  doc["soilMoisture"] = round(latest.soilPct     * 10) / 10.0;
  doc["soilRaw"]      = latest.soilRaw;
  if (latest.gpsValid) {
    JsonObject loc = doc.createNestedObject("location");
    loc["lat"] = latest.gpsLat;
    loc["lng"] = latest.gpsLng;
    loc["alt"] = latest.gpsAlt;
  }
  doc["protocol"]     = "ESP32-HTTP";
  doc["firmwareVer"]  = "1.0.0";
  String out;
  serializeJson(doc, out);
  return out;
}

// ═══════════════════════════════════════════════════════════
//  ⑨ LOCAL HTTP SERVER — /sensor endpoint
// ═══════════════════════════════════════════════════════════

void handleSensorEndpoint() {
  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  localServer.send(200, "application/json", buildPayload());
}

void handleHealth() {
  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  localServer.send(200, "application/json", "{\"status\":\"ok\",\"device\":\"" + String(DEVICE_ID) + "\"}");
}

void handleNotFound() {
  localServer.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
}

// ═══════════════════════════════════════════════════════════
//  ⑩ PUSH TO BACKEND
// ═══════════════════════════════════════════════════════════

void pushToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  String payload = buildPayload();
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_ID);   // simple auth header

  int code = http.POST(payload);
  if (code == 200 || code == 201) {
    backendOnline = true;
    Serial.println("[OK] Backend accepted: " + payload.substring(0, 60) + "...");
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(80);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    backendOnline = false;
    Serial.println("[WARN] Backend returned: " + String(code));
  }
  http.end();
}

// ═══════════════════════════════════════════════════════════
//  ⑪ WIFI CONNECT
// ═══════════════════════════════════════════════════════════

void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.println("[Info] Local sensor API: http://" + WiFi.localIP().toString() + "/sensor");
  } else {
    Serial.println("\n[WiFi] Connection failed. Will retry...");
  }
}

// ═══════════════════════════════════════════════════════════
//  ⑫ SETUP
// ═══════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n══════════════════════════════════════");
  Serial.println(" AgriTraceX ESP32-S3 Firmware v1.0.0 ");
  Serial.println("══════════════════════════════════════");

  pinMode(STATUS_LED_PIN, OUTPUT);

  // Init sensors
  dht.begin();
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  analogReadResolution(12);   // ESP32-S3: 12-bit ADC (0-4095)

  // Connect WiFi
  connectWiFi();

  // Register local HTTP routes
  localServer.on("/sensor",  HTTP_GET, handleSensorEndpoint);
  localServer.on("/health",  HTTP_GET, handleHealth);
  localServer.onNotFound(handleNotFound);
  localServer.begin();
  Serial.println("[HTTP] Local server running on port 80");

  // Initial sensor read
  readSensors();
}

// ═══════════════════════════════════════════════════════════
//  ⑬ LOOP
// ═══════════════════════════════════════════════════════════

void loop() {
  // Handle local HTTP requests
  localServer.handleClient();

  // Auto-reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting...");
    WiFi.disconnect();
    connectWiFi();
  }

  // Read sensors & push to backend at interval
  if (millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();
    readSensors();

    Serial.println("─────────────────────────────────────");
    Serial.println(" Temp:  " + String(latest.temperature) + " °C");
    Serial.println(" Hum:   " + String(latest.humidity)    + " %");
    Serial.println(" Soil:  " + String(latest.soilPct)     + " % (" + String(latest.soilRaw) + " raw)");
    if (latest.gpsValid) {
      Serial.println(" GPS:   " + String(latest.gpsLat, 6) + ", " + String(latest.gpsLng, 6));
    }
    Serial.println("─────────────────────────────────────");

    pushToBackend();
  }
}
