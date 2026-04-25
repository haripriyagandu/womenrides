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
const isValidCoord = (obj: any) => obj && typeof obj.lat === 'number' && typeof obj.lng === 'number' && !isNaN(obj.lat) && !isNaN(obj.lng);

// 🛵 Simulated Driver Marker Component
function NearbyDrivers({ center }: { center: { lat: number, lng: number } }) {
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    // Generate initial ghost drivers near the pickup/center
    const initial = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      lat: center.lat + (Math.random() - 0.5) * 0.02,
      lng: center.lng + (Math.random() - 0.5) * 0.02,
      rotation: 0 // Set to 0 to prevent 'sleepy' look
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
      {drivers.map(d => (
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
    const points: [number, number][] = [];
    if (isValidCoord(driverCoords)) points.push([driverCoords.lat, driverCoords.lng]);
    if (isValidCoord(pickupObj)) points.push([pickupObj.lat, pickupObj.lng]);
    if (isValidCoord(dropObj)) points.push([dropObj.lat, dropObj.lng]);

    if (points.length > 0) {
      try {
        if (points.length === 1) {
          map.flyTo(points[0] as L.LatLngExpression, 15, { duration: 1.5 });
        } else {
          const bounds = L.latLngBounds(points as L.LatLngExpression[]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 1 });
        }
      } catch (e) {
        console.warn("Map animation failed safely:", e);
      }
    }
  }, [driverCoords, pickupObj, dropObj, map]);

  return null;
}

// 🗺️ Main Component
const InteractiveMap = memo(function InteractiveMap({ pickupObj, dropObj, driverCoords, searching }: MapProps) {
  const [position] = useState<[number, number]>([17.4065, 78.4772]); // Default Hyderabad
  const [animatedCoords, setAnimatedCoords] = useState<any>(driverCoords);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth Glide Animation for Driver
  useEffect(() => {
    if (!driverCoords) return;
    if (!animatedCoords) {
      setAnimatedCoords(driverCoords);
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
      
      setAnimatedCoords({ lat: currentLat, lng: currentLng });

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
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
        const data = await res.json();
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setter(coords);
        }
      } catch (e) { console.error("Routing error:", e); }
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
        {driverRoute ? (
          <Polyline positions={driverRoute} color="#3b82f6" weight={5} opacity={0.8} />
        ) : (isValidCoord(animatedCoords) && isValidCoord(pickupObj) && (
          <Polyline positions={[[animatedCoords.lat, animatedCoords.lng], [pickupObj.lat, pickupObj.lng]]} color="#3b82f6" weight={3} dashArray="5, 10" />
        ))}

        {/* Pickup-to-Drop Route */}
        {tripRoute ? (
          <Polyline positions={tripRoute} color="#e11d48" weight={5} opacity={0.8} />
        ) : (isValidCoord(pickupObj) && isValidCoord(dropObj) && (
          <Polyline positions={[[pickupObj.lat, pickupObj.lng], [dropObj.lat, dropObj.lng]]} color="#e11d48" weight={4} dashArray="10, 10" />
        ))}
      </MapContainer>
    </div>
  );
});

export default InteractiveMap;
