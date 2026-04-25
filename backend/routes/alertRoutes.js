const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { protect } = require('../middlewares/authMiddleware');

// @route   GET /api/alerts
// @desc    Get unread alerts for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const alerts = await Alert.find({ receiverId: req.user._id, status: 'unread' })
      .populate('senderId', 'name phone')
      .populate({ path: 'rideId', populate: { path: 'driverId', select: 'name vehicleNumber phone' } })
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/alerts/:id/read
// @desc    Mark an alert as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    alert.status = 'read';
    await alert.save();
    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
