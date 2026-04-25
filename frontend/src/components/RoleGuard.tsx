'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleGuardProps {
  children: React.ReactNode;
  role: 'customer' | 'driver' | 'admin';
}

export default function RoleGuard({ children, role }: RoleGuardProps) {
  const { authUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!authUser) {
        router.push('/login');
      } else if (authUser.role !== role) {
        // Redirection if role doesn't match
        router.push(authUser.role === 'driver' ? '/driver/dashboard' : '/dashboard');
      }
    }
  }, [authUser, loading, router, role]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fcf9f9' }}>
        <p style={{ color: '#e11d48', fontWeight: 700, fontSize: '18px', fontFamily: 'Outfit' }}>Verifying Role...</p>
      </div>
    );
  }

  if (!authUser || authUser.role !== role) {
    return null; // Prevents flashing wrong content
  }

  return <>{children}</>;
}
