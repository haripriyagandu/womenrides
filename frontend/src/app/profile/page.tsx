'use client';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';
import RoleGuard from '@/components/RoleGuard';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SystemAlert from '@/components/SystemAlert';

const relations = ['Mother', 'Father', 'Sister', 'Brother', 'Husband', 'Friend', 'Family', 'Other'];

export default function ProfilePage() {
  const { authUser, customerProfile, refreshProfile, logout } = useAuth();
  
  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(authUser?.name || '');
  const [editPhone, setEditPhone] = useState(authUser?.phone || '');
  const [historyCount, setHistoryCount] = useState<number | null>(null);

  // Emergency Contacts State
  const [editingContacts, setEditingContacts] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  
  // Alerts
  const [sysAlert, setSysAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning'; visible: boolean }>({ message: '', type: 'info', visible: false });

  const showAlert = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
    setSysAlert({ message, type, visible: true });
  };

  useEffect(() => {
    if (authUser) {
      setContacts(authUser.emergencyContacts || []);
      setEditName(authUser.name || '');
      setEditPhone(authUser.phone || '');
      fetchHistoryCount();
    }
  }, [authUser]);

  const fetchHistoryCount = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const res = await fetch(`${API_URL}/api/auth/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryCount(data.length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveProfile = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName, phone: editPhone })
      });
      if (res.ok) {
        setIsEditingProfile(false);
        refreshProfile();
        showAlert('Profile updated successfully!', 'success');
      }
    } catch (e) {
      showAlert('Failed to update profile', 'error');
    }
  };

  const saveContacts = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const res = await fetch(`${API_URL}/api/auth/emergency-contacts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts })
      });
      if (res.ok) {
        setEditingContacts(false);
        refreshProfile();
        showAlert('Emergency contacts saved successfully!', 'success');
      }
    } catch (e) {
      showAlert('Failed to save contacts', 'error');
    }
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  const addContact = () => {
    if (contacts.length >= 5) return;
    setContacts([...contacts, { name: '', phone: '', email: '', relation: 'Family' }]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
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
            <Link href="/history" className="hidden sm:block text-sm font-black text-slate-500 hover:text-[#e11d48] transition-colors no-underline">My Rides</Link>
            <button onClick={logout} className="px-5 py-2.5 rounded-xl border border-rose-50 text-sm font-black text-[#ef4444] hover:bg-rose-50 transition-colors">Logout</button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-10 sm:py-14">
            <div className="flex flex-col gap-10">

              {/* User Identity Card */}
              <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl shadow-rose-900/5 border border-rose-50 relative overflow-hidden">
                <div className="text-center">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-rose-100 to-rose-200 mx-auto mb-6 flex items-center justify-center text-5xl shadow-inner border-4 border-white">
                    👩
                  </div>
                  
                  {!isEditingProfile ? (
                    <div className="mb-8">
                      <h2 className="text-3xl font-black text-[#0f172a] mb-1">{authUser?.name}</h2>
                      <p className="text-lg font-bold text-slate-400">{authUser?.phone}</p>
                      <button onClick={() => setIsEditingProfile(true)} className="absolute top-8 right-8 text-sm font-black text-[#e11d48] hover:underline">Edit</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 max-w-xs mx-auto mb-8 animate-in slide-in-from-top duration-300">
                       <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your Name" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#e11d48] focus:bg-white outline-none font-black text-center transition-all" />
                       <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone Number" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#e11d48] focus:bg-white outline-none font-black text-center transition-all" />
                       <div className="flex gap-3 justify-center">
                          <button onClick={() => setIsEditingProfile(false)} className="px-8 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black hover:bg-slate-200 transition-colors">Cancel</button>
                          <button onClick={saveProfile} className="px-8 py-3.5 rounded-2xl bg-[#0f172a] text-white font-black shadow-lg">Save</button>
                       </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6 border-t border-slate-50 pt-8">
                  <div className="text-center border-r border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trust Score</p>
                    <p className="text-2xl font-black text-[#eab308]">{(authUser as any)?.trustScore || 5.0} <span className="text-xl">⭐</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Trips</p>
                    <p className="text-2xl font-black text-[#0f172a]">{historyCount !== null ? historyCount : (authUser?.totalRides || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contacts Card */}
              <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl shadow-rose-900/5 border border-rose-50">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-[#0f172a] mb-1">Emergency Contacts</h3>
                    <p className="text-sm font-bold text-slate-400">Add up to 5 trusted people</p>
                  </div>
                  {!editingContacts ? (
                    <button onClick={() => setEditingContacts(true)} className="text-sm font-black text-[#e11d48] hover:underline text-left sm:text-right">Edit Settings</button>
                  ) : (
                    <button onClick={saveContacts} className="px-6 py-3 bg-[#0f172a] text-white text-sm font-black rounded-2xl shadow-lg">Save Changes</button>
                  )}
                </div>

                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
                  These people will be notified instantly if you trigger an SOS during your journey. Your safety is our priority.
                </p>

                <div className="space-y-6">
                  {contacts.length === 0 && !editingContacts && (
                    <div className="text-center py-14 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                      <p className="text-slate-400 font-black">No contacts added yet</p>
                    </div>
                  )}

                  {contacts.map((contact, idx) => (
                    <div key={idx} className={`p-6 sm:p-8 rounded-[2rem] border-2 transition-all ${
                      editingContacts ? 'bg-slate-50 border-slate-100' : 'bg-rose-50/50 border-rose-100/50'
                    }`}>
                      {editingContacts ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-[#e11d48] uppercase tracking-widest">CONTACT {idx + 1}</p>
                            <button onClick={() => removeContact(idx)} className="w-8 h-8 bg-rose-100 text-[#e11d48] rounded-full flex items-center justify-center font-black">×</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Full Name" value={contact.name} onChange={e => handleContactChange(idx, 'name', e.target.value)}
                              className="w-full px-5 py-3.5 rounded-xl border-2 border-slate-100 bg-white focus:border-[#e11d48] outline-none font-bold text-sm" />
                            <input placeholder="Phone Number" value={contact.phone} onChange={e => handleContactChange(idx, 'phone', e.target.value)}
                              className="w-full px-5 py-3.5 rounded-xl border-2 border-slate-100 bg-white focus:border-[#e11d48] outline-none font-bold text-sm" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Email Address" value={contact.email} onChange={e => handleContactChange(idx, 'email', e.target.value)}
                              className="w-full px-5 py-3.5 rounded-xl border-2 border-slate-100 bg-white focus:border-[#e11d48] outline-none font-bold text-sm" />
                            <select value={contact.relation} onChange={e => handleContactChange(idx, 'relation', e.target.value)}
                              className="w-full px-5 py-3.5 rounded-xl border-2 border-slate-100 bg-white focus:border-[#e11d48] outline-none font-black text-sm cursor-pointer appearance-none">
                              {relations.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-black text-[#0f172a] text-lg leading-none">{contact.name}</p>
                              <span className="px-2.5 py-1 bg-white border border-rose-100 rounded-lg text-[9px] font-black text-[#e11d48] uppercase tracking-wider">{contact.relation}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-500 font-bold text-sm">
                              <p>📞 {contact.phone}</p>
                              {contact.email && <p className="hidden sm:block text-slate-300">•</p>}
                              {contact.email && <p>✉️ {contact.email}</p>}
                            </div>
                          </div>
                          <div className="text-2xl opacity-50 grayscale">🛡️</div>
                        </div>
                      )}
                    </div>
                  ))}

                  {editingContacts && contacts.length < 5 && (
                    <button onClick={addContact} className="w-full py-5 rounded-[2rem] border-2 border-dashed border-rose-200 text-[#e11d48] font-black text-sm hover:bg-rose-50 transition-all">+ Add Another Contact</button>
                  )}
                </div>
              </div>
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
