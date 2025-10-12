// ==========================
// GLOBAL VARIABLES
// ==========================

// Initialize Leaflet map
const map = L.map("map", {
  zoomDelta: 0.25,  // Allow fractional zoom levels
  zoomSnap: 0.25,   // Snap to 0.25 zoom level increments
  wheelDebounceTime: 100  // Smooth out wheel zooming
}).setView([39, -98], 4);

// Layer groups for different zoom level markers
const circleMarkersGroup = L.layerGroup();
const lowZoomMarkersGroup = L.layerGroup().addTo(map);

// Track labeled airports and markers
const labeledAirports = new Map();
const airportMarkers = new Map();

// Track dynamic map objects
const flightPaths = [];
const flightDecorators = [];
const connectionLabels = [];

// Label management
const BASE_MIN_LABEL_DISTANCE = 50; // Base minimum pixels between labels
const BASE_LABEL_MARGIN = 20; // Base margin around airport point for label placement
const MAX_PIXEL_DISTANCE = 100; // Maximum pixels away from airport
const MIN_ZOOM = 4; // Minimum zoom level for reference
const MAX_ZOOM = 12; // Maximum zoom level for reference
const CIRCLE_MARKER_MIN_ZOOM = 13; // Minimum zoom level to show circle markers

// Colors for flights
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

// Last flight info
let lastFlight = null;

// ==========================
// TILE LAYER
// ==========================
// Esri World Imagery basemap (legal, free, beautiful)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
    maxZoom: 18,
  }
).addTo(map);

// Show/hide circle markers based on zoom
function updateMarkerVisibility() {
  const zoom = map.getZoom();
  if (zoom >= CIRCLE_MARKER_MIN_ZOOM) {
    circleMarkersGroup.addTo(map);
    lowZoomMarkersGroup.remove();
  } else {
    circleMarkersGroup.remove();
    lowZoomMarkersGroup.addTo(map);
  }
}

// Update airport labels positions on zoom
function updateLabelPositions() {
  labeledAirports.forEach((details, code) => {
    if (details.label) {
      const newPos = adjustLabelPosition(code, details.position, labeledAirports);
      details.label.setLatLng(newPos);
      if (details.connector) details.connector.setLatLngs([details.position, newPos]);
      details.labelPosition = newPos;
    }
  });
}

// Global zoomend listener
map.on('zoomend', () => {
  updateMarkerVisibility();
  updateLabelPositions();
});

// ==========================
// HELPER FUNCTIONS
// ==========================

// Distance using Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Zoom-adjusted distances for labels
function getZoomAdjustedValues(zoom) {
  const zoomFactor = Math.max(0.3, (zoom - MIN_ZOOM)/(MAX_ZOOM - MIN_ZOOM));
  return {
    labelDistance: BASE_MIN_LABEL_DISTANCE * (1 - zoomFactor * 0.7),
    labelMargin: BASE_LABEL_MARGIN * (1 - zoomFactor * 0.7)
  };
}

// Create low zoom marker
function createLowZoomMarker(airport, position, color) {
  if (airportMarkers.has(airport)) return airportMarkers.get(airport);

  const marker = L.marker(position, {
    icon: L.divIcon({
      className: 'airport-marker',
      html: `<div style="width:8px;height:8px;background:white;border:2px solid ${color};border-radius:50%;"></div>`,
      iconSize: [12,12],
      iconAnchor: [6,6]
    })
  }).bindPopup(`<b>${airport}</b>`);

  airportMarkers.set(airport, marker);
  return marker;
}

