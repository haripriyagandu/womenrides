require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const Ride = require('./models/Ride');
const User = require('./models/User');
const Message = require('./models/Message');
const sendEmail = require('./utils/sendEmail');
const chatRoutes = require('./routes/chatRoutes');
const alertRoutes = require('./routes/alertRoutes');
const Alert = require('./models/Alert');

// Connect Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Make io accessible to routes
app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Women Scooter Ride Booking API' });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/rides', require('./routes/rideRoutes'));
app.use('/api/chat', chatRoutes);
app.use('/api/alerts', alertRoutes);

// In-memory store for active rides OTP verification
const activeRides = {};

// Socket.io for Real-time tracking
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Drivers can join their own persistent room to receive targeted pings
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  // When a passenger confirms a ride
  socket.on('request-ride', (data) => {
    // data = { rideId, pickup, drop, fare, customerId, customerName, rideType, scheduledTime }
    console.log('Ride requested:', data);

    // If it's a Safe ride, we flag it for elite drivers only
    const isElite = data.rideType === 'SheRide Safe';

    console.log('Broadcasting ride request to drivers...', data.rideId);

    // Broadcast to all drivers, but include the elite requirement
    socket.broadcast.emit('incoming-ride', {
      ...data,
      isEliteOnly: isElite,
      minRating: isElite ? 4.8 : 0
    });
  });

  // When a driver accepts a ride
  socket.on('accept-ride', async (data) => {
    // Generate a secure 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    activeRides[data.rideId] = otp;

    try {
      // Update DB status to accepted and save the OTP permanently
      const updatedRide = await Ride.findByIdAndUpdate(data.rideId, {
        status: 'accepted',
        driverId: data.driverId,
        otp: otp
      }, { new: true });

      console.log(`Ride accepted: ${data.rideId}. Generated OTP: ${otp}`);

      // Send to the customer: Driver details + OTP they need to share
      io.to(data.customerId).emit('ride-accepted', {
        rideId: data.rideId,
        driverName: data.driverName,
        driverId: data.driverId,
        driverPhone: '9876543210', // dummy formatting
        vehicleNumber: 'TS 09 HA 1234',
        otp: otp,
        scheduledTime: updatedRide ? updatedRide.scheduledTime : null
      });

      // Send back to the driver the generated OTP metadata context
      // Actually, driver doesn't need to know the OTP in advance. They get it from the customer.
      // Trigger Email to Customer
      User.findById(data.customerId).then(user => {
        if (user && user.email) {
          sendEmail({
            to: user.email,
            subject: `SheRide: Ride PIN for ${data.driverName}`,
            text: otp
          });
        }
      }).catch(err => console.error('Error fetching customer for Email:', err));

    } catch (err) {
      console.error('DB update error:', err);
    }
  });

  // When driver arrives at pickup
  socket.on('driver-arrived', (data) => {
    console.log(`Driver arrived for ride: ${data.rideId}`);
    Ride.findByIdAndUpdate(data.rideId, { status: 'arrived' }).catch(err => console.error('DB error:', err));
    io.to(data.customerId).emit('driver-arrived', data);
  });

  // When driver starts ride by verifying OTP
  socket.on('start-ride', (data, callback) => {
    console.log(`OTP check for ${data.rideId}. Provided: ${data.otp}, Actual: ${activeRides[data.rideId]}`);
    if (activeRides[data.rideId] === data.otp) {
      // OTP matched
      delete activeRides[data.rideId];
      Ride.findByIdAndUpdate(data.rideId, { status: 'in-transit' }).catch(err => console.error('DB error:', err));
      io.to(data.customerId).emit('ride-started', data);
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, message: 'Invalid OTP' });
    }
  });

  // When driver completes the ride
  socket.on('complete-ride', async (data) => {
    console.log(`Ride completed: ${data.rideId}`);
    try {
      const ride = await Ride.findByIdAndUpdate(data.rideId, { status: 'completed' });
      // Note: Stats and earnings are handled in the rideRoutes.js PUT /status route
      io.to(data.customerId).emit('ride-completed', data);
    } catch (err) {
      console.error('Error completing ride via socket:', err);
    }
  });

  // When driver moves
  socket.on('location-update', (data) => {
    // Send to customer room or specific customer
    if (data.customerId) {
      io.to(data.customerId).emit('driver-location', { lat: data.lat, lng: data.lng });
    }
  });

  // --- CHAT LOGIC ---
  socket.on('join-chat', (rideId) => {
    socket.join(`chat_${rideId}`);
    console.log(`User joined chat room: chat_${rideId}`);
  });

  socket.on('send-chat-message', async (data) => {
    // data = { rideId, senderId, text }
    try {
      const newMessage = await Message.create({
        rideId: data.rideId,
        senderId: data.senderId,
        text: data.text
      });

      // Broadcast to room
      io.to(`chat_${data.rideId}`).emit('receive-chat-message', newMessage);

      // Send a notification to the recipient specifically
      const ride = await Ride.findById(data.rideId);
      if (ride) {
        const recipientId = data.senderId === ride.customerId.toString() 
          ? ride.driverId?.toString() 
          : ride.customerId.toString();
        
        if (recipientId) {
          io.to(recipientId).emit('new-chat-notification', {
            rideId: data.rideId,
            senderId: data.senderId,
            text: data.text.length > 50 ? data.text.substring(0, 47) + '...' : data.text
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Background Job: Check for upcoming scheduled rides (every minute)
setInterval(async () => {
  try {
    const now = new Date();
    // Look for rides starting between 14 and 16 minutes from now
    const startWindow = new Date(now.getTime() + 14 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 16 * 60 * 1000);

    const upcomingRides = await Ride.find({
      scheduledTime: { $gte: startWindow, $lt: endWindow },
      status: 'accepted',
      reminderSent: { $ne: true }
    });

    for (const ride of upcomingRides) {
      console.log(`Sending 15-minute reminder for ride: ${ride._id}`);
      
      // Notify Customer
      io.to(ride.customerId.toString()).emit('ride-reminder', {
        message: "⏰ Your scheduled ride starts in 15 minutes! The driver will be arriving soon.",
        rideId: ride._id
      });

      // Notify Driver
      if (ride.driverId) {
        io.to(ride.driverId.toString()).emit('ride-reminder', {
          message: "⏰ Heads up! You have a scheduled ride starting in 15 minutes.",
          rideId: ride._id
        });
      }

      // Mark as notified
      ride.reminderSent = true;
      await ride.save();
    }
  } catch (err) {
    console.error('Reminder check error:', err);
  }
}, 60000);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
