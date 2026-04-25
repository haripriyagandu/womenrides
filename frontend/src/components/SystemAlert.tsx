'use client';
import { useState, useEffect } from 'react';

interface SystemAlertProps {
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function SystemAlert({ message, type = 'success', visible, onClose, duration = 5000 }: SystemAlertProps) {
  useEffect(() => {
    if (visible && message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, message, onClose]);

  if (!visible || !message) return null;

  const getStyle = () => {
    switch (type) {
      case 'success': return { background: '#f0fdf4', border: '1px solid #bbfcce', color: '#16a34a' };
      case 'error': return { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' };
      case 'warning': return { background: '#fffbeb', border: '1px solid #fef3c7', color: '#d97706' };
      default: return { background: '#f0f9ff', border: '1px solid #e0f2fe', color: '#0369a1' };
    }
  };

  const style = getStyle();

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '24px',
      zIndex: 11000,
      width: '100%',
      maxWidth: '380px',
      animation: 'slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      
      <div style={{
        ...style,
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontFamily: 'Outfit, sans-serif'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
        }}>
          {type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔'}
        </div>
        
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>
            {message}
          </p>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#9ca3af',
            fontWeight: 800
          }}>
          ×
        </button>
      </div>
    </div>
  );
}
