/**
 * Map initialization and layer group management
 */

// Initialize Leaflet map
const map = L.map("map", {
  zoomDelta: 0.25,
  zoomSnap: 0.25,
  wheelDebounceTime: 100
}).setView([39, -98], 4);

// Layer groups for different zoom level markers
const circleMarkersGroup = L.layerGroup();
const lowZoomMarkersGroup = L.layerGroup().addTo(map);

// Layer groups for intermediate stops (separate so they can be toggled)
const intermediateStopsCircleMarkersGroup = L.layerGroup();
const intermediateStopsLowZoomMarkersGroup = L.layerGroup().addTo(map);

// Keep track of labeled airports and markers
const labeledAirports = new Map();
const intermediateStopLabels = new Map();
const airportMarkers = new Map();

// Color index for flight paths
let colorIndex = 0;

// Last flight info
let lastFlight = null;

// Track all flight bounds for proper map fitting
let allFlightBounds = [];
let filesProcessed = 0;
let totalFilesToProcess = 0;

// Store loaded flight data for re-rendering with different colors
let loadedFlights = [];

// Store all polylines and decorators for removal during re-render
let flightPolylines = [];
let flightDecorators = [];
let gradientSegments = []; // Store gradient polyline segments separately

/**
 * Initialize the map with base tiles and layer control
 */
function initializeMap() {
  // ========== ESRI BASEMAPS ==========
  const esriWorldImagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
      maxZoom: 18,
    }
  );

  const esriWorldStreet = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom",
      maxZoom: 18,
    }
  );

  const esriWorldTopo = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
      maxZoom: 18,
    }
  );

  const esriWorldGray = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    }
  );

  const esriDarkGray = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    }
  );

  const esriLightGrayReference = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    }
  );

  const esriDarkGrayReference = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    }
  );

  // Combined layer groups for Gray Canvas with labels
  const esriLightGrayLabeled = L.layerGroup([esriWorldGray, esriLightGrayReference]);
  const esriDarkGrayLabeled = L.layerGroup([esriDarkGray, esriDarkGrayReference]);

  const esriNatGeo = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC",
      maxZoom: 16,
    }
  );

  const esriOcean = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri",
      maxZoom: 13,
    }
  );

  // ========== OPENSTREETMAP ==========
  const osmStandard = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }
  );

  const osmHOT = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
      maxZoom: 19,
    }
  );

  const osmFrance = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    {
      attribution: '&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    }
  );

  const osmBW = L.tileLayer(
    "https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }
  );

  // ========== CARTO / CARTODB ==========
  const cartoPositron = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const cartoDarkMatter = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const cartoVoyager = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  // ========== OPENTOPOMAP ==========
  const openTopoMap = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      maxZoom: 17,
    }
  );

  // ========== STAMEN ==========
  const stamenTerrain = L.tileLayer(
    "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png",
    {
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abcd",
      maxZoom: 18,
    }
  );

  const stamenToner = L.tileLayer(
    "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png",
    {
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const stamenWatercolor = L.tileLayer(
    "https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg",
    {
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abcd",
      maxZoom: 16,
    }
  );

  // ========== OTHER FREE OPTIONS ==========
  const cyclOSM = L.tileLayer(
    "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    {
      attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    }
  );

  const openRailwayMap = L.tileLayer(
    "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
    {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      maxZoom: 19,
    }
  );

  // ========== ORGANIZE BASEMAPS BY CATEGORY ==========
  const baseMaps = {
    "✨ Positron": cartoPositron,
    "🧭 Voyager": cartoVoyager,
    "⚪📍 Light Gray + Labels": esriLightGrayLabeled,
    "⚫📍 Dark Gray + Labels": esriDarkGrayLabeled,
  };

  // Add default basemap (Positron)
  cartoPositron.addTo(map);

  // Add layer control to map
  L.control.layers(baseMaps, null, {
    position: 'topright',
    collapsed: true
  }).addTo(map);

  // Set initial visibility of circle markers based on zoom level
  if (map.getZoom() >= CIRCLE_MARKER_MIN_ZOOM) {
    circleMarkersGroup.addTo(map);
  }

  // Add global zoom handler for track width updates
  map.on('zoomend', () => {
    const zoom = map.getZoom();
    const newTrackWidth = getZoomAdaptiveTrackWidth(zoom);

    const colorMode = document.getElementById('color-mode').value;

    // Update non-gradient polylines
    if (colorMode === COLOR_MODES.SINGLE || colorMode === COLOR_MODES.MULTI) {
      flightPolylines.forEach(polyline => {
        if (polyline && polyline.setStyle) {
          polyline.setStyle({ weight: newTrackWidth });
        }
      });
    }

    // Update gradient segments
    if (colorMode === COLOR_MODES.GRADIENT || colorMode === COLOR_MODES.GRADIENT_GLOBAL) {
      gradientSegments.forEach(segment => {
        if (segment && segment.setStyle) {
          segment.setStyle({ weight: newTrackWidth });
        }
      });
    }
  });
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

  const currentZoom = map.getZoom();
  const trackWidth = getZoomAdaptiveTrackWidth(currentZoom);
  console.log(`Map fitted to show all ${allFlightBounds.length} flights`);
  console.log(`Current zoom level: ${currentZoom.toFixed(2)}, Track width: ${trackWidth}px`);
}

/**
 * Get the next color for a flight path
 * @returns {string} Color hex code
 */
function getNextFlightColor() {
  return FLIGHT_COLORS[colorIndex++ % FLIGHT_COLORS.length];
}
