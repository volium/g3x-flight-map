// Initialize Leaflet map
const map = L.map("map").setView([39, -98], 4);

// Esri World Imagery basemap (legal, free, beautiful)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
    maxZoom: 18,
  }
).addTo(map);

// Keep track of previous flight's end point and airport code
let lastFlight = null;

const colors = [
  "#ff0000",
  "#ff8800",
  "#ffaa00",
  "#00aaff",
  "#00cc66",
  "#cc00ff",
  "#ff0099",
  "#0055ff",
];
let colorIndex = 0;

// Extract airport code from filename (expected format: log_YYYYMMDD_HHMMSS_ICAO.csv)
function extractAirportCode(filename) {
  const match = filename.match(/log_\d{8}_\d{6}_([A-Z0-9]{3,4})\.csv$/);
  return match ? match[1] : null;
}

// Handle file uploads
document.getElementById("file-input").addEventListener("change", (event) => {
  const files = Array.from(event.target.files);
  files.sort((a, b) => a.name.localeCompare(b.name)); // chronological order
  lastFlight = null; // Reset on new file upload
  files.forEach((file, index) => processFile(file, index === 0, index === files.length - 1));
});

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

        const color = colors[colorIndex++ % colors.length];
        // Get airport code from filename
        const currentAirport = extractAirportCode(file.name);
        const start = latlngs[0];
        const end = latlngs[latlngs.length - 1];

        // Draw flight path
        const polyline = L.polyline(latlngs, {
          color: color,
          weight: 3,
          opacity: 0.9,
        }).addTo(map);

        // Always add departure airport marker and label since the filename contains the departure airport
        const startMarker = L.circleMarker(start, {
          radius: 6,
          color: color,
          fillColor: "white",
          fillOpacity: 1,
        })
          .bindPopup(`<b>${currentAirport}</b><br>Departure ${file.name}`)
          .addTo(map);

        // Add airport code label for departure
        L.marker(start, {
          icon: L.divIcon({
            className: 'airport-label',
            html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">${currentAirport}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 0]
          })
        }).addTo(map);

        // For the last leg, add arrival marker with the next flight's airport code
        if (!isLast) {
          // Get the next file's departure airport as this flight's destination
          const nextFile = files[Array.from(files).findIndex(f => f === file) + 1];
          const destinationAirport = extractAirportCode(nextFile.name);

          if (destinationAirport) {
            const endMarker = L.circleMarker(end, {
              radius: 6,
              color: color,
              fillColor: "white",
              fillOpacity: 0.9,
            })
              .bindPopup(`<b>${destinationAirport}</b><br>Arrival`)
              .addTo(map);

            // Add airport code label for arrival
            L.marker(end, {
              icon: L.divIcon({
                className: 'airport-label',
                html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">${destinationAirport}</div>`,
                iconSize: [40, 20],
                iconAnchor: [20, 30]
              })
            }).addTo(map);
          }
        }

        // Add polyline popup
        polyline.bindPopup(`<b>${file.name}</b>`);

        // If we have a previous flight and this isn't the last flight, add connecting label
        if (lastFlight && !isLast) {
          const nextFile = files[Array.from(files).findIndex(f => f === file) + 1];
          const destinationAirport = extractAirportCode(nextFile.name);

          if (destinationAirport) {
            // Calculate midpoint between last flight's end and this flight's start
            const midLat = (lastFlight.end[0] + start[0]) / 2;
            const midLng = (lastFlight.end[1] + start[1]) / 2;

            // Add connection label at midpoint
            L.marker([midLat, midLng], {
              icon: L.divIcon({
                className: 'airport-label',
                html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">
                  ${currentAirport} → ${destinationAirport}
                </div>`,
                iconSize: [80, 20],
                iconAnchor: [40, 10]
              })
            }).addTo(map);
          }
        }

        // Update last flight info
        lastFlight = {
          airport: currentAirport,
          end: end
        };

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      },
    });
  };
  reader.readAsText(file);
}
