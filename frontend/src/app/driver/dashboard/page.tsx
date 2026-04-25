'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { io } from 'socket.io-client';
import { API_URL } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import SystemAlert from '@/components/SystemAlert';
import ChatOverlay from '@/components/ChatOverlay';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function DriverDashboardContent() {
  const { driverProfile, logout, refreshProfile } = useAuth();
  const [userName, setUserName] = useState(driverProfile?.name || 'Driver');
  const [userId, setUserId] = useState(driverProfile?._id || '');
  const [isOnline, setIsOnline] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  const [incomingRide, setIncomingRide] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const activeRideRef = useRef<any>(null); // To handle stale closures in socket events
  useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);

  // Alert System
  const [sysAlert, setSysAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning'; visible: boolean; duration?: number }>({ message: '', type: 'info', visible: false });
  const showAlert = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info', duration = 5000) => {
    setSysAlert({ message, type, visible: true, duration });
  };

  const [rideState, setRideState] = useState<'accepted' | 'arrived' | 'started'>('accepted');
  const [otpInput, setOtpInput] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [driverCancelModal, setDriverCancelModal] = useState(false);
  const [driverCancelReason, setDriverCancelReason] = useState('');
  
  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatRideId, setChatRideId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Overlays
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState(driverProfile?.phone || '');
  const [editVehicle, setEditVehicle] = useState(driverProfile?.vehicleNumber || '');

  const fetchActiveRide = async () => {
    try {
      const token = localStorage.getItem('driverToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/rides/driver/active?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ride) {
          const ride = data.ride;
          const formattedRide = {
            rideId: ride._id,
            customerId: ride.customerId?._id || ride.customerId,
            customerName: ride.customerId?.name || 'Customer', 
            pickup: ride.pickupLocation,
            drop: ride.dropLocation,
            fare: ride.fare,
            distance: ride.distanceKm,
            scheduledTime: ride.scheduledTime
          };
          setActiveRide(formattedRide);
          if (ride.status === 'arrived') setRideState('arrived');
          else if (ride.status === 'in-transit') setRideState('started');
          else setRideState('accepted');
        } else {
          if (activeRide) {
            setActiveRide(null);
            setRideState('accepted');
            setOtpInput('');
          }
        }
      }
    } catch (e) { console.error('Error fetching active ride:', e); }
  };

  const fetchHistory = async () => {
    setIsHistoryOpen(true);
    setIsProfileOpen(false);
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('driverToken');
      const res = await fetch(`${API_URL}/api/rides/driver/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
        
        // Calculate today's earnings
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySum = data
          .filter((r: any) => r.createdAt.startsWith(todayStr))
          .reduce((sum: number, r: any) => sum + parseInt(r.fare?.replace(/[^0-9]/g, '') || '0'), 0);
        setTodayEarnings(todaySum);
      }
    } catch (e) { console.error(e); }
    setLoadingHistory(false);
  };

  const saveProfile = async () => {
    try {
      const token = localStorage.getItem('driverToken');
      const res = await fetch(`${API_URL}/api/auth/driver-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone: editPhone, vehicleNumber: editVehicle })
      });
      if (res.ok) {
        setIsEditing(false);
        refreshProfile();
        showAlert('Profile updated successfully!', 'success');
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (driverProfile) {
      setUserName(driverProfile.name);
      setUserId(driverProfile._id);
      setEditPhone(driverProfile.phone || '');
      setEditVehicle(driverProfile.vehicleNumber || '');
    }
  }, [driverProfile]);

  useEffect(() => {
    if (userId) {
      fetchActiveRide();
    }
    const interval = setInterval(() => {
       if (userId && !isHistoryOpen && !isProfileOpen) fetchActiveRide();
    }, 5000);

    // Initial load of history to calculate daily stats
    if (userId) {
       const loadStats = async () => {
         try {
           const token = localStorage.getItem('driverToken');
           const res = await fetch(`${API_URL}/api/rides/driver/history`, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           const data = await res.json();
           if (res.ok) {
             setHistory(data);
             const todayStr = new Date().toISOString().split('T')[0];
             const todaySum = data
               .filter((r: any) => r.createdAt.startsWith(todayStr))
               .reduce((sum: number, r: any) => sum + parseInt(r.fare?.replace(/[^0-9]/g, '') || '0'), 0);
             setTodayEarnings(todaySum);
           }
         } catch(e) {}
       };
       loadStats();
    }

    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const newSocket = io(API_URL);
    setSocket(newSocket);
    newSocket.emit('join', userId);

    newSocket.on('incoming-ride', (data) => {
      console.log("DRIVER RECEIVED RIDE:", data);
      setIncomingRide(data);
    });

    newSocket.on('ride-cancelled', (data) => {
      if (data.rideId === activeRideRef.current?.rideId) {
        setActiveRide(null);
        setRideState('accepted');
        setOtpInput('');
        showAlert(`🚫 Ride cancelled by ${data.cancelledBy || 'Customer'}. Reason: ${data.reason || 'No reason provided'}`, 'error', 8000);
      }
      setIncomingRide((prev: any) => prev?.rideId === data.rideId ? null : prev);
    });

    newSocket.on('ride-reminder', (data) => {
      showAlert(data.message, 'info', 10000);
    });

    return () => { newSocket.disconnect(); }
  }, [userId]);

  // Use a ref to track isChatOpen for the background listener to avoid stale closure
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  // Background Chat Listener for Notifications & Room Joining
  useEffect(() => {
    if (!socket || !activeRide?.rideId) return;
    
    // Join chat room in background
    socket.emit('join-chat', activeRide.rideId);

    const handleNewMessage = (msg: any) => {
      // Message handled by chat window state
    };

    socket.on('receive-chat-message', handleNewMessage);
    socket.on('new-chat-notification', (data) => {
      if (!isChatOpenRef.current) {
        setUnreadCount(prev => prev + 1);
        showAlert(`💬 New message: ${data.text}`, 'info');
      }
    });

    return () => { 
      socket.off('receive-chat-message', handleNewMessage); 
      socket.off('new-chat-notification');
    };
  }, [socket, activeRide?.rideId]);

  useEffect(() => {
    let timer: any;
    if (incomingRide) {
      setCountdown(30);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setIncomingRide(null);
            clearInterval(timer);
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [incomingRide]);

  // Stream live location
  useEffect(() => {
    if (isOnline && socket && activeRide) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          socket.emit('location-update', {
            customerId: activeRide.customerId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, socket, activeRide]);

  const acceptRide = () => {
    if (!socket || !incomingRide) return;
    socket.emit('accept-ride', {
      rideId: incomingRide.rideId,
      customerId: incomingRide.customerId,
      driverId: userId,
      driverName: userName
    });
    setActiveRide(incomingRide);
    setRideState('accepted');
    setIncomingRide(null);
  };

  const startTripWithOtp = () => {
    if (!socket || !activeRide) return;
    socket.emit('start-ride', { rideId: activeRide.rideId, customerId: activeRide.customerId, otp: otpInput }, (response: any) => {
        if (response.success) setRideState('started');
        else alert("Invalid OTP!");
    });
  };

  const finishRide = async () => {
    if (!activeRide) return;
    try {
      const token = localStorage.getItem('driverToken');
      const res = await fetch(`${API_URL}/api/rides/${activeRide.rideId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed' })
      });
      if (res.ok) {
        setActiveRide(null);
        setRideState('accepted');
        setOtpInput('');
        showAlert('🏁 Ride completed successfully!', 'success');
        // Refresh everything to update wallet
        setTimeout(() => { 
          refreshProfile(); 
          fetchHistory(); // This updates todayEarnings
        }, 1000);
      }
    } catch (e) { console.error('Error finishing ride:', e); }
  };

  const cancelRideAsDriver = async (reason: string) => {
    if (!activeRide) return;
    try {
      const token = localStorage.getItem('driverToken');
      const res = await fetch(`${API_URL}/api/rides/${activeRide.rideId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveRide(null);
        setRideState('accepted');
        setOtpInput('');
        setDriverCancelModal(false);
        showAlert('✅ Ride cancelled successfully.', 'success');
      } else {
        showAlert(`❌ Failed to cancel: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (e) { 
      console.error('Error cancelling ride:', e);
      showAlert('❌ Network error while cancelling. Please check your connection.', 'error');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#f1f5f9', overflow: 'hidden' }}>
      
      {/* 🗺️ FULL SCREEN MAP */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
         <Map />
      </div>

      {/* 🏛️ HEADER BAR */}
      <nav style={{ position: 'absolute', top: '24px', left: '24px', right: '24px', zIndex: 100, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.3)' }}>
        
        {/* Left: Brand */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🛵</span>
          <span style={{ fontWeight: 900, fontSize: '18px', color: '#111827' }}>SheRide</span>
        </div>
        
        {/* Middle: Online Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isOnline ? '#dcfce7' : '#fee2e2', padding: '8px 20px', borderRadius: '100px', cursor: 'pointer', transition: '0.3s', border: isOnline ? '1.5px solid #86efac' : '1.5px solid #fecaca' }} onClick={() => setIsOnline(!isOnline)}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444' }}></div>
            <span style={{ fontSize: '11px', fontWeight: 900, color: isOnline ? '#166534' : '#991b1b', letterSpacing: '0.5px' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px' }}>
          <button onClick={() => { setIsProfileOpen(false); setIsHistoryOpen(false); }} style={{ background: 'none', border: 'none', color: '#111827', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Map</button>
          <button onClick={fetchHistory} style={{ background: 'none', border: 'none', color: '#111827', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>My Rides</button>
          <button onClick={() => { setIsProfileOpen(true); setIsHistoryOpen(false); }} style={{ background: 'none', border: 'none', color: '#111827', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Profile</button>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>

      {/* 📥 INCOMING RIDE REQUEST OVERLAY */}
      {incomingRide && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
           <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.4s ease-out' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ background: '#111827', color: '#fff', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>NEW REQUEST</span>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px' }}>{countdown}</div>
             </div>
             
             <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px' }}>{incomingRide.customerName}</h2>
             <p style={{ color: '#64748b', margin: '0 0 24px', fontWeight: 500 }}>is looking for a ride</p>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div>
                   <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>PICKUP</p>
                   <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>📍 {incomingRide.pickup.address}</p>
                </div>
                <div>
                   <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>DROP</p>
                   <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>🏁 {incomingRide.drop.address}</p>
                </div>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: '#f8fafc', borderRadius: '20px', marginBottom: incomingRide.scheduledTime ? '16px' : '32px' }}>
                <div>
                   <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>{incomingRide.fare}</p>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b' }}>EARNING</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                   <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>{incomingRide.distance ? `${incomingRide.distance} Km` : '--'}</p>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b' }}>DISTANCE</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <p style={{ margin: 0, fontSize: '13px', fontWeight: 900 }}>{incomingRide.rideType || 'SheRide'}</p>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b' }}>TYPE</p>
                </div>
             </div>

             {/* Scheduled Ride Badge */}
             {incomingRide.scheduledTime && (
               <div style={{ background: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: '14px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <span style={{ fontSize: '18px' }}>📅</span>
                 <div>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#92400e', letterSpacing: '0.5px' }}>SCHEDULED RIDE</p>
                   <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#78350f' }}>
                     {new Date(incomingRide.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                 </div>
               </div>
             )}

             <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIncomingRide(null)} style={{ flex: 1, padding: '18px', borderRadius: '18px', border: '2px solid #e2e8f0', background: 'none', fontWeight: 800, cursor: 'pointer' }}>Ignore</button>
                <button onClick={acceptRide} style={{ flex: 2, padding: '18px', borderRadius: '18px', border: 'none', background: '#111827', color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: '16px' }}>Accept Ride</button>
             </div>
           </div>
        </div>
      )}

      {/* 🚀 ACTIVE RIDE FLOATING CARD */}
      {activeRide && (
        <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 48px)', maxWidth: '440px', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: '32px', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.05)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>CURRENT RIDE</p>
                   <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>{activeRide.customerName}</h3>
                </div>
                <div style={{ background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                   {rideState === 'accepted' ? '🚀 OTW' : rideState === 'arrived' ? '👋 ARRIVED' : '🛣️ IN TRANSIT'}
                </div>
             </div>

              {rideState !== 'started' && (
                <button 
                  onClick={() => {
                    if (activeRide?.rideId) {
                      setChatRideId(activeRide.rideId);
                      setIsChatOpen(true);
                      setUnreadCount(0); // Explicitly reset on click
                    }
                  }}
                  style={{ width: '100%', marginBottom: '16px', padding: '14px', background: '#f8fafc', color: '#111827', fontWeight: 800, borderRadius: '16px', border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '20px' }}>💬</span>
                    {unreadCount > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        background: '#ef4444',
                        color: '#fff',
                        minWidth: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 900,
                        border: '2px solid #fff',
                        boxShadow: '0 4px 8px rgba(239, 68, 68, 0.3)',
                        padding: '0 4px',
                        zIndex: 10
                      }}>
                        {unreadCount}
                      </div>
                    )}
                  </div>
                  <span>Chat with Customer</span>
                </button>
              )}

             {rideState === 'accepted' && (
                <button onClick={async () => {
                  const token = localStorage.getItem('driverToken');
                  const res = await fetch(`${API_URL}/api/rides/${activeRide.rideId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ status: 'arrived' })
                  });
                  if (res.ok) {
                    socket?.emit('driver-arrived', { customerId: activeRide.customerId });
                    setRideState('arrived');
                  }
                }} style={{ width: '100%', padding: '18px', borderRadius: '18px', background: '#111827', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '16px' }}>I Have Arrived</button>
             )}

             {rideState === 'arrived' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <input value={otpInput} onChange={e => setOtpInput(e.target.value)} placeholder="ENTER TRIP PIN" style={{ width: '100%', padding: '18px', fontSize: '18px', fontWeight: 900, textAlign: 'center', borderRadius: '18px', border: '2px solid #f1f5f9', background: '#f8fafc', outline: 'none' }} />
                   <button onClick={startTripWithOtp} style={{ width: '100%', padding: '18px', borderRadius: '18px', background: '#111827', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '16px' }}>Start Journey</button>
                </div>
             )}

             {rideState === 'started' && (
                <button onClick={finishRide} style={{ width: '100%', padding: '18px', borderRadius: '18px', background: '#059669', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '16px' }}>Complete Trip</button>
             )}

             {rideState !== 'started' && (
               <button onClick={() => setDriverCancelModal(true)} style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, marginTop: '16px', cursor: 'pointer' }}>Cancel Ride</button>
             )}
          </div>
        </div>
      )}

      {/* 👤 PROFILE OVERLAY */}
      {isProfileOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '500px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
             <button onClick={() => setIsProfileOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>×</button>
             
             <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#f1f5f9', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>👩</div>
                <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px' }}>{userName}</h2>
                <p style={{ color: '#64748b', fontWeight: 600 }}>Verified Driver</p>
             </div>

             <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                   <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>PHONE NUMBER</label>
                   {isEditing ? <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ width: '100%', border: 'none', background: 'none', fontSize: '16px', fontWeight: 700, outline: 'none' }} /> : <p style={{ margin: 0, fontWeight: 700 }}>{driverProfile?.phone}</p>}
                </div>
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                   <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>VEHICLE PLATE</label>
                   {isEditing ? <input value={editVehicle} onChange={e => setEditVehicle(e.target.value)} style={{ width: '100%', border: 'none', background: 'none', fontSize: '16px', fontWeight: 700, outline: 'none' }} /> : <p style={{ margin: 0, fontWeight: 700 }}>{driverProfile?.vehicleNumber}</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '16px', border: '1px solid #d1fae5', textAlign: 'center' }}>
                       <label style={{ fontSize: '10px', fontWeight: 800, color: '#059669', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Rating</label>
                       <p style={{ margin: 0, fontWeight: 900, color: '#047857', fontSize: '18px' }}>⭐ {driverProfile?.trustScore?.toFixed(1) || '5.0'}</p>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                       <label style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Trips</label>
                       <p style={{ margin: 0, fontWeight: 900, fontSize: '18px' }}>🛵 {history.length || driverProfile?.totalRides || '0'}</p>
                    </div>
                    <div style={{ padding: '16px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fef08a', textAlign: 'center' }} onClick={fetchHistory}>
                       <label style={{ fontSize: '10px', fontWeight: 800, color: '#a16207', display: 'block', marginBottom: '4px', textTransform: 'uppercase', cursor: 'pointer' }}>Wallet (Today)</label>
                       <p style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: '#854d0e', cursor: 'pointer' }}>₹{todayEarnings || '0'}</p>
                    </div>
                 </div>
             </div>

             <div style={{ display: 'flex', gap: '12px' }}>
                {!isEditing ? (
                   <button onClick={() => setIsEditing(true)} style={{ width: '100%', padding: '18px', borderRadius: '18px', background: '#111827', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer' }}>Edit Profile</button>
                ) : (
                   <>
                      <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '18px', borderRadius: '18px', background: '#f1f5f9', color: '#64748b', fontWeight: 900, border: 'none', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={saveProfile} style={{ flex: 2, padding: '18px', borderRadius: '18px', background: '#111827', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer' }}>Save Changes</button>
                   </>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 📜 MY RIDES OVERLAY */}
      {isHistoryOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '600px', height: '80vh', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
             <button onClick={() => setIsHistoryOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>×</button>
             
             <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px' }}>My Completed Rides</h2>
             <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                   <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Total Earnings: </span>
                   <span style={{ fontSize: '16px', fontWeight: 900, color: '#111827' }}>₹{(driverProfile as any)?.totalEarnings || 0}</span>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                   <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Total Trips: </span>
                   <span style={{ fontSize: '16px', fontWeight: 900, color: '#111827' }}>{history.length}</span>
                </div>
             </div>

             <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                {loadingHistory ? (
                   <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading history...</div>
                ) : history.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No rides found.</div>
                ) : (
                   <div style={{ display: 'grid', gap: '16px' }}>
                      {history.filter(h => h.status === 'completed').map((ride, i) => (
                         <div key={i} style={{ padding: '20px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                               <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>{new Date(ride.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                               <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>📍 {ride.pickupLocation?.address}</p>
                               <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>🏁 {ride.dropLocation?.address}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                               <p style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>{ride.fare}</p>
                               <span style={{ fontSize: '10px', fontWeight: 800, background: '#dcfce7', color: '#059669', padding: '2px 8px', borderRadius: '6px' }}>PAID</span>
                            </div>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* ⚠️ CANCELLATION MODAL */}
      {driverCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '400px', padding: '36px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 12px' }}>Cancel Ride?</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px' }}>Please select a reason for cancelling. Frequent cancellations may affect your trust score.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
               {['Traffic issues', 'Vehicle problems', 'Emergency', 'Other'].map(r => (
                 <button key={r} onClick={() => setDriverCancelReason(r)} style={{ padding: '14px 20px', borderRadius: '16px', border: driverCancelReason === r ? '2.5px solid #111827' : '1.5px solid #e2e8f0', background: driverCancelReason === r ? '#f8fafc' : '#fff', textAlign: 'left', fontWeight: 800, cursor: 'pointer' }}>{r}</button>
               ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDriverCancelModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', background: 'none', fontWeight: 800, cursor: 'pointer' }}>Back</button>
              <button onClick={() => cancelRideAsDriver(driverCancelReason || 'Other')} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <SystemAlert
        message={sysAlert.message}
        type={sysAlert.type}
        visible={sysAlert.visible}
        onClose={() => setSysAlert({ ...sysAlert, visible: false })}
        duration={sysAlert.duration}
      />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <ChatOverlay 
        rideId={chatRideId || ''} 
        currentUserId={userId || ''} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        socket={socket} 
      />
    </div>
  );
}

export default function ProtectedDriverDashboard() {
  return (
    <RoleGuard role="driver">
      <DriverDashboardContent />
    </RoleGuard>
  );
}
