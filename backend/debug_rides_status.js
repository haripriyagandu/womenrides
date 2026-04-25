const mongoose = require('mongoose');
const Ride = require('./models/Ride');
const User = require('./models/User');

async function debugRides() {
  await mongoose.connect('mongodb://127.0.0.1:27017/womenrides');
  console.log('Connected to DB');

  const rides = await Ride.find({}).sort({ createdAt: -1 }).limit(5).populate('customerId', 'name').populate('driverId', 'name');
  
  console.log('--- RECENT RIDES ---');
  rides.forEach(r => {
    console.log(`ID: ${r._id} | Status: ${r.status} | Scheduled: ${r.scheduledTime} | Created: ${r.createdAt}`);
  });

  process.exit();
}

debugRides();
