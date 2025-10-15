/**
 * Utility functions for calculations and conversions
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
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

/**
 * Extract airport code from filename (expected format: log_YYYYMMDD_HHMMSS_ICAO.csv)
 * @param {string} filename - The filename to parse
 * @returns {string|null} Airport code or null if not found
 */
function extractAirportCode(filename) {
  const match = filename.match(/log_\d{8}_\d{6}_([A-Z0-9]{3,4})\.csv$/);
  return match ? match[1] : null;
}

/**
 * Get zoom-adjusted distances for label positioning
 * @param {number} zoom - Current zoom level
 * @returns {Object} Object with labelDistance and labelMargin
 */
function getZoomAdjustedValues(zoom) {
  const zoomFactor = Math.max(0.3, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM));
  return {
    labelDistance: BASE_MIN_LABEL_DISTANCE * (1 - zoomFactor * 0.7),
    labelMargin: BASE_LABEL_MARGIN * (1 - zoomFactor * 0.7)
  };
}

/**
 * Show loading message overlay
 * @param {string} message - Message to display
 */
function showLoadingMessage(message) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-size: 18px;
      font-weight: bold;
    `;
    document.body.appendChild(overlay);
  }
  overlay.textContent = message;
  overlay.style.display = 'flex';
}

/**
 * Hide loading message overlay
 */
function hideLoadingMessage() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Show progress indicator
 * @param {number} current - Current file number
 * @param {number} total - Total number of files
 * @param {string} message - Status message
 */
function showProgress(current, total, message) {
  const container = document.getElementById('progress-container');
  const text = document.getElementById('progress-text');
  const bar = document.getElementById('progress-bar');

  if (!container || !text || !bar) return;

  const percentage = Math.round((current / total) * 100);

  container.style.display = 'block';
  text.textContent = message || `Processing file ${current} of ${total}`;
  bar.style.width = `${percentage}%`;

  // Only show percentage if greater than 0
  if (percentage > 0) {
    bar.textContent = `${percentage}%`;
  } else {
    bar.textContent = '';
  }
}

/**
 * Hide progress indicator
 */
function hideProgress() {
  const container = document.getElementById('progress-container');
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Update progress with custom message
 * @param {string} message - Custom message to display
 */
function updateProgressMessage(message) {
  const text = document.getElementById('progress-text');
  if (text) {
    text.textContent = message;
  }
}

/**
 * Calculate perpendicular distance from a point to a line segment
 * @param {Array} point - [lat, lon] point
 * @param {Array} lineStart - [lat, lon] line start point
 * @param {Array} lineEnd - [lat, lon] line end point
 * @returns {number} Distance in kilometers
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // If the line segment is actually a point
  if (dx === 0 && dy === 0) {
    return getDistance(px, py, x1, y1);
  }

  // Calculate the parameter t that represents the projection of point onto the line
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

  // Find the closest point on the line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  // Return distance from point to closest point on line
  return getDistance(px, py, closestX, closestY);
}

/**
 * Ramer-Douglas-Peucker algorithm for polyline simplification
 * Reduces the number of points in a polyline while maintaining visual accuracy
 * @param {Array} points - Array of [lat, lon] coordinate pairs
 * @param {number} epsilon - Tolerance in kilometers (smaller = more detail)
 * @returns {Array} Simplified array of [lat, lon] coordinate pairs
 */
function simplifyPolyline(points, epsilon) {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call on both segments
    const leftSegment = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon);
    const rightSegment = simplifyPolyline(points.slice(maxIndex), epsilon);

    // Combine results, removing duplicate middle point
    return leftSegment.slice(0, -1).concat(rightSegment);
  } else {
    // Max distance is less than epsilon, so we can approximate with just the endpoints
    return [points[0], points[end]];
  }
}

/**
 * Apply gradient colors to polyline segments (time-based coloring)
 * @param {L.Polyline} polyline - The polyline to apply gradient to
 * @param {Array} latlngs - Array of [lat, lon] coordinates
 * @returns {Array} Array of created gradient segment polylines
 */
function applyGradientToPolyline(polyline, latlngs) {
  // Remove the original polyline from map
  polyline.remove();

  const segments = []; // Track all created segments

  // Create multiple small segments with gradient colors
  const segmentCount = Math.min(latlngs.length - 1, 100); // Limit to 100 segments for performance
  const step = Math.max(1, Math.floor((latlngs.length - 1) / segmentCount));

  // Define gradient colors (green → yellow → red)
  const startColor = [0, 180, 100];   // Green (RGB)
  const midColor = [255, 200, 0];     // Yellow
  const endColor = [255, 50, 50];     // Red

  for (let i = 0; i < latlngs.length - step; i += step) {
    const segmentStart = i;
    const segmentEnd = Math.min(i + step, latlngs.length - 1);
    const segment = latlngs.slice(segmentStart, segmentEnd + 1);

    // Calculate color for this segment (interpolate through gradient)
    const progress = i / (latlngs.length - 1);
    const color = interpolateGradientColor(progress, startColor, midColor, endColor);
    const colorHex = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

    // Create segment with gradient color using zoom-adaptive width
    const currentZoom = map.getZoom();
    const trackWidth = getZoomAdaptiveTrackWidth(currentZoom);

    const segmentPolyline = L.polyline(segment, {
      color: colorHex,
      weight: trackWidth,
      opacity: TRACK_STYLE.opacity,
      smoothFactor: TRACK_STYLE.smoothFactor,
      lineCap: TRACK_STYLE.lineCap,
      lineJoin: TRACK_STYLE.lineJoin
    }).addTo(map);

    segments.push(segmentPolyline); // Track this segment
  }

  return segments; // Return all created segments
}

/**
 * Apply global gradient colors across all flights
 * @param {L.Polyline} polyline - The polyline to apply gradient to
 * @param {Array} latlngs - Array of [lat, lon] coordinates
 * @param {number} cumulativePointsBefore - Number of points in all previous flights
 * @param {number} totalPointsAllFlights - Total points across all flights
 * @returns {Array} Array of created gradient segment polylines
 */
function applyGlobalGradientToPolyline(polyline, latlngs, cumulativePointsBefore, totalPointsAllFlights) {
  // Remove the original polyline from map
  polyline.remove();

  const segments = []; // Track all created segments

  // Create multiple small segments with gradient colors
  const segmentCount = Math.min(latlngs.length - 1, 100); // Limit to 100 segments for performance
  const step = Math.max(1, Math.floor((latlngs.length - 1) / segmentCount));

  // Define gradient colors (green → yellow → red)
  const startColor = [0, 180, 100];   // Green (RGB)
  const midColor = [255, 200, 0];     // Yellow
  const endColor = [255, 50, 50];     // Red

  for (let i = 0; i < latlngs.length - step; i += step) {
    const segmentStart = i;
    const segmentEnd = Math.min(i + step, latlngs.length - 1);
    const segment = latlngs.slice(segmentStart, segmentEnd + 1);

    // Calculate progress based on position in ALL flights
    const globalPointIndex = cumulativePointsBefore + i;
    const progress = globalPointIndex / (totalPointsAllFlights - 1);

    const color = interpolateGradientColor(progress, startColor, midColor, endColor);
    const colorHex = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

    // Create segment with gradient color using zoom-adaptive width
    const currentZoom = map.getZoom();
    const trackWidth = getZoomAdaptiveTrackWidth(currentZoom);

    const segmentPolyline = L.polyline(segment, {
      color: colorHex,
      weight: trackWidth,
      opacity: TRACK_STYLE.opacity,
      smoothFactor: TRACK_STYLE.smoothFactor,
      lineCap: TRACK_STYLE.lineCap,
      lineJoin: TRACK_STYLE.lineJoin
    }).addTo(map);

    segments.push(segmentPolyline); // Track this segment
  }

  return segments; // Return all created segments
}

/**
 * Interpolate color in a 3-point gradient
 * @param {number} progress - Progress value (0 to 1)
 * @param {Array} startColor - RGB array for start
 * @param {Array} midColor - RGB array for midpoint
 * @param {Array} endColor - RGB array for end
 * @returns {Array} RGB color array
 */
function interpolateGradientColor(progress, startColor, midColor, endColor) {
  if (progress < 0.5) {
    // Interpolate between start and mid
    const t = progress * 2;
    return [
      Math.round(startColor[0] + (midColor[0] - startColor[0]) * t),
      Math.round(startColor[1] + (midColor[1] - startColor[1]) * t),
      Math.round(startColor[2] + (midColor[2] - startColor[2]) * t)
    ];
  } else {
    // Interpolate between mid and end
    const t = (progress - 0.5) * 2;
    return [
      Math.round(midColor[0] + (endColor[0] - midColor[0]) * t),
      Math.round(midColor[1] + (endColor[1] - midColor[1]) * t),
      Math.round(midColor[2] + (endColor[2] - midColor[2]) * t)
    ];
  }
}

/**
 * Get zoom-adaptive arrow configuration
 * Arrows become smaller and less obtrusive at low zoom, larger and more visible at high zoom
 * @param {number} zoom - Current map zoom level
 * @returns {Object} Configuration object with spacing, size, and weight
 */
function getZoomAdaptiveArrowConfig(zoom) {
  // Arrow spacing (pixels between arrows)
  let spacing;
  if (zoom < 7) spacing = 100;
  else if (zoom < 10) spacing = 200;
  else if (zoom < 13) spacing = 400;
  else spacing = 600;

  // Arrow size (scales with zoom - smaller at low zoom, larger at high zoom)
  let size;
  if (zoom < 7) size = 8;       // Very small at low zoom (was 16)
  else if (zoom < 10) size = 11; // Small at medium-low zoom
  else if (zoom < 13) size = 14; // Medium at medium-high zoom
  else size = 17;                 // Larger at high zoom

  // Outline weight (thinner throughout, especially at low zoom)
  let weight;
  if (zoom < 7) weight = 1;      // Very thin at low zoom (was 3)
  else if (zoom < 10) weight = 1.5; // Thin at medium-low zoom
  else if (zoom < 13) weight = 2; // Medium at medium-high zoom
  else weight = 2;                // Medium at high zoom (was 3)

  return { spacing, size, weight };
}

/**
 * Get zoom-adaptive track width
 * Tracks become thinner at low zoom for cleaner overview, thicker at high zoom for detail
 * @param {number} zoom - Current map zoom level
 * @returns {number} Track width in pixels
 */
function getZoomAdaptiveTrackWidth(zoom) {
  // Track width scales with zoom level (adjusted for thinner appearance)
  if (zoom < 7) return 2;        // Thin at very low zoom (continental view)
  else if (zoom < 10) return 2;  // Keep thin at low-medium zoom (multi-state)
  else if (zoom < 13) return 3;  // Medium-thin at medium-high zoom (state view)
  else return 3;                  // Medium-thin at high zoom (local/airport view)
}