// Adjust label to avoid overlaps
function adjustLabelPosition(airport, position, existingLabels) {
  const zoom = map.getZoom();
  const { labelDistance, labelMargin } = getZoomAdjustedValues(zoom);
  const point = map.latLngToContainerPoint(position);
  const minOffset = 20;

  const positions = [
    {angle: Math.PI/2, radius: minOffset}, {angle:-Math.PI/2, radius:minOffset},
    {angle: Math.PI, radius:minOffset}, {angle:0, radius:minOffset},
    {angle:Math.PI/4,radius:minOffset},{angle:-Math.PI/4,radius:minOffset},
    {angle:3*Math.PI/4,radius:minOffset},{angle:-3*Math.PI/4,radius:minOffset}
  ];

  for (const pos of positions) {
    const testPoint = point.add(L.point(pos.radius*Math.cos(pos.angle), pos.radius*Math.sin(pos.angle)));
    const newPos = map.containerPointToLatLng(testPoint);
    let overlap = false;
    for (const [code, details] of existingLabels) {
      if (code===airport) continue;
      const labelPoint = map.latLngToContainerPoint(details.labelPosition);
      if (testPoint.distanceTo(labelPoint) < labelDistance) { overlap=true; break; }
    }
    if (!overlap) return newPos;
  }

  // Spiral fallback
  let angle=0, radius=minOffset;
  for(let i=0;i<32;i++){
    const testPoint = point.add(L.point(radius*Math.cos(angle), radius*Math.sin(angle)));
    if(testPoint.distanceTo(point)>MAX_PIXEL_DISTANCE) break;
    const newPos = map.containerPointToLatLng(testPoint);
    let overlap=false;
    for(const [code, details] of existingLabels){
      if(code===airport) continue;
      const labelPoint = map.latLngToContainerPoint(details.labelPosition);
      if(testPoint.distanceTo(labelPoint)<labelDistance){ overlap=true; break; }
    }
    if(!overlap) return newPos;
    angle+=Math.PI/4;
    if(angle>=2*Math.PI){ angle=0; radius+=labelMargin; }
  }

  // Random fallback
  const fallbackAngle = Math.random()*2*Math.PI;
  return map.containerPointToLatLng(point.add(L.point(MAX_PIXEL_DISTANCE*Math.cos(fallbackAngle), MAX_PIXEL_DISTANCE*Math.sin(fallbackAngle))));
}

// Create airport label and connector
function createAirportLabel(airport, position, color){
  const adjustedPosition = adjustLabelPosition(airport, position, labeledAirports);

  const label = L.marker(adjustedPosition, {
    icon: L.divIcon({
      className: 'airport-label',
      html: `<div style="color:${color};font-weight:bold;background:rgba(255,255,255,0.8);padding:2px 4px;border-radius:3px;">${airport}</div>`,
      iconSize: [40,20],
      iconAnchor: [20,10]
    })
  }).addTo(map);

  let connector=null;
  if(adjustedPosition.lat!==position.lat || adjustedPosition.lng!==position.lng){
    connector = L.polyline([position, adjustedPosition], {color, weight:1, opacity:0.5, dashArray:'3,3'}).addTo(map);
  }

  return { label, connector, position, labelPosition:adjustedPosition, color };
}

// Extract airport code from filename
function extractAirportCode(filename){
  const match = filename.match(/log_\d{8}_\d{6}_([A-Z0-9]{3,4})\.csv$/);
  return match ? match[1] : null;
}

// Verify airport code using coordinates
function verifyAirportCode(code, lat, lon){
  const nearest = findNearestAirport(lat, lon);
  if(!nearest) return null;
  return code===nearest.code ? code : nearest.code;
}

// Find nearest airport (requires `airports` object)
function findNearestAirport(lat, lon){
  let closest=null;
  let minDistance=Infinity;
  const typePriority = { 'closed':-1, 'heliport':0,'seaplane_base':1,'small_airport':2,'medium_airport':3,'large_airport':3 };
  for(const [code, airport] of Object.entries(airports)){
    const distance = getDistance(lat, lon, airport.lat, airport.lon);
    const priority = typePriority[airport.type] || 0;
    const closestPriority = closest ? (typePriority[closest.type]||0) : -1;
    if(!closest || priority>closestPriority || (priority===closestPriority && distance<minDistance)){
      minDistance=distance;
      closest={code,...airport,distance};
    }
  }
  return closest;
}

// ==========================
// FILE UPLOAD HANDLER
// ==========================
document.getElementById("file-input").addEventListener("change", (event) => {
  const files = Array.from(event.target.files);
  if(!files.length) return;
  files.sort((a,b)=>a.name.localeCompare(b.name));
  lastFlight=null;

  // ----- CLEAR EVERYTHING -----
  flightPaths.forEach(poly=>poly.remove()); flightPaths.length=0;
  flightDecorators.forEach(deco=>deco.remove()); flightDecorators.length=0;
  connectionLabels.forEach(label=>label.remove()); connectionLabels.length=0;
  circleMarkersGroup.clearLayers();
  lowZoomMarkersGroup.clearLayers();
  labeledAirports.forEach(details=>{ if(details.label)details.label.remove(); if(details.connector)details.connector.remove(); });
  labeledAirports.clear();
  airportMarkers.clear();

  // ----- PROCESS FILES -----
  files.forEach((file,index)=>processFile(file,index===0,index===files.length-1));
});

