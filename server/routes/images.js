/**
 * AgriTrace X — Geo-Tagged Image Upload Pipeline
 * Supports: drone uploads, manual uploads, future S3 integration
 */
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect, authorize } = require('../middleware/auth');
const Mission = require('../models/Mission');
const mongoose = require('mongoose');

const router = express.Router();

// ── Local storage (swap diskStorage → S3/GCS for production) ─────────────
const uploadDir = path.join(__dirname, '../../uploads/survey');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${req.body.droneId || 'DRN'}-${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.tif','.tiff','.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── POST /api/images/upload ───────────────────────────────────────────────
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded.' });

    const { missionId, droneId, lat, lng, altitude, ndviValue, aiAnalysis, capturedAt } = req.body;
    const imageUrl = `/uploads/survey/${req.file.filename}`;

    const imageDoc = {
      filename:   req.file.filename,
      url:        imageUrl,
      lat:        parseFloat(lat)      || 0,
      lng:        parseFloat(lng)      || 0,
      altitude:   parseFloat(altitude) || 0,
      ndviValue:  parseFloat(ndviValue)|| null,
      aiAnalysis: aiAnalysis || null,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      uploadedBy: req.user._id,
      droneId:    droneId || 'UNKNOWN',
    };

    // Attach to mission if provided
    let mission = null;
    if (missionId) {
      mission = await Mission.findOneAndUpdate(
        { missionId },
        { $push: { images: imageDoc } },
        { new: true }
      );
    }

    // Broadcast via Socket.IO
    if (req.app.io) {
      req.app.io.emit('image:captured', { missionId, droneId, lat: imageDoc.lat, lng: imageDoc.lng, url: imageUrl, ndviValue: imageDoc.ndviValue, timestamp: imageDoc.capturedAt });
    }

    res.json({ success: true, image: imageDoc, mission: mission?.missionId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/images/mission/:missionId ───────────────────────────────────
router.get('/mission/:missionId', protect, async (req, res) => {
  try {
    const mission = await Mission.findOne({ missionId: req.params.missionId });
    if (!mission) return res.status(404).json({ success: false, message: 'Mission not found.' });
    res.json({ success: true, missionId: mission.missionId, zone: mission.zone, images: mission.images });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/images/all ── all geo-tagged images as GeoJSON ──────────────
router.get('/all', protect, async (req, res) => {
  try {
    const missions = await Mission.find({ 'images.0': { $exists: true } }).select('missionId zone district droneId images');
    const features = [];
    missions.forEach(m => {
      m.images.forEach(img => {
        if (!img.lat || !img.lng) return;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [img.lng, img.lat] },
          properties: {
            missionId: m.missionId, zone: m.zone, district: m.district, droneId: m.droneId,
            filename: img.filename, url: img.url, altitude: img.altitude,
            ndviValue: img.ndviValue, aiAnalysis: img.aiAnalysis, capturedAt: img.capturedAt,
          },
        });
      });
    });
    res.json({ type: 'FeatureCollection', features });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/images/timeline ── time-sorted mission history ──────────────
router.get('/timeline', protect, async (req, res) => {
  try {
    const missions = await Mission.find({ 'images.0': { $exists: true } })
      .populate('droneAgentId', 'name userId')
      .sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, missions: missions.map(m => ({
      missionId: m.missionId, zone: m.zone, district: m.district,
      droneId: m.droneId, status: m.status, purpose: m.purpose,
      startTime: m.startTime, endTime: m.endTime,
      imageCount: m.images.length, areaCovered: m.areaCovered,
      agentName: m.droneAgentId?.name,
      thumbnail: m.images[0]?.url || null,
    }))});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DELETE /api/images/:missionId/:filename ───────────────────────────────
router.delete('/:missionId/:filename', protect, authorize('admin', 'analyst'), async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Mission.findOneAndUpdate({ missionId: req.params.missionId }, { $pull: { images: { filename: req.params.filename } } });
    res.json({ success: true, message: 'Image deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;

// ── POST /api/images/upload-public ── no auth (drone direct / testing) ────
router.post('/upload-public', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file received.' });
    const { missionId, droneId, lat, lng, altitude, ndviValue, aiAnalysis, capturedAt } = req.body;
    const imageUrl = `/uploads/survey/${req.file.filename}`;
    const imageDoc = {
      filename: req.file.filename, url: imageUrl,
      lat: parseFloat(lat)||0, lng: parseFloat(lng)||0,
      altitude: parseFloat(altitude)||0,
      ndviValue: ndviValue ? parseFloat(ndviValue) : null,
      aiAnalysis: aiAnalysis||null,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      droneId: droneId||'UNKNOWN',
    };
    if (missionId) {
      try { await Mission.findOneAndUpdate({ missionId }, { $push: { images: imageDoc } }); } catch {}
    }
    if (req.app.io) req.app.io.emit('image:captured', { missionId, droneId, lat: imageDoc.lat, lng: imageDoc.lng, url: imageUrl, filename: req.file.filename, ndviValue: imageDoc.ndviValue, timestamp: imageDoc.capturedAt });
    res.json({ success: true, image: imageDoc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/images/all-public ── no auth ─────────────────────────────────
router.get('/all-public', async (req, res) => {
  try {
    const missions = await Mission.find({ 'images.0': { $exists: true } }).select('missionId zone district droneId images status purpose startTime');
    const features = [];
    missions.forEach(m => {
      (m.images||[]).forEach(img => {
        if (!img.lat || !img.lng) return;
        features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[img.lng, img.lat] }, properties:{ missionId:m.missionId, zone:m.zone, district:m.district, droneId:m.droneId||img.droneId, status:m.status, filename:img.filename, url:img.url, altitude:img.altitude, ndviValue:img.ndviValue, aiAnalysis:img.aiAnalysis, capturedAt:img.capturedAt }});
      });
    });
    res.json({ type:'FeatureCollection', features, count:features.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
