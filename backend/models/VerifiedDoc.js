const mongoose = require('mongoose');

const verifiedDocSchema = new mongoose.Schema({
  docType: { 
    type: String, 
    required: true, 
    enum: ['aadhar', 'license', 'pan'] 
  },
  docNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  ownerName: { 
    type: String // Optional: to cross-verify the name
  }
}, { timestamps: true });

module.exports = mongoose.model('VerifiedDoc', verifiedDocSchema);
