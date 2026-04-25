const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const { protect } = require('../middlewares/authMiddleware');
const { calculateFare } = require('../utils/pricingEngine');

// @route   POST /api/rides/estimate
// @desc    Calculate estimates and get breakdown for a trip
router.post('/estimate', async (req, res) => {
  try {
    const { pickupLocation, dropLocation } = req.body;
    
    // Extract lat/lng safely
    const pLat = pickupLocation?.lat;
    const pLng = pickupLocation?.lng;
    const dLat = dropLocation?.lat;
    const dLng = dropLocation?.lng;

    console.log(`DEBUG: Estimating for [${pLat}, ${pLng}] to [${dLat}, ${dLng}]`);

    const demands = ['low', 'medium', 'high'];
    const traffics = ['low', 'medium', 'high'];
    const demandLevel = demands[Math.floor(Math.random() * demands.length)];
    const trafficLevel = traffics[Math.floor(Math.random() * traffics.length)];

    // Estimate for Scooter
    const scooterEstimate = await calculateFare({ 
      pickupLat: pLat, pickupLng: pLng,
      dropLat: dLat, dropLng: dLng,
      trafficLevel, demandLevel, rideMultiplier: 1.0
    });

    // Estimate for Premium/Safe (More expensive)
    const safeEstimate = await calculateFare({ 
      pickupLat: pLat, pickupLng: pLng,
      dropLat: dLat, dropLng: dLng,
      trafficLevel, demandLevel, rideMultiplier: 1.3
    });

     res.json({
       demandLevel,
       trafficLevel,
       rides: [
         { id: 'scooter', name: 'SheRide Scooter', desc: 'Standard point-to-point', price: scooterEstimate.finalFare, eta: `${scooterEstimate.pickupEtaMin} min`, tripDuration: `${scooterEstimate.tripDurationMin} min`, icon: '🛵', distanceKm: scooterEstimate.distanceKm, breakdown: scooterEstimate.breakdown },
         { id: 'safe', name: 'SheRide Safe', desc: 'Elite service with top-rated drivers (4.8+ ⭐)', price: safeEstimate.finalFare, eta: `${safeEstimate.pickupEtaMin} min`, tripDuration: `${safeEstimate.tripDurationMin} min`, icon: '🛡️', distanceKm: safeEstimate.distanceKm, breakdown: safeEstimate.breakdown }
       ]
     });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error calculating fare' });
  }
});

