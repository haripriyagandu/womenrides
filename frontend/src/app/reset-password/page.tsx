'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [message, setMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match!');
      return;
    }
    if (newPassword.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('http://localhost:5001/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('done');
        setMessage(data.message);
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setStatus('error');
        setMessage(data.message || 'Reset failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 48px',
    border: '2px solid #f0dee6', borderRadius: '14px', fontSize: '16px', fontWeight: 500,
    color: '#2b101c', fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fcf9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ background: '#fff', borderRadius: '28px', padding: '36px', boxShadow: '0 8px 40px rgba(235,215,220,0.6)', border: '1px solid #faeef2' }}>

          {status === 'done' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#2b101c', margin: '0 0 10px' }}>Password Updated!</h2>
              <p style={{ color: '#374151', fontSize: '16px', margin: '0 0 24px' }}>{message}</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>Redirecting to login...</p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#2b101c', margin: '0 0 8px' }}>Set New Password</h1>
                <p style={{ color: '#846b74', fontSize: '15px', fontWeight: 500, margin: 0 }}>For <strong style={{ color: '#2b101c' }}>{email}</strong></p>
              </div>

              {status === 'error' && (
                <div style={{ background: '#fceef3', color: '#e11d48', fontWeight: 700, fontSize: '15px', padding: '14px', borderRadius: '12px', marginBottom: '20px' }}>{message}</div>
              )}

              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#2b101c', marginBottom: '8px' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>🔒</div>
                    <input style={inputStyle} type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#2b101c', marginBottom: '8px' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>🔒</div>
                    <input style={inputStyle} type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                </div>

                <button type="submit" disabled={status === 'loading'}
                  style={{ width: '100%', padding: '16px', background: 'linear-gradient(to right,#e11d48,#f97316)', color: '#fff', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: '8px' }}>
                  {status === 'loading' ? 'Updating...' : 'Update Password →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<p style={{ padding: '40px', color: '#e11d48', fontWeight: 700 }}>Loading...</p>}>
      <ResetForm />
    </Suspense>
  );
}
