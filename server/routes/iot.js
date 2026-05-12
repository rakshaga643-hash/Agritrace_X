/**
 * AgriTraceX — IoT Device Routes
 *
 * ESP32 pushes to:  POST /api/iot/ingest
 * Dashboard reads:  GET  /api/iot/latest
 *                   GET  /api/iot/history/:deviceId
 *                   GET  /api/iot/devices
 *                   GET  /api/iot/status/:deviceId
 */
const express   = require('express');
const IotSensor = require('../models/IotSensor');
const router    = express.Router();

// ── Validation helpers ────────────────────────────────────────────────────────
const ALLOWED_PROTOCOLS = ['ESP32-HTTP', 'ESP32-MQTT', 'SIMULATED'];

function clamp(v, min, max) {
  const n = parseFloat(v);
  return isNaN(n) ? null : Math.min(max, Math.max(min, n));
}

function deviceIsOnline(lastSeenDate) {
  if (!lastSeenDate) return false;
  return (Date.now() - new Date(lastSeenDate).getTime()) < 30000; // 30s window
}

// ── POST /api/iot/ingest ── ESP32 pushes sensor data ─────────────────────────
router.post('/ingest', async (req, res) => {
  try {
    const b = req.body || {};
    const errors = [];

    // Required
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId.trim().slice(0, 64) : null;
    if (!deviceId) errors.push('deviceId is required');
    if (errors.length) return res.status(400).json({ success: false, errors });

    // Sanitise numeric fields
    const temperature  = clamp(b.temperature,  -40, 85);
    const humidity     = clamp(b.humidity,       0, 100);
    const soilMoisture = clamp(b.soilMoisture,   0, 100);
    const soilRaw      = clamp(b.soilRaw,        0, 4095);

    // GPS
    let location = undefined;
    if (b.location?.lat != null && b.location?.lng != null) {
      const lat = clamp(b.location.lat, -90, 90);
      const lng = clamp(b.location.lng, -180, 180);
      if (lat !== null && lng !== null) {
        location = { lat, lng, alt: clamp(b.location.alt, -500, 9000) };
      }
    }

    // Protocol whitelist
    const rawProto = String(b.protocol || 'ESP32-HTTP').toUpperCase().replace('-', '-');
    const protocol = ALLOWED_PROTOCOLS.includes(b.protocol) ? b.protocol : 'ESP32-HTTP';

    const doc = await IotSensor.create({
      deviceId,
      zone:        b.zone        || 'Unassigned',
      protocol,
      firmwareVer: b.firmwareVer || '1.0.0',
      temperature, humidity, soilMoisture, soilRaw,
      location,
      deviceOnline: true,
    });

    // Broadcast via Socket.IO
    if (req.app.io) {
      req.app.io.emit('iot:reading', {
        deviceId, zone: doc.zone, temperature, humidity,
        soilMoisture, cropHealthIndex: doc.cropHealthIndex,
        alerts: doc.alerts, location,
        timestamp: doc.timestamp,
      });
    }

    res.status(201).json({ success: true, id: doc._id, cropHealthIndex: doc.cropHealthIndex, alerts: doc.alerts });
  } catch (err) {
    console.error('[iot/ingest]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/iot/latest ── most recent reading per device ─────────────────────
router.get('/latest', async (req, res) => {
  try {
    // Aggregate: last document for each deviceId
    const docs = await IotSensor.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$deviceId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { deviceId: 1 } },
    ]);

    const result = docs.map(d => ({
      ...d,
      online: deviceIsOnline(d.timestamp),
    }));

    res.json({ success: true, count: result.length, devices: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/iot/status/:deviceId ── single device status ────────────────────
router.get('/status/:deviceId', async (req, res) => {
  try {
    const doc = await IotSensor.findOne({ deviceId: req.params.deviceId }).sort({ timestamp: -1 });
    if (!doc) return res.json({ success: true, online: false, lastSeen: null });
    const online = deviceIsOnline(doc.timestamp);
    res.json({ success: true, online, lastSeen: doc.timestamp, cropHealthIndex: doc.cropHealthIndex, alerts: doc.alerts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/iot/devices ── list all known devices ────────────────────────────
router.get('/devices', async (req, res) => {
  try {
    const devices = await IotSensor.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$deviceId', lastSeen: { $first: '$timestamp' }, zone: { $first: '$zone' }, protocol: { $first: '$protocol' } } },
      { $project: { deviceId: '$_id', lastSeen: 1, zone: 1, protocol: 1, _id: 0 } },
    ]);
    const result = devices.map(d => ({ ...d, online: deviceIsOnline(d.lastSeen) }));
    res.json({ success: true, devices: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/iot/history/:deviceId?limit=50 ── time-series for charts ─────────
router.get('/history/:deviceId', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const docs  = await IotSensor.find({ deviceId: req.params.deviceId })
      .sort({ timestamp: -1 }).limit(limit)
      .select('temperature humidity soilMoisture cropHealthIndex timestamp alerts');
    res.json({ success: true, deviceId: req.params.deviceId, count: docs.length, history: docs.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
