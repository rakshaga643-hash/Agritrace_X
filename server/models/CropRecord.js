const mongoose = require('mongoose');

const fertilizerEntrySchema = new mongoose.Schema({
  date:       { type: Date },
  name:       { type: String },
  dose:       { type: Number },  // kg/Ha
  stage:      { type: String },
  appliedBy:  { type: String },
});

const irrigationLogSchema = new mongoose.Schema({
  date:       { type: Date },
  method:     { type: String },
  waterUsed:  { type: Number },  // m³/Ha
  moisture:   { type: Number },  // %
});

const cropSchema = new mongoose.Schema({
  farmId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  farmerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cropType:       { type: String, required: true },
  variety:        { type: String },
  season:         { type: String },
  sowingDate:     { type: Date },
  expectedHarvest:{ type: Date },
  seedSource:     { type: String },
  seedRate:       { type: Number },
  // Soil data
  soilType:       { type: String },
  soilPH:         { type: Number },
  soilN:          { type: Number },
  soilP:          { type: Number },
  soilK:          { type: Number },
  organicCarbon:  { type: Number },
  lastSoilTest:   { type: Date },
  // Irrigation
  irrigationSource: { type: String },
  irrigationMethod: { type: String },
  irrigationFrequency: { type: String },
  irrigationLogs: [irrigationLogSchema],
  // Fertilizer
  fertilizerHistory: [fertilizerEntrySchema],
  // Live sensor data
  currentMoisture:  { type: Number, default: 65 },
  currentNDVI:      { type: Number, default: 0.75 },
  currentTemp:      { type: Number, default: 28 },
  currentHumidity:  { type: Number, default: 45 },
  // Yield
  predictedYield:   { type: Number },
  actualYield:      { type: Number },
  // Insurance
  pmfbyPolicyNo:    { type: String },
  sumInsured:       { type: Number },
  premiumPaid:      { type: Number },
  insuranceStatus:  { type: String, default: 'Active' },
  status:           { type: String, enum: ['Active','Harvested','Failed'], default: 'Active' },
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now },
});

module.exports = mongoose.model('CropRecord', cropSchema);
