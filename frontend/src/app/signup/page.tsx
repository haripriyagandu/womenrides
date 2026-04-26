'use client';
import { useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/utils/api';

// ─── Shared input style ──────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '14px 14px 14px 48px',
  border: '2px solid #f0dee6', borderRadius: '14px',
  fontSize: '17px', fontWeight: 600, color: '#2b101c',
  fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '16px', fontWeight: 700,
  color: '#2b101c', marginBottom: '8px',
};
const BtnPrimary = ({ children, onClick, type = 'button', disabled = false }: any) => (
  <button type={type} onClick={onClick} disabled={disabled}
    style={{ width: '100%', padding: '17px', background: disabled ? '#e5e7eb' : 'linear-gradient(to right,#fc8aa5,#fab282)', color: disabled ? '#9ca3af' : '#fff', fontWeight: 800, fontSize: '18px', borderRadius: '14px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: '28px' }}>
    {children}
  </button>
);

// ─── Icon wrapper ─────────────────────────────────
const Icon = ({ svg }: { svg: React.ReactNode }) => (
  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#bda9b1' }}>{svg}</div>
);

// ─── Document Upload Box ──────────────────────────
type DocStatus = 'idle' | 'scanning' | 'verified' | 'failed';
function DocUpload({ label, onChange, status }: { label: string; onChange: (f: File) => void; status: DocStatus }) {
  const colorMap: Record<DocStatus, string> = { idle: '#e0d4d8', scanning: '#ffc107', verified: '#22c55e', failed: '#ef4444' };
  const bgMap: Record<DocStatus, string> = { idle: '#fff', scanning: '#fffbf2', verified: '#f0fdf4', failed: '#fef2f2' };
  const iconColor = colorMap[status];
  return (
    <div style={{ position: 'relative', border: `2.5px dashed ${iconColor}`, borderRadius: '16px', padding: '18px 20px', background: bgMap[status], display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.3s' }}>
      {status !== 'verified' && status !== 'scanning' && (
        <input type="file" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10, width: '100%', height: '100%' }} />
      )}
      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${iconColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '22px' }}>
        {status === 'verified' ? '✅' : status === 'scanning' ? '⏳' : status === 'failed' ? '❌' : '📄'}
      </div>
      <div>
        <p style={{ fontWeight: 700, fontSize: '16px', color: '#2b101c', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '13px', color: iconColor, margin: '4px 0 0', fontWeight: 600 }}>
          {status === 'scanning' ? 'Scanning document...' : status === 'verified' ? 'Verified ✓' : status === 'failed' ? 'Invalid — tap to retry' : 'Tap to upload (image or PDF)'}
        </p>
      </div>
    </div>
  );
}

// ─── OTP Boxes ────────────────────────────────────
function OtpBoxes({ otp, onChange, refs }: { otp: string[]; onChange: (i: number, v: string) => void; refs: React.RefObject<HTMLInputElement | null>[] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '28px' }}>
      {otp.map((digit, idx) => (
        <input key={idx} ref={refs[idx]} type="text" maxLength={1} value={digit}
          onChange={e => onChange(idx, e.target.value)}
          style={{ width: '70px', height: '70px', border: '2px solid #f0dee6', borderRadius: '16px', textAlign: 'center', fontSize: '28px', fontWeight: 900, color: '#2b101c', fontFamily: 'Outfit, sans-serif', outline: 'none' }} />
      ))}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────
function SignupWizard() {
  const router = useRouter();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') === 'driver' ? 'driver' : 'customer';
  console.log('DEBUG: Using API_URL =', API_URL);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Stable OTP Refs
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const otpRefs = useRef([r1, r2, r3, r4]);
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Step 3 States (Identity Verification)
  const [aadharNumber, setAadharNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name || phone.length < 10 || password.length < 6 || !email.includes('@')) {
      setError('Please fill all fields correctly. Email must be valid.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email })
      });
      const data = await res.json();
      if (res.ok) setStep(2);
      else setError(data.message || 'Failed to send OTP');
    } catch { setError('Network error'); } finally { setIsLoading(false); }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) return;
    const n = [...otp]; n[idx] = val; setOtp(n);
    if (val && idx < 3) {
      otpRefs.current[idx + 1].current?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otp.join('') })
      });
      const data = await res.json();
      if (res.ok) setStep(3);
      else setError(data.message || 'Incorrect OTP');
    } catch { setError('Network error'); } finally { setIsLoading(false); }
  };

  const handleSubmit = async (docs: any) => {
    setIsLoading(true);
    try {
      const payload: any = { 
        name, phone, email, password, role,
        aadharNumber: docs.aadharNumber,
        licenseNumber: docs.licenseNumber,
        panNumber: docs.panNumber,
        vehicleNumber: docs.vehicleNumber
      };
      const res = await fetch(`${API_URL}/api/auth/register`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (res.ok) {
        // Sync with global auth state immediately
        login(data);
        
        // Success routing
        if (role === 'driver' && data.status === 'pending') {
          setError('Document verification pending. You will be notified once approved.');
          return;
        }
        
        // Small timeout to ensure state is set before redirect
        setTimeout(() => {
          router.push(role === 'driver' ? '/driver/dashboard' : '/emergency-setup');
        }, 100);
      } else { 
        setError(data.message || 'Registration failed'); 
      }
    } catch { setError('Network error'); } finally { setIsLoading(false); }
  };

  // ─── Shared card wrapper ─────────────────────────
  const card = (content: React.ReactNode) => (
    <div className="w-full max-w-[480px] mx-auto pt-8 pb-10 px-4">
      <button 
        onClick={() => step > 1 ? setStep(step - 1) : router.push('/')}
        className="flex items-center gap-2 text-[#846b74] font-bold text-lg bg-none border-none cursor-pointer mb-5 hover:text-[#2b101c] transition-colors"
      >
        ← Back
      </button>
      <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_12px_40px_rgba(235,215,220,0.7)] border border-[#faeef2]">
        {content}
      </div>
    </div>
  );

  const ErrBox = () => error ? <div className="bg-[#fceef3] text-[#e11d48] font-bold text-sm p-4 rounded-2xl mb-5">{error}</div> : null;

  // STEP 1: Details
  if (step === 1) return card(
    <form onSubmit={handleSendOTP}>
      <h2 className="text-3xl sm:text-4xl font-black text-[#2b101c] mb-1.5 tracking-tight leading-tight">Sign Up as {role === 'driver' ? 'Driver' : 'Customer'}</h2>
      <p className="text-[#846b74] text-lg font-medium mb-8">Create your account to get started</p>
      <ErrBox />
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-bold text-[#2b101c] mb-2">Full Name</label>
          <div className="relative">
            <Icon svg={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
            <input className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-[#2b101c] mb-2">Phone Number</label>
          <div className="relative">
            <Icon svg={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>} />
            <input className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-[#2b101c] mb-2">Email Address</label>
          <div className="relative">
            <Icon svg={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
            <input className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="For password recovery" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-[#2b101c] mb-2">Password</label>
          <div className="relative">
            <Icon svg={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} />
            <input className="w-full pl-12 pr-4 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
        </div>
      </div>
      <button 
        type="submit" 
        disabled={isLoading}
        className="w-full py-4.5 bg-gradient-to-r from-[#fc8aa5] to-[#fab282] text-white font-extrabold text-lg rounded-2xl border-none cursor-pointer mt-8 shadow-xl shadow-pink-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Sending OTP...' : 'Send OTP →'}
      </button>
      
      <div className="mt-6 text-center">
        <p className="text-[#846b74] text-base font-medium">
          Already have an account?{' '}
          <button type="button" onClick={() => router.push(role === 'driver' ? '/driver/login' : '/login')} className="bg-none border-none text-[#e11d48] font-bold cursor-pointer p-0 hover:underline">Log in</button>
        </p>
      </div>
    </form>
  );

  // STEP 2: Verify OTP
  if (step === 2) return card(
    <div className="flex flex-col items-center">
      <h2 className="text-3xl sm:text-4xl font-black text-[#2b101c] mb-2 text-center tracking-tight leading-tight">Verify OTP</h2>
      <p className="text-[#846b74] text-base font-medium mb-8 text-center leading-relaxed">Code sent to <strong className="text-[#2b101c]">{email}</strong></p>
      <ErrBox />
      <div className="flex justify-center gap-3 sm:gap-4 mb-8">
        {otp.map((digit, idx) => (
          <input 
            key={idx} 
            ref={otpRefs.current[idx]} 
            type="text" 
            maxLength={1} 
            value={digit}
            onChange={e => handleOtpChange(idx, e.target.value)}
            className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-[#f0dee6] rounded-2xl text-center text-2xl sm:text-3xl font-black text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors" 
          />
        ))}
      </div>
      <button 
        onClick={handleVerifyOTP} 
        disabled={isLoading}
        className="w-full py-4.5 bg-gradient-to-r from-[#fc8aa5] to-[#fab282] text-white font-extrabold text-lg rounded-2xl border-none cursor-pointer shadow-xl shadow-pink-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {isLoading ? 'Verifying...' : 'Verify OTP'}
      </button>
      <button 
        type="button" 
        onClick={() => handleSendOTP()} 
        disabled={isLoading}
        className="mt-5 bg-none border-none text-[#846b74] font-bold text-sm cursor-pointer hover:text-[#2b101c] underline"
      >
        Resend Code
      </button>
    </div>
  );

  // STEP 3: Documents (Now using Numbers)

  const canFinish = role === 'customer' 
    ? aadharNumber.length === 12 
    : (aadharNumber.length === 12 && licenseNumber.length > 5 && panNumber.length > 5 && vehicleNumber.length > 5);

  const finalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit({ aadharNumber, licenseNumber, panNumber, vehicleNumber });
  }

  if (step === 3) return card(
    <form onSubmit={finalSubmit}>
      <h2 className="text-3xl font-black text-[#2b101c] mb-2 tracking-tight">Identity Verification</h2>
      <p className="text-[#846b74] text-base font-medium mb-8 leading-relaxed">
        Please enter your document details for secure verification.
      </p>
      <ErrBox />
      
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-bold text-[#2b101c] mb-2">Aadhaar Card Number (12 digits)</label>
          <input 
            className="w-full px-5 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
            type="text" 
            maxLength={12}
            required 
            value={aadharNumber} 
            onChange={e => setAadharNumber(e.target.value.replace(/\D/g,''))} 
            placeholder="XXXX XXXX XXXX" 
          />
        </div>

        {role === 'driver' && (
          <>
            <div>
              <label className="block text-sm font-bold text-[#2b101c] mb-2">PAN Card Number</label>
              <input 
                className="w-full px-5 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
                type="text" 
                required 
                value={panNumber} 
                onChange={e => setPanNumber(e.target.value.toUpperCase())} 
                placeholder="ABCDE1234F" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#2b101c] mb-2">Driving License Number</label>
              <input 
                className="w-full px-5 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
                type="text" 
                required 
                value={licenseNumber} 
                onChange={e => setLicenseNumber(e.target.value.toUpperCase())} 
                placeholder="DL-XXXXXXXXXXXX" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#2b101c] mb-2">Vehicle Number Plate</label>
              <input 
                className="w-full px-5 py-4 border-2 border-[#f0dee6] rounded-2xl text-base font-semibold text-[#2b101c] focus:border-[#e11d48] outline-none transition-colors"
                type="text" 
                required 
                value={vehicleNumber} 
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())} 
                placeholder="TS 09 AB 1234" 
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6 bg-[#fef2f2] rounded-2xl p-4 border border-[#fee2e2]">
        <p className="m-0 text-sm text-[#991b1b] font-semibold leading-relaxed">
          🔒 Your data is compared against our secure verification vault and encrypted.
        </p>
      </div>

      <button 
        type="submit" 
        disabled={!canFinish || isLoading}
        className="w-full py-4.5 bg-gradient-to-r from-[#fc8aa5] to-[#fab282] text-white font-extrabold text-lg rounded-2xl border-none cursor-pointer mt-8 shadow-xl shadow-pink-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Verifying...' : 'Finish Registration 🎉'}
      </button>
    </form>
  );

  return null;
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-[#fcf9f9] flex items-start justify-center">
      <Suspense fallback={<div className="p-10 text-[#e11d48] font-bold">Loading...</div>}>
        <SignupWizard />
      </Suspense>
    </div>
  );
}
