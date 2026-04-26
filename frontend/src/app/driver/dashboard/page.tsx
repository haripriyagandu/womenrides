'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { io } from 'socket.io-client';
import { API_URL } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import SystemAlert from '@/components/SystemAlert';
import ChatOverlay from '@/components/ChatOverlay';
import Link from 'next/link';
import { Home, History, User, LogOut } from 'lucide-react';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function DriverDashboardContent() {
  const { driverProfile, logout, refreshProfile } = useAuth();
  const [userName, setUserName] = useState(driverProfile?.name || 'Driver');
  const [userId, setUserId] = useState(driverProfile?._id || '');
  const [isOnline, setIsOnline] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // 🛡️ Nuclear Responsiveness Fix: Manual Window Width & Touch Check
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isTouch = navigator.maxTouchPoints > 0;
      setIsMobile(width < 1300 || isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
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
    <div className="relative w-full h-screen bg-slate-50 overflow-hidden font-['Outfit',sans-serif]">
      
      {/* 🗺️ FULL SCREEN MAP */}
      <div className="absolute inset-0 z-0">
         <Map />
      </div>

      {/* 🏛️ HEADER BAR */}
      <nav className="absolute top-4 sm:top-6 left-4 right-4 sm:left-6 sm:right-6 z-[100] bg-white/90 backdrop-blur-xl h-16 sm:h-20 flex items-center justify-between px-6 rounded-3xl shadow-2xl border border-white/20">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl">🛵</span>
          <span className="font-black text-lg sm:text-xl text-[#0f172a] tracking-tight">SheRide</span>
        </div>
        
        {/* Middle: Online Toggle */}
        <div className="hidden md:flex flex-1 justify-center">
          <button 
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-3 px-6 py-2.5 rounded-full border-2 transition-all active:scale-95 ${
              isOnline 
              ? 'bg-green-50 border-green-100 text-green-700 shadow-sm shadow-green-100' 
              : 'bg-red-50 border-red-100 text-red-700 shadow-sm shadow-red-100'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-[11px] font-black uppercase tracking-widest">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </button>
        </div>

        {/* Mobile Toggle Button (Visible only on mobile) */}
        <div className="flex md:hidden items-center gap-3">
          <button 
             onClick={() => setIsOnline(!isOnline)}
             className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${
               isOnline ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'
             }`}
          >
             {isOnline ? '🟢' : '🔴'}
          </button>
        </div>
        
        {/* Right: Actions (Desktop) */}
        <div 
          className="lg:flex items-center gap-6"
          style={{ display: isMobile ? 'none' : 'flex' }}
        >
          <Link href="/driver/dashboard" className="text-sm font-black text-[#0f172a] hover:text-[#e11d48] transition-colors">Map</Link>
          <Link href="/driver/history" className="text-sm font-black text-[#0f172a] hover:text-[#e11d48] transition-colors">My Rides</Link>
          <button onClick={() => setIsProfileOpen(true)} className="text-sm font-black text-[#0f172a] hover:text-[#e11d48] transition-colors">Profile</button>
          <button onClick={logout} className="text-sm font-black text-[#ef4444] hover:opacity-80 transition-opacity">Logout</button>
        </div>
      </nav>

      {/* 📥 INCOMING RIDE REQUEST OVERLAY */}
      {incomingRide && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md z-[500] flex items-center justify-center p-5">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-8">
                <span className="bg-[#0f172a] text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">NEW REQUEST</span>
                <div className="w-14 h-14 rounded-full border-4 border-[#0f172a] flex items-center justify-center font-black text-xl text-[#0f172a]">{countdown}</div>
             </div>
             
             <div className="mb-8">
               <h2 className="text-3xl font-black text-[#0f172a] mb-1">{incomingRide.customerName}</h2>
               <p className="text-slate-500 font-bold">is looking for a ride</p>
             </div>

             <div className="space-y-6 mb-10">
                <div className="relative pl-8">
                   <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-green-100 border-4 border-white shadow-sm flex items-center justify-center text-[8px]">📍</div>
                   <div className="absolute left-[9px] top-7 bottom-[-20px] w-0.5 bg-slate-100 dashed-border"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">PICKUP</p>
                   <p className="font-black text-[#0f172a] text-sm leading-tight">{incomingRide.pickup.address}</p>
                </div>
                <div className="relative pl-8">
                   <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-red-100 border-4 border-white shadow-sm flex items-center justify-center text-[8px]">🏁</div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">DROP</p>
                   <p className="font-black text-[#0f172a] text-sm leading-tight">{incomingRide.drop.address}</p>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-2 px-4 py-6 bg-slate-50 rounded-3xl mb-8 border border-slate-100">
                <div className="text-center">
                   <p className="text-xl font-black text-[#0f172a]">{incomingRide.fare}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">EARNING</p>
                </div>
                <div className="text-center border-x border-slate-200">
                   <p className="text-xl font-black text-[#0f172a]">{incomingRide.distance ? `${incomingRide.distance}Km` : '--'}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">DISTANCE</p>
                </div>
                <div className="text-center flex flex-col justify-center items-center">
                   <p className="text-[10px] font-black text-[#e11d48] uppercase leading-tight line-clamp-2">
                     {incomingRide.rideType?.replace('SheRide ', '') || 'Standard'}
                   </p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">TYPE</p>
                </div>
             </div>

             {incomingRide.scheduledTime && (
               <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4 mb-8 flex items-center gap-4">
                 <span className="text-2xl">📅</span>
                 <div>
                   <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">SCHEDULED RIDE</p>
                   <p className="text-sm font-black text-amber-900">
                     {new Date(incomingRide.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                 </div>
               </div>
             )}

             <div className="flex gap-4">
                <button onClick={() => setIncomingRide(null)} className="flex-1 py-4.5 rounded-2xl border-2 border-slate-100 font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95">Ignore</button>
                <button onClick={acceptRide} className="flex-[2] py-4.5 rounded-2xl bg-[#0f172a] text-white font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">Accept Ride</button>
             </div>
           </div>
        </div>
      )}

      {/* 🚀 ACTIVE RIDE FLOATING CARD */}
      {activeRide && (
        <div className="absolute bottom-6 sm:bottom-10 left-6 right-6 lg:left-1/2 lg:-translate-x-1/2 lg:w-[440px] z-[400]">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom duration-500">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CURRENT TRIP</p>
                   <h3 className="text-2xl font-black text-[#0f172a]">{activeRide.customerName}</h3>
                </div>
                <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest border-2 ${
                  rideState === 'accepted' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                  rideState === 'arrived' ? 'bg-green-50 border-green-100 text-green-600' :
                  'bg-orange-50 border-orange-100 text-orange-600'
                }`}>
                   {rideState === 'accepted' ? '🚀 OTW' : rideState === 'arrived' ? '👋 ARRIVED' : '🛣️ IN TRANSIT'}
                </div>
             </div>

              {rideState !== 'started' && (
                <button 
                  onClick={() => {
                    if (activeRide?.rideId) {
                      setChatRideId(activeRide.rideId);
                      setIsChatOpen(true);
                      setUnreadCount(0);
                    }
                  }}
                  className="w-full mb-6 py-4 bg-slate-50 text-[#0f172a] font-black rounded-2xl border-2 border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                    {unreadCount > 0 && (
                      <div className="absolute -top-2 -right-2 bg-[#e11d48] text-white min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg px-1">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                  <span>Chat with Customer</span>
                </button>
              )}

             {rideState === 'accepted' && (
                <button 
                  onClick={async () => {
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
                  }} 
                  className="w-full py-5 bg-[#0f172a] text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                >
                  I Have Arrived
                </button>
             )}

             {rideState === 'arrived' && (
                <div className="flex flex-col gap-4">
                   <div className="relative">
                      <input 
                        value={otpInput} 
                        onChange={e => setOtpInput(e.target.value)} 
                        placeholder="TRIP PIN" 
                        className="w-full py-5 px-6 text-center text-3xl font-black text-[#0f172a] rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#e11d48] focus:bg-white outline-none transition-all placeholder:text-slate-300 placeholder:text-lg tracking-widest" 
                      />
                   </div>
                   <button 
                     onClick={startTripWithOtp} 
                     className="w-full py-5 bg-[#0f172a] text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Start Journey
                    </button>
                </div>
             )}

             {rideState === 'started' && (
                <button 
                  onClick={finishRide} 
                  className="w-full py-5 bg-[#059669] text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-100 hover:bg-[#047857] transition-all active:scale-95"
                >
                  Complete Trip
                </button>
             )}

             {rideState !== 'started' && (
               <button onClick={() => setDriverCancelModal(true)} className="w-full mt-6 text-sm font-black text-slate-400 hover:text-[#ef4444] transition-colors">
                 Cancel Ride
               </button>
             )}
          </div>
        </div>
      )}

      {/* 👤 PROFILE OVERLAY */}
      {isProfileOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 sm:p-10 shadow-2xl relative animate-in zoom-in duration-300">
             <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 hover:bg-slate-200 transition-colors">×</button>
             
             <div className="text-center mb-10">
                <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center text-5xl shadow-inner">👩</div>
                <h2 className="text-3xl font-black text-[#0f172a] mb-1">{userName}</h2>
                <p className="text-slate-500 font-bold flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Verified SheRide Partner
                </p>
             </div>

             <div className="space-y-4 mb-10">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">PHONE NUMBER</label>
                   {isEditing ? <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-transparent font-black text-[#0f172a] outline-none" /> : <p className="font-black text-[#0f172a]">{driverProfile?.phone}</p>}
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">VEHICLE PLATE</label>
                   {isEditing ? <input value={editVehicle} onChange={e => setEditVehicle(e.target.value)} className="w-full bg-transparent font-black text-[#0f172a] outline-none" /> : <p className="font-black text-[#0f172a]">{driverProfile?.vehicleNumber}</p>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-center">
                       <label className="text-[8px] font-black text-green-600 uppercase tracking-widest block mb-1">Rating</label>
                       <p className="font-black text-green-700 text-lg">⭐ {driverProfile?.trustScore?.toFixed(1) || '5.0'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Trips</label>
                       <p className="font-black text-[#0f172a] text-lg">🛵 {history.length || driverProfile?.totalRides || '0'}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center cursor-pointer active:scale-95 transition-transform" onClick={fetchHistory}>
                       <label className="text-[8px] font-black text-amber-700 uppercase tracking-widest block mb-1">Today</label>
                       <p className="font-black text-amber-800 text-lg">₹{todayEarnings || '0'}</p>
                    </div>
                 </div>
             </div>

             <div className="flex gap-4">
                {!isEditing ? (
                   <button onClick={() => setIsEditing(true)} className="w-full py-4.5 bg-[#0f172a] text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">Edit Profile</button>
                ) : (
                   <>
                      <button onClick={() => setIsEditing(false)} className="flex-1 py-4.5 rounded-2xl border-2 border-slate-100 font-black text-slate-400">Cancel</button>
                      <button onClick={saveProfile} className="flex-[2] py-4.5 bg-[#0f172a] text-white font-black text-lg rounded-2xl shadow-xl">Save Changes</button>
                   </>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 📜 MY RIDES OVERLAY */}
      {isHistoryOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl h-[85vh] p-8 sm:p-10 shadow-2xl relative flex flex-col animate-in slide-in-from-bottom duration-500">
             <button onClick={() => setIsHistoryOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 hover:bg-slate-200 transition-colors">×</button>
             
             <h2 className="text-3xl font-black text-[#0f172a] mb-2">My Completed Rides</h2>
             <div className="flex gap-4 mb-8">
                <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Total Earnings</span>
                   <span className="text-xl font-black text-[#0f172a]">₹{(driverProfile as any)?.totalEarnings || 0}</span>
                </div>
                <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Total Trips</span>
                   <span className="text-xl font-black text-[#0f172a]">{history.length}</span>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4">
                {loadingHistory ? (
                   <div className="text-center py-20 font-black text-slate-300 animate-pulse">⏳ Loading history...</div>
                ) : history.length === 0 ? (
                   <div className="text-center py-20 text-slate-400 font-bold">No rides found.</div>
                ) : (
                   history.filter(h => h.status === 'completed').map((ride, i) => (
                      <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center hover:bg-white hover:shadow-lg transition-all">
                         <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(ride.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                            <div className="space-y-1">
                              <p className="font-black text-[#0f172a] text-sm leading-tight flex items-center gap-2">
                                <span className="text-[10px]">📍</span> {ride.pickupLocation?.address}
                              </p>
                              <p className="font-black text-[#0f172a] text-sm leading-tight flex items-center gap-2">
                                <span className="text-[10px]">🏁</span> {ride.dropLocation?.address}
                              </p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-2xl font-black text-[#0f172a] mb-1">{ride.fare}</p>
                            <span className="text-[9px] font-black bg-green-100 text-green-700 px-3 py-1 rounded-full uppercase tracking-widest">PAID</span>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* ⚠️ CANCELLATION MODAL */}
      {driverCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1100] flex items-center justify-center p-5">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 sm:p-10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-[#0f172a] mb-2">Cancel Ride?</h3>
            <p className="text-sm font-medium text-slate-500 mb-8">Please select a reason. Frequent cancellations may affect your trust score.</p>
            
            <div className="flex flex-col gap-3 mb-10">
               {['Traffic issues', 'Vehicle problems', 'Emergency', 'Other'].map(r => (
                 <button 
                  key={r} 
                  onClick={() => setDriverCancelReason(r)} 
                  className={`py-4 px-6 rounded-2xl border-2 font-black text-left transition-all ${
                    driverCancelReason === r ? 'border-[#0f172a] bg-slate-50' : 'border-slate-100'
                  }`}
                 >
                   {r}
                 </button>
               ))}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setDriverCancelModal(false)} className="flex-1 py-4.5 rounded-2xl border-2 border-slate-100 font-black text-slate-400">Back</button>
              <button onClick={() => cancelRideAsDriver(driverCancelReason || 'Other')} className="flex-1 py-4.5 rounded-2xl bg-[#ef4444] text-white font-black shadow-lg shadow-red-100">Cancel</button>
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

      {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
      {isMobile && !activeRide && (
        <div 
          className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 z-[200] flex items-center justify-around px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
          style={{ display: 'flex' }}
        >
          <button onClick={() => setRideState('accepted')} className="flex flex-col items-center gap-1.5 px-4 group">
            <Home className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">Home</span>
          </button>
          <Link href="/driver/history" className="flex flex-col items-center gap-1.5 px-4 no-underline group">
            <History className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">My Rides</span>
          </Link>
          <button onClick={() => setIsProfileOpen(true)} className="flex flex-col items-center gap-1.5 px-4 group">
            <User className="w-5 h-5 text-slate-400 group-hover:text-[#e11d48] transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#e11d48] uppercase tracking-wider transition-colors">Profile</span>
          </button>
          <button onClick={logout} className="flex flex-col items-center gap-1.5 px-4 group">
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
            <span className="text-[10px] font-black text-slate-400 group-hover:text-rose-600 uppercase tracking-wider transition-colors">Logout</span>
          </button>
        </div>
      )}
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
