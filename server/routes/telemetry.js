/**
 * AgriTrace X — Telemetry & Drone Intelligence Routes
 *
 * Hardware integration points:
 *  - MAVLink/ArduPilot  → POST /api/telemetry/ingest  (protocol: MAVLINK)
 *  - DJI Mobile SDK     → POST /api/telemetry/ingest  (protocol: DJI_SDK)
 *  - ESP32-S3 modules   → POST /api/telemetry/ingest  (protocol: ESP32)
 *  - Web simulator      → POST /api/telemetry/ingest  (protocol: SIMULATED)
 */
const express  = require('express');
const { protect, authorize } = require('../middleware/auth');
const Mission   = require('../models/Mission');
const Telemetry = require('../models/Telemetry');
const { FLIGHT_MODES } = require('../models/Telemetry');

const router = express.Router();

// ── Flight mode aliases → canonical values ────────────────────────────────
const MODE_ALIASES = {
  'auto':         'AUTO',   'mission':     'AUTO',   'automatic': 'AUTO',
  'guided':       'GUIDED', 'gcs':         'GUIDED',
  'rtl':          'RTL',    'return':      'RTL',    'returntolaunch':'RTL',
  'loiter':       'LOITER', 'poshold':     'POSHOLD','position':'POSHOLD',
  'land':         'LAND',   'landing':     'LAND',
  'stabilize':    'STABILIZE','stabilise': 'STABILIZE',
  'manual':       'MANUAL', 'override':    'MANUAL',
  'althold':      'ALTHOLD','altitude':    'ALTHOLD',
  'brake':        'BRAKE',  'stop':        'BRAKE',
  'hover':        'HOVER',  'hold':        'LOITER',
  'offboard':     'OFFBOARD',
  'acro':         'ACRO',   'acrobatic':   'ACRO',
  'sport':        'SPORT',  'idle':        'IDLE',
};

function normaliseFlightMode(raw) {
  if (!raw) return 'UNKNOWN';
  const key = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  if (MODE_ALIASES[key])              return MODE_ALIASES[key];
  const upper = String(raw).toUpperCase().trim();
  if (FLIGHT_MODES.includes(upper))   return upper;
  return 'UNKNOWN';
}

// ── Numeric clamp helper ───────────────────────────────────────────────────
function clamp(val, min, max, name, warnings) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < min) { warnings.push(`${name} clamped from ${n} to min ${min}`); return min; }
  if (n > max) { warnings.push(`${name} clamped from ${n} to max ${max}`); return max; }
  return n;
}

