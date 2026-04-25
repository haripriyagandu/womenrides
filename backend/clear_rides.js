const mongoose = require('mongoose');
const Ride = require('./models/Ride');

mongoose.connect('mongodb://127.0.0.1:27017/womenrides')
  .then(async () => {
    const result = await Ride.updateMany(
      { status: { $in: ['requested', 'accepted', 'arrived', 'in-transit'] } },
      { status: 'cancelled' }
    );
    console.log('Cleared active rides:', result.modifiedCount);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
