const mongoose = require('mongoose');
require('dotenv').config();
const VerifiedDoc = require('./models/VerifiedDoc');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await VerifiedDoc.find({});
  console.log('Docs in DB:', JSON.stringify(docs, null, 2));
  process.exit(0);
}
check();
