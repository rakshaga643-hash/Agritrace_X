const express = require('express');
const { protect } = require('../middleware/auth');
const CropRecord = require('../models/CropRecord');
const Farm = require('../models/Farm');
const ai = require('../services/aiEngine');

const router = express.Router();

// Build crop payload from DB records
async function buildCropPayload(farmerId, cropId) {
  const cropQ = cropId ? CropRecord.findById(cropId) : CropRecord.findOne({ farmerId, status: 'Active' }).sort({ createdAt: -1 });
  const crop = await cropQ.populate('farmId');
  if (!crop) return null;
  const farm = crop.farmId;
  return {
    cropType:        crop.cropType,
    currentMoisture: crop.currentMoisture,
    currentNDVI:     crop.currentNDVI,
    currentTemp:     crop.currentTemp,
    currentHumidity: crop.currentHumidity,
    soilN: crop.soilN, soilP: crop.soilP, soilK: crop.soilK, soilPH: crop.soilPH,
    irrigationMethod: crop.irrigationMethod,
    totalArea: farm?.totalArea || 4.5,
    lat: farm?.location?.coordinates?.[1] || 30.9,
    lng: farm?.location?.coordinates?.[0] || 75.85,
    fertilizerHistory: crop.fertilizerHistory,
  };
}

// ── GET /api/ai/full — complete analysis for authenticated farmer ──────────
router.get('/full', protect, async (req, res) => {
  try {
    const cropId = req.query.cropId;
    const payload = await buildCropPayload(req.user._id, cropId);
    if (!payload) return res.status(404).json({ success: false, message: 'No active crop record found.' });
    const result = await ai.fullAnalysis(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/ai/irrigation ────────────────────────────────────────────────
router.get('/irrigation', protect, async (req, res) => {
  try {
    const payload = await buildCropPayload(req.user._id, req.query.cropId);
    if (!payload) return res.status(404).json({ success: false, message: 'No active crop.' });
    const result = await ai.irrigationAnalysis(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/ai/fertilizer ────────────────────────────────────────────────
router.get('/fertilizer', protect, async (req, res) => {
  try {
    const payload = await buildCropPayload(req.user._id, req.query.cropId);
    if (!payload) return res.status(404).json({ success: false, message: 'No active crop.' });
    const result = ai.fertilizerAnalysis(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/ai/yield ─────────────────────────────────────────────────────
router.get('/yield', protect, async (req, res) => {
  try {
    const payload = await buildCropPayload(req.user._id, req.query.cropId);
    if (!payload) return res.status(404).json({ success: false, message: 'No active crop.' });
    const result = await ai.yieldPrediction(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/ai/disaster ──────────────────────────────────────────────────
router.get('/disaster', protect, async (req, res) => {
  try {
    const payload = await buildCropPayload(req.user._id, req.query.cropId);
    if (!payload) return res.status(404).json({ success: false, message: 'No active crop.' });
    const result = await ai.disasterRisk(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── POST /api/ai/analyze — analyze custom crop payload (admin/analyst) ────
router.post('/analyze', protect, async (req, res) => {
  try {
    const result = await ai.fullAnalysis(req.body);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/ai/district — district-level aggregate risk (admin/analyst) ─
router.get('/district', protect, async (req, res) => {
  try {
    const crops = await CropRecord.find({ status: 'Active' }).populate('farmId').limit(50);
    const analyses = await Promise.all(crops.map(c => ai.fullAnalysis({
      cropType: c.cropType, currentMoisture: c.currentMoisture, currentNDVI: c.currentNDVI,
      soilN: c.soilN, soilP: c.soilP, soilK: c.soilK, soilPH: c.soilPH,
      totalArea: c.farmId?.totalArea || 4.5,
      lat: c.farmId?.location?.coordinates?.[1] || 30.9,
      lng: c.farmId?.location?.coordinates?.[0] || 75.85,
    })));
    const avgScore = Math.round(analyses.reduce((s, a) => s + a.overallScore, 0) / (analyses.length || 1));
    const highRisk = analyses.filter(a => a.disaster.disaster?.risks?.some(r => r.score > 60)).length;
    res.json({ success: true, cropCount: crops.length, avgScore, highRisk, analyses: analyses.slice(0, 5) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;

// ── POST /api/ai/analyze-public — no auth, used by AI dashboard & chatbot ──
router.post('/analyze-public', async (req, res) => {
  try {
    const payload = { ...req.body };
    // Enrich with real DB data if farmerId provided
    if (payload.farmerId) {
      try {
        const crop = await CropRecord.findOne({ farmerId: payload.farmerId }).populate('farmId').sort({ createdAt: -1 });
        if (crop) {
          payload.cropType        = payload.cropType        || crop.cropType;
          payload.currentMoisture = payload.currentMoisture || crop.currentMoisture;
          payload.currentNDVI     = payload.currentNDVI     || crop.currentNDVI;
          payload.soilN  = payload.soilN  || crop.soilN;
          payload.soilP  = payload.soilP  || crop.soilP;
          payload.soilK  = payload.soilK  || crop.soilK;
          payload.soilPH = payload.soilPH || crop.soilPH;
          payload.totalArea        = payload.totalArea        || crop.farmId?.totalArea;
          payload.lat              = payload.lat              || crop.farmId?.location?.coordinates?.[1];
          payload.lng              = payload.lng              || crop.farmId?.location?.coordinates?.[0];
          payload.irrigationMethod = payload.irrigationMethod || crop.irrigationMethod;
        }
      } catch {}
    }
    const result = await ai.fullAnalysis(payload);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
