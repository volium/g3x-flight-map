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
