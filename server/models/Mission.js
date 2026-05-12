const mongoose = require('mongoose');

const waypointSchema = new mongoose.Schema({
  lat: Number, lng: Number, reached: { type: Boolean, default: false }
});

const imageSchema = new mongoose.Schema({
  filename:  String,
  url:       String,
  lat:       Number,
  lng:       Number,
  capturedAt:{ type: Date, default: Date.now },
  ndviValue: Number,
  aiAnalysis:String,
});

const missionSchema = new mongoose.Schema({
  missionId:   { type: String, required: true, unique: true },
  droneAgentId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  droneId:     { type: String, required: true },
  zone:        { type: String, required: true },
  district:    { type: String },
  purpose:     { type: String, enum: ['Survey','Pesticide Spray','Monitoring','Emergency'], default: 'Survey' },
  status:      { type: String, enum: ['Planned','In Flight','Completed','Aborted'], default: 'Planned' },
  waypoints:   [waypointSchema],
  images:      [imageSchema],
  startTime:   { type: Date },
  endTime:     { type: Date },
  flightTime:  { type: Number },  // seconds
  areaCovered: { type: Number },  // Ha
  batteryStart:{ type: Number },
  batteryEnd:  { type: Number },
  notes:       { type: String },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Mission', missionSchema);