// ==========================
// PROCESS SINGLE FILE
// ==========================
function processFile(file, isFirst, isLast){
  const reader = new FileReader();
  reader.onload = function(e){
    const lines = e.target.result.split(/\r?\n/);
    const dataLines = lines.filter((line, idx)=>idx===2||idx>2);
    const cleanedCSV = dataLines.join("\n");

    Papa.parse(cleanedCSV, {
      header:true,
      dynamicTyping:true,
      complete: results => {
        const data = results.data.filter(row=>(row.Latitude&&row.Longitude)||(row.latitude&&row.longitude));
        if(!data.length) return;

        const latlngs = data.map(row=>[row.Latitude||row.latitude,row.Longitude||row.longitude]);
        const color = colors[colorIndex++ % colors.length];
        const start = latlngs[0], end = latlngs[latlngs.length-1];

        const suggestedCode = extractAirportCode(file.name);
        const departureAirport = verifyAirportCode(suggestedCode,start[0],start[1]);
        const arrivalAirport = findNearestAirport(end[0],end[1])?.code;

        // ----- DRAW POLYLINE -----
        const polyline = L.polyline(latlngs,{color,weight:3,opacity:0.9}).addTo(map);
        flightPaths.push(polyline);

        // ----- ADD ARROWS -----
        const decorator = L.polylineDecorator(polyline,{
          patterns:[{offset:25, repeat:50, symbol:L.Symbol.arrowHead({pixelSize:12,polygon:false,pathOptions:{color,fillOpacity:1,weight:2}})}]
        }).addTo(map);
        flightDecorators.push(decorator);

        // ----- DEPARTURE AIRPORT -----
        if(departureAirport){
          const airportData = airports[departureAirport];
          if(airportData && !labeledAirports.has(departureAirport)){
            const details = createAirportLabel(departureAirport,[airportData.lat,airportData.lon],color);
            labeledAirports.set(departureAirport,details);
            const lowZoomMarker = createLowZoomMarker(departureAirport,[airportData.lat,airportData.lon],color);
            lowZoomMarker.addTo(lowZoomMarkersGroup);

            // Circle marker for high zoom
            L.circleMarker([airportData.lat,airportData.lon],{radius:6,color:color,fillColor:"white",fillOpacity:1})
              .bindPopup(`<b>${departureAirport}</b><br>Departure ${file.name}`)
              .addTo(circleMarkersGroup);
          }
        }

        // ----- ARRIVAL AIRPORT -----
        if(arrivalAirport){
          const airportData = airports[arrivalAirport];
          if(airportData && !labeledAirports.has(arrivalAirport)){
            const details = createAirportLabel(arrivalAirport,[airportData.lat,airportData.lon],color);
            labeledAirports.set(arrivalAirport,details);
            const lowZoomMarker = createLowZoomMarker(arrivalAirport,[airportData.lat,airportData.lon],color);
            lowZoomMarker.addTo(lowZoomMarkersGroup);

            // Circle marker for high zoom
            L.circleMarker([airportData.lat,airportData.lon],{radius:6,color:color,fillColor:"white",fillOpacity:0.9})
              .bindPopup(`<b>${arrivalAirport}</b><br>Arrival`)
              .addTo(circleMarkersGroup);
          }
        }

        // ----- CONNECTION LABEL -----
        if(departureAirport && arrivalAirport && departureAirport!==arrivalAirport){
          const midLat = (start[0]+end[0])/2, midLng=(start[1]+end[1])/2;
          const label = L.marker([midLat,midLng],{
            icon: L.divIcon({
              className:'airport-label',
              html:`<div style="color:${color};font-weight:bold;background:rgba(255,255,255,0.8);padding:2px 4px;border-radius:3px;">${departureAirport} → ${arrivalAirport}</div>`,
              iconSize:[80,20], iconAnchor:[40,10]
            })
          }).addTo(map);
          connectionLabels.push(label);
        }

        polyline.bindPopup(`<b>${file.name}</b>`);
        lastFlight={airport:arrivalAirport,end:end};
        map.fitBounds(polyline.getBounds(),{padding:[50,50]});
      }
    });
  };
  reader.readAsText(file);
}
