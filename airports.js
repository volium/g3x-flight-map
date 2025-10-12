// Load airports from CSV
let airports = {};
const localCSVPath = 'airports.csv';
const remoteCSVPath = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

async function loadAirportsData() {
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
              !airport.name.includes('(Duplicate)') &&  // Filter out duplicate entries
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

        // Validate some key airports
        const keyAirports = ['CYTZ', 'CPZ9'];
        keyAirports.forEach(code => {
          if (airports[code]) {
            console.log(`Loaded airport ${code}:`, airports[code]);
          } else {
            console.warn(`Failed to load airport ${code}`);
          }
        });

        console.log(`Loaded ${Object.keys(airports).length} airports`);
      }
    });
  } catch (error) {
    console.error('Error loading airports data:', error);
    // Fallback to empty airports object if both remote and local fail
    airports = {};
  }
}

// Load the airports data when the script is loaded
loadAirportsData();