// ── POST /api/telemetry/ingest ────────────────────────────────────────────────
// Compatible with MAVLink→REST, DJI SDK relay, ESP32 HTTP client, web simulator.
router.post('/ingest', async (req, res) => {
  const warnings = [];
  const errors   = [];

  try {
    const b = req.body || {};

    // ── 1. Required field validation ────────────────────────────────────────
    const droneId = typeof b.droneId === 'string' ? b.droneId.trim().slice(0, 64) : null;
    if (!droneId) errors.push('droneId is required and must be a string.');

    const rawLat = parseFloat(b.lat), rawLng = parseFloat(b.lng);
    if (isNaN(rawLat) || isNaN(rawLng)) errors.push('lat and lng are required and must be numbers.');
    if (!isNaN(rawLat) && (rawLat < -90  || rawLat > 90))  errors.push(`lat ${rawLat} out of range (-90 to 90).`);
    if (!isNaN(rawLng) && (rawLng < -180 || rawLng > 180)) errors.push(`lng ${rawLng} out of range (-180 to 180).`);

    if (errors.length) {
      return res.status(400).json({ success: false, errors, message: errors[0] });
    }

    // ── 2. Numeric field clamping (non-fatal — warn but proceed) ────────────
    const altitude       = clamp(b.altitude,       -500, 15000, 'altitude',       warnings);
    const heading        = clamp(b.heading,            0,   360, 'heading',        warnings);
    const speed          = clamp(b.speed,              0,   500, 'speed',          warnings);
    // Accept 'battery' (ESP32) OR 'batteryPct' (simulator/DJI)
    const batteryPct     = clamp(b.batteryPct ?? b.battery, 0, 100, 'batteryPct', warnings);
    // Accept 'signal' (ESP32) OR 'signalStrength' (simulator)
    const signalStrength = clamp(b.signalStrength ?? b.signal, 0, 100, 'signalStrength', warnings);
    const satellites     = clamp(b.satellites,         0,    50, 'satellites',     warnings);
    const ndviReading    = clamp(b.ndviReading,        0,     1, 'ndviReading',    warnings);
    const soilMoisture   = clamp(b.soilMoisture,       0,   100, 'soilMoisture',   warnings);
    const temperature    = clamp(b.temperature,      -80,    80, 'temperature',    warnings);
    const humidity       = clamp(b.humidity,           0,   100, 'humidity',       warnings);
    const errorCode      = clamp(b.errorCode,          0, 99999, 'errorCode',      warnings) || 0;

    // ── 3. Flight mode normalisation ────────────────────────────────────────
    const rawMode      = b.flightMode || b.mode || b.flight_mode;
    const flightMode   = normaliseFlightMode(rawMode);
    if (flightMode === 'UNKNOWN' && rawMode) {
      warnings.push(`Unrecognised flight mode "${rawMode}" → stored as UNKNOWN. Supported: ${FLIGHT_MODES.slice(0,7).join(', ')}...`);
    }

    // ── 4. Protocol validation ────────────────────────────────────────────
    const PROTOCOLS  = ['MAVLINK','DJI_SDK','ESP32','SIMULATED'];
    const rawProto   = String(b.protocol || 'SIMULATED').toUpperCase();
    const protocol   = PROTOCOLS.includes(rawProto) ? rawProto : 'UNKNOWN';
    if (!PROTOCOLS.includes(rawProto)) warnings.push(`Unknown protocol "${b.protocol}" → stored as UNKNOWN.`);

    // ── 5. String sanitisation ────────────────────────────────────────────
    const missionId  = typeof b.missionId === 'string'  ? b.missionId.trim().slice(0, 64) : undefined;
    const statusMsg  = typeof b.statusMsg === 'string'  ? b.statusMsg.trim().slice(0, 256) : '';
    const armed      = typeof b.armed  === 'boolean'    ? b.armed  : b.armed  === 'true' || b.armed  === 1;
    const inAir      = typeof b.inAir  === 'boolean'    ? b.inAir  : b.inAir  === 'true' || b.inAir  === 1;

    // ── 6. Derived safety alerts ──────────────────────────────────────────
    if (batteryPct !== null && batteryPct < 15) {
      warnings.push(`CRITICAL: Battery at ${batteryPct}% — RTL recommended immediately.`);
    }
    if (satellites !== null && satellites < 6) {
      warnings.push(`Low GPS accuracy: only ${satellites} satellites acquired. Position may drift.`);
    }
    if (signalStrength !== null && signalStrength < 20) {
      warnings.push(`Weak signal (${signalStrength}%). Risk of link loss.`);
    }

    // ── 7. Store telemetry packet ─────────────────────────────────────────
    const packet = await Telemetry.create({
      droneId, missionId,
      lat: rawLat, lng: rawLng, altitude, heading, speed,
      batteryPct, signalStrength, satellites, flightMode,
      armed, inAir, statusMsg, errorCode,
      ndviReading, soilMoisture, temperature, humidity,
      protocol,
      validationWarnings: warnings,
      sanitised: warnings.length > 0,
    });

    // ── 8. Update mission position (non-fatal) ────────────────────────────
    if (missionId) {
      try {
        await Mission.findOneAndUpdate(
          { missionId },
          { $set: { lastLat: rawLat, lastLng: rawLng, lastUpdated: new Date() } }
        );
      } catch { /* mission not found or invalid — silently ignore */ }
    }

    // ── 9. Broadcast via Socket.IO ────────────────────────────────────────
    const broadcast = {
      droneId, lat: rawLat, lng: rawLng, altitude, batteryPct, speed,
      heading, satellites, signalStrength, flightMode, protocol,
      armed, inAir, statusMsg, errorCode, warnings,
      timestamp: packet.timestamp,
    };
    if (req.app.io) {
      req.app.io.to(`drone:${droneId}`).emit('telemetry', packet.toObject());
      req.app.io.emit('telemetry:broadcast', broadcast);
    }

    // ── 10. Response ──────────────────────────────────────────────────────
    const response = { success: true, packetId: packet._id, flightMode, protocol };
    if (warnings.length) response.warnings = warnings;
    res.json(response);

  } catch (err) {
    // Last-resort catch — never crash
    console.error('[telemetry/ingest] Unexpected error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error during telemetry ingestion.', detail: err.message });
  }
});


