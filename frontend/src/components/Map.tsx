'use client';
import { useState, useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import "leaflet-defaulticon-compatibility";
import L from 'leaflet';

interface MapProps {
  pickupObj?: any;
  dropObj?: any;
  driverCoords?: any;
  searching?: boolean;
}

// 🛡️ Helper to ensure coordinates are valid numbers to prevent Leaflet runtime errors
const isValidCoord = (obj: any) => {
  if (!obj) return false;
  const lat = typeof obj.lat === 'string' ? parseFloat(obj.lat) : obj.lat;
  const lng = typeof obj.lng === 'string' ? parseFloat(obj.lng) : obj.lng;
  return (
    typeof lat === 'number' && 
    typeof lng === 'number' && 
    !isNaN(lat) && 
    !isNaN(lng) && 
    isFinite(lat) && 
    isFinite(lng) &&
    lat !== 0 && lng !== 0 // 0,0 is usually a sign of bad data in this app's context
  );
};

// 🛵 Simulated Driver Marker Component
function NearbyDrivers({ center }: { center: { lat: number, lng: number } }) {
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    if (!isValidCoord(center)) return;

    // Generate initial ghost drivers near the pickup/center
    const initial = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      lat: center.lat + (Math.random() - 0.5) * 0.02,
      lng: center.lng + (Math.random() - 0.5) * 0.02,
      rotation: 0 
    }));
    setDrivers(initial);

    // Subtle movement jitter to simulate life
    const interval = setInterval(() => {
      setDrivers(prev => prev.map(d => ({
        ...d,
        lat: d.lat + (Math.random() - 0.5) * 0.0005,
        lng: d.lng + (Math.random() - 0.5) * 0.0005,
        rotation: 0 // Keep upright
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, [center.lat, center.lng]);

  const bikeIcon = (rotation: number) => L.divIcon({
    html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2))">🛵</div>`,
    className: 'custom-bike-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  return (
    <>
      {drivers.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).map(d => (
        <Marker key={d.id} position={[d.lat, d.lng]} icon={bikeIcon(d.rotation)} opacity={0.7} />
      ))}
    </>
  );
}

// 🗺️ Sub-component to handle map animations and viewport updates
function MapController({ pickupObj, dropObj, driverCoords }: MapProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    try {
      const points: [number, number][] = [];
      if (isValidCoord(driverCoords)) points.push([driverCoords.lat, driverCoords.lng]);
      if (isValidCoord(pickupObj)) points.push([pickupObj.lat, pickupObj.lng]);
      if (isValidCoord(dropObj)) points.push([dropObj.lat, dropObj.lng]);

      if (points.length > 0) {
        if (points.length === 1) {
          map.flyTo(points[0] as L.LatLngExpression, 15, { duration: 1.5 });
        } else {
          const bounds = L.latLngBounds(points as L.LatLngExpression[]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 1 });
        }
      }
    } catch (e) {
      console.warn("Map control failed safely:", e);
    }
  }, [driverCoords, pickupObj, dropObj, map]);

  return null;
}

