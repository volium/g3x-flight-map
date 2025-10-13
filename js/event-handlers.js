/**
 * Event handlers for UI interactions
 */

/**
 * Setup event handler for intermediate stops checkbox toggle
 */
function setupIntermediateStopsToggle() {
  document.getElementById("show-intermediate-stops").addEventListener("change", (event) => {
    const showIntermediateStops = event.target.checked;

    if (showIntermediateStops) {
      // Show intermediate stops markers
      const zoom = map.getZoom();
      if (zoom >= CIRCLE_MARKER_MIN_ZOOM) {
        intermediateStopsCircleMarkersGroup.addTo(map);
        intermediateStopsLowZoomMarkersGroup.remove();
      } else {
        intermediateStopsLowZoomMarkersGroup.addTo(map);
        intermediateStopsCircleMarkersGroup.remove();
      }

      // Show intermediate stop labels
      intermediateStopLabels.forEach((details) => {
        if (details.label) details.label.addTo(map);
        if (details.connector) details.connector.addTo(map);
      });
    } else {
      // Hide intermediate stops markers
      intermediateStopsCircleMarkersGroup.remove();
      intermediateStopsLowZoomMarkersGroup.remove();

      // Hide intermediate stop labels
      intermediateStopLabels.forEach((details) => {
        if (details.label) details.label.remove();
        if (details.connector) details.connector.remove();
      });
    }
  });
}

/**
 * Setup event handler for file uploads
 */
function setupFileUploadHandler() {
  document.getElementById("file-input").addEventListener("change", (event) => {
    const files = Array.from(event.target.files);
    files.sort((a, b) => a.name.localeCompare(b.name)); // chronological order

    // Reset the map
    resetMap();

    // Add handler for zoom changes to update label positions
    map.off('zoomend'); // Remove any existing handlers first

    // Setup marker visibility handler
    setupMarkerVisibilityHandler();

    // Setup label repositioning handler
    map.on('zoomend', () => {
      // Store existing airports (departure/arrival) and clear the map
      const existingAirports = Array.from(labeledAirports.entries());
      labeledAirports.forEach((details) => {
        if (details.label) details.label.remove();
        if (details.connector) details.connector.remove();
      });
      labeledAirports.clear();

      // Store existing intermediate stops and clear the map
      const existingIntermediateStops = Array.from(intermediateStopLabels.entries());
      intermediateStopLabels.forEach((details) => {
        if (details.label) details.label.remove();
        if (details.connector) details.connector.remove();
      });
      intermediateStopLabels.clear();

      // Recreate departure/arrival labels with new positions
      existingAirports.forEach(([code, details]) => {
        const newDetails = createAirportLabel(code, details.position, details.color);
        labeledAirports.set(code, newDetails);
      });

      // Recreate intermediate stop labels with new positions
      const showIntermediateStops = document.getElementById('show-intermediate-stops').checked;
      existingIntermediateStops.forEach(([code, details]) => {
        const newDetails = createAirportLabel(code, details.position, details.color, null, showIntermediateStops);
        intermediateStopLabels.set(code, newDetails);
      });
    });

    // Process all files
    files.forEach((file, index) =>
      processFile(file, index === 0, index === files.length - 1)
    );
  });
}

/**
 * Setup all event handlers
 */
function setupEventHandlers() {
  setupIntermediateStopsToggle();
  setupFileUploadHandler();
  setupMarkerVisibilityHandler();
}
