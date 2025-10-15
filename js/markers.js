/**
 * Marker creation and management
 */

// Track if marker visibility handler has been set up
let markerVisibilityHandlerSetup = false;

/**
 * Create or get a low zoom marker for an airport
 * @param {string} airport - Airport code
 * @param {Array} position - [lat, lon] position array
 * @param {string} color - Marker color
 * @param {string|null} label - Optional label text for popup
 * @returns {L.Marker} Leaflet marker object
 */
function createLowZoomMarker(airport, position, color, label = null) {
  const markerKey = label ? `${airport}_${label}` : airport;

  if (airportMarkers.has(markerKey)) {
    return airportMarkers.get(markerKey);
  }

  const popupText = label ? `<b>${airport}</b><br>${label}` : `<b>${airport}</b>`;

  const marker = L.marker(position, {
    icon: L.divIcon({
      className: 'airport-marker',
      html: `<div style="width: 8px; height: 8px; background-color: white; border: 2px solid ${color}; border-radius: 50%;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })
  }).bindPopup(popupText);

  airportMarkers.set(markerKey, marker);
  return marker;
}

/**
 * Setup zoom-based marker visibility handler
 */
function setupMarkerVisibilityHandler() {
  // Only setup once to avoid duplicate handlers
  if (markerVisibilityHandlerSetup) {
    return;
  }

  map.on('zoomend', () => {
    const zoom = map.getZoom();
    const showIntermediateStops = document.getElementById('show-intermediate-stops').checked;

    if (zoom >= CIRCLE_MARKER_MIN_ZOOM) {
      circleMarkersGroup.addTo(map);
      lowZoomMarkersGroup.remove();

      if (showIntermediateStops) {
        intermediateStopsCircleMarkersGroup.addTo(map);
        intermediateStopsLowZoomMarkersGroup.remove();
      }
    } else {
      circleMarkersGroup.remove();
      lowZoomMarkersGroup.addTo(map);

      if (showIntermediateStops) {
        intermediateStopsCircleMarkersGroup.remove();
        intermediateStopsLowZoomMarkersGroup.addTo(map);
      }
    }
  });

  markerVisibilityHandlerSetup = true;
}
