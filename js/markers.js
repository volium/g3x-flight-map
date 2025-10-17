/**
 * Marker creation and management
 */

// Track if marker visibility handler has been set up
let markerVisibilityHandlerSetup = false;

/**
 * Create or get a low zoom marker for an airport
 * @param {string} airport - Airport code
 * @param {Array} position - [lat, lon] position array
 * @param {string} color - Marker color (deprecated, now consistent)
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
      html: `<div class="airport-marker-dot" data-airport="${airport}" style="width: 10px; height: 10px; background-color: #1a1a1a; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); transition: all 0.2s ease;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
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

  // Keep both layer groups on the map at all times - use CSS to control visibility
  circleMarkersGroup.addTo(map);
  lowZoomMarkersGroup.addTo(map);
  intermediateStopsCircleMarkersGroup.addTo(map);
  intermediateStopsLowZoomMarkersGroup.addTo(map);

  // Function to update visibility based on zoom - use opacity for instant hide/show
  const updateMarkerVisibility = () => {
    const zoom = map.getZoom();
    const showHighZoom = zoom >= CIRCLE_MARKER_MIN_ZOOM;

    // Update circle markers visibility using opacity (instant, no transition)
    circleMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.opacity = showHighZoom ? '1' : '0';
        element.style.pointerEvents = showHighZoom ? 'auto' : 'none';
      }
    });

    // Update low-zoom markers visibility
    lowZoomMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.opacity = showHighZoom ? '0' : '1';
        element.style.pointerEvents = showHighZoom ? 'none' : 'auto';
      }
    });

    // Update intermediate stop markers
    const showIntermediateStops = document.getElementById('show-intermediate-stops').checked;

    intermediateStopsCircleMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.opacity = (showHighZoom && showIntermediateStops) ? '1' : '0';
        element.style.pointerEvents = (showHighZoom && showIntermediateStops) ? 'auto' : 'none';
      }
    });

    intermediateStopsLowZoomMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.opacity = (!showHighZoom && showIntermediateStops) ? '1' : '0';
        element.style.pointerEvents = (!showHighZoom && showIntermediateStops) ? 'auto' : 'none';
      }
    });
  };

  // Disable transitions during zoom to prevent visual artifacts
  const disableTransitions = () => {
    circleMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.transition = 'none';
      }
    });
    lowZoomMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.transition = 'none';
      }
    });
    intermediateStopsCircleMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.transition = 'none';
      }
    });
    intermediateStopsLowZoomMarkersGroup.eachLayer(layer => {
      const element = layer.getElement ? layer.getElement() : null;
      if (element) {
        element.style.transition = 'none';
      }
    });
  };

  // Re-enable transitions after zoom completes
  const enableTransitions = () => {
    setTimeout(() => {
      circleMarkersGroup.eachLayer(layer => {
        const element = layer.getElement ? layer.getElement() : null;
        if (element) {
          element.style.transition = '';
        }
      });
      lowZoomMarkersGroup.eachLayer(layer => {
        const element = layer.getElement ? layer.getElement() : null;
        if (element) {
          element.style.transition = '';
        }
      });
      intermediateStopsCircleMarkersGroup.eachLayer(layer => {
        const element = layer.getElement ? layer.getElement() : null;
        if (element) {
          element.style.transition = '';
        }
      });
      intermediateStopsLowZoomMarkersGroup.eachLayer(layer => {
        const element = layer.getElement ? layer.getElement() : null;
        if (element) {
          element.style.transition = '';
        }
      });
    }, 100);
  };

  // Initial visibility update
  updateMarkerVisibility();

  // Disable transitions when zoom starts
  map.on('zoomstart', disableTransitions);

  // Update visibility and re-enable transitions when zoom ends
  map.on('zoomend', () => {
    updateMarkerVisibility();
    enableTransitions();
  });

  // Also update when intermediate stops checkbox changes
  document.getElementById('show-intermediate-stops').addEventListener('change', updateMarkerVisibility);

  markerVisibilityHandlerSetup = true;
}
