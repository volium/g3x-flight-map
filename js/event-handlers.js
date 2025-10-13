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
  const fileInput = document.getElementById("file-input");

  fileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);

    if (files.length === 0) return;

    files.sort((a, b) => a.name.localeCompare(b.name)); // chronological order

    // Disable file input during processing
    fileInput.disabled = true;

    // Reset the map
    resetMap();

    // Set the total number of files to process
    totalFilesToProcess = files.length;
    console.log(`Loading ${totalFilesToProcess} flight files...`);

    // Load airports data if not already loaded
    if (!airportsLoaded) {
      console.log('Loading airport database...');
      showLoadingMessage('Loading airport database...');
      try {
        await loadAirportsData();
        hideLoadingMessage();
      } catch (error) {
        console.error('Failed to load airports:', error);
        hideLoadingMessage();
        fileInput.disabled = false;
        alert('Failed to load airport database. Some features may not work correctly.');
        return;
      }
    }

    // Show initial progress with bar at 0%
    showProgress(0, totalFilesToProcess, 'Processing files...');

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

    // Process files in parallel with progress tracking
    console.log('Processing all flight files in parallel...');

    let completedCount = 0;
    const parsePromises = files.map(file =>
      parseFile(file).then(flightData => {
        completedCount++;
        showProgress(completedCount, files.length, `Processed ${completedCount} of ${files.length} files`);
        return flightData;
      }).catch(error => {
        console.error(`Error processing flight ${file.name}:`, error);
        completedCount++;
        showProgress(completedCount, files.length, `Processed ${completedCount} of ${files.length} files`);
        return null;
      })
    );

    // Wait for all files to parse
    const allFlightData = await Promise.all(parsePromises);

    // Filter out any null results (empty files or errors)
    const validFlights = allFlightData.filter(data => data !== null);
    console.log(`Successfully parsed ${validFlights.length} flights`);

    // Update progress message
    updateProgressMessage('Rendering flights to map...');

    // Render all flights
    validFlights.forEach((flightData, index) => {
      try {
        const color = getNextFlightColor();
        console.log(`Rendering flight ${index + 1}/${validFlights.length}: ${flightData.filename} with color ${color}`);
        const polyline = renderFlight(flightData, color);
        allFlightBounds.push(polyline.getBounds());
      } catch (error) {
        console.error(`Error rendering flight ${flightData.filename}:`, error);
      }
    });

    // Update progress message
    updateProgressMessage('Finalizing map view...');

    // Smoothly zoom to show all flights
    if (allFlightBounds.length > 0) {
      console.log(`Zooming to show all ${allFlightBounds.length} flights...`);
      fitMapToAllFlights();
    } else {
      console.warn('No flight bounds to fit!');
    }

    // Hide progress after a short delay
    setTimeout(() => {
      hideProgress();
      fileInput.disabled = false;
      fileInput.value = ''; // Clear the input so the same files can be re-uploaded
    }, 500);
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
