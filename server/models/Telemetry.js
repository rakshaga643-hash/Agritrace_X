const mongoose = require('mongoose');

// ── All supported flight modes (MAVLink + DJI + custom) ─────────────────────
const FLIGHT_MODES = [
  'AUTO',       // Mission waypoint following
  'GUIDED',     // GCS-commanded flight
  'RTL',        // Return to launch
  'LOITER',     // Position hold
  'LAND',       // Auto-land
  'STABILIZE',  // Manual + gyro stabilisation
  'MANUAL',     // Full pilot override
  'POSHOLD',    // Position hold (ArduPilot)
  'ALTHOLD',    // Altitude hold
  'BRAKE',      // Emergency brake
  'DRIFT',      // Drift mode
  'SPORT',      // Sport/fast mode
  'ACRO',       // Acrobatic
  'OFFBOARD',   // External computer control (PX4)
  'MISSION',    // Alias for AUTO
  'HOVER',      // Generic hover
  'IDLE',       // On ground, armed/disarmed
  'UNKNOWN',    // Fallback for unrecognised values
];

const telemetrySchema = new mongoose.Schema({
  droneId:    { type: String, required: true, trim: true, maxlength: 64, index: true },
  missionId:  { type: String, trim: true, maxlength: 64, index: true },
  agentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ── GPS ──────────────────────────────────────────────────────────────────
  lat:      { type: Number, required: true, min: -90,  max: 90  },
  lng:      { type: Number, required: true, min: -180, max: 180 },
  altitude: { type: Number, min: -500, max: 15000, default: 0 },  // metres AGL
  heading:  { type: Number, min: 0,    max: 360,   default: 0 },  // degrees

  // ── Flight telemetry ──────────────────────────────────────────────────────
  speed:          { type: Number, min: 0, max: 500,  default: 0 },   // m/s
  batteryPct:     { type: Number, min: 0, max: 100,  default: null }, // %
  signalStrength: { type: Number, min: 0, max: 100,  default: null }, // %
  satellites:     { type: Number, min: 0, max: 50,   default: null },
  flightMode: {
    type: String,
    enum: { values: FLIGHT_MODES, message: 'Unrecognised flight mode: {VALUE}' },
    default: 'UNKNOWN',
  },

  // ── Status flags ─────────────────────────────────────────────────────────
  armed:     { type: Boolean, default: false },
  inAir:     { type: Boolean, default: false },
  errorCode: { type: Number, default: 0 },
  statusMsg: { type: String, maxlength: 256, default: '' },

  // ── Validation metadata (set by ingest route) ─────────────────────────────
  validationWarnings: [{ type: String }],  // non-fatal issues detected
  sanitised:          { type: Boolean, default: false }, // true if any field was clamped

  // ── Optional payload sensors ──────────────────────────────────────────────
  ndviReading:  { type: Number, min: 0,   max: 1   },
  soilMoisture: { type: Number, min: 0,   max: 100 },
  temperature:  { type: Number, min: -80, max: 80  },
  humidity:     { type: Number, min: 0,   max: 100 },

  // ── Source protocol ───────────────────────────────────────────────────────
  protocol: {
    type: String,
    enum: ['MAVLINK','DJI_SDK','ESP32','SIMULATED','SIMULATED-FALLBACK','UNKNOWN'],
    default: 'UNKNOWN',
  },

  timestamp: { type: Date, default: Date.now, index: true },
}, { collection: 'telemetry' });

// TTL — auto-delete raw packets after 7 days
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });
telemetrySchema.index({ droneId: 1, timestamp: -1 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
module.exports.FLIGHT_MODES = FLIGHT_MODES;
