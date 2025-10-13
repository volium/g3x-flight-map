# G3X Flight Map - Modular Architecture

This document describes the modular architecture of the G3X Flight Map application.

## Module Overview

The application has been refactored from a single 818-line `script.js` file into 10 focused modules:

### 1. **constants.js**
- Defines all application constants
- Flight path colors
- Label positioning parameters
- Airport type priorities
- Detection thresholds

### 2. **utils.js**
- Utility functions for calculations
- `getDistance()` - Haversine distance calculation
- `extractAirportCode()` - Parse airport codes from filenames
- `getZoomAdjustedValues()` - Calculate zoom-based label positioning

### 3. **map-init.js**
- Map initialization and configuration
- Layer group management
- Global state (labeledAirports, intermediateStopLabels, etc.)
- Map reset functionality
- Color cycling for flight paths

### 4. **airport-finder.js**
- Airport search and verification logic
- `findNearestAirport()` - Find closest airport with type priority
- `verifyAirportCode()` - Verify airport codes using coordinates
- Handles airport type priorities (large > medium > small > heliport, etc.)

### 5. **intermediate-stops.js**
- Intermediate stop detection algorithm
- `detectIntermediateStops()` - Analyzes flight data for landings
- Uses AGL and ground speed thresholds
- Filters duplicate/nearby airports

### 6. **labels.js**
- Label positioning and creation
- `adjustLabelPosition()` - Smart label positioning to avoid overlaps
- `createAirportLabel()` - Creates labels with connector lines
- Spiral search algorithm for non-overlapping positions

### 7. **markers.js**
- Marker creation and management
- `createLowZoomMarker()` - Creates low-zoom markers
- `setupMarkerVisibilityHandler()` - Manages zoom-based marker visibility
- Handles both departure/arrival and intermediate stop markers

### 8. **file-processor.js**
- CSV file processing
- `processFile()` - Main file processing logic
- Parses CSV data
- Creates flight paths, markers, and labels
- Integrates all other modules

### 9. **event-handlers.js**
- UI event handling
- `setupIntermediateStopsToggle()` - Handles intermediate stops checkbox
- `setupFileUploadHandler()` - Processes file uploads
- `setupEventHandlers()` - Initializes all event handlers

### 10. **main.js**
- Application entry point
- Initializes the map on page load
- Sets up event handlers

## Module Loading Order

The modules must be loaded in the correct order (as specified in `index.html`):

1. `constants.js` - Must be loaded first (defines constants used everywhere)
2. `utils.js` - Utility functions used by other modules
3. `map-init.js` - Creates global map and layer groups
4. `airport-finder.js` - Airport search (uses utils, map, constants)
5. `intermediate-stops.js` - Stop detection (uses airport-finder, utils, constants)
6. `labels.js` - Label creation (uses utils, map, constants)
7. `markers.js` - Marker creation (uses map, constants)
8. `file-processor.js` - File processing (uses all above modules)
9. `event-handlers.js` - Event setup (uses all above modules)
10. `main.js` - Entry point (calls initialization functions)

## Benefits of This Architecture

### Maintainability
- Each module has a single, clear responsibility
- Easy to locate and fix bugs
- Changes in one area don't affect others

### Readability
- Smaller, focused files are easier to understand
- Clear module names indicate purpose
- Well-documented function headers

### Testability
- Modules can be tested independently
- Pure functions (like utils) are easy to unit test
- Clear dependencies make mocking easier

### Extensibility
- New features can be added as new modules
- Existing modules can be extended without affecting others
- Clear interfaces between modules

## Global State

The following global objects are shared across modules (defined in `map-init.js`):

- `map` - Leaflet map instance
- `circleMarkersGroup` - High-zoom marker layer
- `lowZoomMarkersGroup` - Low-zoom marker layer
- `intermediateStopsCircleMarkersGroup` - Intermediate stop high-zoom markers
- `intermediateStopsLowZoomMarkersGroup` - Intermediate stop low-zoom markers
- `labeledAirports` - Map of departure/arrival airport labels
- `intermediateStopLabels` - Map of intermediate stop labels
- `airportMarkers` - Map of low-zoom markers
- `colorIndex` - Current color index for flight paths
- `lastFlight` - Last processed flight info

## Future Improvements

Potential areas for further enhancement:

1. **ES6 Modules** - Convert to ES6 modules with import/export
2. **TypeScript** - Add type safety
3. **State Management** - Implement a centralized state management pattern
4. **Testing** - Add unit tests for each module
5. **Build Process** - Add bundling and minification
6. **Configuration** - Move constants to a config file
