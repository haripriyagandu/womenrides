'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 48px',
  border: '2px solid #e5e7eb', borderRadius: '14px', fontSize: '16px', fontWeight: 500,
  color: '#111827', fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
};

function DriverLoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.role !== 'driver') {
          setError('This phone number belongs to a Customer account. Please use the Customer Login below.');
          return;
        }
        if (data.status === 'pending_otp') {
          setStep(2);
        } else {
          login(data);
          router.push('/driver/dashboard');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-login-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (res.ok) {
        login(data);
        router.push('/driver/dashboard');
      } else {
        setError(data.message || 'Invalid OTP');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '20px', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '32px', boxShadow: '0 8px 24px rgba(34,197,94,0.3)' }}>🪖</div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Driver Hub</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 500, margin: 0 }}>
            Ready to earn? Sign in to start your shift.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '28px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid #1e293b' }}>
          {error && <div style={{ background: '#fef2f2', color: '#e11d48', fontWeight: 700, fontSize: '14px', padding: '14px', borderRadius: '12px', marginBottom: '20px' }}>{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>📱</div>
                  <input style={inputStyle} type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔒</div>
                  <input style={inputStyle} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" />
                </div>
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '17px', fontWeight: 900, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
                {loading ? 'Authenticating...' : 'Enter Dashboard →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>
                Enter the 4-digit code sent to your email
              </p>
              <div>
                <input 
                  style={{ ...inputStyle, paddingLeft: '14px', textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 900 }} 
                  type="text" 
                  maxLength={4}
                  required 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  placeholder="0 0 0 0" 
                />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '17px', fontWeight: 900, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                {loading ? 'Verifying...' : 'Verify & Enter Hub ✓'}
              </button>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                Back to credentials
              </button>
            </form>
          )}

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
             <Link href="/login" style={{ fontSize: '14px', color: '#64748b', fontWeight: 700, textDecoration: 'none' }}>Are you a Customer? Login here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriverLogin() {
  return (
    <Suspense fallback={<p>Loading Driver Hub...</p>}>
      <DriverLoginForm />
    </Suspense>
  );
}
