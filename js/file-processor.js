/**
 * CSV file processing and flight path rendering
 */

/**
 * Process a CSV flight log file
 * @param {File} file - The file to process
 * @param {boolean} isFirst - Whether this is the first file
 * @param {boolean} isLast - Whether this is the last file
 */
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

        const color = getNextFlightColor();
        const start = latlngs[0];
        const end = latlngs[latlngs.length - 1];

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
            .bindPopup(`<b>${departureAirport}</b><br>Departure`)
            .addTo(circleMarkersGroup);

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
            radius: 6,
            color: color,
            fillColor: "white",
            fillOpacity: 0.9,
          })
            .bindPopup(`<b>${arrivalAirport}</b><br>Arrival`)
            .addTo(circleMarkersGroup);

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

        filteredIntermediateStops.forEach(stop => {
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
