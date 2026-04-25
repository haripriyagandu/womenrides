const mongoose = require('mongoose');
const Ride = require('./models/Ride');
const User = require('./models/User');

const dbUri = 'mongodb://127.0.0.1:27017/womenrides';

async function runTest() {
  await mongoose.connect(dbUri);
  console.log('Connected to DB');

  // Let's create a test driver
  const driver = await User.create({
    name: 'Test Driver',
    phone: '2222222222',
    email: 'testdriver@example.com',
    password: 'password123',
    role: 'driver',
    totalRides: 0,
    trustScore: 4.8
  });

  // Create a ride assigned to this driver
  const activeRide = await Ride.create({
    customerId: driver._id, // Just mock it
    driverId: driver._id,
    pickupLocation: { lat: 0, lng: 0, address: 'Test Pickup' },
    dropLocation: { lat: 0, lng: 0, address: 'Test Drop' },
    rideType: 'SheRide Scooter',
    fare: '50',
    status: 'in-transit',
  });

  console.log('Driver initial stats:', { totalRides: driver.totalRides, trustScore: driver.trustScore });

  // Simulate socket complete-ride
  const updatedRide = await Ride.findByIdAndUpdate(activeRide._id, { status: 'completed' }, { new: true });
  if (updatedRide && updatedRide.driverId) {
    const d = await User.findById(updatedRide.driverId);
    if (d) {
      d.totalRides = (d.totalRides || 0) + 1;
      d.trustScore = Math.min(5.0, (d.trustScore || 0) + 0.1);
      await d.save();
    }
  }

  // Reload driver to check memory vs db
  const finalDriver = await User.findById(driver._id);
  console.log('Driver final stats:', { totalRides: finalDriver.totalRides, trustScore: finalDriver.trustScore });

  mongoose.disconnect();
}

runTest().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
