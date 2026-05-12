const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimId:       { type: String, required: true, unique: true },
  farmerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cropRecordId:  { type: mongoose.Schema.Types.ObjectId, ref: 'CropRecord' },
  agentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  district:      { type: String },
  cropType:      { type: String },
  damagePct:     { type: Number },
  claimedAmount: { type: Number },
  approvedAmount:{ type: Number },
  status:        { type: String, enum: ['Pending','Under Review','Approved','Rejected','Flagged'], default: 'Pending' },
  fraudScore:    { type: Number, default: 0 },  // 0-100
  fraudReasons:  [{ type: String }],
  evidenceImages:[{ url: String, lat: Number, lng: Number, capturedAt: Date }],
  disasterType:  { type: String },
  notes:         { type: String },
  filedAt:       { type: Date, default: Date.now },
  reviewedAt:    { type: Date },
});

module.exports = mongoose.model('InsuranceClaim', claimSchema);
