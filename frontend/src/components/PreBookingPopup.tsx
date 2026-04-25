'use client';
import { useState, useEffect } from 'react';

interface PreBookingPopupProps {
  rides: any[];
}

export default function PreBookingPopup({ rides }: PreBookingPopupProps) {
  const [activePopup, setActivePopup] = useState<any>(null);

  useEffect(() => {
    const checkScheduledRides = () => {
      const now = new Date();
      const scheduled = rides.find(ride => {
        if (!ride.scheduledTime) return false;
        // ONLY show once accepted
        if (ride.status !== 'accepted') return false;
        
        const sTime = new Date(ride.scheduledTime);
        if (isNaN(sTime.getTime())) return false;
        
        const diff = sTime.getTime() - now.getTime();
        // Show if in future (within next 12h)
        return diff > 0 && diff < 12 * 60 * 60 * 1000;
      });

      if (scheduled) {
        const dismissedId = sessionStorage.getItem('dismissedRideId');
        if (dismissedId === scheduled._id) {
          setActivePopup(null);
        } else {
          setActivePopup(scheduled);
        }
      } else {
        setActivePopup(null);
        sessionStorage.removeItem('dismissedRideId');
      }
    };

    checkScheduledRides();
    const interval = setInterval(checkScheduledRides, 5000); // Check more frequently for responsiveness
    return () => clearInterval(interval);
  }, [rides]);

  if (!activePopup) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('dismissedRideId', activePopup._id);
    setActivePopup(null);
  };

  const handleCancelFromPopup = () => {
    // We emit an event or call a window-level function since the modal is in page.tsx
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('triggerCancelRide', { detail: activePopup._id });
      window.dispatchEvent(event);
    }
  };

  const scheduledDate = new Date(activePopup.scheduledTime);
  const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      width: '95%',
      maxWidth: '450px',
      animation: 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
      
      <div style={{
        background: '#fff',
        borderRadius: '32px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #f1f5f9',
        fontFamily: 'Outfit, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              📅
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Confirmed Ride</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{dateStr} at {timeStr}</p>
            </div>
          </div>
          <button onClick={handleDismiss} style={{ background: '#f8fafc', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>×</button>
        </div>

        {activePopup.driverId && (
          <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '16px', marginBottom: '16px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  👩‍✈️
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{activePopup.driverId.name || 'Driver Assigned'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{activePopup.driverId.vehicleNumber || 'Vehicle Pending'}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#e11d48', letterSpacing: '0.5px' }}>RIDE PIN</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{activePopup.otp}</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleCancelFromPopup}
            style={{ flex: 1, padding: '14px', background: '#fff', color: '#e11d48', border: '1.5px solid #fee2e2', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
            Cancel Ride
          </button>
          <button 
            onClick={handleDismiss}
            style={{ flex: 1, padding: '14px', background: '#111827', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
