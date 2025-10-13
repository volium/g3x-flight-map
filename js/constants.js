/**
 * Constants used throughout the application
 */

// Flight path colors (cycles through these)
const FLIGHT_COLORS = [
  "#ff0000",
  "#ff8800",
  "#ffaa00",
  "#00aaff",
  "#00cc66",
  "#cc00ff",
  "#ff0099",
  "#0055ff",
];

// Label management constants
const BASE_MIN_LABEL_DISTANCE = 50; // Base minimum pixels between labels
const BASE_LABEL_MARGIN = 20; // Base margin around airport point for label placement
const MAX_PIXEL_DISTANCE = 100; // Maximum pixels away from airport
const MIN_ZOOM = 4; // Minimum zoom level for reference
const MAX_ZOOM = 12; // Maximum zoom level for reference
const CIRCLE_MARKER_MIN_ZOOM = 13; // Minimum zoom level to show circle markers

// Airport type priority (higher = better)
const AIRPORT_TYPE_PRIORITY = {
  'closed': -1,
  'heliport': 0,
  'seaplane_base': 1,
  'small_airport': 2,
  'medium_airport': 3,
  'large_airport': 3
};

// Intermediate stop detection
const PROXIMITY_THRESHOLD_KM = 2; // Airports within this distance are considered same landing
