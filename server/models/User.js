const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true, uppercase: true },
  name:      { type: String, required: true },
  password:  { type: String, required: true },  // bcrypt hash
  role:      { type: String, enum: ['farmer','drone','analyst','insurance','admin'], required: true },
  district:  { type: String, default: '' },
  phone:     { type: String, default: '' },
  email:     { type: String, default: '' },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
