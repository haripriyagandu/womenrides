export const getEstimatedClockTime = (minutesToAdd: number, startTime?: Date | string): string => {
  const start = startTime ? new Date(startTime) : new Date();
  const estimatedDate = new Date(start.getTime() + minutesToAdd * 60000);
  
  return estimatedDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

/**
 * Calculates distance between two points in KM
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

/**
 * Estimates travel time in minutes based on distance
 * Assuming average city speed 15 km/h -> 4 mins per km
 */
export const estimateMinutes = (distanceKm: number): number => {
  return Math.max(1, Math.round(distanceKm * 4));
};
