'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { io } from 'socket.io-client';
import { API_URL } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import LocationAutocomplete, { LocationResult } from '@/components/LocationAutocomplete';
import ActiveRideWidget from '@/components/ActiveRideWidget';
import SystemAlert from '@/components/SystemAlert';
import ChatOverlay from '@/components/ChatOverlay';
import { getEstimatedClockTime } from '@/utils/EstimatedTimeHelper';
import { Home, History, User, LogOut, ShieldCheck, Map as MapIcon } from 'lucide-react';

// Map rendering without SSR
const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Contact = { name: string; phone: string; email: string; relation: string };

function DashboardContent() {
  const { customerProfile, logout } = useAuth();
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [userName, setUserName] = useState(customerProfile?.name || 'Customer');
  const [showEmergency, setShowEmergency] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 🛡️ Nuclear Responsiveness Fix: Manual Window Width & Touch Check
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isTouch = navigator.maxTouchPoints > 0;
      // 🚀 Extreme Threshold: If width < 1400 OR it's a touch device, show mobile UI
      setIsMobile(width < 1400 || isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Format 12-hour preview for easy interface
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTimeVal] = useState('');

  const getTimePreview = () => {
    if (!scheduleDate || !scheduleTime) return ''; // Only show when BOTH are selected
    const [hrs, mins] = scheduleTime.split(':');
    let h = parseInt(hrs);
    const m = mins;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `Picked up at ${h}:${m} ${ampm} on ${scheduleDate}`;
  };
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', phone: '', email: '', relation: 'Family' }]);
  const [saved, setSaved] = useState(false);

  // Rating States
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingRideId, setRatingRideId] = useState('');
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [pickupObj, setPickupObj] = useState<any>(null);
  const [dropObj, setDropObj] = useState<any>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [fareConditions, setFareConditions] = useState<any>(null);
  const [showBreakdown, setShowBreakdown] = useState(-1);
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'arrived' | 'started'>('idle');
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const driverInfoRef = useRef<any>(null); // To handle stale closures in socket events
  useEffect(() => { driverInfoRef.current = driverInfo; }, [driverInfo]);

  const [cancellingRideId, _setCancellingRideId] = useState<string | null>(null);
  const cancellingRideIdRef = useRef<string | null>(null);
  const setCancellingRideId = (id: string | null) => {
    _setCancellingRideId(id);
    cancellingRideIdRef.current = id;
  };

  const [searchingRideId, setSearchingRideId] = useState<string | null>(null); // To allow cancelling search immediately

  const [driverCoords, setDriverCoords] = useState<any>(null);
  const [isPreBooking, setIsPreBooking] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [sysAlert, setSysAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning'; visible: boolean }>({ message: '', type: 'info', visible: false });

  const showAlert = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
    setSysAlert({ message, type, visible: true });
  };

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatRideId, setChatRideId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Contact Selection State
  const [contactSelection, setContactSelection] = useState<{ visible: boolean, type: 'sos' | 'share', rideId?: string, selectedIds: string[] } | null>(null);

  // In-App Alerts State
  const [incomingAlerts, setIncomingAlerts] = useState<any[]>([]);

  // 15-min Pre-Booking Reminder
  const [rideReminder, setRideReminder] = useState<string | null>(null);
  const reminderShownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      for (const ride of activeRides) {
        if (!ride.scheduledTime) continue;
        if (ride.status !== 'accepted' && ride.status !== 'requested') continue;
        const sTime = new Date(ride.scheduledTime);
        const diffMs = sTime.getTime() - now.getTime();
        const diffMins = diffMs / 60000;
        // Trigger if within 15 min but not already past
        if (diffMins > 0 && diffMins <= 15 && !reminderShownRef.current.has(ride._id)) {
          reminderShownRef.current.add(ride._id);
          const timeStr = sTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setRideReminder(`⏰ Reminder: Your ride is scheduled at ${timeStr}`);
          setTimeout(() => setRideReminder(null), 8000);
        }
      }
    };
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [activeRides]);

  // 🕒 10-Minute Timeout for Scheduled Rides
  useEffect(() => {
    const checkTimeout = () => {
      activeRides.forEach(ride => {
        if (ride.scheduledTime && ride.status === 'requested') {
          const createdAt = new Date(ride.createdAt || Date.now()).getTime();
          const now = Date.now();
          // If 10 mins passed since request
          if (now - createdAt > 10 * 60 * 1000) {
            showAlert(`Your scheduled ride for ${new Date(ride.scheduledTime).toLocaleTimeString()} is not being accepted by any driver. Please reschedule.`, "warning", 10000);
          }
        }
      });
    };
    const timer = setInterval(checkTimeout, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [activeRides]);

  const fetchActiveRides = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/rides/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRides(data.rides || []);

        // Restore dashboard primary map details if there is an active INSTANT ride in progress
        // Pre-booked rides should not lock the primary dashboard while just 'accepted' and waiting.
        const activeInstance = data.rides.find((r: any) => {
          if (['arrived', 'in-transit'].includes(r.status)) return true;
          if (r.status === 'accepted' && !r.scheduledTime) return true;
          return false;
        });

        if (activeInstance) {
          setRideStatus(activeInstance.status === 'in-transit' ? 'started' : activeInstance.status);
          setPickupObj(activeInstance.pickupLocation);
          setDropObj(activeInstance.dropLocation);
          setDriverInfo({
            rideId: activeInstance._id,
            driverName: activeInstance.driverId.name,
            driverId: activeInstance.driverId._id,
            vehiclePlate: activeInstance.driverId.vehiclePlate,
            otp: activeInstance.otp || '***'
          });
        } else {
          // 🛡️ If the server returns no active rides, reset the dashboard to idle
          // but preserve the location objects so the user can easily re-book.
          // CRITICAL: Do not reset if we are currently "searching" as that is a local intent
          // that might not have reached the server yet or is still in 'requested' status.
          if (rideStatus !== 'idle' && rideStatus !== 'searching') {
            setRideStatus('idle');
            setDriverInfo(null);
            setDriverCoords(null);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUnreadAlerts = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingAlerts(data || []);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  };

  useEffect(() => {
    fetchActiveRides();
    fetchUnreadAlerts();
    
    // Fetch user location for search proximity
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    const interval = setInterval(() => {
      fetchActiveRides();
      fetchUnreadAlerts();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      showAlert("Geolocation is not supported by your browser.", "error");
      return;
    }
    
    // Set a loading state visually
    setPickup("📍 Locating you...");
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Reverse geocode using Nominatim (OpenStreetMap) - Free and no key required
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          
          if (data && data.display_name) {
            const shortAddress = data.display_name.split(',').slice(0, 3).join(','); // Get a concise version
            setPickup(shortAddress);
            setPickupObj({ lat: latitude, lng: longitude, address: shortAddress });
          } else {
            // Fallback if geocoding fails
            setPickup("Current Location (Address not found)");
            setPickupObj({ lat: latitude, lng: longitude, address: "Current Location (Manual check required)" });
          }
        } catch (err) {
          console.error("Geocoding error:", err);
          setPickup("Current Location");
          setPickupObj({ lat: latitude, lng: longitude, address: "Current Location" });
        }
      },
      () => {
        setPickup("");
        showAlert("Unable to access location. Please check browser permissions.", "error");
      }
    );
  };

  // Helper to calculate distance and ETA dynamically
  const calculateDynamicETA = (coords1: any, coords2: any) => {
    if (!coords1 || !coords2) return 'Calculating...';
    try {
      const R = 6371; // Radius of the earth in km
      const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
      const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;
      const mins = Math.max(1, Math.round(d * 4)); // Assume 15km/h in traffic -> 4 mins per km
      return `${mins} min`;
    } catch { return '...'; }
  };

  useEffect(() => {
    if (customerProfile) setUserName(customerProfile.name);
  }, [customerProfile]);

  const handlePickupSelect = (loc: LocationResult | null) => {
    if (!loc) {
      setPickupObj(null);
      return;
    }
    setPickupObj({ lat: loc.lat, lng: loc.lng, address: loc.address });
  };

  const handleDropSelect = (loc: LocationResult | null) => {
    if (!loc) {
      setDropObj(null);
      return;
    }
    setDropObj({ lat: loc.lat, lng: loc.lng, address: loc.address });
  };

  const handleConfirmBooking = async () => {
    const selected = availableRides[selectedRide];
    if (!selected) return;

    if (isPreBooking && scheduledTime) {
      const sched = new Date(scheduledTime);
      const now = new Date();
      if (sched.getTime() - now.getTime() < 30 * 60 * 1000) {
        showAlert("Pre-booking must be at least 30 minutes in advance. For sooner rides, please use normal booking.", "warning");
        return;
      }
    }

    setRideStatus('searching');
    try {
      const token = localStorage.getItem('customerToken');
      const res = await fetch(`${API_URL}/api/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          pickupLocation: pickupObj,
          dropLocation: dropObj,
          rideType: selected.name,
          fare: `₹${selected.price}`,
          eta: selected.eta,
          tripDuration: selected.tripDuration,
          distanceKm: selected.distanceKm,
          scheduledTime: isPreBooking ? scheduledTime : undefined
        })
      });
      const rideData = await res.json();
      if (res.ok) {
        // Broadcast the ride to drivers regardless of whether it's instant or scheduled
        socket?.emit('request-ride', {
          rideId: rideData._id,
          pickup: pickupObj,
          drop: dropObj,
          rideType: selected.name,
          fare: `₹${selected.price}`,
          distance: selected.distanceKm,
          customerId: localStorage.getItem('customerId'),
          customerName: userName,
          scheduledTime: isPreBooking ? scheduledTime : null
        });

        if (isPreBooking && scheduledTime) {
          // 🤫 Silent scheduling as requested - no immediate popup
          setRideStatus('idle');
          setShowRides(false);
          setPickup('');
          setDrop('');
          setPickupObj(null);
          setDropObj(null);
        } else {
          setSearchingRideId(rideData._id);
          showAlert("🚀 Request sent! Finding you a driver...", 'success');
        }
        fetchActiveRides();
      }
    } catch (err) {
      console.error(err);
      setRideStatus('idle');
    }
  };

  useEffect(() => {
    // Init Socket
    const newSocket = io(API_URL);
    setSocket(newSocket);

    // Join room for targeted updates
    const uid = localStorage.getItem('customerId');
    if (uid) newSocket.emit('join', uid);

    // Request Notification Permissions
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    newSocket.on('new-emergency-alert', (data: any) => {
      setIncomingAlerts(prev => [...prev, {
        _id: data.alertId,
        senderId: { name: data.senderName },
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        status: 'unread',
        rideId: { driverId: data.driverInfo }
      }]);
      const isShare = data.type === 'share';
      showAlert(isShare ? `📍 LOCATION SHARE: ${data.senderName} shared their trip with you!` : `🚨 EMERGENCY: ${data.senderName} triggered ${data.type}!`, isShare ? "info" : "error");
    });

    newSocket.on('ride-accepted', (data) => {
      fetchActiveRides();
      setShowRides(false); // Hide selection UI on mobile
      // Only lock the main dashboard map to 'accepted' if it's an INSTANT ride.
      if (!data.scheduledTime) {
        setRideStatus('accepted');
        setDriverInfo(data);
      }

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(data.scheduledTime ? "Scheduled Ride Accepted! ✅" : "Ride Accepted! ✅", {
          body: data.scheduledTime
            ? `Your scheduled ride has been accepted by Driver: ${data.driverName}. Check app for details.`
            : `Your SheRide is on the way! Driver: ${data.driverName}. Your TRIP PIN: ${data.otp}`,
          icon: "/favicon.ico"
        });
      } else {
        showAlert(data.scheduledTime
          ? `📅 Your scheduled ride has been accepted by ${data.driverName}`
          : `🎉 Ride Accepted! Driver ${data.driverName} is on the way. Your OTP is ${data.otp}`, 'success');
      }
    });

    newSocket.on('driver-arrived', (data) => {
      fetchActiveRides();
      setShowRides(false);
      setRideStatus('arrived');
      showAlert("👋 Your driver has arrived at the pickup location!", 'info');
    });
    newSocket.on('ride-started', (data) => {
      fetchActiveRides();
      setShowRides(false);
      setRideStatus('started');
      showAlert("🚀 Trip started! Safe journey.", 'success');
    });
    newSocket.on('ride-completed', (data) => {
      fetchActiveRides();
      setRideStatus('idle');
      setDriverInfo(null);
      setDriverCoords(null);
      // 🔥 Restore Rating UI
      setRatingRideId(data.rideId);
      setShowRatingModal(true);
      showAlert('🏁 Your ride has been completed! Please rate your experience.', 'success');
    });
    newSocket.on('driver-location', (coords) => setDriverCoords(coords));
    const handleTriggerCancel = (e: any) => {
      setCancellingRideId(e.detail);
      setShowCancelModal(true);
    };
    const handleTriggerOpenChat = (e: any) => {
      setChatRideId(e.detail);
      setIsChatOpen(true);
      setUnreadCount(0);
    };
    const handleTriggerSOS = (e: any) => {
      const targetId = e.detail;
      const defaultIds = customerProfile?.emergencyContacts?.map((c: any) => c._id) || [];
      setContactSelection({ visible: true, type: 'sos', rideId: targetId, selectedIds: defaultIds });
    };

    window.addEventListener('triggerCancelRide', handleTriggerCancel);
    window.addEventListener('triggerOpenChat', handleTriggerOpenChat);
    window.addEventListener('triggerSOS', handleTriggerSOS);

    return () => { 
      newSocket.disconnect(); 
      window.removeEventListener('triggerCancelRide', handleTriggerCancel);
      window.removeEventListener('triggerOpenChat', handleTriggerOpenChat);
      window.removeEventListener('triggerSOS', handleTriggerSOS);
    }
  }, []); // Mount only for socket initialization

  // Consolidated Socket Listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      // Handled by new-chat-notification
    };

    socket.on('receive-chat-message', handleNewMessage);

    socket.on('ride-accepted', (data: any) => {
      fetchActiveRides();
      if (!data.scheduledTime) {
        setRideStatus('accepted');
        setDriverInfo(data);
      }
    });

    socket.on('driver-arrived', (data) => {
      fetchActiveRides();
      setRideStatus('arrived');
      showAlert("👋 Your driver has arrived at the pickup location!", 'info');
    });

    socket.on('ride-started', (data) => {
      fetchActiveRides();
      setRideStatus('started');
      // Hide OTP once ride has started
      setDriverInfo(prev => prev ? { ...prev, otp: '' } : null);
      showAlert("🚀 Trip started! Safe journey.", 'success');
    });

    socket.on('ride-completed', (data) => {
      fetchActiveRides();
      setRideStatus('idle');
      setDriverInfo(null);
      setDriverCoords(null);
      setShowRides(false);
      setAvailableRides([]);
      setRatingRideId(data.rideId);
      setShowRatingModal(true);
      // ✨ Clear Locations on Completion
      setPickup('');
      setDrop('');
      setPickupObj(null);
      setDropObj(null);
      showAlert('🏁 Your ride has been completed! Please rate your experience.', 'success');
    });

    socket.on('driver-location', (coords) => setDriverCoords(coords));

    socket.on('ride-cancelled', (data) => {
      fetchActiveRides();
      if (data.rideId === driverInfoRef.current?.rideId) {
        setDriverInfo(null);
        setDriverCoords(null);
        if (data.role === 'driver') {
          setRideStatus('searching'); 
          showAlert(`🚫 Driver cancelled (${data.reason || 'No reason'}). Finding you a new ride...`, 'info');
          setTimeout(() => { handleConfirmBooking(); }, 1000);
        } else {
          setRideStatus('idle');
        }
      } else {
         showAlert(`🚫 Ride cancelled by ${data.cancelledBy || 'Driver'}. ${data.reason ? `Reason: ${data.reason}` : ''}`, 'info');
      }
    });

    socket.on('new-chat-notification', (data) => {
      if (!isChatOpenRef.current) {
        setUnreadCount(prev => prev + 1);
        showAlert(`💬 New message: ${data.text}`, 'info');
      }
    });

    socket.on('ride-reminder', (data) => {
      showAlert(data.message, 'info');
    });

    return () => {
      socket.off('ride-accepted');
      socket.off('driver-arrived');
      socket.off('ride-started');
      socket.off('ride-completed');
      socket.off('driver-location');
      socket.off('ride-cancelled');
      socket.off('receive-chat-message', handleNewMessage);
      socket.off('new-chat-notification');
      socket.off('ride-reminder');
    };
  }, [socket]);

  // Use a ref to track isChatOpen for the background listener to avoid stale closure
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  // Background Chat Room Joining
  useEffect(() => {
    if (!socket || activeRides.length === 0) return;
    activeRides.forEach(ride => {
      if (ride._id) socket.emit('join-chat', ride._id);
    });
  }, [socket, activeRides]);

  const addContact = () => setContacts([...contacts, { name: '', phone: '', email: '', relation: 'Family' }]);
  const updateContact = (i: number, field: keyof Contact, val: string) => {
    const c = [...contacts]; c[i][field] = val; setContacts(c);
  };

  const saveContacts = async () => {
    const token = localStorage.getItem('customerToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/emergency-contacts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => { setSaved(false); setShowEmergency(false); }, 1800);
      }
    } catch { showAlert('Network error', 'error'); }
  };

  const fetchEstimates = async () => {
    try {
      if (!pickupObj || !dropObj) {
        showAlert("Please select both pickup and destination from the suggestions list.", "warning");
        return;
      }

      console.log("SENDING TO SERVER:", {
        pickup: { lat: pickupObj.lat, lng: pickupObj.lng, addr: pickupObj.address },
        drop: { lat: dropObj.lat, lng: dropObj.lng, addr: dropObj.address }
      });

      setAvailableRides([]); 
      const res = await fetch(`${API_URL}/api/rides/estimate?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pickupLocation: { lat: pickupObj.lat, lng: pickupObj.lng }, 
          dropLocation: { lat: dropObj.lat, lng: dropObj.lng } 
        })
      });
      const data = await res.json();
      console.log("SERVER RESPONDED WITH:", data);
      setAvailableRides(data.rides);
      setFareConditions({ demand: data.demandLevel, traffic: data.trafficLevel });
      setShowRides(true);
    } catch (err) { 
      console.error("ESTIMATE ERROR:", err);
      showAlert('Failed to fetch estimate', 'error'); 
    }
  };

  const [selectedRide, setSelectedRide] = useState(0);
  const [showRides, setShowRides] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Outfit, sans-serif' }}>

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-[#e5e7eb] px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsAccountMenuOpen(!isAccountMenuOpen);
            }}
            className="lg:hidden p-2 -ml-2 text-[#4b5563] hover:bg-gray-100 rounded-xl transition-colors relative z-[100]"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <Link href="/dashboard" className="no-underline">
            <span className="text-xl sm:text-2xl font-black text-[#e11d48] tracking-tight">SheRide</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8">
          <button 
            onClick={() => { setRideStatus('idle'); setShowRides(false); setIsSidebarOpen(false); }}
            className="text-sm font-black text-[#e11d48] bg-transparent border-none cursor-pointer"
            style={{ display: isMobile ? 'none' : 'block' }}
          >
            Home
          </button>
          <div 
            className="lg:flex items-center gap-8 text-sm font-bold"
            style={{ display: isMobile ? 'none' : 'flex' }}
          >
            <Link href="/history" className="text-[#6b7280] hover:text-[#e11d48] transition-colors">My Rides</Link>
            <button onClick={() => setIsSafetyOpen(true)} className="text-[#6b7280] hover:text-[#e11d48] transition-colors font-bold cursor-pointer">Safety</button>
            <Link href="/profile" className="text-[#6b7280] hover:text-[#e11d48] transition-colors">Profile</Link>
            <button onClick={logout} className="text-[#ef4444] font-bold cursor-pointer">Logout</button>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#ffe4e6] text-[#e11d48] flex items-center justify-center font-extrabold shadow-sm border border-[#fecdd3]">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>

      {/* ── MOBILE ACCOUNT MENU ── */}
      {isAccountMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAccountMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-8 bg-gradient-to-br from-[#111827] to-[#1f2937] text-white">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl mb-4">👩</div>
              <h3 className="text-xl font-black">{userName}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Passenger Account</p>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => setIsAccountMenuOpen(false)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-rose-50 text-[#e11d48] transition-colors text-left">
                <span className="text-xl">🗺️</span>
                <span className="font-black">Back to Map</span>
              </button>
              <Link href="/profile" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                <span className="text-xl">👤</span>
                <span className="font-black text-[#0f172a]">My Profile</span>
              </Link>
              <Link href="/history" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                <span className="text-xl">📜</span>
                <span className="font-black text-[#0f172a]">Ride History</span>
              </Link>
              <button onClick={() => { setIsSafetyOpen(true); setIsAccountMenuOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left">
                <span className="text-xl">🛡️</span>
                <span className="font-black text-[#0f172a]">Safety Dashboard</span>
              </button>
              <div className="h-px bg-slate-100 my-4" />
              <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-rose-600 hover:bg-rose-50 transition-colors text-left">
                <span className="text-xl">🚪</span>
                <span className="font-black">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAFETY DASHBOARD MODAL ── */}
      {isSafetyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', padding: '32px 24px', color: '#fff', textAlign: 'center' }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🛡️</span>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Safety Dashboard</h2>
                <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '14px' }}>Your safety is our top priority</p>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '12px', fontWeight: 800, color: '#9ca3af', marginBottom: '16px', letterSpacing: '0.05em' }}>QUICK SAFETY ACTIONS</p>
              
              {(() => {
                const activeRide = activeRides[0];
                const isElite = activeRide && (activeRide.rideType === 'SheRide Safe' || activeRide.rideType?.includes('Safe'));

                if (!activeRide) {
                  return (
                    <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '16px', marginBottom: '24px' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#64748b' }}>Start a ride to access safety features.</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Share Ride Card */}
                    <button 
                      onClick={async () => {
                        if (!activeRide) return showAlert("You don't have an active ride to share.", "warning");
                        setIsSafetyOpen(false);
                        const defaultIds = customerProfile?.emergencyContacts?.map((c: any) => c._id) || [];
                        setContactSelection({ visible: true, type: 'share', rideId: activeRide._id, selectedIds: defaultIds });
                      }}
                      disabled={sosLoading}
                      style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: '20px', padding: '20px', textAlign: 'left', cursor: 'pointer', transition: '0.3s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '24px', display: 'block', marginBottom: '12px', color: '#e11d48' }}>🔗</span>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '15px' }}>Share Ride</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>Share live location</p>
                    </button>

                    {/* Call Emergency Card */}
                    {isElite ? (
                      <a href="tel:112" style={{ textDecoration: 'none', background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: '20px', padding: '20px', textAlign: 'left', cursor: 'pointer', transition: '0.3s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '24px', display: 'block', marginBottom: '12px', color: '#e11d48' }}>📞</span>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '15px' }}>Call Emergency</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>Quick dial 112</p>
                      </a>
                    ) : (
                      <div onClick={() => showAlert("SOS features like calling emergency services directly from the app are restricted to SheRide Safe (Elite) bookings.", "warning")} style={{ textDecoration: 'none', background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '20px', padding: '20px', textAlign: 'left', cursor: 'pointer', transition: '0.3s', opacity: 0.7 }}>
                        <span style={{ fontSize: '24px', display: 'block', marginBottom: '12px', color: '#94a3b8' }}>🔒</span>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: '#64748b' }}>Call Emergency</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>Elite feature</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              
              <button 
                onClick={() => setIsSafetyOpen(false)}
                style={{ width: '100%', padding: '14px', background: '#111827', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', marginTop: '12px' }}>
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── MAIN BODY ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative bg-white">
        {/* Sidebar Overlay (Mobile) */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar / Search Area */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-[200] w-full lg:w-[380px] bg-white border-r border-[#e5e7eb] overflow-y-auto transition-transform duration-300 ease-in-out lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${(rideStatus === 'idle' && !showRides) ? 'translate-x-0 relative' : ''}
        `}>
          <div className="p-6 pb-24 lg:pb-6">
            {/* ── SEARCH AREA ── */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 lg:block">
                  <div>
                    <h2 className="text-2xl font-black text-[#111827]">Where to?</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Book your SheRide</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              <LocationAutocomplete
                value={pickup}
                onChange={setPickup}
                onSelect={handlePickupSelect}
                placeholder="Enter pickup location"
                dotColor="#22c55e"
                userLoc={userLoc}
              />
              <LocationAutocomplete
                value={drop}
                onChange={setDrop}
                onSelect={handleDropSelect}
                placeholder="Enter destination"
                dotColor="#e11d48"
                showCurrentLocation={false}
                userLoc={userLoc}
              />
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '24px' }}>
              <button onClick={() => setIsPreBooking(!isPreBooking)} style={{ flex: 1, padding: '14px', background: isPreBooking ? '#111827' : '#fff', borderRadius: '18px', border: '1.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', cursor: 'pointer', transition: '0.3s' }}>
                <p style={{ fontSize: '20px', margin: '0 0 4px' }}>📅</p>
                <p style={{ fontWeight: 800, color: isPreBooking ? '#fff' : '#4b5563', fontSize: '12px', margin: 0 }}>Schedule</p>
              </button>
            </div>

            {isPreBooking && (
              <div style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: '2px solid #ffe4e6', marginBottom: '20px', boxShadow: '0 8px 20px rgba(225,29,72,0.08)' }}>
                <p style={{ fontWeight: 900, fontSize: '13px', color: '#e11d48', marginTop: 0, marginBottom: '12px', letterSpacing: '0.5px' }}>PICK DATE & TIME</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="date" min={new Date().toISOString().split('T')[0]} style={{ flex: 1.5, padding: '12px', borderRadius: '12px', border: '1.5px solid #f3f4f6', outline: 'none', background: '#f9fafb', fontWeight: 600 }} onChange={e => {
                    const date = e.target.value;
                    setScheduleDate(date);
                    if (scheduleTime) setScheduledTime(`${date}T${scheduleTime}`);
                  }} />
                  <input type="time" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #f3f4f6', outline: 'none', background: '#f9fafb', fontWeight: 600 }} onChange={e => {
                     const time = e.target.value;
                     setScheduleTimeVal(time);
                     const date = scheduleDate || new Date().toISOString().split('T')[0];
                     // Create a local date object then convert to string to ensure consistency
                     const [y, m, d] = date.split('-').map(Number);
                     const [hrs, mins] = time.split(':').map(Number);
                     const localDate = new Date(y, m - 1, d, hrs, mins);
                     setScheduledTime(localDate.toISOString());
                   }} />
                </div>
                {scheduleDate && scheduleTime && getTimePreview() && (
                  (() => {
                    const sched = new Date(scheduledTime);
                    const now = new Date();
                    const tooClose = sched.getTime() - now.getTime() < 30 * 60 * 1000;
                    
                    return (
                      <p style={{ 
                        margin: '12px 0 0', 
                        fontSize: '12px', 
                        color: tooClose ? '#e11d48' : '#10b981', 
                        fontWeight: 800, 
                        textAlign: 'center', 
                        background: tooClose ? '#fff1f2' : '#ecfdf5', 
                        padding: '10px', 
                        borderRadius: '12px',
                        border: tooClose ? '1.5px solid #fecdd3' : '1.5px solid #d1fae5'
                      }}>
                        {tooClose 
                          ? `⚠️ Time is too close! Please pick a time at least 30 mins from now, or use instant booking.`
                          : `✨ ${getTimePreview()}`
                        }
                      </p>
                    );
                  })()
                )}
              </div>
            )}

            {!showRides ? (
              <button 
                onClick={() => { 
                  if (!pickupObj || !dropObj) {
                    showAlert("Please select locations from the dropdown list.", "warning");
                    return;
                  }
                  if (pickup && drop) {
                    if (isPreBooking && scheduledTime) {
                      const sched = new Date(scheduledTime);
                      const now = new Date();
                      if (sched.getTime() - now.getTime() < 30 * 60 * 1000) {
                        showAlert("Please pick a time at least 30 minutes in advance for pre-booking.", "warning");
                        return;
                      }
                    }
                    fetchEstimates(); 
                    setIsSidebarOpen(false); // Close sidebar on search (mobile)
                  } 
                }} 
                className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
                  (!pickupObj || !dropObj) 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-[#111827] text-white hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {(!pickupObj || !dropObj) ? 'Select Locations...' : 'Search SheRides'}
              </button>
            ) : (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">AVAILABLE RIDES</p>
                  <button onClick={() => setShowRides(false)} className="text-sm font-black text-[#e11d48] hover:underline">Edit</button>
                </div>
                <div className="flex flex-col gap-3">
                  {availableRides.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedRide(i)} 
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedRide === i 
                        ? 'border-[#e11d48] bg-[#fff5f6] shadow-md' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{r.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-[#0f172a]">{r.name}</p>
                            {r.id === 'safe' && (
                              <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-md font-black italic">ELITE</span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500">{r.desc}</p>
                          {!isPreBooking && (
                            <p className="text-xs font-black text-[#e11d48] mt-1.5 flex items-center gap-1">
                              <span className="text-[10px]">⏰</span> Est. Pickup: {r.eta}
                            </p>
                          )}
                        </div>
                        <p className="font-black text-lg text-[#0f172a]">₹{r.price}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {rideStatus === 'idle' ? (
                  <button 
                    onClick={handleConfirmBooking} 
                    className="w-full mt-6 py-5 bg-[#111827] text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Confirm Booking
                  </button>
                ) : (
                  <div className="w-full mt-6 flex flex-col gap-3">
                    <div className="py-4 bg-slate-100 rounded-2xl text-center font-black text-[#0f172a] animate-pulse">
                      {rideStatus === 'searching' ? '⏳ Searching drivers...' : rideStatus === 'accepted' ? '✅ Driver is coming!' : rideStatus === 'arrived' ? '👋 Driver has arrived!' : '🚀 Trip Started'}
                    </div>

                    {rideStatus === 'searching' && (
                      <button 
                        onClick={() => {
                          const requested = activeRides.find(r => r.status === 'requested' && !r.scheduledTime);
                          const targetId = requested?._id || searchingRideId;
                          if (targetId) {
                            setCancellingRideId(targetId);
                            setShowCancelModal(true);
                          } else {
                            setRideStatus('idle');
                            showAlert("Search stopped.", "info");
                          }
                        }} 
                        className="py-3 bg-white text-[#e11d48] border-2 border-[#ffe4e6] rounded-2xl font-black hover:bg-[#fff5f6] transition-colors"
                      >
                        Stop Searching
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map Panel (Rigid height on mobile to prevent blank white space) */}
        <div className={`
          relative transition-all duration-500 bg-slate-200 z-0
          ${(rideStatus === 'idle' && !showRides) ? 'h-0 hidden lg:block' : 'h-[500px] lg:h-auto w-full block flex-shrink-0'}
        `} style={{ minHeight: (rideStatus === 'idle' && !showRides) ? '0' : '450px' }}>
          <Map 
            key={`map-v5-${showRides}-${rideStatus}`} 
            pickupObj={pickupObj} 
            dropObj={dropObj} 
            driverCoords={driverCoords} 
            searching={rideStatus === 'searching'} 
          />
          
          {/* Back button for mobile booking view */}
          {(showRides || rideStatus !== 'idle') && (
            <button 
              onClick={() => { setShowRides(false); setRideStatus('idle'); }}
              className="lg:hidden absolute top-4 left-4 z-20 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-[#111827] border border-slate-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>

        {/* Bottom Sheet (Mobile Booking Options) */}
        {(showRides || rideStatus !== 'idle') && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-[250] bg-white rounded-t-[2.5rem] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] border-t border-slate-100 max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 flex-shrink-0" />
            <div className="px-6 pb-20">
               {/* This is a simplified version of the sidebar booking content */}
               {showRides && rideStatus === 'idle' && (
                 <div>
                   <div className="flex justify-between items-center mb-6">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">CHOOSE A RIDE</p>
                      <button onClick={() => setShowRides(false)} className="text-sm font-black text-[#e11d48]">Edit Locations</button>
                   </div>
                   <div className="flex flex-col gap-3 mb-8">
                     {availableRides.map((r, i) => (
                       <div 
                         key={i} 
                         onClick={() => setSelectedRide(i)} 
                         className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                           selectedRide === i 
                           ? 'border-[#e11d48] bg-[#fff5f6]' 
                           : 'border-slate-50 bg-slate-50/50'
                         }`}
                       >
                         <div className="flex items-center gap-4">
                           <span className="text-3xl">{r.icon}</span>
                           <div className="flex-1">
                             <p className="font-black text-[#0f172a] text-sm">{r.name}</p>
                             <p className="text-[10px] font-bold text-slate-500 mt-0.5">{r.eta} • {r.desc}</p>
                           </div>
                           <p className="font-black text-lg text-[#0f172a]">₹{r.price}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                   <button 
                     onClick={handleConfirmBooking} 
                     className="w-full py-5 bg-[#111827] text-white font-black text-lg rounded-2xl shadow-xl active:scale-[0.98] transition-all"
                   >
                     Confirm Booking
                   </button>
                 </div>
               )}
                {rideStatus === 'searching' && (
                  <div className="pt-4 text-center">
                    <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <span className="text-4xl text-[#e11d48]">⏳</span>
                    </div>
                    <h3 className="text-xl font-black text-[#0f172a] mb-2">Searching for Drivers...</h3>
                    <p className="text-sm font-medium text-slate-500 mb-8">We are finding the best SheRide for you.</p>
                    
                    <button 
                      onClick={() => {
                        const requested = activeRides.find(r => r.status === 'requested' && !r.scheduledTime);
                        const targetId = requested?._id || searchingRideId;
                        if (targetId) {
                          setCancellingRideId(targetId);
                          setShowCancelModal(true);
                        } else {
                          setRideStatus('idle');
                          showAlert("Search stopped.", "info");
                        }
                      }} 
                      className="w-full py-4.5 bg-white text-[#e11d48] border-2 border-[#ffe4e6] rounded-2xl font-black active:bg-rose-50 transition-all"
                    >
                      Stop Searching
                    </button>
                  </div>
                )}
                {/* Mobile Trip Details removed to use ActiveRideWidget instead, matching Laptop UI */}
            </div>
          </div>
        )}
      </div>
      {/* Active Rides Widget - Now visible on both Mobile and Desktop to match Laptop experience */}
      <ActiveRideWidget rides={activeRides} unreadCount={unreadCount} />
      
      {/* SOS Button integrated into ActiveRideWidget for better responsiveness */}

      {/* ── CONTACT SELECTION MODAL ── */}
      {contactSelection && contactSelection.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="mb-6 text-center">
               <span className="text-4xl mb-3 block">{contactSelection.type === 'sos' ? '🚨' : '🔗'}</span>
               <h3 className="text-2xl font-black text-[#0f172a] mb-1.5">Select Contacts</h3>
               <p className="text-sm font-medium text-slate-500">Choose who should receive this {contactSelection.type === 'sos' ? 'emergency alert' : 'ride update'}.</p>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto mb-8 flex flex-col gap-3 no-scrollbar">
               {(!customerProfile?.emergencyContacts || customerProfile.emergencyContacts.length === 0) ? (
                 <div className="p-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">No emergency contacts found in your profile.</p>
                 </div>
               ) : (
                 customerProfile.emergencyContacts.map((c: any) => {
                   const isSelected = contactSelection.selectedIds.includes(c._id);
                   return (
                     <div key={c._id} 
                          onClick={() => {
                            setContactSelection(prev => {
                              if (!prev) return prev;
                              const newIds = isSelected 
                                ? prev.selectedIds.filter(id => id !== c._id)
                                : [...prev.selectedIds, c._id];
                              return { ...prev, selectedIds: newIds };
                            });
                          }}
                          className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                            isSelected ? 'border-[#e11d48] bg-red-50' : 'border-slate-100 hover:border-slate-200'
                          }`}
                      >
                       <div>
                         <p className="font-black text-[#0f172a]">{c.name}</p>
                         <p className="text-xs font-bold text-slate-500 mt-0.5">{c.relation} {c.email ? `• Email Available` : ''}</p>
                       </div>
                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                         isSelected ? 'bg-[#e11d48]' : 'bg-slate-100'
                       }`}>
                         {isSelected && <span className="text-white text-xs font-black">✓</span>}
                       </div>
                     </div>
                   );
                 })
               )}
            </div>

            <div className="flex gap-4">
               <button onClick={() => setContactSelection(null)} disabled={sosLoading} className="flex-1 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
               <button 
                 disabled={!customerProfile?.emergencyContacts?.length || contactSelection.selectedIds.length === 0 || sosLoading}
                 onClick={async () => {
                   setSosLoading(true);
                   navigator.geolocation.getCurrentPosition(async (pos) => {
                      const { latitude, longitude } = pos.coords;
                      const token = localStorage.getItem('customerToken');
                      await fetch(`${API_URL}/api/rides/${contactSelection.rideId}/sos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ 
                           lat: latitude, 
                           lng: longitude, 
                           alertType: contactSelection.type,
                           selectedContactIds: contactSelection.selectedIds
                        })
                      });
                      setSosLoading(false);
                      setContactSelection(null);
                      showAlert(contactSelection.type === 'sos' ? "🚨 SOS SIGNAL SENT." : "📍 Trip details shared!", "success");
                   }, () => {
                      setSosLoading(false);
                      setContactSelection(null);
                      showAlert("Location required.", "error");
                   });
                 }} 
                 className={`flex-1 py-4 rounded-2xl font-black text-white shadow-lg transition-all ${
                   contactSelection.selectedIds.length === 0 || sosLoading ? 'bg-slate-300 shadow-none' : 'bg-[#e11d48] shadow-red-200'
                 }`}
                >
                 {sosLoading ? 'Sending...' : 'Send Alert'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONFIRMATION MODAL ── */}
      {confirmModal && confirmModal.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[200] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-[#e11d48] rounded-full flex items-center justify-center text-3xl mx-auto mb-5">
              ⚠️
            </div>
            <h3 className="text-xl font-black text-[#0f172a] mb-2">{confirmModal.title}</h3>
            <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
               <button onClick={() => setConfirmModal(null)} className="flex-1 py-3.5 rounded-xl border-2 border-slate-100 font-black text-slate-600">Cancel</button>
               <button onClick={confirmModal.onConfirm} className="flex-1 py-3.5 rounded-xl bg-[#e11d48] text-white font-black shadow-lg shadow-red-100">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RATING MODAL ── */}
      {/* ── EMERGENCY ALERT OVERLAY ── */}
      {incomingAlerts.length > 0 && (() => {
        const currentAlert = incomingAlerts[0];
        const isShare = currentAlert.type === 'share';
        const themeColor = isShare ? '#3b82f6' : '#e11d48';
        const themeBg = isShare ? '#eff6ff' : '#fee2e2';
        const emoji = isShare ? '📍' : '🚨';
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[1000] flex items-center justify-center p-5">
            <div className={`bg-white rounded-[2.5rem] w-full max-w-md p-8 sm:p-10 text-center shadow-2xl border-4`} style={{ borderColor: themeColor }}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 animate-bounce`} style={{ backgroundColor: themeBg, color: themeColor }}>
                {emoji}
              </div>
              
              <h2 className="text-2xl font-black mb-2" style={{ color: themeColor }}>
                {isShare ? 'Location Shared' : 'EMERGENCY SOS'}
              </h2>
              <p className="text-xl font-black text-[#0f172a] mb-2">{currentAlert.senderId?.name} {isShare ? 'shared their trip!' : 'needs help!'}</p>
              <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                {isShare 
                  ? 'Your contact is currently on a ride and has shared their live location with you.' 
                  : 'Your emergency contact is on a ride and has triggered a safety alert. Please check their live location immediately.'}
              </p>

              <div className="text-left p-5 rounded-2xl border mb-8" style={{ backgroundColor: themeBg, borderColor: `${themeColor}40` }}>
                <h4 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: themeColor }}>👩‍✈️ Driver Details:</h4>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Name: <span className="text-[#0f172a]">{currentAlert.rideId?.driverId?.name || 'N/A'}</span></p>
                  <p className="text-sm font-bold text-slate-700">Vehicle: <span className="text-[#0f172a]">{currentAlert.rideId?.driverId?.vehicleNumber || 'N/A'}</span></p>
                  <p className="text-sm font-bold text-slate-700">Phone: <span className="text-[#0f172a]">{currentAlert.rideId?.driverId?.phone || 'N/A'}</span></p>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <a 
                  href={`https://www.google.com/maps?q=${currentAlert.lat},${currentAlert.lng}`}
                  target="_blank"
                  className="py-4.5 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: themeColor }}
                >
                  📍 Track Live Location
                </a>
                <button 
                  onClick={async () => {
                    try {
                      const alertId = currentAlert._id;
                      const token = localStorage.getItem('customerToken');
                      await fetch(`${API_URL}/api/alerts/${alertId}/read`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      setIncomingAlerts(prev => prev.filter(al => al._id !== alertId));
                    } catch (e) {
                      console.error('Error marking alert as read:', e);
                    }
                  }}
                  className="py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Acknowledge & Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showRatingModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 sm:p-10 text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="text-5xl mb-4">✨</div>
            <h3 className="text-2xl font-black text-[#0f172a] mb-2">Rate Your Ride</h3>
            <p className="text-sm font-medium text-slate-500 mb-8">How was your experience with SheRide?</p>
            
            <div className="flex justify-center gap-2 mb-10">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className={`text-4xl transition-all ${
                    star <= ratingValue ? 'text-yellow-400 scale-110' : 'text-slate-200'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  if (ratingValue === 0) return showAlert("Please select a rating", "warning");
                  setRatingLoading(true);
                  try {
                    const token = localStorage.getItem('customerToken');
                    const res = await fetch(`${API_URL}/api/rides/${ratingRideId}/rating`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ rating: ratingValue })
                    });
                    if (res.ok) {
                      setShowRatingModal(false);
                      setRatingValue(0);
                      showAlert("Thank you! Rating saved.", "success");
                    }
                  } catch { showAlert("Failed to save rating", "error"); }
                  setRatingLoading(false);
                }}
                disabled={ratingLoading}
                className="w-full py-4.5 bg-[#111827] text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {ratingLoading ? 'Saving...' : 'Submit Rating'}
              </button>
              <button 
                onClick={() => setShowRatingModal(false)}
                className="py-3 font-black text-slate-400 hover:text-slate-600 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <SystemAlert
        message={sysAlert.message}
        type={sysAlert.type}
        visible={sysAlert.visible}
        onClose={() => setSysAlert({ ...sysAlert, visible: false })}
      />
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(225, 29, 72, 0); }
          100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
        }
      `}</style>
      {/* ── CANCEL RIDE REASON MODAL ── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[10000] flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] p-8 sm:p-10 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
            <h3 className="text-2xl font-black text-[#0f172a] mb-2">Why do you want to cancel?</h3>
            <p className="text-sm font-medium text-slate-500 mb-8">Please provide the reason for cancellation</p>
            
            <div className="flex flex-col border-t border-slate-50">
              {[
                'Selected Wrong Pickup Location',
                'Selected Wrong Drop Location',
                'Booked by mistake',
                'Selected different service/vehicle',
                'Taking too long to confirm the ride',
                'Got a ride elsewhere',
                'Others'
              ].map((reason, i) => (
                <button 
                 key={i}
                 onClick={async () => {
                    const rideIdToCancel = cancellingRideIdRef.current;
                    if (!rideIdToCancel) {
                      showAlert("Error: No ride ID found to cancel", "error");
                      setShowCancelModal(false);
                      return;
                    }
                    try {
                      const token = localStorage.getItem('customerToken');
                      const res = await fetch(`${API_URL}/api/rides/${rideIdToCancel}/cancel`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ reason })
                      });
                      
                      if (res.ok) {
                        setShowCancelModal(false);
                        setCancellingRideId(null);
                        setSearchingRideId(null);
                        setRideStatus('idle');
                        setDriverInfo(null);
                        setDriverCoords(null);
                        fetchActiveRides();
                        showAlert("✅ Ride cancelled successfully", "success");
                      } else {
                        const errData = await res.json();
                        if (!errData.message?.includes('already cancelled')) {
                          showAlert(`Failed to cancel: ${errData.message || 'Unknown error'}`, "error");
                        }
                        setShowCancelModal(false);
                        setCancellingRideId(null);
                        setSearchingRideId(null);
                        setRideStatus('idle');
                        setDriverInfo(null);
                        setDriverCoords(null);
                      }
                    } catch (err) { 
                      showAlert("Network Error: Could not reach server", "error"); 
                    }
                  }}
                  className="py-5 flex justify-between items-center border-b border-slate-50 font-black text-slate-700 hover:text-[#e11d48] transition-colors group"
                >
                  {reason}
                  <span className="text-slate-200 group-hover:text-[#e11d48] transition-colors text-2xl">›</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => { setShowCancelModal(false); setCancellingRideId(null); }} 
              className="w-full mt-8 py-4.5 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-colors"
            >
              Don't Cancel
            </button>
          </div>
        </div>
      )}
      <ChatOverlay 
        rideId={chatRideId || ''} 
        currentUserId={localStorage.getItem('customerId') || ''} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        socket={socket} 
      />

      {/* ⏰ 15-MIN RIDE REMINDER TOAST */}
      {rideReminder && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-500">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 border border-slate-800">
            <span className="text-xl animate-bounce">⏰</span>
            <p className="font-black text-sm tracking-wide">{rideReminder}</p>
            <button
              onClick={() => setRideReminder(null)}
              className="bg-white/20 hover:bg-white/30 text-white w-6 h-6 rounded-full flex items-center justify-center font-black cursor-pointer transition-colors"
            >×</button>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAVIGATION BAR (Rapido Style) ── */}
      {/* Hide bottom bar during active booking/ride to prevent overlap */}
      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      {isMobile && !showRides && rideStatus === 'idle' && (
        <div 
          className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 z-[200] flex items-center justify-around px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] safe-bottom"
          style={{ display: 'flex' }}
        >
          <Link href="/dashboard" className="flex flex-col items-center gap-1.5 px-4 no-underline group">
            <Home className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">Home</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center gap-1.5 px-4 no-underline group">
            <History className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">My Rides</span>
          </Link>
          <button onClick={() => setIsSafetyOpen(true)} className="flex flex-col items-center gap-1.5 px-4 group">
            <div className="w-12 h-12 -mt-10 bg-[#e11d48] rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">Safety</span>
          </button>
          <Link href="/profile" className="flex flex-col items-center gap-1.5 px-4 no-underline group">
            <User className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">Profile</span>
          </Link>
          <button onClick={logout} className="flex flex-col items-center gap-1.5 px-4 group">
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-rose-600 uppercase tracking-wider transition-colors">Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProtectedDashboard() {
  return (
    <RoleGuard role="customer">
      <DashboardContent />
    </RoleGuard>
  );
}
