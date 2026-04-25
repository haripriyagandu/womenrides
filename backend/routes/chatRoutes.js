const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const Message = require('../models/Message');

// @route   GET /api/chat/history/:rideId
// @desc    Get chat history for a specific ride
router.get('/history/:rideId', protect, async (req, res) => {
  try {
    const messages = await Message.find({ rideId: req.params.rideId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
