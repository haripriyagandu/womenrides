const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pickupLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: String
  },
  dropLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: String
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'arrived', 'in-transit', 'completed', 'cancelled'],
    default: 'requested'
  },
  rideType: { type: String, required: true }, // 'SheRide Scooter', 'SheRide Bike', etc.
  fare: { type: String },
  distanceKm: { type: Number },
  eta: { type: String },
  tripDuration: { type: String },
  scheduledTime: { type: Date },
  reminderSent: { type: Boolean, default: false },
  otp: { type: String },
  cancellationReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
