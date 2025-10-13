/**
 * Airport finding and verification logic
 */

/**
 * Find closest airport to given coordinates with type priority
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object|null} Closest airport object or null
 */
function findNearestAirport(lat, lon) {
  let closest = null;
  let minDistance = Infinity;

  console.log(`Searching for airports near lat: ${lat}, lon: ${lon}`);

  // Keep track of all nearby airports for debugging
  const nearbyAirports = [];

  // First pass: find all airports within 1km
  const closeAirports = [];

  for (const [code, airport] of Object.entries(airports)) {
    const distance = getDistance(lat, lon, airport.lat, airport.lon);

    const currentPriority = AIRPORT_TYPE_PRIORITY[airport.type] || 0;
    const closestPriority = closest ? AIRPORT_TYPE_PRIORITY[closest.type] || 0 : -1;

    // Keep track of all airports within 50km for debugging
    if (distance <= 50) {
      nearbyAirports.push({
        code,
        ...airport,
        distance,
        priority: AIRPORT_TYPE_PRIORITY[airport.type] || 0
      });
    }

    // Track all airports within 1km
    if (distance <= 1) {
      closeAirports.push({
        code,
        ...airport,
        distance,
        priority: AIRPORT_TYPE_PRIORITY[airport.type] || 0
      });
    }

    // If we don't have any close airports (<1km), use normal distance and priority logic
    if (closeAirports.length === 0) {
      const currentPriority = AIRPORT_TYPE_PRIORITY[airport.type] || 0;
      const closestPriority = closest ? AIRPORT_TYPE_PRIORITY[closest.type] || 0 : -1;

      // Update closest if:
      // 1. No airport found yet, or
      // 2. This airport type has higher priority, or
      // 3. Same priority but closer distance
      if (!closest ||
          currentPriority > closestPriority ||
          (currentPriority === closestPriority && distance < minDistance)) {
        console.log(`New closest airport: ${code} (${airport.type || 'unknown type'}) at ${distance.toFixed(2)}km` +
                    `${closest ? ` replacing ${closest.code}` : ''}`);
        minDistance = distance;
        closest = { code, ...airport, distance };
      }
    }
  }

  // If we have airports within 1km, pick the one with highest priority
  if (closeAirports.length > 0) {
    console.log(`Found ${closeAirports.length} airports within 1km`);

    // Sort by type priority first, then by distance
    closeAirports.sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      return priorityDiff !== 0 ? priorityDiff : a.distance - b.distance;
    });

    closest = closeAirports[0];
    console.log(`Selected closest airport ${closest.code} (${closest.type || 'unknown type'}) at ${closest.distance.toFixed(2)}km`);
  }

  // Always log nearby airports for debugging
  if (nearbyAirports.length > 0) {
    console.log('All nearby airports:',
      nearbyAirports
        .sort((a, b) => a.distance - b.distance)
        .map(a => ({
          code: a.code,
          name: a.name,
          type: a.type || 'unknown',
          priority: a.priority,
          distance: a.distance.toFixed(2) + 'km'
        }))
    );
  } else {
    console.log('No airports found within 50km');
  }

  // Ensure we have the type information
  if (closest && !closest.type) {
    console.warn('Missing type information for airport:', closest.code);
  }

  return closest;
}

/**
 * Verify airport code using coordinates
 * @param {string} code - Suggested airport code
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string|null} Verified airport code
 */
function verifyAirportCode(code, lat, lon) {
  console.log(`\nVerifying airport code: ${code} at position ${lat}, ${lon}`);

  const nearest = findNearestAirport(lat, lon);
  if (!nearest) {
    console.log('No nearby airport found');
    return null;
  }

  // Debug logging
  console.log('Nearest airport found:', {
    code: nearest.code,
    name: nearest.name,
    type: nearest.type || 'unknown',
    distance: nearest.distance.toFixed(2) + 'km'
  });

  // If the filename's code matches one of the nearby airports, use it
  if (code && code === nearest.code) {
    console.log(`Using suggested code: ${code} (matches nearest airport)`);
    return code;
  }

  // Otherwise use the nearest airport's code
  console.log(`Using nearest airport code: ${nearest.code} (suggested code ${code || 'not provided'} didn't match)`);
  return nearest.code;
}
