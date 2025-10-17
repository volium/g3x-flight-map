/**
 * CSV file processing and flight path rendering
 */

/**
 * Parse a CSV flight log file and return processed data
 * @param {File} file - The file to process
 * @returns {Promise} Promise that resolves with flight data
 */
function parseFile(file) {
  return new Promise((resolve, reject) => {
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
          // Filter for valid coordinates (handle both strings and numbers)
          const data = results.data.filter(
            (row) => {
              const lat = row.Latitude || row.latitude;
              const lon = row.Longitude || row.longitude;

              // Check if values exist and can be converted to valid numbers
              if (!lat || !lon) return false;

              const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
              const lonNum = typeof lon === 'number' ? lon : parseFloat(lon);

              return !isNaN(latNum) && !isNaN(lonNum) &&
                     latNum !== 0 && lonNum !== 0; // Also filter out zero coordinates
            }
          );
          if (data.length === 0) {
            console.warn(`No valid coordinate data found in ${file.name}`);
            resolve(null);
            return;
          }

          // Use correct keys and ensure numeric values
          const rawLatLngs = data.map((row) => {
            const lat = row.Latitude || row.latitude;
            const lon = row.Longitude || row.longitude;
            return [
              typeof lat === 'number' ? lat : parseFloat(lat),
              typeof lon === 'number' ? lon : parseFloat(lon)
            ];
          });

          // Simplify the polyline for better performance
          // epsilon = 0.0005 km (~0.5 meters) - maintains visual accuracy while reducing points
          const epsilon = 0.0005;
          const latlngs = simplifyPolyline(rawLatLngs, epsilon);

          console.log(`Simplified ${file.name}: ${rawLatLngs.length} points → ${latlngs.length} points (${Math.round((1 - latlngs.length/rawLatLngs.length) * 100)}% reduction)`);

          const start = latlngs[0];
          const end = latlngs[latlngs.length - 1];

          // Extra validation - make sure start and end have valid coordinates
          if (!start || !end || isNaN(start[0]) || isNaN(start[1]) || isNaN(end[0]) || isNaN(end[1])) {
            console.error(`Invalid start/end coordinates in ${file.name}. Start: ${start}, End: ${end}`);
            resolve(null);
            return;
          }

          // Get and verify departure airport code
          const suggestedCode = extractAirportCode(file.name);
          const departureAirport = verifyAirportCode(suggestedCode, start[0], start[1]);

          // Find arrival airport code
          const arrivalAirport = findNearestAirport(end[0], end[1])?.code;

          // Get threshold values from UI
          const aglThreshold = parseFloat(document.getElementById('agl-threshold').value) || 20;
          const speedThreshold = parseFloat(document.getElementById('speed-threshold').value) || 20;

          // Detect intermediate stops
          const intermediateStops = detectIntermediateStops(data, aglThreshold, speedThreshold);

          // Filter out departure and arrival airports from intermediate stops
          const filteredIntermediateStops = intermediateStops.filter(stop =>
            stop.airport !== departureAirport && stop.airport !== arrivalAirport
          );

          console.log(`Flight ${file.name}: Found ${filteredIntermediateStops.length} intermediate stops`);

          resolve({
            filename: file.name,
            latlngs,
            data,
            start,
            end,
            departureAirport,
            arrivalAirport,
            intermediateStops: filteredIntermediateStops
          });
        },
        error: (error) => {
          console.error(`Error parsing ${file.name}:`, error);
          reject(error);
        }
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Render a flight to the map
 * @param {Object} flightData - Processed flight data
 * @param {string} color - Color for this flight
 * @param {number} cumulativePointsBefore - For global gradient mode
 * @param {number} totalPointsAllFlights - For global gradient mode
 * @returns {L.Polyline} The polyline representing the flight path
 */
function renderFlight(flightData, color, cumulativePointsBefore = 0, totalPointsAllFlights = 0) {
  const { filename, latlngs, start, end, departureAirport, arrivalAirport, intermediateStops } = flightData;

  // Get color mode setting
  const colorMode = document.getElementById('color-mode').value;

  // Determine actual color(s) based on mode
  let trackColor = color;
  if (colorMode === COLOR_MODES.SINGLE) {
    trackColor = SINGLE_FLIGHT_COLOR;
  }

  // Draw flight path with modern styling (zoom-adaptive width)
  const currentZoom = map.getZoom();
  const trackWidth = getZoomAdaptiveTrackWidth(currentZoom);

  const polylineOptions = {
    color: trackColor,
    weight: trackWidth,
    opacity: TRACK_STYLE.opacity,
    smoothFactor: TRACK_STYLE.smoothFactor,
    lineCap: TRACK_STYLE.lineCap,
    lineJoin: TRACK_STYLE.lineJoin
  };

  const polyline = L.polyline(latlngs, polylineOptions).addTo(map);

  // Apply gradient if selected and store gradient segments
  if (colorMode === COLOR_MODES.GRADIENT) {
    const segments = applyGradientToPolyline(polyline, latlngs);
    gradientSegments.push(...segments); // Store all gradient segments
  } else if (colorMode === COLOR_MODES.GRADIENT_GLOBAL) {
    const segments = applyGlobalGradientToPolyline(polyline, latlngs, cumulativePointsBefore, totalPointsAllFlights);
    gradientSegments.push(...segments); // Store all gradient segments
  }

  // Add arrow decorations with improved visibility
  // Zoom-adaptive: spacing, size, and outline all adjust with zoom level
  const arrowConfig = getZoomAdaptiveArrowConfig(currentZoom);

  const decorator = L.polylineDecorator(polyline, {
    patterns: [
      {
        offset: '10%',
        repeat: arrowConfig.spacing,
        symbol: L.Symbol.arrowHead({
          pixelSize: arrowConfig.size,
          polygon: true,
          pathOptions: {
            fillColor: ARROW_STYLE.fillColor,
            fillOpacity: ARROW_STYLE.fillOpacity,
            color: ARROW_STYLE.color,
            weight: arrowConfig.weight
          }
        })
      }
    ]
  }).addTo(map);

  // Update arrows on zoom
  map.on('zoomend', () => {
    const zoom = map.getZoom();
    const config = getZoomAdaptiveArrowConfig(zoom);

    decorator.setPatterns([
      {
        offset: '10%',
        repeat: config.spacing,
        symbol: L.Symbol.arrowHead({
          pixelSize: config.size,
          polygon: true,
          pathOptions: {
            fillColor: ARROW_STYLE.fillColor,
            fillOpacity: ARROW_STYLE.fillOpacity,
            color: ARROW_STYLE.color,
            weight: config.weight
          }
        })
      }
    ]);
  });

  // Add departure airport marker and label
  if (departureAirport) {
    const startMarker = L.circleMarker(start, {
      radius: 7,
      color: "white",
      fillColor: "#00AA55",  // Green for departure
      fillOpacity: 1,
      weight: 2,
      className: 'airport-circle-marker airport-circle-marker-departure'
    })
      .bindPopup(`<b>${departureAirport}</b><br>Departure`)
      .addTo(circleMarkersGroup);

    // Store reference for hover effect
    startMarker._airportCode = departureAirport;
    startMarker._markerType = 'departure';

    // Add hover event handlers using Leaflet's API - only affects the circle marker itself
    startMarker.on('mouseover', function() {
      const element = this.getElement();
      if (element) {
        element.classList.add('circle-marker-hover');
        this.setRadius(this.options.radius * 1.4);
      }
    });

    startMarker.on('mouseout', function() {
      const element = this.getElement();
      if (element) {
        element.classList.remove('circle-marker-hover');
        this.setRadius(7);  // Reset to original size
      }
    });

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
      radius: 7,
      color: "white",
      fillColor: "#DD3333",  // Red for arrival
      fillOpacity: 1,
      weight: 2,
      className: 'airport-circle-marker airport-circle-marker-arrival'
    })
      .bindPopup(`<b>${arrivalAirport}</b><br>Arrival`)
      .addTo(circleMarkersGroup);

    // Store reference for hover effect
    endMarker._airportCode = arrivalAirport;
    endMarker._markerType = 'arrival';

    // Add hover event handlers using Leaflet's API - only affects the circle marker itself
    endMarker.on('mouseover', function() {
      const element = this.getElement();
      if (element) {
        element.classList.add('circle-marker-hover');
        this.setRadius(this.options.radius * 1.4);
      }
    });

    endMarker.on('mouseout', function() {
      const element = this.getElement();
      if (element) {
        element.classList.remove('circle-marker-hover');
        this.setRadius(7);  // Reset to original size
      }
    });

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

  // Add intermediate stop markers
  const showIntermediateStops = document.getElementById('show-intermediate-stops').checked;

  intermediateStops.forEach(stop => {
    // Add circle marker for intermediate stop
    const stopMarker = L.circleMarker([stop.lat, stop.lon], {
      radius: 5,
      color: color,
      fillColor: "yellow",
      fillOpacity: 0.8,
    })
      .bindPopup(`<b>${stop.airport}</b><br>Intermediate stop`)
      .addTo(intermediateStopsCircleMarkersGroup);

    // Add airport code label if not already labeled (check both maps)
    if (!labeledAirports.has(stop.airport) && !intermediateStopLabels.has(stop.airport)) {
      const airportPos = [stop.airportLat, stop.airportLon];
      // Only add to map if checkbox is checked
      const details = createAirportLabel(stop.airport, airportPos, color, null, showIntermediateStops);
      intermediateStopLabels.set(stop.airport, details);

      // Add low-zoom marker with "Intermediate stop" label
      const lowZoomMarker = createLowZoomMarker(stop.airport, airportPos, color, "Intermediate stop");
      lowZoomMarker.addTo(intermediateStopsLowZoomMarkersGroup);
    }
  });

    // Add polyline popup
    polyline.bindPopup(`<b>${filename}</b>`);

    // Store polyline and decorator for potential re-rendering
    flightPolylines.push(polyline);
    flightDecorators.push(decorator);

    // Update last flight info
    lastFlight = {
      airport: arrivalAirport,
      end: end
    };

    return polyline;
}

/**
 * Re-render all flights with current color mode (without reloading files)
 */
function reRenderAllFlights() {
  console.log('Re-rendering all flights with new color mode...');

  // Remove all existing polylines and decorators
  flightPolylines.forEach(polyline => {
    if (map.hasLayer(polyline)) {
      map.removeLayer(polyline);
    }
  });
  flightDecorators.forEach(decorator => {
    if (map.hasLayer(decorator)) {
      map.removeLayer(decorator);
    }
  });

  // Remove all gradient segments
  gradientSegments.forEach(segment => {
    if (map.hasLayer(segment)) {
      map.removeLayer(segment);
    }
  });

  // Clear the arrays
  flightPolylines = [];
  flightDecorators = [];
  gradientSegments = [];

  // Clear flight bounds (will be recalculated)
  allFlightBounds = [];

  // Reset color index
  colorIndex = 0;

  // Check if we need to calculate global gradient info
  const colorMode = document.getElementById('color-mode').value;
  let totalPointsAllFlights = 0;
  let cumulativePoints = [];

  if (colorMode === COLOR_MODES.GRADIENT_GLOBAL) {
    // Calculate cumulative point counts for global gradient
    loadedFlights.forEach((flightData) => {
      cumulativePoints.push(totalPointsAllFlights);
      totalPointsAllFlights += flightData.latlngs.length;
    });
  }

  // Re-render each flight
  loadedFlights.forEach((flightData, index) => {
    const color = getNextFlightColor();
    console.log(`Re-rendering flight ${index + 1}/${loadedFlights.length}: ${flightData.filename} with color ${color}`);

    const polyline = renderFlight(
      flightData,
      color,
      colorMode === COLOR_MODES.GRADIENT_GLOBAL ? cumulativePoints[index] : 0,
      colorMode === COLOR_MODES.GRADIENT_GLOBAL ? totalPointsAllFlights : 0
    );

    allFlightBounds.push(polyline.getBounds());
  });

  console.log(`Re-rendered ${loadedFlights.length} flights successfully`);
}
