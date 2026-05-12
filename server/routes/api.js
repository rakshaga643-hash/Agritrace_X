const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Farm = require('../models/Farm');
const CropRecord = require('../models/CropRecord');
const Mission = require('../models/Mission');
const InsuranceClaim = require('../models/InsuranceClaim');

const router = express.Router();

// ── FARMER ROUTES ─────────────────────────────────────────────────────────

// GET /api/farmer/dashboard — farmer's farms + crops
router.get('/farmer/dashboard', protect, authorize('farmer'), async (req, res) => {
  try {
    const farms = await Farm.find({ farmerId: req.user._id });
    const crops = await CropRecord.find({ farmerId: req.user._id, status: 'Active' });
    const claims = await InsuranceClaim.find({ farmerId: req.user._id });
    res.json({ success: true, farms, crops, claims });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/farmer/farm — register farmland
router.post('/farmer/farm', protect, authorize('farmer'), async (req, res) => {
  try {
    const farm = await Farm.create({ ...req.body, farmerId: req.user._id });
    res.status(201).json({ success: true, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// PUT /api/farmer/farm/:id — update farm
router.put('/farmer/farm/:id', protect, authorize('farmer'), async (req, res) => {
  try {
    const farm = await Farm.findOneAndUpdate({ _id: req.params.id, farmerId: req.user._id }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    res.json({ success: true, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// POST /api/farmer/crop — add crop record
router.post('/farmer/crop', protect, authorize('farmer'), async (req, res) => {
  try {
    const crop = await CropRecord.create({ ...req.body, farmerId: req.user._id });
    res.status(201).json({ success: true, crop });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// PUT /api/farmer/crop/:id — update crop record
router.put('/farmer/crop/:id', protect, authorize('farmer'), async (req, res) => {
  try {
    const crop = await CropRecord.findOneAndUpdate({ _id: req.params.id, farmerId: req.user._id }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!crop) return res.status(404).json({ success: false, message: 'Crop record not found.' });
    res.json({ success: true, crop });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// POST /api/farmer/crop/:id/fertilizer — add fertilizer log entry
router.post('/farmer/crop/:id/fertilizer', protect, authorize('farmer'), async (req, res) => {
  try {
    const crop = await CropRecord.findOne({ _id: req.params.id, farmerId: req.user._id });
    if (!crop) return res.status(404).json({ success: false, message: 'Crop not found.' });
    crop.fertilizerHistory.push(req.body);
    await crop.save();
    res.json({ success: true, fertilizerHistory: crop.fertilizerHistory });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// POST /api/farmer/crop/:id/irrigation — log irrigation event
router.post('/farmer/crop/:id/irrigation', protect, authorize('farmer'), async (req, res) => {
  try {
    const crop = await CropRecord.findOne({ _id: req.params.id, farmerId: req.user._id });
    if (!crop) return res.status(404).json({ success: false, message: 'Crop not found.' });
    crop.irrigationLogs.push(req.body);
    crop.currentMoisture = req.body.moisture || crop.currentMoisture;
    await crop.save();
    res.json({ success: true, irrigationLogs: crop.irrigationLogs });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// POST /api/farmer/claim — file insurance claim
router.post('/farmer/claim', protect, authorize('farmer'), async (req, res) => {
  try {
    const claimId = 'CLM-' + Date.now();
    const claim = await InsuranceClaim.create({ ...req.body, claimId, farmerId: req.user._id });
    res.status(201).json({ success: true, claim });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── DRONE AGENT ROUTES ────────────────────────────────────────────────────

// GET /api/drone/missions — agent's assigned missions
router.get('/drone/missions', protect, authorize('drone'), async (req, res) => {
  try {
    const missions = await Mission.find({ droneAgentId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, missions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/drone/mission — create mission
router.post('/drone/mission', protect, authorize('drone', 'admin'), async (req, res) => {
  try {
    const missionId = 'MSN-' + Date.now();
    const mission = await Mission.create({ ...req.body, missionId, droneAgentId: req.user._id });
    res.status(201).json({ success: true, mission });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// PUT /api/drone/mission/:id/status — update mission status / telemetry
router.put('/drone/mission/:id/status', protect, authorize('drone'), async (req, res) => {
  try {
    const mission = await Mission.findOneAndUpdate(
      { _id: req.params.id, droneAgentId: req.user._id },
      req.body, { new: true }
    );
    res.json({ success: true, mission });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// POST /api/drone/mission/:id/image — add geo-tagged image
router.post('/drone/mission/:id/image', protect, authorize('drone'), async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    if (!mission) return res.status(404).json({ success: false, message: 'Mission not found.' });
    mission.images.push(req.body);
    await mission.save();
    res.json({ success: true, images: mission.images });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── ANALYST ROUTES ────────────────────────────────────────────────────────

// GET /api/analyst/surveys — all missions with images for verification
router.get('/analyst/surveys', protect, authorize('analyst', 'admin'), async (req, res) => {
  try {
    const missions = await Mission.find().populate('droneAgentId', 'name userId').sort({ createdAt: -1 }).limit(50);
    const crops = await CropRecord.find().populate('farmerId', 'name userId district').sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, missions, crops });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analyst/district-summary — district-level crop analytics
router.get('/analyst/district-summary', protect, authorize('analyst', 'admin'), async (req, res) => {
  try {
    const summary = await CropRecord.aggregate([
      { $group: { _id: null, avgNDVI: { $avg: '$currentNDVI' }, avgMoisture: { $avg: '$currentMoisture' }, count: { $sum: 1 }, totalArea: { $sum: '$farmId' } } }
    ]);
    res.json({ success: true, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── INSURANCE ROUTES ──────────────────────────────────────────────────────

// GET /api/insurance/claims — all claims
router.get('/insurance/claims', protect, authorize('insurance', 'admin'), async (req, res) => {
  try {
    const claims = await InsuranceClaim.find()
      .populate('farmerId', 'name userId district')
      .sort({ filedAt: -1 });
    res.json({ success: true, claims });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/insurance/claim/:id — update claim status
router.put('/insurance/claim/:id', protect, authorize('insurance', 'admin'), async (req, res) => {
  try {
    const claim = await InsuranceClaim.findByIdAndUpdate(
      req.params.id, { ...req.body, reviewedAt: new Date() }, { new: true }
    );
    res.json({ success: true, claim });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────

// GET /api/admin/users — all users
router.get('/admin/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/admin/user — create new user
router.post('/admin/user', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, user });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// PUT /api/admin/user/:id — update user
router.put('/admin/user/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// GET /api/admin/overview — statewide stats
router.get('/admin/overview', protect, authorize('admin'), async (req, res) => {
  try {
    const [userCount, farmCount, missionCount, claimCount] = await Promise.all([
      User.countDocuments(),
      Farm.countDocuments(),
      Mission.countDocuments(),
      InsuranceClaim.countDocuments(),
    ]);
    const activeMissions = await Mission.countDocuments({ status: 'In Flight' });
    const pendingClaims = await InsuranceClaim.countDocuments({ status: 'Pending' });
    res.json({ success: true, stats: { userCount, farmCount, missionCount, claimCount, activeMissions, pendingClaims } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
