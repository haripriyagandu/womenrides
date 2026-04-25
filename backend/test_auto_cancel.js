const mongoose = require('mongoose');
const Ride = require('./models/Ride');
const User = require('./models/User');

const dbUri = 'mongodb://127.0.0.1:27017/womenrides';

async function runTest() {
  await mongoose.connect(dbUri);
  console.log('Connected to DB');

  // Let's create a test user or find one
  let customer = await User.findOne({ role: 'customer' });
  if (!customer) {
    customer = await User.create({
      name: 'Test Customer',
      phone: '1111111111',
      email: 'testcustomer@example.com',
      password: 'password123',
      role: 'customer'
    });
  }

  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  const futureSchedule = new Date(Date.now() + 60 * 60 * 1000); // 1 hr from now

  // Create an old instant ride (no scheduledTime)
  const instantRide = await Ride.create({
    customerId: customer._id,
    pickupLocation: { lat: 0, lng: 0, address: 'Test Pickup' },
    dropLocation: { lat: 0, lng: 0, address: 'Test Drop' },
    rideType: 'SheRide Scooter',
    fare: '50',
    status: 'requested',
    createdAt: twentyMinsAgo
  });

  // Create an old pre-booked ride
  const prebookedRide = await Ride.create({
    customerId: customer._id,
    pickupLocation: { lat: 0, lng: 0, address: 'Test Pickup' },
    dropLocation: { lat: 0, lng: 0, address: 'Test Drop' },
    rideType: 'SheRide Scooter',
    fare: '50',
    status: 'requested',
    scheduledTime: futureSchedule,
    createdAt: twentyMinsAgo
  });

  console.log('Created test rides inside DB');

  // Now, let's simulate the API call logic manually to see what it does
  // Auto-cancel only INSTANT rides (no scheduledTime) that are older than 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const updateResult = await Ride.updateMany({
    status: 'requested',
    scheduledTime: null,
    createdAt: { $lt: fifteenMinsAgo }
  }, { status: 'cancelled' });

  console.log('Update result for auto-cancellation:', updateResult);

  const updatedInstant = await Ride.findById(instantRide._id);
  const updatedPrebooked = await Ride.findById(prebookedRide._id);

  console.log('Instant Ride status (should be cancelled):', updatedInstant.status);
  console.log('Prebooked Ride status (should be requested):', updatedPrebooked.status);

  mongoose.disconnect();
}

runTest().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
