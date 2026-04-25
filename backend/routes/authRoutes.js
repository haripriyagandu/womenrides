const express = require('express');
const router = express.Router();
const { registerUser, loginUser, sendRegistrationOtp, verifyRegistrationOtp, verifyLoginOtp } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendRegistrationOtp);
router.post('/verify-otp', verifyRegistrationOtp);
router.post('/verify-login-otp', verifyLoginOtp);

// 🧪 Temporary Seed Route for Verification Docs
router.get('/seed', async (req, res) => {
  try {
    const VerifiedDoc = require('../models/VerifiedDoc');
    const sampleDocs = [
      { docType: 'aadhar', docNumber: '123456789012', ownerName: 'Aadhar Holder 1' },
      { docType: 'aadhar', docNumber: '987654321098', ownerName: 'Aadhar Holder 2' },
      { docType: 'license', docNumber: 'DL-12345678', ownerName: 'License Holder 1' },
      { docType: 'pan', docNumber: 'ABCDE1234F', ownerName: 'PAN Holder 1' }
    ];
    await VerifiedDoc.deleteMany({});
    await VerifiedDoc.insertMany(sampleDocs);
    res.json({ message: 'Successfully seeded VerifiedDocs collection on LIVE server! 🎉', docs: sampleDocs });
  } catch (err) {
    res.status(500).json({ message: 'Seeding failed', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'User not found' });
  res.json(req.user);
});

// PUT /api/auth/profile - For updating General Profile (Name, Phone)
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/driver-profile
router.put('/driver-profile', protect, async (req, res) => {
  try {
    const { phone, vehicleNumber } = req.body;
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'driver') return res.status(403).json({ message: 'Not authorized' });

    if (phone) user.phone = phone;
    if (vehicleNumber) user.vehicleNumber = vehicleNumber;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/emergency-contacts
router.put('/emergency-contacts', protect, async (req, res) => {
  try {
    const { contacts } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.emergencyContacts = contacts;
    await user.save();
    res.json({ message: 'Emergency contacts saved', contacts: user.emergencyContacts });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'No account found with this email.' });

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'] || 'localhost:3000';
    const resetUrl = `${protocol}://${host}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fcf9f9;padding:32px;border-radius:20px;border:1px solid #faeef2;">
        <h1 style="color:#e11d48;font-size:26px;margin:0 0 4px;">SheRide 🛵</h1>
        <p style="color:#846b74;margin:0 0 24px;font-size:14px;">Safe rides by women, for women</p>
        <h2 style="color:#2b101c;font-size:20px;margin:0 0 16px;">Reset Your Password</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">Hi <strong>${user.name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px;">Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${resetUrl}" style="background:linear-gradient(to right,#e11d48,#f97316);color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">Reset Password →</a>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 16px;">If you didn't request this, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #faeef2;margin:20px 0;">
        <p style="color:#bda9b1;font-size:12px;text-align:center;margin:0;">© SheRide — Safe rides by women, for women</p>
      </div>
    `;

    const result = await sendEmail({ to: user.email, subject: 'Reset Your SheRide Password', html });

    res.json({ message: 'Password reset link sent to your email.', previewUrl: result.previewUrl || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to send email. Try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset link. Please try again.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully! You can now log in.' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/history - For Profile Page history list
router.get('/history', protect, async (req, res) => {
  try {
    const Ride = require('../models/Ride');
    const rides = await Ride.find({
      customerId: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 });

    res.json(rides);
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
