'use client';
import { useState } from 'react';

import { getEstimatedClockTime } from '@/utils/EstimatedTimeHelper';

export default function ActiveRideWidget({ rides, unreadCount = 0 }: { rides: any[], unreadCount?: number }) {
  const [minimized, setMinimized] = useState(false);

  // Filter out stale rides first
  const activeRides = (rides || []).filter(ride => {
    // IMMEDIATE REMOVAL: If it's a requested/accepted scheduled ride and time has passed, hide it.
    if ((ride.status === 'requested' || ride.status === 'accepted') && ride.scheduledTime) {
      const sTime = new Date(ride.scheduledTime);
      if (isNaN(sTime.getTime())) return true;
      if (sTime < new Date()) return false;
    }
    return true;
  });

  if (activeRides.length === 0) return null;

  const getTimeDisplay = (ride: any) => {
    const pickupMins = ride.eta ? parseInt(ride.eta.replace(/\D/g, '')) : 4;
    const tripMins = ride.tripDuration ? parseInt(ride.tripDuration.replace(/\D/g, '')) : 12;

    // PRIORITY: If pre-booked and not yet arrived/started, show the SCHEDULED TIME
    if (ride.scheduledTime && (ride.status === 'requested' || ride.status === 'accepted')) {
      return `📅 Schedule: ${new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    if (ride.status === 'accepted') {
      return `🛵 Arrival in: ${pickupMins} min`;
    }
    if (ride.status === 'arrived') {
      return `✅ Driver Arrived`;
    }
    if (ride.status === 'in-transit') {
      return `📍 Dropoff: ${getEstimatedClockTime(tripMins)}`;
    }
    return '';
  };

  return (
    <>
      <style jsx>{`
        .active-ride-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .active-ride-card {
          background: #fff;
          border-radius: 24px;
          width: 320px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
        }
        @media (max-width: 768px) {
          .active-ride-container {
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            width: 100% !important;
          }
          .active-ride-card {
            width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            box-shadow: 0 -10px 30px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      <div className="active-ride-container">
        {minimized ? (
          <div style={{ position: 'relative', padding: '16px' }}>
            <button
              onClick={() => setMinimized(false)}
              style={{
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#fff',
                border: 'none',
                borderRadius: '30px',
                padding: '12px 24px',
                fontWeight: 800,
                fontSize: '14px',
                boxShadow: '0 10px 25px rgba(225, 29, 72, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Outfit, sans-serif'
              }}>
              <span style={{ fontSize: '18px' }}>🛵</span>
              {activeRides.length} Active {activeRides.length === 1 ? 'Ride' : 'Rides'}
            </button>
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#ef4444',
                color: '#fff',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 900,
                border: '3px solid #fff',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}>
                {unreadCount}
              </div>
            )}
          </div>
        ) : (
          <div className="active-ride-card">
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #111827, #1f2937)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#fff'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Your Rides</h3>
            <button
              onClick={() => setMinimized(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900
              }}>
              -
            </button>
          </div>

          {/* Ride List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px' }}>
            {activeRides.map(ride => (
              <div key={ride._id} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    background: ride.status === 'requested' ? '#fef3c7' : '#e0f2fe',
                    color: ride.status === 'requested' ? '#d97706' : '#0369a1',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    {ride.status === 'requested' ? 'SCHEDULED' : ride.status}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: ride.status === 'arrived' ? '#10b981' : '#e11d48' }}>
                    {getTimeDisplay(ride)}
                  </span>
                </div>

                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  {ride.pickupLocation?.address?.split(',')[0]} → {ride.dropLocation?.address?.split(',')[0]}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  {ride.rideType} • {ride.fare}
                </p>

                {ride.driverId && ride.status !== 'in-transit' && (
                  <>
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#fee2e2',
                        color: '#e11d48',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800
                      }}>
                        {ride.driverId.name ? ride.driverId.name[0] : 'D'}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 800 }}>{ride.driverId.name}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                          {ride.driverId.vehicleNumber || 'Vehicle Info Pending'} • 📞 {ride.driverId.phone}
                        </p>
                      </div>
                    </div>
                    {/* Chat Button with Badge */}
                    <button 
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('triggerOpenChat', { detail: ride._id }));
                        }
                      }}
                      style={{ 
                        width: '100%', 
                        marginTop: '12px', 
                        padding: '12px', 
                        background: '#111827', 
                        color: '#fff', 
                        borderRadius: '12px', 
                        border: 'none', 
                        fontWeight: 800, 
                        fontSize: '13px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>💬</span>
                        {unreadCount > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#ef4444',
                            color: '#fff',
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '9px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 900,
                            border: '2px solid #111827',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                          }}>
                            {unreadCount}
                          </div>
                        )}
                      </div>
                      Chat with Driver
                    </button>
                  </>
                )}

                {ride.scheduledTime && (
                  <div style={{ marginTop: '12px', background: ride.status === 'requested' ? '#fef3c7' : '#ecfdf5', padding: '10px', borderRadius: '10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: ride.status === 'requested' ? '#d97706' : '#10b981', fontWeight: 800 }}>
                      📅 Your ride is scheduled at {new Date(ride.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                )}

                {ride.otp && ride.status !== 'requested' && ride.status !== 'in-transit' && (
                  <div style={{
                    marginTop: '12px',
                    background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
                    border: '1.5px solid #fecdd3',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#e11d48', letterSpacing: '0.8px' }}>RIDE PIN</p>
                      <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '4px' }}>{ride.otp}</p>
                    </div>
                  </div>
                )}

                {(ride.status === 'requested' || ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in-transit') && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {ride.rideType === 'SheRide Safe' && ride.status !== 'requested' && (
                      <button 
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('triggerSOS', { detail: ride._id }));
                          }
                        }}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          background: 'linear-gradient(135deg, #e11d48, #991b1b)', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '12px', 
                          fontWeight: 900, 
                          cursor: 'pointer', 
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                        <span>🚨</span> SOS
                      </button>
                    )}
                    {(ride.status === 'requested' || ride.status === 'accepted' || ride.status === 'arrived') && (
                      <button 
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const event = new CustomEvent('triggerCancelRide', { detail: ride._id });
                            window.dispatchEvent(event);
                          }
                        }}
                        style={{ flex: 1, padding: '12px', background: '#fff', color: '#e11d48', border: '1.5px solid #fee2e2', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>
                        Cancel Ride
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
