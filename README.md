# g3x-flight-map

A web-based flight visualization tool for Garmin G3X avionics CSV flight logs.

## Local Development

**Important:** This application requires a local web server. Do NOT open `index.html` directly via `file://` protocol.

### Quick Start (Python - recommended)

```bash
cd /Users/rot/git/g3x-flight-map
python3 -m http.server 8080
```

Then open: <http://localhost:8080>

### Alternative (http-server with gzip)

```bash
npm install -g http-server
./serve.sh
```

Then open: <http://localhost:8080>

## Features

- Upload multiple CSV flight logs from Garmin G3X avionics
- Visualize flight paths on interactive maps with **4 curated basemap options**
- Automatic airport detection for departure/arrival
- Intermediate stop detection with configurable thresholds
- Color-coded flight paths with directional arrows
- Smart label positioning to avoid overlaps
- Zoom-adaptive markers and labels

## Basemap Options

The application includes **4 carefully curated basemap options** accessible via the layer control in the top-right corner:

1. **✨ Positron** (default) - Ultra-clean, light basemap with minimal clutter, perfect for dense flight paths
2. **🧭 Voyager** - Balanced style with clear labels and subtle detail
3. **⚪📍 Light Gray + Labels** - Clean gray background with city names and major roads
4. **⚫📍 Dark Gray + Labels** - Balanced dark theme with city names and major roads (great for dark mode)

All basemaps are free and require no API keys.

## Usage

1. Start a local web server (see above)
2. Open the page in your browser
3. Click "Choose Files" and select your G3X CSV log files
4. The map will automatically display all flights with airports labeled
5. Use the **layer control** (top-right) to switch between different basemaps
6. Adjust AGL/Speed thresholds to fine-tune intermediate stop detection
7. Toggle intermediate stops visibility as needed
