const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  relation: { type: String, default: 'Family' },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'driver', 'admin'], required: true },

  // Verification
  isVerified: { type: Boolean, default: false },

  // Password reset
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },

  // Emergency contacts (for customers)
  emergencyContacts: [emergencyContactSchema],

  // Specific to documents (now using numbers instead of uploads)
  aadharNumber: { type: String },
  licenseNumber: { type: String },
  panNumber: { type: String },
  vehicleNumber: { type: String },

  status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },

  trustScore: { type: Number, default: 5.0 },
  totalRides: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
