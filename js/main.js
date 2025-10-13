/**
 * Main entry point for the G3X Flight Map application
 * Initializes the map and sets up event handlers
 */

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing G3X Flight Map application...');

  // Initialize the map
  initializeMap();

  // Setup all event handlers
  setupEventHandlers();

  console.log('G3X Flight Map application initialized successfully');
});
