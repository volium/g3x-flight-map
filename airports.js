// Load airports from CSV
let airports = {};
let airportsLoading = null; // Promise to track loading state
let airportsLoaded = false;

const localCSVPath = 'airports.csv';
const remoteCSVPath = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

/**
 * Load airports data on-demand (called when user uploads files)
 * @returns {Promise} Promise that resolves when airports are loaded
 */
function loadAirportsData() {
  // If already loaded, return immediately
  if (airportsLoaded) {
    return Promise.resolve();
  }

  // If currently loading, return existing promise
  if (airportsLoading) {
    return airportsLoading;
  }

  // Start loading
  airportsLoading = new Promise(async (resolve, reject) => {
    try {
      // Try to fetch remote data first
      let csvData;
      try {
        const response = await fetch(remoteCSVPath);
        if (!response.ok) throw new Error('Remote data unavailable');
        csvData = await response.text();
      } catch (e) {
        // If remote fails, try local file
        console.log('Using local airport database...');
        const response = await fetch(localCSVPath);
        if (!response.ok) throw new Error('Local data unavailable');
        csvData = await response.text();
      }

      // Parse CSV data
      Papa.parse(csvData, {
        header: true,
        complete: function(results) {
          // Filter for airports with ICAO codes and valid coordinates
          results.data.forEach(airport => {
            if (airport.ident &&
                airport.latitude_deg &&
                airport.longitude_deg &&
                airport.name &&
                !airport.name.includes('(Duplicate)') &&
                !isNaN(airport.latitude_deg) &&
                !isNaN(airport.longitude_deg)) {
              airports[airport.ident] = {
                lat: parseFloat(airport.latitude_deg),
                lon: parseFloat(airport.longitude_deg),
                name: airport.name,
                type: airport.type
              };
            }
          });

          airportsLoaded = true;
          console.log(`Loaded ${Object.keys(airports).length} airports`);
          resolve();
        },
        error: function(error) {
          console.error('Error parsing airports CSV:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error loading airports data:', error);
      airports = {};
      airportsLoaded = true; // Mark as loaded even on error to prevent retries
      reject(error);
    }
  });

  return airportsLoading;
}
