'use client';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';
import RoleGuard from '@/components/RoleGuard';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SystemAlert from '@/components/SystemAlert';

export default function DriverHistoryPage() {
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
      const token = localStorage.getItem('driverToken');
      const res = await fetch(`${API_URL}/api/rides/driver/history`, {
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
    <RoleGuard role="driver">
      <div className="min-h-screen bg-[#fdfafb] font-['Outfit',sans-serif]">
        {/* Header */}
        <header className="sticky top-0 z-50 px-6 py-5 bg-white border-b border-rose-50 flex justify-between items-center shadow-sm">
          <Link href="/driver/dashboard" className="no-underline">
            <h1 className="text-2xl font-black text-[#e11d48]">SheRide <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full ml-1 uppercase">Driver</span></h1>
          </Link>
          <button onClick={logout} className="text-slate-400 hover:text-rose-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </header>

        <main className="max-w-xl mx-auto p-6 pb-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-[#0f172a]">Trip History</h2>
              <p className="text-slate-500 text-sm mt-1">Review your completed earnings</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Trips</span>
              <span className="text-xl font-black text-[#e11d48]">{history.length}</span>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-rose-100 border-t-[#e11d48] rounded-full animate-spin" />
              <p className="text-slate-400 font-bold animate-pulse">Loading trips...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border-2 border-dashed border-slate-100 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              </div>
              <h3 className="text-xl font-black text-[#0f172a] mb-2">No trips yet</h3>
              <p className="text-slate-400 font-medium mb-8">Start accepting rides to see your history here!</p>
              <Link href="/driver/dashboard" className="inline-flex items-center gap-2 bg-[#e11d48] text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-transform no-underline">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((ride, idx) => (
                <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                        {ride.rideType === 'safe' ? '🛡️ SheRide Safe' : '🛵 Scooter'}
                      </span>
                      <p className="text-slate-400 text-xs mt-2 font-bold">
                        {new Date(ride.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#0f172a]">₹{ride.fare}</span>
                      <p className="text-[10px] font-bold text-green-500 uppercase">Paid</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 relative">
                    <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-slate-100" />
                    <div className="flex items-center gap-4 relative">
                      <div className="w-5 h-5 rounded-full bg-green-100 border-2 border-white flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <p className="text-xs font-bold text-[#0f172a] truncate">{ride.pickupLocation.address}</p>
                    </div>
                    <div className="flex items-center gap-4 relative">
                      <div className="w-5 h-5 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                      </div>
                      <p className="text-xs font-bold text-[#0f172a] truncate">{ride.dropLocation.address}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <SystemAlert 
          message={sysAlert.message} 
          type={sysAlert.type} 
          visible={sysAlert.visible} 
          onClose={() => setSysAlert(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    </RoleGuard>
  );
}
