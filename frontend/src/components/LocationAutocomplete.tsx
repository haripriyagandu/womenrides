'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

export interface LocationResult {
  lat: number;
  lng: number;
  address: string;
}

interface LocationAutocompleteProps {
  placeholder: string;
  onSelect: (loc: LocationResult | null) => void;
  onChange?: (val: string) => void;
  value?: string;
  className?: string;
  initialValue?: string;
  userLoc?: { lat: number; lng: number } | null;
  showCurrentLocation?: boolean;
  dotColor?: string;
  rightIcon?: React.ReactNode;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  placeholder,
  onSelect,
  onChange,
  value,
  className = "",
  initialValue = "",
  userLoc,
  showCurrentLocation = true,
  dotColor,
  rightIcon
}) => {
  const [query, setQuery] = useState(value || initialValue || "");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (value !== undefined && !isInternalChange.current) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchText: string) => {
    if (!searchText || searchText.length < 2) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (!apiKey) return;

    const proximity = userLoc ? `&proximity=${userLoc.lng},${userLoc.lat}` : '';
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(searchText)}.json?key=${apiKey}&language=en&country=in&fuzzyMatch=true&limit=10${proximity}`
      );
      const data = await res.json();
      if (data.features) {
        setSuggestions(data.features);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInternalChange.current && query.length >= 2) {
        fetchSuggestions(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: any) => {
    const address = item.place_name || item.text;
    const [lng, lat] = item.center;
    isInternalChange.current = false;
    setQuery(address);
    if (onChange) onChange(address);
    setSuggestions([]);
    setShowDropdown(false);
    onSelect({ lat, lng, address });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
      try {
        const res = await fetch(`https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${apiKey}`);
        const data = await res.json();
        const addr = data.features?.[0]?.place_name || "My Location";
        isInternalChange.current = false;
        setQuery(addr);
        if (onChange) onChange(addr);
        onSelect({ lat: latitude, lng: longitude, address: addr });
      } catch {
        onSelect({ lat: latitude, lng: longitude, address: "Current Location" });
      } finally {
        setLoading(false);
      }
    }, () => setLoading(false));
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center group">
        <div className="absolute left-4 flex items-center z-10 pointer-events-none">
          {dotColor ? (
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ background: dotColor }} />
          ) : (
            <div className="text-slate-400 group-focus-within:text-[#e11d48] transition-colors">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </div>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            isInternalChange.current = true;
            const val = e.target.value;
            setQuery(val);
            if (onChange) onChange(val);
            onSelect(null); 
            setShowDropdown(true);
          }}
          placeholder={placeholder}
          className={`w-full ${dotColor ? 'pl-10' : 'pl-12'} pr-24 py-4 sm:py-4.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl focus:border-[#e11d48] focus:bg-white focus:ring-4 focus:ring-rose-50 outline-none transition-all shadow-sm text-[#0f172a] font-black text-sm placeholder:text-slate-300 placeholder:font-bold`}
        />
        <div className="absolute right-3 flex items-center gap-1">
          {query && (
            <button
              onClick={() => { 
                isInternalChange.current = false; 
                setQuery(''); 
                if (onChange) onChange(''); 
                onSelect(null); 
                setSuggestions([]); 
              }}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {rightIcon ? (
            <div className="flex items-center">{rightIcon}</div>
          ) : (
            showCurrentLocation && (
              <button
                onClick={useCurrentLocation}
                className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 rounded-xl text-[#e11d48] transition-all active:scale-90"
                title="Use current location"
              >
                <MapPin className="w-5 h-5" />
              </button>
            )
          )}
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[2000] w-full mt-3 bg-white border border-slate-100 rounded-3xl shadow-2xl shadow-rose-900/10 max-h-80 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
          {suggestions.map((item, index) => (
            <button
              key={item.id || index}
              onClick={() => handleSelect(item)}
              className="w-full flex items-start gap-4 p-5 hover:bg-rose-50/50 text-left transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="mt-0.5 p-2 bg-slate-100 rounded-xl group-hover:bg-white transition-colors">
                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-[#e11d48]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#0f172a] text-sm truncate">{item.text}</p>
                <p className="text-xs text-slate-400 font-bold truncate mt-0.5">{item.place_name?.replace(item.text + ', ', '')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
