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
