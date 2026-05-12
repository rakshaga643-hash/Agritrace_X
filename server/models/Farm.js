const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  // Farmer linkage — optional for GIS-drawn polygons (can be unregistered)
  farmerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Identity fields — flexible for GIS input
  farmName:     { type: String, required: true },   // friendly name from GIS form
  surveyNo:     { type: String },
  khasraNo:     { type: String },
  ownerName:    { type: String },                   // free-text owner name
  village:      { type: String, default: '' },
  tehsil:       { type: String, default: '' },
  district:     { type: String, default: '' },
  state:        { type: String, default: 'Punjab' },
  cropType:     { type: String, default: 'Unknown' },
  totalArea:    { type: Number, default: 0 },       // Ha
  cultivatedArea:{ type: Number, default: 0 },
  ownershipType:{ type: String, enum: ['Owner','Tenant','Sharecropper'], default: 'Owner' },

  // ── GeoJSON geometry (2dsphere indexed) ──────────────────────────────────
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [75.8572, 30.9009] },   // [lng, lat]
  },
  boundary: {
    type:        { type: String, enum: ['Polygon'] },
    coordinates: [[[ Number ]]],    // [[[lng,lat],...]] — GeoJSON ring
  },

  // Flat coordinate store (for easy frontend retrieval)
  vertices: [{
    lat: Number,
    lng: Number,
    _id: false,
  }],

  // Analytics / verification
  ndviScore:    { type: Number, default: null },
  cropHealth:   { type: String, enum: ['Optimal','Moderate','Poor','Unknown'], default: 'Unknown' },
  isVerified:   { type: Boolean, default: false },
  verifiedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt:   { type: Date },
  tags:         [{ type: String }],
  notes:        { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'farms' });

// Geospatial indexes
farmSchema.index({ location: '2dsphere' });
farmSchema.index({ farmerId: 1 });
farmSchema.index({ district: 1 });

module.exports = mongoose.model('Farm', farmSchema);
