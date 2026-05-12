/**
 * AgriTraceX — IoT Sensor Data Schema
 * Stores real-time readings from ESP32 field devices
 */
const mongoose = require('mongoose');

const iotSensorSchema = new mongoose.Schema({
  // ── Device identity ──────────────────────────────────────────────────────
  deviceId:    { type: String, required: true, trim: true, maxlength: 64, index: true },
  zone:        { type: String, trim: true, maxlength: 64, default: 'Unassigned' },
  protocol:    { type: String, enum: ['ESP32-HTTP','ESP32-MQTT','SIMULATED'], default: 'ESP32-HTTP' },
  firmwareVer: { type: String, default: '1.0.0' },

  // ── Sensor readings ───────────────────────────────────────────────────────
  temperature:  { type: Number, min: -40, max: 85,  default: null },  // °C
  humidity:     { type: Number, min: 0,   max: 100, default: null },  // %
  soilMoisture: { type: Number, min: 0,   max: 100, default: null },  // %
  soilRaw:      { type: Number, min: 0,   max: 4095,default: null },  // ADC 12-bit

  // ── GPS location ──────────────────────────────────────────────────────────
  location: {
    lat: { type: Number, min: -90,  max: 90  },
    lng: { type: Number, min: -180, max: 180 },
    alt: { type: Number, min: -500, max: 9000 },
  },

  // ── Derived crop health indicators (computed server-side) ─────────────────
  cropHealthIndex: { type: Number, min: 0, max: 100 },  // simple composite score
  alerts:          [{ type: String }],                   // warning messages

  // ── Device status ─────────────────────────────────────────────────────────
  deviceOnline:    { type: Boolean, default: true },

  timestamp:  { type: Date, default: Date.now, index: true },
}, { collection: 'iot_sensors' });

// TTL — auto-delete raw packets older than 30 days
iotSensorSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Efficient latest-per-device query
iotSensorSchema.index({ deviceId: 1, timestamp: -1 });

// ── Composite crop health calculator ─────────────────────────────────────────
iotSensorSchema.pre('save', function (next) {
  const alerts = [];
  let score = 100;

  if (this.temperature != null) {
    if (this.temperature > 40)       { score -= 20; alerts.push('Heat stress: temp > 40°C'); }
    else if (this.temperature < 10)  { score -= 15; alerts.push('Cold stress: temp < 10°C'); }
  }
  if (this.humidity != null) {
    if (this.humidity < 30)          { score -= 15; alerts.push('Low humidity < 30%'); }
    else if (this.humidity > 90)     { score -= 10; alerts.push('High humidity — disease risk'); }
  }
  if (this.soilMoisture != null) {
    if (this.soilMoisture < 25)      { score -= 25; alerts.push('Critical: soil moisture < 25% — irrigate now'); }
    else if (this.soilMoisture < 40) { score -= 10; alerts.push('Low soil moisture — schedule irrigation'); }
    else if (this.soilMoisture > 85) { score -= 10; alerts.push('Overwatering detected'); }
  }

  this.cropHealthIndex = Math.max(0, score);
  this.alerts = alerts;
  next();
});

module.exports = mongoose.model('IotSensor', iotSensorSchema);
