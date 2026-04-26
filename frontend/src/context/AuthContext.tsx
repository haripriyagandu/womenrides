'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/utils/api';

interface AuthUser {
  _id: string;
  name: string;
  phone: string;
  role: 'customer' | 'driver' | 'admin';
  status: string;
  isVerified: boolean;
  emergencyContacts?: any[];
  trustScore?: number;
  totalRides?: number;
}

interface AuthContextType {
  authUser: AuthUser | null;
  customerProfile: any | null;
  driverProfile: any | null;
  loading: boolean;
  login: (userData: any) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any | null>(null);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = async () => {
    const isDriverMap = typeof window !== 'undefined' && window.location.pathname.includes('/driver');
    const token = localStorage.getItem(isDriverMap ? 'driverToken' : 'customerToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuthUser(data);
        if (data.role === 'customer') {
          setCustomerProfile(data);
          setDriverProfile(null);
        } else if (data.role === 'driver') {
          setDriverProfile(data);
          setCustomerProfile(null);
        }
      } else {
        // If 401, only logout if we were previously logged in
        if (authUser) logout();
      }
    } catch (error) {
      // Sliently handle network errors during background check
    } finally {
      setLoading(false);
    }
  };

  const login = (userData: any) => {
    const isDriver = userData.role === 'driver';
    if (isDriver) {
      localStorage.setItem('driverToken', userData.token);
      localStorage.setItem('driverId', userData._id);
    } else {
      localStorage.setItem('customerToken', userData.token);
      localStorage.setItem('customerId', userData._id);
    }
    
    setAuthUser(userData);
    if (userData.role === 'customer') {
      setCustomerProfile(userData);
      setDriverProfile(null);
    } else if (userData.role === 'driver') {
      setDriverProfile(userData);
      setCustomerProfile(null);
    }
  };

  const logout = () => {
    const isDriverMap = typeof window !== 'undefined' && window.location.pathname.includes('/driver');
    if (isDriverMap) {
      localStorage.removeItem('driverToken');
      localStorage.removeItem('driverId');
      setDriverProfile(null);
      router.push('/driver/login');
    } else {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      setCustomerProfile(null);
      router.push('/login');
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      authUser, 
      customerProfile, 
      driverProfile, 
      loading, 
      login, 
      logout,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
