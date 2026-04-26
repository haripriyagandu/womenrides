'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';

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
      const res = await fetch(`${API_URL}/api/auth/login`, {
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
      const res = await fetch(`${API_URL}/api/auth/verify-login-otp`, {
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
    <div className="min-h-screen bg-[#fcf9f9] flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[420px]">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e11d48] to-[#f97316] flex items-center justify-center mx-auto mb-5 text-3xl shadow-lg shadow-pink-200/50">🛵</div>
          <h1 className="text-3xl font-black text-[#2b101c] mb-1.5 tracking-tight">Welcome Back</h1>
          <p className="text-[#846b74] text-base font-medium">
            Don't have an account?{' '}
            <Link href="/" className="text-[#e11d48] font-bold hover:underline">Sign Up</Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_12px_40px_rgba(235,215,220,0.7)] border border-[#faeef2]">
          {error && <div className="bg-[#fceef3] text-[#e11d48] font-bold text-sm p-4 rounded-xl mb-6">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-[#2b101c] mb-2">Phone Number</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">📱</div>
                  <input 
                    className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
                    type="tel" 
                    required 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="10-digit phone number" 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-[#2b101c]">Password</label>
                  <Link href="/forgot-password" size="sm" className="text-xs font-bold text-[#e11d48] hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔒</div>
                  <input 
                    className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
                    type="password" 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Your password" 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4.5 bg-gradient-to-r from-[#e11d48] to-[#f97316] text-white rounded-2xl text-lg font-extrabold cursor-pointer shadow-xl shadow-pink-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Log In →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="flex flex-col gap-6">
              <p className="text-center text-[#846b74] text-sm font-medium">
                Enter the 4-digit code sent to your email
              </p>
              <div>
                <input 
                  className="w-full py-5 border-2 border-[#f0dee6] rounded-2xl text-3xl font-black text-[#2b101c] text-center tracking-[0.5em] focus:border-[#e11d48] outline-none transition-colors"
                  type="text" 
                  maxLength={4}
                  required 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  placeholder="0000" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4.5 bg-[#2b101c] text-white rounded-2xl text-lg font-extrabold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {loading ? 'Verifying...' : 'Verify & Login ✓'}
              </button>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-[#e11d48] font-bold text-sm hover:underline"
              >
                Change Number
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
             <Link href="/driver/login" className="text-sm text-[#846b74] font-bold hover:underline">
               Are you a Driver? <span className="text-[#e11d48]">Login here</span>
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[#e11d48] font-bold">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
