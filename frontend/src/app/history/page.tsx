'use client';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';
import RoleGuard from '@/components/RoleGuard';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SystemAlert from '@/components/SystemAlert';

export default function HistoryPage() {
  const { authUser, logout } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sysAlert, setSysAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning'; visible: boolean }>({ message: '', type: 'info', visible: false });

  const showAlert = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
    setSysAlert({ message, type, visible: true });
  };

  useEffect(() => {
    if (authUser) {
      fetchHistory();
    }
  }, [authUser]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const res = await fetch(`${API_URL}/api/auth/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch history');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <RoleGuard role="customer">
      <div style={{ minHeight: '100vh', background: '#fcf9f9', fontFamily: 'Outfit, sans-serif' }}>
        {/* Header */}
        <header style={{ padding: '20px 40px', background: '#fff', borderBottom: '1px solid #faeef2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: '#e11d48', margin: 0, fontSize: '24px', fontWeight: 900 }}>SheRide 🛵</h1>
          </Link>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link href="/dashboard" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
            <Link href="/profile" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 600 }}>Profile</Link>
            <button onClick={logout} style={{ padding: '10px 20px', borderRadius: '12px', border: '1.5px solid #faeef2', background: '#fff', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Logout</button>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', border: '1px solid #faeef2', boxShadow: '0 10px 30px rgba(225,29,72,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 900, margin: 0, color: '#1f2937' }}>My Rides</h2>
              <span style={{ background: '#ffe4e6', color: '#e11d48', padding: '6px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 800 }}>
                Total: {history.length}
              </span>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                 <p style={{ fontWeight: 700, color: '#64748b' }}>Loading your trip history...</p>
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛵</div>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1f2937', margin: '0 0 8px' }}>No trips found yet</h3>
                <p style={{ color: '#64748b', marginBottom: '32px', maxWidth: '300px', margin: '0 auto 32px' }}>Your completed SheRide journeys will appear here once they are finished.</p>
                <Link href="/dashboard" style={{ background: '#111827', color: '#fff', padding: '16px 36px', borderRadius: '16px', textDecoration: 'none', fontWeight: 800, fontSize: '15px' }}>Book Your First Ride</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {history.map((ride, idx) => (
                  <div key={idx} style={{ padding: '24px', borderRadius: '24px', border: '1.5px solid #fcf9f9', background: '#fff', transition: '0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#fff1f2', color: '#e11d48', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>{ride.rideType}</span>
                        <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>#{ride._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <span style={{ fontWeight: 900, color: '#1f2937', fontSize: '18px' }}>{ride.fare}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', paddingLeft: '16px', borderLeft: '2px dashed #f1f5f9', marginLeft: '6px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', border: '2px solid #fff' }}></span>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{ride.pickupLocation?.address || 'Pickup Point'}</p>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', background: '#e11d48', borderRadius: '50%', border: '2px solid #fff' }}></span>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{ride.dropLocation?.address || 'Destination'}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: '20px', borderTop: '1.5px solid #fcf9f9', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>📅</span>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{new Date(ride.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e' }}>
                         <span style={{ fontWeight: 900, fontSize: '13px' }}>Completed ✓</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <SystemAlert
        message={sysAlert.message}
        type={sysAlert.type}
        visible={sysAlert.visible}
        onClose={() => setSysAlert({ ...sysAlert, visible: false })}
      />
    </RoleGuard>
  );
}
