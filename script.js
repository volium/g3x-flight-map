// Initialize Leaflet map
const map = L.map("map").setView([39, -98], 4);

// Keep track of labeled airports
const labeledAirports = new Map(); // Map of airport code to label and connector info

// Label management
const BASE_MIN_LABEL_DISTANCE = 50; // Base minimum pixels between labels
const BASE_LABEL_MARGIN = 20; // Base margin around airport point for label placement
const MAX_PIXEL_DISTANCE = 100; // Maximum pixels away from airport
const MIN_ZOOM = 4; // Minimum zoom level for reference
const MAX_ZOOM = 12; // Maximum zoom level for reference

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

    // Start with default offset and spiral outward until no overlap
    let angle = 0;
    let radius = labelMargin;
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

// Find closest airport to given coordinates
function findNearestAirport(lat, lon) {
  let closest = null;
  let minDistance = Infinity;

  for (const [code, airport] of Object.entries(airports)) {
    const distance = getDistance(lat, lon, airport.lat, airport.lon);
    if (distance < minDistance) {
      minDistance = distance;
      closest = { code, ...airport, distance };
    }
  }

  // Only return airport if it's within 50km (roughly 30 miles)
  return closest && closest.distance <= 50 ? closest : null;
}

// Extract airport code from filename (expected format: log_YYYYMMDD_HHMMSS_ICAO.csv)
function extractAirportCode(filename) {
  const match = filename.match(/log_\d{8}_\d{6}_([A-Z0-9]{3,4})\.csv$/);
  return match ? match[1] : null;
}

// Verify airport code using coordinates
function verifyAirportCode(code, lat, lon) {
  const nearest = findNearestAirport(lat, lon);
  if (!nearest) return null;

  // If the filename's code matches one of the nearby airports, use it
  if (code && code === nearest.code) {
    return code;
  }

  // Otherwise use the nearest airport's code
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
            .addTo(map);

          // Add airport code label for departure if not already labeled
          if (!labeledAirports.has(departureAirport)) {
            const details = createAirportLabel(departureAirport, start, color);
            labeledAirports.set(departureAirport, details);
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
            .addTo(map);

          // Add airport code label for arrival if not already labeled
          if (!labeledAirports.has(arrivalAirport)) {
            const details = createAirportLabel(arrivalAirport, end, color);
            labeledAirports.set(arrivalAirport, details);
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
