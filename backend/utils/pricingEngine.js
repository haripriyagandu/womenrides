/**
 * Calculates road distance using OSRM API
 */
async function getRoadDistance(lat1, lon1, lat2, lon2) {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const distanceKm = data.routes[0].distance / 1000;
      return Number(distanceKm.toFixed(2));
    }
    return getStraightLineDistance(lat1, lon1, lat2, lon2);
  } catch (error) {
    return getStraightLineDistance(lat1, lon1, lat2, lon2);
  }
}

function getStraightLineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Standard Bike Taxi Pricing (Rapido Style)
 */
const calculateFare = async ({ pickupLat, pickupLng, dropLat, dropLng, trafficLevel, demandLevel, rideMultiplier = 1.0 }) => {
  let distanceKm = 0;
  if(pickupLat && dropLat) {
      distanceKm = await getRoadDistance(pickupLat, pickupLng, dropLat, dropLng);
      if (distanceKm < 1) distanceKm = 1.5;
  } else {
      distanceKm = 5; 
  }

  // 1. Base Fare (Covers first 2.0 km)
  const baseFareIncludedKm = 2.0;
  const baseFare = 30 * rideMultiplier;

  // 2. Distance Cost (Only for km above 2.0)
  let distanceCost = 0;
  if (distanceKm > baseFareIncludedKm) {
    distanceCost = (distanceKm - baseFareIncludedKm) * 8 * rideMultiplier;
  }

  // 3. Time Cost (Traffic)
  let timeMin = distanceKm * 2.5;
  let trafficMultiplier = 1.0;
  if (trafficLevel === 'medium') trafficMultiplier = 1.1;
  if (trafficLevel === 'high') trafficMultiplier = 1.25;
  const timeCost = (timeMin * trafficMultiplier) * 0.5 * rideMultiplier;

  // 4. Surge Pricing
  let surgeMultiplier = 1.0;
  if (demandLevel === 'medium') surgeMultiplier = 1.1;
  if (demandLevel === 'high') surgeMultiplier = 1.2;

  const totalRaw = baseFare + distanceCost + timeCost;
  let finalFare = Math.round(totalRaw * surgeMultiplier);
  
  // Enforce Minimum Fare
  if (finalFare < 30) finalFare = 30;

  return {
    finalFare,
    tripDurationMin: Math.round(timeMin * trafficMultiplier),
    pickupEtaMin: Math.floor(Math.random() * 4) + 2,
    distanceKm,
    breakdown: {
      baseFare: Math.round(baseFare),
      distanceCost: Math.round(distanceCost),
      timeCost: Math.round(timeCost),
      surgeMultiplier,
      trafficLevel,
      demandLevel
    }
  };
};

module.exports = { calculateFare, getStraightLineDistance };
