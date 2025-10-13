/**
 * Intermediate stop detection algorithm
 */

/**
 * Detect intermediate stops in flight data
 * @param {Array} data - Flight data array
 * @param {number} aglThreshold - AGL threshold in feet
 * @param {number} speedThreshold - Ground speed threshold in knots
 * @returns {Array} Array of intermediate stop objects
 */
function detectIntermediateStops(data, aglThreshold, speedThreshold) {
  const intermediateStops = [];
  const visitedAirports = new Set();

  let inLowSlowZone = false;
  let lowSlowStartIdx = -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const agl = row.AGL !== undefined ? row.AGL : Infinity;
    const groundSpeed = row.GndSpd !== undefined ? row.GndSpd : Infinity;
    const lat = row.Latitude || row.latitude;
    const lon = row.Longitude || row.longitude;

    // Check if aircraft meets criteria (low AND/OR slow)
    const isLowAndSlow = (agl <= aglThreshold) || (groundSpeed <= speedThreshold);

    if (isLowAndSlow && !inLowSlowZone) {
      // Entering low/slow zone
      inLowSlowZone = true;
      lowSlowStartIdx = i;
    } else if (!isLowAndSlow && inLowSlowZone) {
      // Exiting low/slow zone - this was a potential landing
      inLowSlowZone = false;

      // Find midpoint of the low/slow zone
      const midIdx = Math.floor((lowSlowStartIdx + i) / 2);
      const midRow = data[midIdx];
      const midLat = midRow.Latitude || midRow.latitude;
      const midLon = midRow.Longitude || midRow.longitude;

      // Find nearest airport
      const nearest = findNearestAirport(midLat, midLon);

      if (nearest && !visitedAirports.has(nearest.code)) {
        // Check if this airport is too close to an already-detected stop
        // If so, keep only the higher priority one
        let shouldAdd = true;
        let replaceIdx = -1;

        for (let j = 0; j < intermediateStops.length; j++) {
          const existingStop = intermediateStops[j];
          const distanceBetweenAirports = getDistance(
            nearest.lat, nearest.lon,
            existingStop.airportLat, existingStop.airportLon
          );

          // If airports are within PROXIMITY_THRESHOLD_KM of each other, consider them the same landing
          if (distanceBetweenAirports < PROXIMITY_THRESHOLD_KM) {
            const existingAirportData = airports[existingStop.airport];
            const existingPriority = AIRPORT_TYPE_PRIORITY[existingAirportData?.type] || 0;
            const newPriority = AIRPORT_TYPE_PRIORITY[nearest.type] || 0;

            console.log(`Found nearby airports: ${existingStop.airport} and ${nearest.code} (${distanceBetweenAirports.toFixed(2)}km apart)`);

            // Keep the one with higher priority, or if same priority, keep the closer one to midpoint
            if (newPriority > existingPriority) {
              console.log(`Replacing ${existingStop.airport} with ${nearest.code} (higher priority: ${newPriority} > ${existingPriority})`);
              replaceIdx = j;
              shouldAdd = false;
              break;
            } else if (newPriority === existingPriority) {
              const existingDistance = getDistance(midLat, midLon, existingStop.airportLat, existingStop.airportLon);
              const newDistance = getDistance(midLat, midLon, nearest.lat, nearest.lon);

              if (newDistance < existingDistance) {
                console.log(`Replacing ${existingStop.airport} with ${nearest.code} (closer to landing point: ${newDistance.toFixed(2)}km < ${existingDistance.toFixed(2)}km)`);
                replaceIdx = j;
                shouldAdd = false;
                break;
              } else {
                console.log(`Keeping ${existingStop.airport} over ${nearest.code} (already have closer airport)`);
                shouldAdd = false;
                break;
              }
            } else {
              console.log(`Keeping ${existingStop.airport} over ${nearest.code} (higher priority: ${existingPriority} > ${newPriority})`);
              shouldAdd = false;
              break;
            }
          }
        }

        if (replaceIdx >= 0) {
          // Replace the existing stop with the new one
          const oldCode = intermediateStops[replaceIdx].airport;
          visitedAirports.delete(oldCode);
          intermediateStops[replaceIdx] = {
            airport: nearest.code,
            lat: midLat,
            lon: midLon,
            airportLat: nearest.lat,
            airportLon: nearest.lon
          };
          visitedAirports.add(nearest.code);
        } else if (shouldAdd) {
          intermediateStops.push({
            airport: nearest.code,
            lat: midLat,
            lon: midLon,
            airportLat: nearest.lat,
            airportLon: nearest.lon
          });
          visitedAirports.add(nearest.code);
        }
      }
    }
  }

  return intermediateStops;
}
