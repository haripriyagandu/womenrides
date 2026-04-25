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
        <div className="absolute left-3 flex items-center">
          {dotColor ? (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
          ) : (
            <div className="text-gray-400 group-focus-within:text-pink-500">
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
            onSelect(null); // Clear coordinates while typing
            setShowDropdown(true);
          }}
          placeholder={placeholder}
          className={`w-full ${dotColor ? 'pl-8' : 'pl-10'} pr-24 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all shadow-sm text-gray-800 font-medium`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => { 
                isInternalChange.current = false; 
                setQuery(''); 
                if (onChange) onChange(''); 
                onSelect(null); 
                setSuggestions([]); 
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400"
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
                className="p-2 hover:bg-pink-50 rounded-lg text-pink-500 text-lg"
                title="Use current location"
              >
                📍
              </button>
            )
          )}
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[2000] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {suggestions.map((item, index) => (
            <button
              key={item.id || index}
              onClick={() => handleSelect(item)}
              className="w-full flex items-start gap-3 p-4 hover:bg-pink-50 text-left border-b border-gray-50 last:border-0"
            >
              <div className="mt-1 p-2 bg-gray-50 rounded-lg">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.text}</p>
                <p className="text-xs text-gray-500 truncate">{item.place_name?.replace(item.text + ', ', '')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
