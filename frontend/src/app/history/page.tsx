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
      <div className="min-h-screen bg-[#fdfafb] font-['Outfit',sans-serif]">
        {/* Header */}
        <header className="sticky top-0 z-50 px-6 sm:px-10 py-5 bg-white border-b border-rose-50 flex justify-between items-center shadow-sm">
          <Link href="/dashboard" className="no-underline">
            <h1 className="text-xl sm:text-2xl font-black text-[#e11d48]">SheRide</h1>
          </Link>
          <div className="flex gap-4 sm:gap-6 items-center">
            <Link href="/dashboard" className="text-sm font-black text-[#e11d48] no-underline">Home</Link>
            <Link href="/profile" className="hidden sm:block text-sm font-black text-slate-500 hover:text-[#e11d48] transition-colors no-underline">Profile</Link>
            <button onClick={logout} className="px-5 py-2.5 rounded-xl border border-rose-50 text-sm font-black text-[#ef4444] hover:bg-rose-50 transition-colors">Logout</button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14">
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl shadow-rose-900/5 border border-rose-50">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-[#0f172a]">My Rides</h2>
              <span className="bg-rose-50 text-[#e11d48] px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase">
                Total: {history.length}
              </span>
            </div>

            {loadingHistory ? (
              <div className="text-center py-20 animate-pulse">
                 <p className="font-black text-slate-300">Loading your trip history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-6">🛵</div>
                <h3 className="text-2xl font-black text-[#0f172a] mb-2">No trips found yet</h3>
                <p className="text-slate-400 font-bold mb-10 max-w-[280px] mx-auto leading-relaxed">Your completed SheRide journeys will appear here once they are finished.</p>
                <Link href="/dashboard" className="inline-block bg-[#0f172a] text-white px-10 py-4.5 rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 no-underline">Book Your First Ride</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {history.map((ride, idx) => (
                  <div key={idx} className="p-6 sm:p-8 rounded-[2rem] border-2 border-slate-50 bg-white hover:border-rose-100 hover:shadow-xl hover:shadow-rose-900/5 transition-all group">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <span className="bg-rose-50 text-[#e11d48] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{ride.rideType}</span>
                        <span className="text-[10px] font-bold text-slate-300">#{ride._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <span className="text-xl font-black text-[#0f172a]">{ride.fare}</span>
                    </div>
                    
                    <div className="space-y-4 mb-8 relative pl-6">
                      <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-slate-100 dashed-border"></div>
                      <div className="relative">
                        <span className="absolute -left-[22px] top-1.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm ring-4 ring-green-50"></span>
                        <p className="text-sm font-black text-[#0f172a] leading-tight">{ride.pickupLocation?.address || 'Pickup Point'}</p>
                      </div>
                      <div className="relative">
                        <span className="absolute -left-[22px] top-1.5 w-3 h-3 bg-[#e11d48] rounded-full border-2 border-white shadow-sm ring-4 ring-rose-50"></span>
                        <p className="text-sm font-black text-[#0f172a] leading-tight">{ride.dropLocation?.address || 'Destination'}</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">📅</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{new Date(ride.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                         <span className="text-[11px] font-black uppercase tracking-widest">Completed ✓</span>
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
