'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Contact = { name: string; phone: string; relation: string };

const relations = ['Mother', 'Father', 'Sister', 'Brother', 'Husband', 'Friend', 'Family', 'Other'];

export default function EmergencySetup() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', phone: '', relation: 'Family' }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addContact = () => {
    if (contacts.length >= 5) return;
    setContacts([...contacts, { name: '', phone: '', relation: 'Family' }]);
  };

  const removeContact = (i: number) => {
    setContacts(contacts.filter((_, idx) => idx !== i));
  };

  const updateContact = (i: number, field: keyof Contact, val: string) => {
    const c = [...contacts];
    c[i][field] = val;
    setContacts(c);
  };

  const handleSave = async () => {
    const validContacts = contacts.filter(c => c.name.trim() && c.phone.trim());
    if (validContacts.length === 0) {
      router.push('/dashboard');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    try {
      const res = await fetch('http://localhost:5001/api/auth/emergency-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ contacts: validContacts })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push('/dashboard'), 1200);
      } else {
        router.push('/dashboard');
      }
    } catch {
      router.push('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push('/dashboard');

  return (
    <div style={{ minHeight: '100vh', background: '#fcf9f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,#ff4d6d,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(255,77,109,0.35)' }}>
            🚨
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#2b101c', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Set Emergency Contacts</h1>
          <p style={{ color: '#846b74', fontSize: '16px', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
            Add people you trust. They'll be notified instantly if you trigger SOS.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '28px', padding: '32px', boxShadow: '0 8px 40px rgba(235,215,220,0.6)', border: '1px solid #faeef2' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {contacts.map((c, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: '18px', padding: '18px', border: '1.5px solid #f3f4f6', position: 'relative' }}>
                {/* Remove button */}
                {contacts.length > 1 && (
                  <button onClick={() => removeContact(i)}
                    style={{ position: 'absolute', top: '14px', right: '14px', width: '28px', height: '28px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    ×
                  </button>
                )}

                <p style={{ fontWeight: 800, color: '#374151', fontSize: '14px', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact {i + 1}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    value={c.name}
                    onChange={e => updateContact(i, 'name', e.target.value)}
                    placeholder="Full name"
                    style={{ padding: '12px 14px', border: '2px solid #f0dee6', borderRadius: '12px', fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#111827', width: '100%', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = '#e11d48')}
                    onBlur={e => (e.target.style.borderColor = '#f0dee6')}
                  />
                  <input
                    type="tel"
                    value={c.phone}
                    onChange={e => updateContact(i, 'phone', e.target.value)}
                    placeholder="Phone number"
                    style={{ padding: '12px 14px', border: '2px solid #f0dee6', borderRadius: '12px', fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#111827', width: '100%', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = '#e11d48')}
                    onBlur={e => (e.target.style.borderColor = '#f0dee6')}
                  />
                  <select
                    value={c.relation}
                    onChange={e => updateContact(i, 'relation', e.target.value)}
                    style={{ padding: '12px 14px', border: '2px solid #f0dee6', borderRadius: '12px', fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#111827', width: '100%', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                    {relations.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Add more */}
          {contacts.length < 5 && (
            <button onClick={addContact}
              style={{ width: '100%', padding: '13px', background: 'transparent', border: '2px dashed #fca5a5', borderRadius: '14px', fontSize: '15px', fontWeight: 700, color: '#dc2626', cursor: 'pointer', marginTop: '12px', fontFamily: 'Outfit, sans-serif' }}>
              + Add Another Contact
            </button>
          )}

          {/* Save button */}
          <button onClick={handleSave} disabled={saving || saved}
            style={{ width: '100%', padding: '17px', background: saved ? '#22c55e' : 'linear-gradient(to right,#ff4d6d,#f97316)', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: 800, cursor: 'pointer', marginTop: '20px', fontFamily: 'Outfit, sans-serif', boxShadow: saved ? '0 4px 12px rgba(34,197,94,0.35)' : '0 4px 16px rgba(255,77,109,0.35)', transition: 'background 0.3s' }}>
            {saved ? '✓ Saved! Redirecting...' : saving ? 'Saving...' : 'Save & Go to Dashboard'}
          </button>

          {/* Skip */}
          <button onClick={handleSkip}
            style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', fontSize: '15px', fontWeight: 700, color: '#9ca3af', cursor: 'pointer', marginTop: '8px', fontFamily: 'Outfit, sans-serif' }}>
            Skip for now →
          </button>
        </div>

        {/* Reassurance note */}
        <p style={{ textAlign: 'center', color: '#bda9b1', fontSize: '13px', fontWeight: 500, marginTop: '20px' }}>
          🔒 You can update your contacts anytime from the dashboard.
        </p>
      </div>
    </div>
  );
}
