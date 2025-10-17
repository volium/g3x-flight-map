/**
 * Event handlers for UI interactions
 */

// Store label repositioning handler so it can be removed/re-added
let labelRepositioningHandler = null;

/**
 * Setup event handler for intermediate stops checkbox toggle
 */
function setupIntermediateStopsToggle() {
  document.getElementById("show-intermediate-stops").addEventListener("change", (event) => {
    const showIntermediateStops = event.target.checked;

    if (showIntermediateStops) {
      // Show intermediate stop labels
      intermediateStopLabels.forEach((details) => {
        if (details.label) details.label.addTo(map);
        if (details.connector) details.connector.addTo(map);
      });
    } else {
      // Hide intermediate stop labels
      intermediateStopLabels.forEach((details) => {
        if (details.label) details.label.remove();
        if (details.connector) details.connector.remove();
      });
    }

    // Note: Marker visibility is now handled by setupMarkerVisibilityHandler via CSS
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

    // Remove previous label repositioning handler if it exists
    if (labelRepositioningHandler) {
      map.off('zoomend', labelRepositioningHandler);
    }

    // Setup marker visibility handler (only once)
    setupMarkerVisibilityHandler();

    // Define and setup label repositioning handler
    labelRepositioningHandler = () => {
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
    };

    // Add the label repositioning handler
    map.on('zoomend', labelRepositioningHandler);

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

    // Store flight data for potential re-rendering
    loadedFlights = validFlights;

    // Check if we need to calculate global gradient info
    const colorMode = document.getElementById('color-mode').value;
    let totalPointsAllFlights = 0;
    let cumulativePoints = [];

    if (colorMode === COLOR_MODES.GRADIENT_GLOBAL) {
      // Calculate cumulative point counts for global gradient
      validFlights.forEach((flightData) => {
        cumulativePoints.push(totalPointsAllFlights);
        totalPointsAllFlights += flightData.latlngs.length;
      });
    }

    // Render all flights
    validFlights.forEach((flightData, index) => {
      try {
        const color = getNextFlightColor();
        console.log(`Rendering flight ${index + 1}/${validFlights.length}: ${flightData.filename} with color ${color}`);

        const polyline = renderFlight(
          flightData,
          color,
          colorMode === COLOR_MODES.GRADIENT_GLOBAL ? cumulativePoints[index] : 0,
          colorMode === COLOR_MODES.GRADIENT_GLOBAL ? totalPointsAllFlights : 0
        );

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
 * Setup event handler for color mode changes
 */
function setupColorModeHandler() {
  document.getElementById("color-mode").addEventListener("change", (event) => {
    console.log(`Color mode changed to: ${event.target.value}`);

    // Only re-render if flights are loaded
    if (loadedFlights.length > 0) {
      reRenderAllFlights();
    }
  });
}

/**
 * Setup synchronized hover effects between markers and labels
 */
function setupSynchronizedHoverEffects() {
  // Use event delegation on the map container
  const mapElement = document.getElementById('map');

  mapElement.addEventListener('mouseover', (e) => {
    let airportCode = null;
    let elementToHighlight = null;

    // Check if hovering over a low-zoom marker dot
    if (e.target.classList.contains('airport-marker-dot')) {
      airportCode = e.target.getAttribute('data-airport');
    }

    // Check if hovering over a label
    if (e.target.classList.contains('airport-label-text')) {
      airportCode = e.target.getAttribute('data-airport');
    }

    // Check if hovering over a circle marker (SVG path or circle element)
    const svgElement = e.target.tagName === 'path' || e.target.tagName === 'circle' ? e.target : null;
    if (svgElement && svgElement.parentElement) {
      const circleMarkerGroup = svgElement.parentElement;

      // Check if this is an airport circle marker
      if (circleMarkerGroup.classList.contains('airport-circle-marker-departure') ||
          circleMarkerGroup.classList.contains('airport-circle-marker-arrival')) {

        // Note: Circle markers now handle their own hover independently
        // They don't synchronize with labels/markers
        return;
      }
    }

    if (airportCode) {
      // Find and highlight all related elements
      const labels = document.querySelectorAll(`.airport-label-text[data-airport="${airportCode}"]`);
      labels.forEach(label => label.classList.add('airport-hover'));

      const markers = document.querySelectorAll(`.airport-marker-dot[data-airport="${airportCode}"]`);
      markers.forEach(marker => marker.classList.add('airport-hover'));

      // Highlight all circle markers with this airport code
      circleMarkersGroup.eachLayer(layer => {
        if (layer._airportCode === airportCode) {
          const element = layer.getElement();
          if (element) {
            element.classList.add('circle-marker-hover');

            // Also increase the radius directly on the SVG path element
            const pathElement = element.querySelector('path');
            if (pathElement) {
              pathElement.setAttribute('data-original-radius', layer.options.radius);
              layer.setRadius(layer.options.radius * 1.4);
            }
          }
        }
      });
    }
  });

  mapElement.addEventListener('mouseout', (e) => {
    let airportCode = null;

    // Check what we're leaving
    if (e.target.classList.contains('airport-marker-dot')) {
      airportCode = e.target.getAttribute('data-airport');
    }

    if (e.target.classList.contains('airport-label-text')) {
      airportCode = e.target.getAttribute('data-airport');
    }

    // Check if leaving a circle marker
    const svgElement = e.target.tagName === 'path' || e.target.tagName === 'circle' ? e.target : null;
    if (svgElement && svgElement.parentElement) {
      const circleMarkerGroup = svgElement.parentElement;

      if (circleMarkerGroup.classList.contains('airport-circle-marker-departure') ||
          circleMarkerGroup.classList.contains('airport-circle-marker-arrival')) {

        circleMarkersGroup.eachLayer(layer => {
          if (layer.getElement && layer.getElement() === circleMarkerGroup) {
            airportCode = layer._airportCode;
          }
        });
      }
    }

    if (airportCode) {
      // Remove hover class from all related elements
      const markers = document.querySelectorAll(`.airport-marker-dot[data-airport="${airportCode}"]`);
      markers.forEach(marker => marker.classList.remove('airport-hover'));

      const labels = document.querySelectorAll(`.airport-label-text[data-airport="${airportCode}"]`);
      labels.forEach(label => label.classList.remove('airport-hover'));

      // Remove hover from all circle markers and restore original radius
      circleMarkersGroup.eachLayer(layer => {
        if (layer._airportCode === airportCode) {
          const element = layer.getElement();
          if (element) {
            element.classList.remove('circle-marker-hover');

            // Restore original radius
            const pathElement = element.querySelector('path');
            if (pathElement && pathElement.hasAttribute('data-original-radius')) {
              const originalRadius = parseFloat(pathElement.getAttribute('data-original-radius'));
              layer.setRadius(originalRadius);
              pathElement.removeAttribute('data-original-radius');
            }
          }
        }
      });
    }
  });
}

/**
 * Setup all event handlers
 */
function setupEventHandlers() {
  setupIntermediateStopsToggle();
  setupFileUploadHandler();
  setupMarkerVisibilityHandler();
  setupColorModeHandler();
  setupSynchronizedHoverEffects();
}
