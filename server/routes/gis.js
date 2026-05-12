const express = require('express');
const { protect } = require('../middleware/auth');
const Farm = require('../models/Farm');

const router = express.Router();

// ── Geodesic area (Shoelace on sphere) ──────────────────────────────────────
function calcAreaHa(ring) {
  // ring: [[lng,lat], ...]
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % n];
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs(area * R * R / 2 / 10000);
}

// ── Build GeoJSON ring from various input formats ────────────────────────────
function buildRing(boundary, coordinates) {
  let ring = null;
  if (boundary?.coordinates?.[0]?.length >= 3) {
    ring = boundary.coordinates[0]; // already GeoJSON
  } else if (coordinates?.length >= 3) {
    // [{lat,lng}] → [[lng,lat]]
    ring = coordinates.map(c => [parseFloat(c.lng), parseFloat(c.lat)]);
  }
  if (!ring) return null;
  // Auto-close ring
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring = [...ring, ring[0]];
  }
  return ring.length >= 4 ? ring : null;
}

// ── GET /api/gis/farms ────────────────────────────────────────────────────────
// Returns GeoJSON FeatureCollection + plain farms array for sidebar
router.get('/farms', async (req, res) => {
  try {
    const filter = {};
    if (req.query.district) filter.district = req.query.district;
    // If authenticated farmer, show only their farms
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'agritrace_secret_2024');
        if (decoded.role === 'farmer') filter.farmerId = decoded.id;
      } catch { /* unauthenticated — show all */ }
    }

    const farms = await Farm.find(filter).sort({ createdAt: -1 }).limit(200);

    const features = farms.map(f => ({
      type: 'Feature',
      geometry: f.boundary?.coordinates?.length
        ? { type: 'Polygon', coordinates: f.boundary.coordinates }
        : { type: 'Point', coordinates: f.location.coordinates },
      properties: {
        _id: f._id, farmName: f.farmName, cropType: f.cropType,
        ownerName: f.ownerName, totalArea: f.totalArea, district: f.district,
        isVerified: f.isVerified, ndviScore: f.ndviScore, createdAt: f.createdAt,
      },
    }));

    res.json({
      type: 'FeatureCollection', features,
      farms: farms.map(f => ({
        _id: f._id, farmName: f.farmName, cropType: f.cropType,
        ownerName: f.ownerName, totalArea: f.totalArea,
        location: f.location, boundary: f.boundary, vertices: f.vertices,
        district: f.district, isVerified: f.isVerified, createdAt: f.createdAt,
      })),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── POST /api/gis/save ────────────────────────────────────────────────────────
// Primary save endpoint from the GIS map frontend
router.post('/save', async (req, res) => {
  try {
    const { farmName, cropType, ownerName, totalArea, location, boundary, coordinates,
            village, tehsil, district, state, surveyNo, khasraNo, notes } = req.body;

    if (!farmName?.trim()) return res.status(400).json({ success: false, message: 'farmName is required.' });

    const ring = buildRing(boundary, coordinates);
    const area = totalArea || (ring ? calcAreaHa(ring) : 0);

    // Center point
    let center = location?.coordinates;
    if (!center && ring) {
      const lngs = ring.map(c => c[0]), lats = ring.map(c => c[1]);
      center = [lngs.reduce((a, b) => a + b, 0) / lngs.length, lats.reduce((a, b) => a + b, 0) / lats.length];
    }
    center = center || [75.8572, 30.9009];

    // Flat vertex list for easy retrieval
    const vertices = (coordinates || (ring ? ring.slice(0, -1).map(c => ({ lng: c[0], lat: c[1] })) : []));

    const farm = await Farm.create({
      farmName: farmName.trim(),
      cropType: cropType || 'Unknown',
      ownerName: ownerName || '',
      surveyNo, khasraNo, village, tehsil,
      district: district || '',
      state: state || 'Punjab',
      notes: notes || '',
      totalArea: parseFloat(parseFloat(area).toFixed(4)),
      location: { type: 'Point', coordinates: [parseFloat(center[0]), parseFloat(center[1])] },
      boundary: ring ? { type: 'Polygon', coordinates: [ring] } : undefined,
      vertices,
    });

    res.status(201).json({ success: true, id: farm._id, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── POST /api/gis/farm ────────────────────────────────────────────────────────
// Original route for farmer dashboard form (authenticated)
router.post('/farm', protect, async (req, res) => {
  try {
    const { farmName, cropType, ownerName, totalArea, location, boundary, coordinates,
            surveyNo, khasraNo, village, tehsil, district, notes, tags } = req.body;

    const ring = buildRing(boundary, coordinates);
    const area = totalArea || (ring ? calcAreaHa(ring) : 0);
    let center = location?.coordinates;
    if (!center && ring) {
      const lngs = ring.map(c => c[0]), lats = ring.map(c => c[1]);
      center = [lngs.reduce((a,b)=>a+b,0)/lngs.length, lats.reduce((a,b)=>a+b,0)/lats.length];
    }
    center = center || [75.8572, 30.9009];
    const vertices = ring ? ring.slice(0,-1).map(c=>({ lng:c[0], lat:c[1] })) : [];

    const farm = await Farm.create({
      farmerId: req.user._id, farmName: (farmName||surveyNo||'Farm').trim(),
      cropType, ownerName, surveyNo, khasraNo, village, tehsil,
      district: district || req.user.district || '', notes, tags,
      totalArea: parseFloat(parseFloat(area).toFixed(4)),
      location: { type:'Point', coordinates:[parseFloat(center[0]),parseFloat(center[1])] },
      boundary: ring ? { type:'Polygon', coordinates:[ring] } : undefined,
      vertices,
    });
    res.status(201).json({ success: true, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── GET /api/gis/farm/:id ─────────────────────────────────────────────────────
router.get('/farm/:id', async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    res.json({ success: true, farm });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── PUT /api/gis/farm/:id ─────────────────────────────────────────────────────
router.put('/farm/:id', protect, async (req, res) => {
  try {
    const { boundary, coordinates, ...rest } = req.body;
    const update = { ...rest, updatedAt: new Date() };
    const ring = buildRing(boundary, coordinates);
    if (ring) {
      update.boundary = { type: 'Polygon', coordinates: [ring] };
      update.totalArea = parseFloat(calcAreaHa(ring).toFixed(4));
      update.vertices  = ring.slice(0,-1).map(c=>({ lng:c[0], lat:c[1] }));
    }
    const farm = await Farm.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    res.json({ success: true, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── DELETE /api/gis/farm/:id ──────────────────────────────────────────────────
router.delete('/farm/:id', protect, async (req, res) => {
  try {
    await Farm.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Farmland deleted.' });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── GET /api/gis/nearby ───────────────────────────────────────────────────────
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 20 } = req.query;
    const farms = await Farm.find({
      location: { $near: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: parseFloat(radius) * 1000 } }
    }).limit(50);
    res.json({ success: true, count: farms.length, farms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── PUT /api/gis/farm/:id/verify ─────────────────────────────────────────────
router.put('/farm/:id/verify', protect, async (req, res) => {
  try {
    const farm = await Farm.findByIdAndUpdate(req.params.id,
      { isVerified: true, verifiedBy: req.user._id, verifiedAt: new Date() }, { new: true });
    res.json({ success: true, farm });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

module.exports = router;
