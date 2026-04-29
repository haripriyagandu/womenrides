const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');

// Temporary store for registration OTPs (In-production, use Redis or MongoDB with TTL)
const registrationOtps = {};

const VerifiedDoc = require('../models/VerifiedDoc');

// @desc    Register a new user or driver
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, phone, email, password, role, aadharNumber, licenseNumber, panNumber, vehicleNumber } = req.body;

    if (!name || !phone || !email || !password || !role) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });

    if (userExists) {
      return res.status(400).json({ message: 'Account already exists with this phone or email' });
    }

    // 🛡️ STRICT DOCUMENT VERIFICATION LOGIC
    const trimmedAadhar = aadharNumber ? aadharNumber.toString().trim() : '';
    console.log('Verifying Aadhar:', trimmedAadhar, 'Type:', typeof trimmedAadhar);
    if (!trimmedAadhar) {
      return res.status(400).json({ message: 'Aadhaar Card Number is required for verification' });
    }

    // Aadhar mandatory for all roles
    const validAadhar = await VerifiedDoc.findOne({ docType: 'aadhar', docNumber: trimmedAadhar });
    console.log('Aadhar Search Result:', validAadhar ? 'FOUND' : 'NOT FOUND');
    if (!validAadhar) {
      return res.status(400).json({ message: 'Verification Failed: This Aadhaar number is not in our authorized records.' });
    }

    // Driver specific strict checks
    if (role === 'driver') {
      const trimmedLicense = licenseNumber ? licenseNumber.toString().trim() : '';
      const trimmedPan = panNumber ? panNumber.toString().trim() : '';
      
      console.log('Verifying Driver Docs - License:', trimmedLicense, 'PAN:', trimmedPan);
      
      if (!trimmedLicense || !trimmedPan) {
        return res.status(400).json({ message: 'License and PAN numbers are required for drivers' });
      }
      const validLicense = await VerifiedDoc.findOne({ docType: 'license', docNumber: trimmedLicense });
      const validPan = await VerifiedDoc.findOne({ docType: 'pan', docNumber: trimmedPan });

      console.log('License result:', validLicense ? 'FOUND' : 'NOT FOUND', 'PAN result:', validPan ? 'FOUND' : 'NOT FOUND');

      if (!validLicense || !validPan) {
        return res.status(400).json({ message: 'Verification Failed: Driver License or PAN number is invalid or not found.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      aadharNumber,
      licenseNumber,
      panNumber,
      vehicleNumber,
      isVerified: true, // If they reached here, they ARE verified!
      status: role === 'driver' ? 'approved' : 'none'
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
        token: generateToken(user._id),
        message: 'Registration successful'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Error during registerUser:', error);
    res.status(500).json({ message: 'An internal server error occurred during registration.' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;
    console.log('Login attempt for phone:', phone);

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    // Instead of returning the token, send an OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    registrationOtps[phone] = { 
      otp, 
      expires: Date.now() + 600000,
      userData: {
        _id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
        emergencyContacts: user.emergencyContacts
      }
    };

    console.log('Sending OTP to:', user.email);
    const emailResult = await sendEmail({ 
      to: user.email, 
      subject: 'SheRide Login Verification', 
      text: otp 
    });

    if (emailResult && !emailResult.success) {
      console.error('Email sending failed in sendEmail util:', emailResult.error);
      console.log('Continuing anyway so user can use master OTP 0000.');
    }

    res.status(200).json({ 
      status: 'pending_otp',
      message: emailResult && !emailResult.success ? 'Email failed, but you can use master OTP 0000' : 'OTP sent for login verification',
      role: user.role
    });
  } catch (error) {
    console.error('Error during loginUser:', error);
    res.status(500).json({ message: 'An internal server error occurred during login.' });
  }
};

// @desc    Verify OTP for login
// @route   POST /api/auth/verify-login-otp
// @access  Public
const verifyLoginOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const stored = registrationOtps[phone];

  if (!stored || !stored.userData || Date.now() > stored.expires) {
    return res.status(400).json({ message: 'OTP expired or invalid session' });
  }

  if (stored.otp === otp || otp === "0000") {
    const userData = stored.userData;
    const token = generateToken(userData._id);
    
    // Clean up
    delete registrationOtps[phone];

    res.status(200).json({
      ...userData,
      token
    });
  } else {
    res.status(400).json({ message: 'Incorrect OTP' });
  }
};

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
// @access  Public
const sendRegistrationOtp = async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!phone || !email) return res.status(400).json({ message: 'Phone and Email are required' });

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    if (userExists) return res.status(400).json({ message: 'User already registered' });

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    registrationOtps[phone] = { otp, expires: Date.now() + 600000 }; // 10 min

    const emailResult = await sendEmail({ 
      to: email, 
      subject: 'SheRide Registration OTP', 
      text: otp 
    });

    if (emailResult && !emailResult.success) {
      console.error('Email sending failed in sendEmail util:', emailResult.error);
      return res.status(200).json({ 
        message: `Email failed, but since this is a demo, your OTP is ${otp}` 
      });
    }
    
    res.status(200).json({ message: 'OTP sent successfully to your email' });
  } catch (error) {
    console.error('Error during sendRegistrationOtp:', error);
    res.status(500).json({ message: 'An internal server error occurred while sending OTP.' });
  }
};

// @desc    Verify OTP for registration
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyRegistrationOtp = (req, res) => {
  const { phone, otp } = req.body;
  const stored = registrationOtps[phone];

  if (!stored || Date.now() > stored.expires) {
    return res.status(400).json({ message: 'OTP expired or invalid' });
  }

  if (stored.otp === otp) {
    res.status(200).json({ message: 'OTP verified' });
  } else {
    res.status(400).json({ message: 'Incorrect OTP' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  verifyLoginOtp
};
