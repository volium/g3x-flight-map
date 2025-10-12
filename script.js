// Initialize Leaflet map
const map = L.map("map", {
  zoomDelta: 0.25,  // Allow fractional zoom levels
  zoomSnap: 0.25,   // Snap to 0.25 zoom level increments
  wheelDebounceTime: 100  // Smooth out wheel zooming
}).setView([39, -98], 4);

// Layer groups for different zoom level markers
const circleMarkersGroup = L.layerGroup();
const lowZoomMarkersGroup = L.layerGroup().addTo(map);

// Keep track of labeled airports and markers
const labeledAirports = new Map(); // Map of airport code to label and connector info
const airportMarkers = new Map(); // Map of airport code to low-zoom marker

// Label management
const BASE_MIN_LABEL_DISTANCE = 50; // Base minimum pixels between labels
const BASE_LABEL_MARGIN = 20; // Base margin around airport point for label placement
const MAX_PIXEL_DISTANCE = 100; // Maximum pixels away from airport
const MIN_ZOOM = 4; // Minimum zoom level for reference
const MAX_ZOOM = 12; // Maximum zoom level for reference
const CIRCLE_MARKER_MIN_ZOOM = 13; // Minimum zoom level to show circle markers

// Function to create or get a low zoom marker for an airport
function createLowZoomMarker(airport, position, color) {
    if (airportMarkers.has(airport)) {
        return airportMarkers.get(airport);
    }

    const marker = L.marker(position, {
        icon: L.divIcon({
            className: 'airport-marker',
            html: `<div style="width: 8px; height: 8px; background-color: white; border: 2px solid ${color}; border-radius: 50%;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).bindPopup(`<b>${airport}</b>`);

    airportMarkers.set(airport, marker);
    return marker;
}

// Handle marker visibility based on zoom
map.on('zoomend', () => {
    const zoom = map.getZoom();
    if (zoom >= CIRCLE_MARKER_MIN_ZOOM) {
        circleMarkersGroup.addTo(map);
        lowZoomMarkersGroup.remove();
    } else {
        circleMarkersGroup.remove();
        lowZoomMarkersGroup.addTo(map);
    }
});

// Get zoom-adjusted distances
function getZoomAdjustedValues(zoom) {
    const zoomFactor = Math.max(0.3, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM));
    return {
        labelDistance: BASE_MIN_LABEL_DISTANCE * (1 - zoomFactor * 0.7), // Reduce distance at higher zooms
        labelMargin: BASE_LABEL_MARGIN * (1 - zoomFactor * 0.7)
    };
}

// Function to find non-overlapping position for label
function adjustLabelPosition(airport, position, existingLabels) {
    const zoom = map.getZoom();
    const { labelDistance, labelMargin } = getZoomAdjustedValues(zoom);
    const point = map.latLngToContainerPoint(position);

    // Fixed minimum offset from marker (20 pixels)
    const minOffset = 20;

    // Define preferred positions to try (in order: up, down, left, right, then diagonals)
    const positions = [
        { angle: Math.PI / 2, radius: minOffset },      // above
        { angle: -Math.PI / 2, radius: minOffset },     // below
        { angle: Math.PI, radius: minOffset },          // left
        { angle: 0, radius: minOffset },                // right
        { angle: Math.PI / 4, radius: minOffset },      // top-right
        { angle: -Math.PI / 4, radius: minOffset },     // bottom-right
        { angle: 3 * Math.PI / 4, radius: minOffset },  // top-left
        { angle: -3 * Math.PI / 4, radius: minOffset }  // bottom-left
    ];

    // Try each preferred position first
    for (const pos of positions) {
        const x = pos.radius * Math.cos(pos.angle);
        const y = pos.radius * Math.sin(pos.angle);
        const testPoint = point.add(L.point(x, y));
        const newPos = map.containerPointToLatLng(testPoint);

        // Check for overlaps
        let hasOverlap = false;
        for (const [code, details] of existingLabels) {
            if (code === airport) continue;
            const labelPoint = map.latLngToContainerPoint(details.labelPosition);
            if (testPoint.distanceTo(labelPoint) < labelDistance) {
                hasOverlap = true;
                break;
            }
        }

        if (!hasOverlap) {
            return newPos;
        }
    }

    // If preferred positions don't work, spiral outward from minimum offset
    let angle = 0;
    let radius = minOffset;
    const maxAttempts = 32; // Limit search iterations

    for (let i = 0; i < maxAttempts; i++) {
        // Calculate new position in spiral pattern
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const testPoint = point.add(L.point(x, y));

        // Check if we've gone too far from the airport
        if (testPoint.distanceTo(point) > MAX_PIXEL_DISTANCE) {
            break; // Stop searching if we're too far
        }

        // Convert back to LatLng for actual placement
        const newPos = map.containerPointToLatLng(testPoint);

        // Check for overlaps
        let hasOverlap = false;
        for (const [code, details] of existingLabels) {
            if (code === airport) continue;
            const labelPoint = map.latLngToContainerPoint(details.labelPosition);
            const distance = testPoint.distanceTo(labelPoint);
            if (distance < labelDistance) {
                hasOverlap = true;
                break;
            }
        }

        if (!hasOverlap) {
            return newPos;
        }

        // Spiral outward
        angle += Math.PI / 4;
        if (angle >= Math.PI * 2) {
            angle = 0;
            radius += labelMargin;
        }
    }

    // If no good position found, place it at maximum allowed distance
    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackX = MAX_PIXEL_DISTANCE * Math.cos(fallbackAngle);
    const fallbackY = MAX_PIXEL_DISTANCE * Math.sin(fallbackAngle);
    return map.containerPointToLatLng(point.add(L.point(fallbackX, fallbackY)));
}

// Create airport label with connector line if needed
function createAirportLabel(airport, position, color) {
    const adjustedPosition = adjustLabelPosition(airport, position, labeledAirports);

    // Create label
    const label = L.marker(adjustedPosition, {
        icon: L.divIcon({
            className: 'airport-label',
            html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">${airport}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10]
        })
    }).addTo(map);

    // Create connector line if label was moved
    let connector = null;
    if (adjustedPosition.lat !== position.lat || adjustedPosition.lng !== position.lng) {
        connector = L.polyline([position, adjustedPosition], {
            color: color,
            weight: 1,
            opacity: 0.5,
            dashArray: '3,3'
        }).addTo(map);
    }

    return {
        label,
        connector,
        position: position,
        labelPosition: adjustedPosition,
        color: color
    };
}

// Esri World Imagery basemap (legal, free, beautiful)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
    maxZoom: 18,
  }
).addTo(map);

// Set initial visibility of circle markers based on zoom level
if (map.getZoom() >= CIRCLE_MARKER_MIN_ZOOM) {
    circleMarkersGroup.addTo(map);
}

const colors = [
  "#ff0000",
  "#ff8800",
  "#ffaa00",
  "#00aaff",
  "#00cc66",
  "#cc00ff",
  "#ff0099",
  "#0055ff",
];
let colorIndex = 0;

// Calculate distance between two points using Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find closest airport to given coordinates with type priority
function findNearestAirport(lat, lon) {
  let closest = null;
  let minDistance = Infinity;

  // Airport type priority (higher = better)
  const typePriority = {
    'closed': -1,
    'heliport': 0,
    'seaplane_base': 1,
    'small_airport': 2,
    'medium_airport': 3,
    'large_airport': 3  // Make equal to medium_airport to not override closer airports
  };

  console.log(`Searching for airports near lat: ${lat}, lon: ${lon}`);

  // Keep track of all nearby airports for debugging
  const nearbyAirports = [];

  // First pass: find all airports within 1km
  const closeAirports = [];

  for (const [code, airport] of Object.entries(airports)) {
    const distance = getDistance(lat, lon, airport.lat, airport.lon);

    // Collect all airports within 50km for debugging
    if (distance <= 50) {
      nearbyAirports.push({
        code,
        ...airport,
        distance,
        priority: typePriority[airport.type] || 0
      });
    }

    const currentPriority = typePriority[airport.type] || 0;
    const closestPriority = closest ? typePriority[closest.type] || 0 : -1;

    // Keep track of all airports within 50km for debugging
    if (distance <= 50) {
      nearbyAirports.push({
        code,
        ...airport,
        distance,
        priority: typePriority[airport.type] || 0
      });
    }

    // Track all airports within 1km
    if (distance <= 1) {
      closeAirports.push({
        code,
        ...airport,
        distance,
        priority: typePriority[airport.type] || 0
      });
    }

    // If we don't have any close airports (<1km), use normal distance and priority logic
    if (closeAirports.length === 0) {
      const currentPriority = typePriority[airport.type] || 0;
      const closestPriority = closest ? typePriority[closest.type] || 0 : -1;

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

// Extract airport code from filename (expected format: log_YYYYMMDD_HHMMSS_ICAO.csv)
function extractAirportCode(filename) {
  const match = filename.match(/log_\d{8}_\d{6}_([A-Z0-9]{3,4})\.csv$/);
  return match ? match[1] : null;
}

// Verify airport code using coordinates
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

// Handle file uploads
document.getElementById("file-input").addEventListener("change", (event) => {
  const files = Array.from(event.target.files);
  files.sort((a, b) => a.name.localeCompare(b.name)); // chronological order
  lastFlight = null; // Reset on new file upload
  // Clear and remove all existing labels and connectors
  labeledAirports.forEach((details) => {
    if (details.label) {
      details.label.remove();
    }
    if (details.connector) {
      details.connector.remove();
    }
  });
  labeledAirports.clear();

  // Clear low zoom markers
  airportMarkers.forEach(marker => marker.remove());
  airportMarkers.clear();

  // Add handler for zoom changes to update label positions
  map.on('zoomend', () => {
    // Store existing airports and clear the map
    const existingAirports = Array.from(labeledAirports.entries());
    labeledAirports.forEach((details) => {
      if (details.label) details.label.remove();
      if (details.connector) details.connector.remove();
    });
    labeledAirports.clear();

    // Recreate labels with new positions
    existingAirports.forEach(([code, details]) => {
      const newDetails = createAirportLabel(code, details.position, details.color);
      labeledAirports.set(code, newDetails);
    });
  });
  files.forEach((file, index) => processFile(file, index === 0, index === files.length - 1));
});

function processFile(file, isFirst, isLast) {
  const reader = new FileReader();
  reader.onload = function (e) {
    // Split lines and find the correct header row (third line)
    const lines = e.target.result.split(/\r?\n/);
    // Remove comment and extra header lines
    const dataLines = lines.filter(
      (line, idx) => idx === 2 || idx > 2
    );
    // Reconstruct CSV string with correct header
    const cleanedCSV = dataLines.join("\n");
    Papa.parse(cleanedCSV, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        // Some files use 'Latitude'/'Longitude', not 'latitude'/'longitude'
        const data = results.data.filter(
          (row) =>
            (row.Latitude && row.Longitude) ||
            (row.latitude && row.longitude)
        );
        if (data.length === 0) return;

        // Use correct keys
        const latlngs = data.map((row) => [
          row.Latitude || row.latitude,
          row.Longitude || row.longitude,
        ]);

        const color = colors[colorIndex++ % colors.length];
        const start = latlngs[0];
        const end = latlngs[latlngs.length - 1];

        // Get and verify departure airport code
        const suggestedCode = extractAirportCode(file.name);
        const departureAirport = verifyAirportCode(suggestedCode, start[0], start[1]);

        // Find arrival airport code
        const arrivalAirport = findNearestAirport(end[0], end[1])?.code;

        // Draw flight path
        const polyline = L.polyline(latlngs, {
          color: color,
          weight: 3,
          opacity: 0.9,
        }).addTo(map);

        // Add arrow decorations to show flight direction
        L.polylineDecorator(polyline, {
          patterns: [
            {
              offset: 25, // Start 25% along the path
              repeat: 50, // Repeat every 50 pixels
              symbol: L.Symbol.arrowHead({
                pixelSize: 12,
                polygon: false,
                pathOptions: {
                  color: color,
                  fillOpacity: 1,
                  weight: 2
                }
              })
            }
          ]
        }).addTo(map);

        // Add departure airport marker and label
        if (departureAirport) {
          const startMarker = L.circleMarker(start, {
            radius: 6,
            color: color,
            fillColor: "white",
            fillOpacity: 1,
          })
            .bindPopup(`<b>${departureAirport}</b><br>Departure ${file.name}`)
            .addTo(circleMarkersGroup);

          // Add airport code label for departure if not already labeled
          if (!labeledAirports.has(departureAirport)) {
            // Use airport coordinates from airports database for label placement
            const airportData = airports[departureAirport];
            if (airportData) {
              const airportPos = [airportData.lat, airportData.lon];
              const details = createAirportLabel(departureAirport, airportPos, color);
              labeledAirports.set(departureAirport, details);

              // Add low-zoom marker
              const lowZoomMarker = createLowZoomMarker(departureAirport, airportPos, color);
              lowZoomMarker.addTo(lowZoomMarkersGroup);
            }
          }
        }

        // Add arrival marker and label if we found an airport
        if (arrivalAirport) {
          const endMarker = L.circleMarker(end, {
            radius: 6,
            color: color,
            fillColor: "white",
            fillOpacity: 0.9,
          })
            .bindPopup(`<b>${arrivalAirport}</b><br>Arrival`)
            .addTo(circleMarkersGroup);

          // Add airport code label for arrival if not already labeled
          if (!labeledAirports.has(arrivalAirport)) {
            // Use airport coordinates from airports database for label placement
            const airportData = airports[arrivalAirport];
            if (airportData) {
              const airportPos = [airportData.lat, airportData.lon];
              const details = createAirportLabel(arrivalAirport, airportPos, color);
              labeledAirports.set(arrivalAirport, details);

              // Add low-zoom marker
              const lowZoomMarker = createLowZoomMarker(arrivalAirport, airportPos, color);
              lowZoomMarker.addTo(lowZoomMarkersGroup);
            }
          }
        }

        // Add polyline popup
        polyline.bindPopup(`<b>${file.name}</b>`);

        // If we have both airports, add connecting label
        if (departureAirport && arrivalAirport && departureAirport !== arrivalAirport) {
          // Calculate midpoint between departure and arrival
          const midLat = (start[0] + end[0]) / 2;
          const midLng = (start[1] + end[1]) / 2;

          // Add connection label at midpoint
          L.marker([midLat, midLng], {
            icon: L.divIcon({
              className: 'airport-label',
              html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">
                ${departureAirport} → ${arrivalAirport}
              </div>`,
              iconSize: [80, 20],
              iconAnchor: [40, 10]
            })
          }).addTo(map);
        }

        // Update last flight info
        lastFlight = {
          airport: arrivalAirport,
          end: end
        };

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      },
    });
  };
  reader.readAsText(file);
}