// @route   POST /api/rides
// @desc    Create a new ride request
router.post('/', protect, async (req, res) => {
  try {
    const { pickupLocation, dropLocation, rideType, fare, eta, tripDuration, distanceKm, scheduledTime } = req.body;
    
    // Safety check: calculate distance if missing
    let finalDistance = distanceKm;
    if (!finalDistance && pickupLocation?.lat && dropLocation?.lat) {
      const { getStraightLineDistance } = require('../utils/pricingEngine');
      finalDistance = getStraightLineDistance(pickupLocation.lat, pickupLocation.lng, dropLocation.lat, dropLocation.lng);
    }

    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      const minAdvanceTime = 30 * 60 * 1000; // 30 minutes in ms
      
      if (scheduledDate.getTime() - now.getTime() < minAdvanceTime) {
        return res.status(400).json({ 
          message: 'Pre-booking must be at least 30 min in advance. For sooner rides, please use instant booking.' 
        });
      }
    }
    
    const ride = await Ride.create({
      customerId: req.user._id,
      pickupLocation,
      dropLocation,
      rideType,
      fare,
      distanceKm: finalDistance,
      eta,
      tripDuration,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      status: 'requested'
    });

    res.status(201).json(ride);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/rides/:id/accept
// @desc    Driver accepts a ride
router.put('/:id/accept', protect, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ message: 'Unauthorized' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'requested') return res.status(400).json({ message: 'Ride is no longer available' });

    ride.driverId = req.user._id;
    ride.status = 'accepted';
    await ride.save();

    res.json(ride);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/rides/:id/status
// @desc    Update ride status (arrived, completed, etc)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    ride.status = status;
    await ride.save();

    // Emit Socket.io notification to customer
    const io = req.app.get('io');
    if (io && ride.customerId) {
        let event = '';
        if (status === 'completed') event = 'ride-completed';
        else if (status === 'arrived') event = 'driver-arrived';
        else if (status === 'in-transit') event = 'ride-started';

        if (event) {
            io.to(ride.customerId.toString()).emit(event, { 
                rideId: ride._id,
                driverId: ride.driverId,
                status: ride.status
            });
        }
    }

    // If ride is completed, update driver and customer stats
    if (status === 'completed') {
        if (ride.driverId) {
            const driver = await User.findById(ride.driverId);
            if (driver) {
                driver.totalRides += 1;
                // Update earnings (Extract number from something like "₹75")
                const fareValue = parseInt(ride.fare?.replace(/[^0-9]/g, '') || '0');
                if (fareValue > 0) {
                    driver.totalEarnings = (driver.totalEarnings || 0) + fareValue;
                }
                await driver.save();
            }
        }
        if (ride.customerId) {
            const customer = await User.findById(ride.customerId);
            if (customer) {
                customer.totalRides += 1;
                await customer.save();
            }
        }
    }

    res.json(ride);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/rides/:id/cancel
// @desc    Cancel a ride (customer or driver)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    // Status check: can only cancel if not started/completed
    if (['in-transit', 'completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: `Cannot cancel a ride that is already ${ride.status}` });
    }

    ride.status = 'cancelled';
    ride.cancellationReason = reason || 'No reason provided';
    await ride.save();

    // Notify other party via socket
    const io = req.app.get('io');
    if (io) {
      if (req.user.role === 'customer' && !ride.driverId) {
        // Broadcast to all drivers to clear incoming request
        io.emit('ride-cancelled', {
          rideId: ride._id,
          reason: ride.cancellationReason,
          cancelledBy: req.user.name,
          role: req.user.role
        });
      } else {
        const targetId = req.user.role === 'driver' ? ride.customerId : ride.driverId;
        if (targetId) {
          io.to(targetId.toString()).emit('ride-cancelled', { 
            rideId: ride._id, 
            reason: ride.cancellationReason,
            cancelledBy: req.user.name,
            role: req.user.role
          });
        }
      }
    }

    res.json({ message: 'Ride cancelled successfully', ride });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/rides/:id/rating
// @desc    Customer rates a completed ride
router.put('/:id/rating', protect, async (req, res) => {
  try {
    const { rating } = req.body;
    if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.customerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized' });
    if (ride.status !== 'completed') return res.status(400).json({ message: 'Can only rate completed rides' });
    if (ride.rating) return res.status(400).json({ message: 'Ride already rated' });

    ride.rating = rating;
    await ride.save();

    // Update driver's overall trustScore
    if (ride.driverId) {
      const driver = await User.findById(ride.driverId);
      if (driver) {
        const previousScore = driver.trustScore || 5.0;
        const totalRides = driver.totalRides > 0 ? driver.totalRides : 1;
        const newScore = ((previousScore * (totalRides - 1)) + rating) / totalRides;
        driver.trustScore = Math.min(5.0, newScore);
        await driver.save();
      }
    }

    res.json(ride);
  } catch (error) {
    console.error('Rating Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/rides/:id/sos
// @desc    Trigger SOS/Safety alert
router.post('/:id/sos', protect, async (req, res) => {
  try {
    const { lat, lng, alertType, selectedContactIds } = req.body;
    const Alert = require('../models/Alert'); // Import model
    
    const ride = await Ride.findById(req.params.id).populate('driverId', 'name vehicleNumber phone');
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    // Fetch user with emergency contacts
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const contacts = user.emergencyContacts || [];
    let targetContacts = contacts;

    if (selectedContactIds && Array.isArray(selectedContactIds)) {
      targetContacts = contacts.filter(c => selectedContactIds.includes(c._id.toString()));
    }

    if (targetContacts.length === 0) {
      return res.status(400).json({ message: 'No contacts selected.' });
    }

    // Persist SOS Trigger in Database
    ride.sosTriggered = true;
    ride.sosType = alertType;
    await ride.save();

    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    
    let subject = "🚨 SheRide Emergency Alert";
    let messageBody = "I am in danger and need help.";
    let typeLabel = "EMERGENCY SOS";
    let themeColor = "#e11d48";

    if (alertType === 'silent') {
      subject = "⚠️ SheRide Silent Alert";
      messageBody = "I am feeling unsafe on my ride. Please track my location.";
      typeLabel = "SILENT ALERT";
      themeColor = "#f59e0b";
    } else if (alertType === 'share') {
      subject = "📍 SheRide Live Location Share";
      messageBody = "I'm on a ride";
      typeLabel = "LOCATION SHARE";
      themeColor = "#3b82f6";
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid ${themeColor}; border-radius: 12px; padding: 24px; background: #fff;">
        <h1 style="color: ${themeColor}; margin: 0 0 10px;">${typeLabel} 🛵</h1>
        <p style="font-size: 18px; font-weight: bold; color: #1f2937;">Hi, this is ${user.name}.</p>
        <p style="font-size: 16px; color: #374151; background: ${alertType === 'share' ? '#eff6ff' : '#fee2e2'}; padding: 15px; border-radius: 8px; border-left: 5px solid ${themeColor};">
          "${messageBody}"
        </p>
        
        <div style="margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px;">
          <h3 style="margin: 0 0 12px; color: #111827;">Ride Details:</h3>
          <p style="margin: 4px 0;"><strong>Driver:</strong> ${ride.driverId?.name || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Vehicle:</strong> ${ride.driverId?.vehicleNumber || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Driver Phone:</strong> ${ride.driverId?.phone || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Ride ID:</strong> ${ride._id}</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${mapsLink}" target="_blank" style="background: ${themeColor}; color: #fff; padding: 16px 32px; border-radius: 12px; font-size: 18px; font-weight: 800; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            📍 TRACK LIVE LOCATION
          </a>
          <p style="margin-top: 15px; color: #6b7280; font-size: 14px;">Click the button above to view the location on Google Maps.</p>
        </div>

        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">This is an automated safety alert from SheRide Application.</p>
      </div>
    `;

    // Process each contact: Send Email AND handle in-app notification if registered
    const sendEmail = require('../utils/sendEmail');
    const io = req.app.get('io');
    
    for (const contact of targetContacts) {
      // 1. Always send email if email exists
      if (contact.email) {
        sendEmail({
          to: contact.email,
          subject,
          html,
          text: `${messageBody} My location: ${mapsLink}`
        }).catch(err => console.error('Error sending alert email:', err));
      }

      // 2. Check if contact is a registered user for in-app alert
      // Search by phone or email
      const registeredUser = await User.findOne({
        $or: [
          { phone: contact.phone },
          { email: contact.email }
        ]
      });

      if (registeredUser) {
        // Create In-App Alert record
        const newAlert = await Alert.create({
          senderId: user._id,
          receiverId: registeredUser._id,
          rideId: ride._id,
          type: alertType,
          lat,
          lng,
          status: 'unread'
        });

        // Broadcast via socket if online
        if (io) {
          io.to(registeredUser._id.toString()).emit('new-emergency-alert', {
            alertId: newAlert._id,
            senderName: user.name,
            type: alertType,
            lat,
            lng,
            mapsLink,
            driverInfo: {
              name: ride.driverId?.name,
              vehicleNumber: ride.driverId?.vehicleNumber,
              phone: ride.driverId?.phone
            }
          });
        }
      }
    }

    res.json({ message: 'SOS alert processed successfully.' });
  } catch (error) {
    console.error('SOS/Alert Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/rides/driver/history
router.get('/driver/history', protect, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ message: 'Unauthorized' });
    const rides = await Ride.find({ driverId: req.user._id, status: 'completed' }).sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/rides/active
router.get('/active', protect, async (req, res) => {
  try {
    const activeRides = await Ride.find({
      customerId: req.user._id,
      $or: [
        { status: { $in: ['accepted', 'arrived', 'in-transit'] } },
        { 
            status: 'requested', 
            scheduledTime: { $exists: false } // Only show instant requests
        }
      ]
    })
    .populate('driverId', 'name phone vehicleNumber trustScore')
    .sort({ createdAt: -1 });

    res.json({ rides: activeRides });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/rides/driver/active
router.get('/driver/active', protect, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ message: 'Unauthorized' });
    const activeRide = await Ride.findOne({
      driverId: req.user._id,
      status: { $in: ['accepted', 'arrived', 'in-transit'] }
    })
    .populate('customerId', 'name phone')
    .sort({ createdAt: -1 });
    res.json({ ride: activeRide });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
