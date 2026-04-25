const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/admin/drivers
router.get('/drivers', async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver' }).sort({ createdAt: -1 });
        res.json(drivers);
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/admin/drivers/:id/approve
router.put('/drivers/:id/approve', async (req, res) => {
    try {
        const driver = await User.findById(req.params.id);
        if (driver && driver.role === 'driver') {
            driver.status = 'approved';
            driver.isVerified = true;
            await driver.save();
            res.json({ message: 'Driver approved successfully', driver });
        } else {
            res.status(404).json({ message: 'Driver not found' });
        }
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/admin/drivers/:id/reject
router.put('/drivers/:id/reject', async (req, res) => {
    try {
        const driver = await User.findById(req.params.id);
        if (driver && driver.role === 'driver') {
            driver.status = 'rejected';
            await driver.save();
            res.json({ message: 'Driver rejected', driver });
        } else {
            res.status(404).json({ message: 'Driver not found' });
        }
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/admin/users/:id/emergency-contacts
// Save emergency contacts for a customer
router.put('/users/:id/emergency-contacts', async (req, res) => {
    try {
        const { contacts } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.emergencyContacts = contacts;
        await user.save();
        res.json({ message: 'Emergency contacts saved', contacts: user.emergencyContacts });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
