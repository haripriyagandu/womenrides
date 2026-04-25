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
          showAlert(`📅 Ride scheduled successfully for ${new Date(scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}!`, 'success');
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
      setRideStatus('arrived');
      showAlert("👋 Your driver has arrived at the pickup location!", 'info');
    });
    newSocket.on('ride-started', (data) => {
      fetchActiveRides();
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

    window.addEventListener('triggerCancelRide', handleTriggerCancel);
    window.addEventListener('triggerOpenChat', handleTriggerOpenChat);

    return () => { 
      newSocket.disconnect(); 
      window.removeEventListener('triggerCancelRide', handleTriggerCancel);
      window.removeEventListener('triggerOpenChat', handleTriggerOpenChat);
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
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <span style={{ fontSize: '22px', fontWeight: 900, color: '#e11d48' }}>SheRide</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', fontWeight: 600 }}>
          <Link href="/dashboard" style={{ color: '#e11d48', textDecoration: 'none' }}>Home</Link>
          <Link href="/history" style={{ color: '#6b7280', textDecoration: 'none' }}>My Rides</Link>
          <button onClick={() => setIsSafetyOpen(true)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>Safety</button>
          <Link href="/profile" style={{ color: '#6b7280', textDecoration: 'none' }}>Profile</Link>
          <button onClick={logout} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>Logout</button>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>

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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '400px', background: '#fff', overflowY: 'auto', borderRight: '1px solid #e5e7eb' }}>
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '20px', color: '#111827' }}>Where to?</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              <LocationAutocomplete
                value={pickup}
                onChange={setPickup}
                onSelect={handlePickupSelect}
                placeholder="Enter pickup location"
                dotColor="#22c55e"
              />
              <LocationAutocomplete
                value={drop}
                onChange={setDrop}
                onSelect={handleDropSelect}
                placeholder="Enter destination"
                dotColor="#e11d48"
                showCurrentLocation={false}
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
                  } 
                }} 
                style={{ 
                  width: '100%', 
                  padding: '18px', 
                  background: (!pickupObj || !dropObj) ? '#cbd5e1' : '#111827', 
                  color: '#fff', 
                  fontWeight: 800, 
                  borderRadius: '18px', 
                  border: 'none', 
                  cursor: (!pickupObj || !dropObj) ? 'not-allowed' : 'pointer', 
                  fontSize: '16px', 
                  boxShadow: '0 10px 20px rgba(17,24,39,0.1)' 
                }}
              >
                {(!pickupObj || !dropObj) ? 'Select Locations...' : 'Search SheRides'}
              </button>
            ) : (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af' }}>AVAILABLE RIDES</p>
                  <button onClick={() => setShowRides(false)} style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                </div>
                {availableRides.map((r, i) => (
                  <div key={i} onClick={() => setSelectedRide(i)} style={{ padding: '14px', borderRadius: '14px', border: selectedRide === i ? '2px solid #e11d48' : '2px solid #f3f4f6', background: selectedRide === i ? '#fff5f6' : '#fff', marginBottom: '8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '24px' }}>{r.icon}</span>
                      <div style={{ flex: 1, marginLeft: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ fontWeight: 700, margin: 0 }}>{r.name}</p>
                          {r.id === 'safe' && (
                            <span style={{ fontSize: '10px', background: 'linear-gradient(to right, #ffd700, #f97316)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>ELITE</span>
                          )}
                        </div>
                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{r.desc}</p>
                        {!isPreBooking && (
                          <p style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700, margin: '2px 0 0' }}>Est. Pickup: {r.eta}</p>
                        )}
                      </div>
                      <p style={{ fontWeight: 900, margin: 0 }}>₹{r.price}</p>
                    </div>
                  </div>
                ))}

                {rideStatus === 'idle' ? (
                  <button onClick={handleConfirmBooking} style={{ width: '100%', marginTop: '20px', padding: '16px', background: '#111827', color: '#fff', fontWeight: 800, borderRadius: '14px', border: 'none', cursor: 'pointer' }}>Confirm Booking</button>
                ) : (
                  <div style={{ width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '14px', textAlign: 'center', fontWeight: 800 }}>
                      {rideStatus === 'searching' ? '⏳ Searching drivers...' : rideStatus === 'accepted' ? '✅ Driver is coming!' : rideStatus === 'arrived' ? '👋 Driver has arrived!' : '🚀 Trip Started'}
                    </div>

                    {/* Chat is shown in the ActiveRideWidget - not duplicated here */}
                    {rideStatus === 'searching' && (
                      <button onClick={() => {
                        // Use the robust ID tracking to ensure we can cancel even before polling finishes
                        const requested = activeRides.find(r => r.status === 'requested' && !r.scheduledTime);
                        const targetId = requested?._id || searchingRideId;
                        
                        if (targetId) {
                          setCancellingRideId(targetId);
                          setShowCancelModal(true);
                        } else {
                          // Emergency fallback: If no ID found, just reset UI
                          setRideStatus('idle');
                          showAlert("Search stopped.", "info");
                        }
                      }} style={{ padding: '12px', background: '#fff', color: '#e11d48', border: '1.5px solid #ffe4e6', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
                        Stop Searching
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map Panel */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Map pickupObj={pickupObj} dropObj={dropObj} driverCoords={driverCoords} searching={rideStatus === 'searching'} />
          {driverInfo && (
            <div style={{ position: 'absolute', bottom: '24px', right: '24px', background: '#fff', borderRadius: '20px', padding: '20px', width: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {rideStatus !== 'started' && (
                  <div>
                    <p style={{ fontSize: '11px', color: '#e11d48', fontWeight: 800, margin: 0 }}>RIDE PIN</p>
                    <p style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>{driverInfo.otp}</p>
                  </div>
                )}
                {rideStatus !== 'started' && (
                  <div style={{ background: '#f0fdf4', padding: '4px 8px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <p style={{ fontSize: '10px', color: '#16a34a', fontWeight: 800, margin: 0 }}>📧 SENT TO EMAIL</p>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '18px', fontWeight: 900, margin: '12px 0 0' }}>{driverInfo.driverName}</p>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0' }}>{driverInfo.vehiclePlate}</p>
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px', marginTop: '10px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: rideStatus === 'started' ? '#10b981' : '#e11d48' }}>
                  {rideStatus === 'started'
                    ? `📍 Estimated Dropoff: ${getEstimatedClockTime(12)}`
                    : (activeRides.find(r => r._id === driverInfo.rideId)?.scheduledTime)
                      ? `📅 Confirmed for: ${new Date(activeRides.find(r => r._id === driverInfo.rideId).scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : `🚗 Arrival in: ${driverInfo.eta || 'X mins'}`}
                </p>
              </div>
              {rideStatus !== 'started' && (
                <button onClick={() => { setCancellingRideId(driverInfo.rideId); setShowCancelModal(true); }} style={{ width: '100%', marginTop: '14px', padding: '10px', background: '#fff', color: '#e11d48', border: '1.5px solid #fee2e2', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>
                  Cancel Ride
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <ActiveRideWidget rides={activeRides} unreadCount={unreadCount} />
      
      {/* ── FLOATING SOS BUTTON ── */}
      {rideStatus !== 'idle' && rideStatus !== 'searching' && activeRides[0] && activeRides[0].rideType === 'SheRide Safe' && (
        <button 
          onClick={async () => {
            const activeRide = activeRides[0];
            if (!activeRide) return;
            const defaultIds = customerProfile?.emergencyContacts?.map((c: any) => c._id) || [];
            setContactSelection({ visible: true, type: 'sos', rideId: activeRide._id, selectedIds: defaultIds });
          }}
          disabled={sosLoading}
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '24px',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e11d48, #991b1b)',
            color: '#fff',
            border: 'none',
            fontSize: '18px',
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 12px 32px rgba(225, 29, 72, 0.5)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s infinite',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
          SOS
        </button>
      )}

      {/* ── CONTACT SELECTION MODAL ── */}
      {contactSelection && contactSelection.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 3500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '28px', width: '100%', maxWidth: '400px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
               <span style={{ fontSize: '32px' }}>{contactSelection.type === 'sos' ? '🚨' : '🔗'}</span>
               <h3 style={{ margin: '8px 0 4px', fontSize: '20px', fontWeight: 900 }}>Select Contacts</h3>
               <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Choose who should receive this {contactSelection.type === 'sos' ? 'emergency alert' : 'ride update'}.</p>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {(!customerProfile?.emergencyContacts || customerProfile.emergencyContacts.length === 0) ? (
                 <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>No emergency contacts found in your profile.</p>
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
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '14px', border: isSelected ? '1.5px solid #e11d48' : '1px solid #e2e8f0', background: isSelected ? '#fff1f2' : '#fff', cursor: 'pointer', transition: '0.2s' }}>
                       <div>
                         <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{c.name}</p>
                         <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{c.relation} {c.email ? `• Email Available` : ''}</p>
                       </div>
                       <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: isSelected ? 'none' : '2px solid #cbd5e1', background: isSelected ? '#e11d48' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}>✓</span>}
                       </div>
                     </div>
                   );
                 })
               )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={() => setContactSelection(null)} disabled={sosLoading} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
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
                 style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: contactSelection.selectedIds.length === 0 ? '#cbd5e1' : '#e11d48', color: '#fff', fontWeight: 800, cursor: contactSelection.selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}>
                 {sosLoading ? 'Sending...' : 'Send Alert'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONFIRMATION MODAL ── */}
      {confirmModal && confirmModal.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '28px', width: '100%', maxWidth: '400px', padding: '32px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#e11d48', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px' }}>
              ⚠️
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 900 }}>{confirmModal.title}</h3>
            <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: '15px', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={() => setConfirmModal(null)} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
               <button onClick={confirmModal.onConfirm} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: '#e11d48', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Confirm</button>
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
        const overlayBg = isShare ? 'rgba(59, 130, 246, 0.4)' : 'rgba(225, 29, 72, 0.4)';
        const pulseColor = isShare ? 'rgba(59, 130, 246, 0.7)' : 'rgba(225, 29, 72, 0.7)';
        
        return (
          <div style={{ position: 'fixed', inset: 0, background: overlayBg, backdropFilter: 'blur(10px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '440px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `4px solid ${themeColor}` }}>
              <div style={{ width: '80px', height: '80px', background: themeBg, color: themeColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 24px', animation: 'alertPulse 1.5s infinite' }}>
                {emoji}
              </div>
              <style>{`
                @keyframes alertPulse {
                  0% { transform: scale(1); box-shadow: 0 0 0 0 ${pulseColor}; }
                  70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(0, 0, 0, 0); }
                  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
                }
              `}</style>
              <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 900, color: themeColor }}>
                {isShare ? 'Location Shared' : 'EMERGENCY SOS'}
              </h2>
              <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>{currentAlert.senderId?.name} {isShare ? 'shared their trip!' : 'needs help!'}</p>
              <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '15px', lineHeight: 1.5 }}>
                {isShare 
                  ? 'Your contact is currently on a ride and has shared their live location with you.' 
                  : 'Your emergency contact is on a ride and has triggered a safety alert. Please check their live location immediately.'}
              </p>

              <div style={{ background: themeBg, padding: '16px', borderRadius: '16px', textAlign: 'left', marginBottom: '24px', border: `1px solid ${themeColor}40` }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: themeColor, fontWeight: 800 }}>🧑‍✈️ Driver Details:</h4>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#334155' }}><strong>Name:</strong> {currentAlert.rideId?.driverId?.name || 'N/A'}</p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#334155' }}><strong>Vehicle:</strong> {currentAlert.rideId?.driverId?.vehicleNumber || 'N/A'}</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}><strong>Phone:</strong> {currentAlert.rideId?.driverId?.phone || 'N/A'}</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a 
                  href={`https://www.google.com/maps?q=${currentAlert.lat},${currentAlert.lng}`}
                  target="_blank"
                  style={{ textDecoration: 'none', background: themeColor, color: '#fff', padding: '18px', borderRadius: '16px', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  📍 Track on Google Maps
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
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}
                >
                  I have acknowledged this
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showRatingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '400px', padding: '36px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✨</div>
            <h3 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 900 }}>Rate Your Ride</h3>
            <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '15px' }}>How was your experience with SheRide?</p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  style={{
                    fontSize: '40px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: star <= ratingValue ? '#fbbf24' : '#e2e8f0',
                    transition: 'transform 0.2s',
                    transform: star === ratingValue ? 'scale(1.2)' : 'scale(1)'
                  }}>
                  ★
                </button>
              ))}
            </div>

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
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer'
              }}>
              {ratingLoading ? 'Saving...' : 'Submit Rating'}
            </button>
            <button 
              onClick={() => setShowRatingModal(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '16px', fontWeight: 700, cursor: 'pointer' }}>
              Maybe Later
            </button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '32px 24px', animation: 'slideUp 0.3s ease-out' }}>
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '2px', margin: '0 auto 24px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>Why do you want to cancel?</h3>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontWeight: 500 }}>Please provide the reason for cancellation</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #f1f5f9' }}>
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
                        
                        // Force a complete UI state reset on successful cancellation
                        setRideStatus('idle');
                        setDriverInfo(null);
                        setDriverCoords(null);
                        
                        fetchActiveRides();
                        showAlert("✅ Ride cancelled successfully", "success");
                      } else {
                        const errData = await res.json();
                        // 🤐 Silence the error if it's already cancelled (since that's the intended outcome)
                        if (!errData.message?.includes('already cancelled')) {
                          showAlert(`Failed to cancel: ${errData.message || 'Unknown error'}`, "error");
                        }
                        
                        // Always reset the UI to idle regardless of the specific error during cancellation
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
                 style={{ 
                   padding: '18px 0', 
                   background: 'none', 
                   border: 'none', 
                   borderBottom: '1px solid #f1f5f9', 
                   textAlign: 'left', 
                   fontSize: '15px', 
                   fontWeight: 700, 
                   color: '#334155', 
                   cursor: 'pointer',
                   display: 'flex',
                   justifyContent: 'space-between',
                   alignItems: 'center'
                 }}>
                  {reason}
                  <span style={{ color: '#cbd5e1', fontSize: '20px' }}>›</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowCancelModal(false); setCancellingRideId(null); }} style={{ width: '100%', marginTop: '24px', padding: '16px', background: '#f1f5f9', color: '#475569', borderRadius: '16px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
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
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          animation: 'reminderSlideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <style>{`
            @keyframes reminderSlideDown {
              from { transform: translate(-50%, -120%); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>
          <div style={{
            background: 'linear-gradient(135deg, #111827, #1f2937)',
            color: '#fff',
            padding: '16px 28px',
            borderRadius: '20px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 800,
            fontSize: '15px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <span style={{ fontSize: '22px' }}>⏰</span>
            <span>{rideReminder.replace('⏰ ', '')}</span>
            <button
              onClick={() => setRideReminder(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px' }}
            >×</button>
          </div>
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
