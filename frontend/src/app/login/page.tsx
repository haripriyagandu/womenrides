'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 48px',
  border: '2px solid #f0dee6', borderRadius: '14px', fontSize: '16px', fontWeight: 500,
  color: '#2b101c', fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
};

function LoginForm() {
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
      const res = await fetch('http://127.0.0.1:5001/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.role !== 'customer') {
          setError('This phone number is registered to a Driver. Please use the Driver App/Portal to log in.');
          return;
        }
        if (data.status === 'pending_otp') {
          setStep(2);
        } else {
          // Fallback if OTP is disabled on server
          login(data);
          router.push('/dashboard');
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
      const res = await fetch('http://localhost:5001/api/auth/verify-login-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (res.ok) {
        login(data);
        router.push('/dashboard');
      } else {
        setError(data.message || 'Invalid OTP');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fcf9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg,#e11d48,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>🛵</div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#2b101c', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Welcome Back</h1>
          <p style={{ color: '#846b74', fontSize: '15px', fontWeight: 500, margin: 0 }}>
            Don't have an account?{' '}
            <Link href="/" style={{ color: '#e11d48', fontWeight: 700, textDecoration: 'none' }}>Sign Up</Link>
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '28px', padding: '32px', boxShadow: '0 8px 40px rgba(235,215,220,0.6)', border: '1px solid #faeef2' }}>
          {error && <div style={{ background: '#fceef3', color: '#e11d48', fontWeight: 700, fontSize: '15px', padding: '14px', borderRadius: '12px', marginBottom: '20px' }}>{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#2b101c', marginBottom: '8px' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#bda9b1', fontSize: '18px' }}>📱</div>
                  <input style={inputStyle} type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '15px', fontWeight: 700, color: '#2b101c' }}>Password</label>
                  <Link href="/forgot-password" style={{ fontSize: '13px', fontWeight: 700, color: '#e11d48', textDecoration: 'none' }}>Forgot password?</Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#bda9b1', fontSize: '18px' }}>🔒</div>
                  <input style={inputStyle} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" />
                </div>
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '17px', background: 'linear-gradient(to right,#e11d48,#f97316)', color: '#fff', border: 'none', borderRadius: '14px', fontSize: '18px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>
                {loading ? 'Authenticating...' : 'Log In →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ textAlign: 'center', color: '#846b74', fontSize: '15px', fontWeight: 500, margin: '0 0 10px' }}>
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
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '17px', background: '#2b101c', color: '#fff', border: 'none', borderRadius: '14px', fontSize: '18px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                {loading ? 'Verifying...' : 'Verify & Login ✓'}
              </button>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#e11d48', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                Change Number
              </button>
            </form>
          )}

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
             <Link href="/driver/login" style={{ fontSize: '14px', color: '#846b74', fontWeight: 700, textDecoration: 'none' }}>Are you a Driver? <span style={{ color: '#e11d48' }}>Login here</span></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<p style={{ padding: '40px', color: '#e11d48', fontWeight: 700, fontFamily: 'Outfit' }}>Loading...</p>}>
      <LoginForm />
    </Suspense>
  );
}
