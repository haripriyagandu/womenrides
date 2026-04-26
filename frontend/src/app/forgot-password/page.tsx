'use client';
import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'sent'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('sent');
        setMessage(data.message);
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
      } else {
        setStatus('error');
        setMessage(data.message || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fcf9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#846b74', fontWeight: 700, fontSize: '16px', textDecoration: 'none', marginBottom: '24px' }}>← Back to Login</Link>

        <div style={{ background: '#fff', borderRadius: '28px', padding: '36px', boxShadow: '0 8px 40px rgba(235,215,220,0.6)', border: '1px solid #faeef2' }}>

          {status !== 'sent' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔑</div>
                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#2b101c', margin: '0 0 8px' }}>Forgot Password?</h1>
                <p style={{ color: '#846b74', fontSize: '15px', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>Enter your registered email and we'll send you a reset link.</p>
              </div>

              {status === 'error' && (
                <div style={{ background: '#fceef3', color: '#e11d48', fontWeight: 700, fontSize: '15px', padding: '14px', borderRadius: '12px', marginBottom: '20px' }}>{message}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: '#2b101c', marginBottom: '8px' }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>📧</div>
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Your registered email"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 48px', border: '2px solid #f0dee6', borderRadius: '14px', fontSize: '16px', fontWeight: 500, color: '#2b101c', fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff' }}
                    />
                  </div>
                </div>
                <button type="submit" disabled={status === 'loading'}
                  style={{ width: '100%', padding: '16px', background: 'linear-gradient(to right,#e11d48,#f97316)', color: '#fff', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {status === 'loading' ? 'Sending...' : 'Send Reset Link →'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>📬</div>
              <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#2b101c', margin: '0 0 10px' }}>Check Your Email!</h2>
              <p style={{ color: '#374151', fontSize: '16px', lineHeight: 1.6, margin: '0 0 24px' }}>
                We sent a password reset link to <strong style={{ color: '#e11d48' }}>{email}</strong>. Click the link in the email to reset your password.
              </p>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>Link expires in 15 minutes.</p>

              {previewUrl && (
                <div style={{ background: '#f0fdf4', border: '2px solid #a3d9b1', borderRadius: '14px', padding: '16px', marginBottom: '24px' }}>
                  <p style={{ fontWeight: 700, color: '#15803d', margin: '0 0 8px', fontSize: '14px' }}>📧 Dev Mode — Preview Email:</p>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontWeight: 700, wordBreak: 'break-all', fontSize: '13px' }}>{previewUrl}</a>
                </div>
              )}

              <Link href="/login" style={{ display: 'inline-block', padding: '14px 28px', background: '#f3f4f6', color: '#374151', borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>Back to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
