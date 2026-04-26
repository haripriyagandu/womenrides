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

  const getClasses = () => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-100 text-emerald-800';
      case 'error': return 'bg-rose-50 border-rose-100 text-rose-800';
      case 'warning': return 'bg-amber-50 border-amber-100 text-amber-800';
      default: return 'bg-sky-50 border-sky-100 text-sky-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '🔔';
    }
  };

  return (
    <div className="fixed top-6 sm:top-10 right-6 sm:right-10 left-6 sm:left-auto z-[11000] w-auto sm:w-[400px] animate-in slide-in-from-right-10 duration-500">
      <div className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 shadow-2xl shadow-slate-900/5 backdrop-blur-md ${getClasses()} font-['Outfit',sans-serif]`}>
        <div className="w-12 h-12 rounded-2xl bg-white/80 shadow-inner flex items-center justify-center text-xl shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm leading-tight">
            {message}
          </p>
        </div>

        <button 
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-xl font-black opacity-40 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