// ── GET /api/telemetry/live ── all active drones (public, for dashboard) ──
router.get('/live', async (req, res) => {
  try {
    const since = new Date(Date.now() - 60000); // active in last 60s
    const drones = await Telemetry.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$droneId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $project: { droneId:1, lat:1, lng:1, altitude:1, batteryPct:1, speed:1, heading:1, flightMode:1, signalStrength:1, satellites:1, timestamp:1 } },
    ]);
    const active = drones.map(d => ({ ...d, online: new Date(d.timestamp) > since }));
    res.json({ success: true, count: active.length, drones: active });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/telemetry/:droneId/latest ── public (no auth needed) ─────────
router.get('/:droneId/latest', async (req, res) => {
  try {
    const latest = await Telemetry.findOne({ droneId: req.params.droneId }).sort({ timestamp: -1 });
    if (!latest) return res.json({ success: false, message: 'No telemetry found' });
    res.json({ success: true, telemetry: latest, online: (Date.now() - new Date(latest.timestamp)) < 30000 });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/telemetry/:droneId/history ── public, path history for map ───
router.get('/:droneId/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 3600000);
    const history = await Telemetry.find({ droneId: req.params.droneId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 }).limit(limit)
      .select('lat lng altitude batteryPct speed heading flightMode timestamp');
    res.json({ success: true, count: history.length, history });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── POST /api/telemetry/mission ── assign mission to drone ────────────────
router.post('/mission', protect, authorize('drone', 'admin'), async (req, res) => {
  try {
    const { droneId, zone, district, purpose, waypoints } = req.body;
    const missionId = 'MSN-' + Date.now();
    const mission = await Mission.create({
      missionId, droneId, droneAgentId: req.user._id,
      zone, district, purpose: purpose || 'Survey',
      status: 'Planned', waypoints: waypoints || [],
      batteryStart: req.body.batteryStart || 100,
    });
    if (req.app.io) req.app.io.to(`drone:${droneId}`).emit('mission:assigned', mission);
    res.status(201).json({ success: true, mission });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── PUT /api/telemetry/mission/:id/status ─────────────────────────────────
router.put('/mission/:id/status', protect, authorize('drone', 'admin'), async (req, res) => {
  try {
    const mission = await Mission.findOneAndUpdate({ missionId: req.params.id }, { ...req.body, lastUpdated: new Date() }, { new: true });
    if (req.app.io) req.app.io.emit('mission:updated', { missionId: req.params.id, ...req.body });
    res.json({ success: true, mission });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── POST /api/telemetry/image ── geo-tagged image metadata ────────────────
router.post('/image', protect, authorize('drone'), async (req, res) => {
  try {
    const { missionId, lat, lng, altitude, ndviValue, filename, aiAnalysis } = req.body;
    const mission = await Mission.findOneAndUpdate(
      { missionId },
      { $push: { images: { filename, lat, lng, altitude, ndviValue, aiAnalysis, capturedAt: new Date() } } },
      { new: true }
    );
    if (!mission) return res.status(404).json({ success: false, message: 'Mission not found.' });
    if (req.app.io) req.app.io.emit('image:captured', { missionId, lat, lng, ndviValue, filename });
    res.json({ success: true, images: mission.images });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── GET /api/telemetry/missions ── all missions (drone agent) ─────────────
router.get('/missions', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'drone' ? { droneAgentId: req.user._id } : {};
    const missions = await Mission.find(filter).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, missions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
