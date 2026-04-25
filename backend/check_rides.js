const mongoose = require('mongoose');
const Ride = require('./models/Ride');

const dbUri = 'mongodb://127.0.0.1:27017/womenrides';

async function checkRides() {
  await mongoose.connect(dbUri);
  const rides = await Ride.find({ status: { $in: ['requested', 'accepted', 'arrived', 'in-transit'] } });
  console.log("Active Rides:", JSON.stringify(rides, null, 2));
  mongoose.disconnect();
}

checkRides();