// 🗺️ Main Component
const InteractiveMap = memo(function InteractiveMap({ pickupObj, dropObj, driverCoords, searching }: MapProps) {
  const [position] = useState<[number, number]>([17.4065, 78.4772]); // Default Hyderabad
  const [animatedCoords, setAnimatedCoords] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth Glide Animation for Driver
  useEffect(() => {
    if (!isValidCoord(driverCoords)) return;
    if (!isValidCoord(animatedCoords)) {
      setAnimatedCoords({ lat: driverCoords.lat, lng: driverCoords.lng });
      return;
    }

    let startTime = Date.now();
    let frameId: number;
    const duration = 1500;
    const startLat = animatedCoords.lat;
    const startLng = animatedCoords.lng;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentLat = startLat + (driverCoords.lat - startLat) * progress;
      const currentLng = startLng + (driverCoords.lng - startLng) * progress;
      
      if (!isNaN(currentLat) && !isNaN(currentLng) && isFinite(currentLat) && isFinite(currentLng)) {
        setAnimatedCoords({ lat: currentLat, lng: currentLng });
      }

      if (progress < 1 && isValidCoord(driverCoords)) {
        frameId = requestAnimationFrame(animate);
      }
    };
    
    if (isValidCoord(driverCoords)) {
      frameId = requestAnimationFrame(animate);
    }
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [driverCoords]);

  const driverIcon = useMemo(() => new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), []);

  // Road Routing Logic
  const [driverRoute, setDriverRoute] = useState<any[] | null>(null);
  const [tripRoute, setTripRoute] = useState<any[] | null>(null);

  // Combine routing logic into one efficient effect
  useEffect(() => {
    const fetchRoute = async (start: any, end: any, setter: any) => {
      if (!isValidCoord(start) || !isValidCoord(end)) return setter(null);
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson`);
        if (!res.ok) throw new Error("OSRM down");
        const data = await res.json();
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setter(coords);
        }
      } catch (e) { 
        // Silently fail - the map will auto-fallback to a dashed straight line
        setter(null);
      }
    };

    fetchRoute(driverCoords, pickupObj, setDriverRoute);
    fetchRoute(pickupObj, dropObj, setTripRoute);
  }, [driverCoords?.lat, driverCoords?.lng, pickupObj?.lat, pickupObj?.lng, dropObj?.lat, dropObj?.lng]);

  if (!mounted) {
    return (
      <div style={{ height: '100%', width: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontWeight: 700 }}>
        Initializing Map...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapContainer 
        key="passenger-ride-map" // Stable key to help React 19 reconciliation
        center={position} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        
        <MapController pickupObj={pickupObj} dropObj={dropObj} driverCoords={driverCoords} />

        {/* Nearby Simulated Drivers (Only while searching) */}
        {searching && isValidCoord(pickupObj) && (
          <NearbyDrivers center={pickupObj} />
        )}

        {/* Pickup Pin */}
        {isValidCoord(pickupObj) && (
          <Marker position={[pickupObj.lat, pickupObj.lng]}>
            <Popup>Pickup: {pickupObj.address || 'Your location'}</Popup>
          </Marker>
        )}

        {/* Drop Pin */}
        {isValidCoord(dropObj) && (
          <Marker position={[dropObj.lat, dropObj.lng]}>
            <Popup>Drop: {dropObj.address}</Popup>
          </Marker>
        )}

        {/* Driver Pin */}
        {isValidCoord(animatedCoords) && (
          <Marker position={[animatedCoords.lat, animatedCoords.lng]} icon={driverIcon}>
            <Popup>Driver Tracking</Popup>
          </Marker>
        )}

        {/* Simulated Hotspots (Demand Areas) */}
        {!isValidCoord(pickupObj) && !isValidCoord(dropObj) && !searching && (
          <>
            <Circle center={[17.44, 78.38]} radius={800} pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.1, weight: 1 }} />
            <Circle center={[17.41, 78.45]} radius={1000} pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.1, weight: 1 }} />
            <Circle center={[17.43, 78.41]} radius={600} pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.1, weight: 1 }} />
          </>
        )}

        {/* Driver-to-Pickup Route */}
        {driverRoute && driverRoute.length > 1 ? (
          <Polyline 
            positions={driverRoute.filter(p => p && typeof p[0] === 'number' && !isNaN(p[0]) && isFinite(p[0]) && typeof p[1] === 'number' && !isNaN(p[1]) && isFinite(p[1]))} 
            color="#3b82f6" 
            weight={5} 
            opacity={0.8} 
          />
        ) : (isValidCoord(animatedCoords) && isValidCoord(pickupObj) && (
          <Polyline 
            positions={[
              [animatedCoords.lat, animatedCoords.lng] as [number, number], 
              [pickupObj.lat, pickupObj.lng] as [number, number]
            ].filter(p => p && typeof p[0] === 'number' && !isNaN(p[0]) && isFinite(p[0]) && typeof p[1] === 'number' && !isNaN(p[1]) && isFinite(p[1]))} 
            color="#3b82f6" 
            weight={3} 
            dashArray="5, 10" 
          />
        ))}

        {/* Pickup-to-Drop Route */}
        {tripRoute && tripRoute.length > 1 ? (
          <Polyline 
            positions={tripRoute.filter(p => p && typeof p[0] === 'number' && !isNaN(p[0]) && isFinite(p[0]) && typeof p[1] === 'number' && !isNaN(p[1]) && isFinite(p[1]))} 
            color="#10b981" 
            weight={6} 
            opacity={0.9} 
          />
        ) : (isValidCoord(pickupObj) && isValidCoord(dropObj) && (
          <Polyline 
            positions={[
              [pickupObj.lat, pickupObj.lng] as [number, number], 
              [dropObj.lat, dropObj.lng] as [number, number]
            ].filter(p => p && typeof p[0] === 'number' && !isNaN(p[0]) && isFinite(p[0]))} 
            color="#e11d48" 
            weight={4} 
            dashArray="10, 10" 
          />
        ))}
      </MapContainer>
    </div>
  );
});

export default InteractiveMap;
