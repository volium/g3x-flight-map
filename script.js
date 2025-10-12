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

// Handle file uploads
document.getElementById("file-input").addEventListener("change", (event) => {
  const files = Array.from(event.target.files);
  files.sort((a, b) => a.name.localeCompare(b.name)); // chronological order
  files.forEach((file) => processFile(file));
});

function processFile(file) {
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    complete: (results) => {
      const data = results.data.filter(
        (row) => row.latitude && row.longitude
      );

      if (data.length === 0) return;

      const latlngs = data.map((row) => [row.latitude, row.longitude]);
      const color = colors[colorIndex++ % colors.length];

      // Draw flight path
      const polyline = L.polyline(latlngs, {
        color: color,
        weight: 3,
        opacity: 0.9,
      }).addTo(map);

      // Add start/end markers
      const start = latlngs[0];
      const end = latlngs[latlngs.length - 1];
      const startMarker = L.circleMarker(start, {
        radius: 6,
        color: color,
        fillColor: "white",
        fillOpacity: 1,
      })
        .bindPopup(`<b>${file.name}</b><br>Start`)
        .addTo(map);
      const endMarker = L.circleMarker(end, {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.9,
      })
        .bindPopup(`<b>${file.name}</b><br>End`)
        .addTo(map);

      polyline.bindPopup(`<b>${file.name}</b>`);

      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    },
  });
}
