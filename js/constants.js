/**
 * Constants used throughout the application
 */

// Flight path color modes
const COLOR_MODES = {
  SINGLE: 'single',
  MULTI: 'multi',
  GRADIENT: 'gradient',
  GRADIENT_GLOBAL: 'gradient-global'
};

// Default single color for flights (vibrant blue)
const SINGLE_FLIGHT_COLOR = "#0066FF";

// Expanded flight path colors (30+ distinct colors for multiple flights)
const FLIGHT_COLORS = [
  "#FF3366", "#FF6B35", "#FF9500", "#FFB700", "#FFD700",  // Warm: Red → Orange → Yellow
  "#B8E62E", "#7DCE13", "#00C853", "#00BFA5", "#00ACC1",  // Green → Teal
  "#00A8FF", "#0091FF", "#0080FF", "#0066FF", "#0050FF",  // Blue spectrum
  "#6C5CE7", "#8E44AD", "#9B59B6", "#C44569", "#E84393",  // Purple → Pink
  "#E74C3C", "#E67E22", "#F39C12", "#F1C40F", "#FFC312",  // Bright warm
  "#1ABC9C", "#16A085", "#27AE60", "#2ECC71", "#3498DB",  // Bright cool
  "#9B59B6", "#8E44AD", "#E74C3C", "#C0392B", "#D35400"   // Additional variety
];

// Modern track styling
const TRACK_STYLE = {
  weight: 4,           // Slightly thicker for modern look
  opacity: 0.85,       // Slightly transparent
  smoothFactor: 1.5,   // Smoother curves
  lineCap: 'round',    // Rounded ends
  lineJoin: 'round'    // Rounded corners
};

// Arrow styling for better visibility
const ARROW_STYLE = {
  size: 16,            // Larger arrows
  fillOpacity: 1,      // Fully opaque
  weight: 3,           // Thick outline
  color: '#000000',    // Black outline
  fillColor: '#FFFFFF' // White fill
};

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
