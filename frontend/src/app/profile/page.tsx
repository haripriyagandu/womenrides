'use client';
import { useAuth } from '@/context/AuthContext';
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
      const res = await fetch('http://localhost:5001/api/auth/history', {
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
      const res = await fetch('http://localhost:5001/api/auth/profile', {
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
      const res = await fetch('http://localhost:5001/api/auth/emergency-contacts', {
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
      <div style={{ minHeight: '100vh', background: '#fcf9f9', fontFamily: 'Outfit, sans-serif' }}>
        {/* Header */}
        <header style={{ padding: '20px 40px', background: '#fff', borderBottom: '1px solid #faeef2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: '#e11d48', margin: 0, fontSize: '24px', fontWeight: 900 }}>SheRide 🛵</h1>
          </Link>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link href="/dashboard" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
            <Link href="/history" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 600 }}>My Rides</Link>
            <button onClick={logout} style={{ padding: '10px 20px', borderRadius: '12px', border: '1.5px solid #faeef2', background: '#fff', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Logout</button>
          </div>
        </header>

        <main style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

              {/* User Identity Card */}
              <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', border: '1px solid #faeef2', boxShadow: '0 10px 30px rgba(225,29,72,0.04)', position: 'relative' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
                    👩
                  </div>
                  
                  {!isEditingProfile ? (
                    <>
                      <h2 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 4px', color: '#1f2937' }}>{authUser?.name}</h2>
                      <p style={{ color: '#6b7280', fontWeight: 500, margin: '0 0 24px' }}>{authUser?.phone}</p>
                      <button onClick={() => setIsEditingProfile(true)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#e11d48', fontWeight: 800, cursor: 'pointer' }}>Edit Profile</button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px', margin: '0 auto 24px' }}>
                       <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your Name" style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #faeef2', background: '#fcf9f9', outline: 'none', fontWeight: 600, fontFamily: 'Outfit', textAlign: 'center' }} />
                       <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone Number" style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #faeef2', background: '#fcf9f9', outline: 'none', fontWeight: 600, fontFamily: 'Outfit', textAlign: 'center' }} />
                       <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => setIsEditingProfile(false)} style={{ padding: '10px 20px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={saveProfile} style={{ padding: '10px 20px', borderRadius: '12px', background: '#111827', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Save</button>
                       </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1.5px solid #fcf9f9', paddingTop: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', color: '#9ca3af', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Rating</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#eab308' }}>{(authUser as any)?.trustScore || 5.0} ⭐</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', color: '#9ca3af', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Trips</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#1f2937' }}>{historyCount !== null ? historyCount : (authUser?.totalRides || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contacts Card */}
              <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', border: '1px solid #faeef2', boxShadow: '0 10px 30px rgba(225,29,72,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: '#1f2937' }}>Emergency Contacts</h3>
                  {!editingContacts ? (
                    <button onClick={() => setEditingContacts(true)} style={{ background: 'none', border: 'none', color: '#e11d48', fontWeight: 800, cursor: 'pointer' }}>Edit Settings</button>
                  ) : (
                    <button onClick={saveContacts} style={{ background: '#111827', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>Save Changes</button>
                  )}
                </div>

                <p style={{ color: '#846b74', fontSize: '14px', fontWeight: 500, margin: '0 0 24px', lineHeight: 1.5 }}>
                  Add people you trust. They'll be notified instantly if you trigger a safety alert during a journey.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {contacts.length === 0 && !editingContacts && (
                    <div style={{ textAlign: 'center', padding: '40px 0', background: '#fcf9f9', borderRadius: '20px', border: '2px dashed #faeef2' }}>
                      <p style={{ color: '#9ca3af', fontWeight: 600, margin: 0 }}>No contacts added yet</p>
                    </div>
                  )}

                  {contacts.map((contact, idx) => (
                    <div key={idx} style={{ background: editingContacts ? '#f9fafb' : '#fff5f6', padding: '20px', borderRadius: '20px', border: editingContacts ? '1.5px solid #f3f4f6' : '1.5px solid #fceef3', position: 'relative' }}>
                      {editingContacts ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontWeight: 800, color: '#e11d48', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}>Contact {idx + 1}</p>
                            <button onClick={() => removeContact(idx)} style={{ color: '#ef4444', background: '#fee2e2', width: '24px', height: '24px', borderRadius: '50%', border: 'none', fontWeight: 900, cursor: 'pointer' }}>×</button>
                          </div>
                          <input placeholder="Full Name" value={contact.name} onChange={e => handleContactChange(idx, 'name', e.target.value)}
                            style={{ padding: '12px 14px', borderRadius: '12px', border: '2px solid #f0dee6', background: '#fff', fontWeight: 600, fontFamily: 'Outfit', outline: 'none' }} />
                          <input placeholder="Phone Number" value={contact.phone} onChange={e => handleContactChange(idx, 'phone', e.target.value)}
                            style={{ padding: '12px 14px', borderRadius: '12px', border: '2px solid #f0dee6', background: '#fff', fontWeight: 600, fontFamily: 'Outfit', outline: 'none' }} />
                          <input placeholder="Email Address" value={contact.email} onChange={e => handleContactChange(idx, 'email', e.target.value)}
                            style={{ padding: '12px 14px', borderRadius: '12px', border: '2px solid #f0dee6', background: '#fff', fontWeight: 600, fontFamily: 'Outfit', outline: 'none' }} />
                          <select value={contact.relation} onChange={e => handleContactChange(idx, 'relation', e.target.value)}
                            style={{ padding: '12px 14px', borderRadius: '12px', border: '2px solid #f0dee6', background: '#fff', fontWeight: 600, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                            {relations.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: '0 0 4px', fontWeight: 800, color: '#374151', fontSize: '16px' }}>{contact.name}</p>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', background: '#fff', padding: '2px 8px', borderRadius: '6px', color: '#e11d48', fontWeight: 700, border: '1px solid #faeef2' }}>{contact.relation}</span>
                              <p style={{ margin: 0, fontWeight: 600, color: '#6b7280', fontSize: '14px' }}>{contact.phone}</p>
                              {contact.email && <p style={{ margin: 0, fontWeight: 600, color: '#9ca3af', fontSize: '13px' }}>• {contact.email}</p>}
                            </div>
                          </div>
                          <div style={{ fontSize: '20px' }}>🛡️</div>
                        </div>
                      )}
                    </div>
                  ))}

                  {editingContacts && contacts.length < 5 && (
                    <button onClick={addContact} style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '2px dashed #fca5a5', background: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>+ Add Another Contact</button>
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
