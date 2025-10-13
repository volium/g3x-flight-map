/**
 * Map initialization and layer group management
 */

// Initialize Leaflet map
const map = L.map("map", {
  zoomDelta: 0.25,  // Allow fractional zoom levels
  zoomSnap: 0.25,   // Snap to 0.25 zoom level increments
  wheelDebounceTime: 100  // Smooth out wheel zooming
}).setView([39, -98], 4);

// Layer groups for different zoom level markers
const circleMarkersGroup = L.layerGroup();
const lowZoomMarkersGroup = L.layerGroup().addTo(map);

// Layer groups for intermediate stops (separate so they can be toggled)
const intermediateStopsCircleMarkersGroup = L.layerGroup();
const intermediateStopsLowZoomMarkersGroup = L.layerGroup().addTo(map);

// Keep track of labeled airports and markers
const labeledAirports = new Map(); // Map of airport code to label and connector info (departure/arrival only)
const intermediateStopLabels = new Map(); // Map of airport code to label and connector info (intermediate stops only)
const airportMarkers = new Map(); // Map of airport code to low-zoom marker

// Color index for flight paths
let colorIndex = 0;

// Last flight info
let lastFlight = null;

// Track all flight bounds for proper map fitting
let allFlightBounds = [];
let filesProcessed = 0;
let totalFilesToProcess = 0;

/**
 * Initialize the map with base tiles
 */
function initializeMap() {
  // Esri World Imagery basemap (legal, free, beautiful)
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
      maxZoom: 18,
    }
  ).addTo(map);

  // Set initial visibility of circle markers based on zoom level
  if (map.getZoom() >= CIRCLE_MARKER_MIN_ZOOM) {
    circleMarkersGroup.addTo(map);
  }
}

/**
 * Reset all map layers and clear state
 */
function resetMap() {
  // Remove all layers except base tiles
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  // Clear all layer groups
  circleMarkersGroup.clearLayers();
  lowZoomMarkersGroup.clearLayers();
  intermediateStopsCircleMarkersGroup.clearLayers();
  intermediateStopsLowZoomMarkersGroup.clearLayers();

  // Clear tracking maps
  labeledAirports.clear();
  intermediateStopLabels.clear();
  airportMarkers.clear();

  // Reset state
  colorIndex = 0;
  lastFlight = null;
  allFlightBounds = [];
  filesProcessed = 0;
  totalFilesToProcess = 0;

  // Re-add groups based on checkbox state
  circleMarkersGroup.addTo(map);
  lowZoomMarkersGroup.addTo(map);

  const showIntermediateStops = document.getElementById('show-intermediate-stops').checked;
  if (showIntermediateStops) {
    intermediateStopsCircleMarkersGroup.addTo(map);
    intermediateStopsLowZoomMarkersGroup.addTo(map);
  }
}

/**
 * Fit the map to show all processed flights
 */
function fitMapToAllFlights() {
  if (allFlightBounds.length === 0) {
    return;
  }

  // Combine all flight bounds into one
  let combinedBounds = allFlightBounds[0];
  for (let i = 1; i < allFlightBounds.length; i++) {
    combinedBounds.extend(allFlightBounds[i]);
  }

  // Fit the map to show all flights
  map.fitBounds(combinedBounds, { padding: [50, 50] });

  console.log(`Map fitted to show all ${allFlightBounds.length} flights`);
}

/**
 * Get the next color for a flight path
 * @returns {string} Color hex code
 */
function getNextFlightColor() {
  return FLIGHT_COLORS[colorIndex++ % FLIGHT_COLORS.length];
}
