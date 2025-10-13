/**
 * Label positioning and creation logic
 */

/**
 * Find non-overlapping position for label
 * @param {string} airport - Airport code
 * @param {L.LatLng} position - Original position
 * @param {Map} existingLabels - Map of existing labels
 * @returns {L.LatLng} Adjusted position for label
 */
function adjustLabelPosition(airport, position, existingLabels) {
  const zoom = map.getZoom();
  const { labelDistance, labelMargin } = getZoomAdjustedValues(zoom);
  const point = map.latLngToContainerPoint(position);

  // Fixed minimum offset from marker (20 pixels)
  const minOffset = 20;

  // Define preferred positions to try (in order: up, down, left, right, then diagonals)
  const positions = [
    { angle: Math.PI / 2, radius: minOffset },      // above
    { angle: -Math.PI / 2, radius: minOffset },     // below
    { angle: Math.PI, radius: minOffset },          // left
    { angle: 0, radius: minOffset },                // right
    { angle: Math.PI / 4, radius: minOffset },      // top-right
    { angle: -Math.PI / 4, radius: minOffset },     // bottom-right
    { angle: 3 * Math.PI / 4, radius: minOffset },  // top-left
    { angle: -3 * Math.PI / 4, radius: minOffset }  // bottom-left
  ];

  // Try each preferred position first
  for (const pos of positions) {
    const x = pos.radius * Math.cos(pos.angle);
    const y = pos.radius * Math.sin(pos.angle);
    const testPoint = point.add(L.point(x, y));
    const newPos = map.containerPointToLatLng(testPoint);

    // Check for overlaps
    let hasOverlap = false;
    for (const [code, details] of existingLabels) {
      if (code === airport) continue;
      const labelPoint = map.latLngToContainerPoint(details.labelPosition);
      if (testPoint.distanceTo(labelPoint) < labelDistance) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      return newPos;
    }
  }

  // If preferred positions don't work, spiral outward from minimum offset
  let angle = 0;
  let radius = minOffset;
  const maxAttempts = 32; // Limit search iterations

  for (let i = 0; i < maxAttempts; i++) {
    // Calculate new position in spiral pattern
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const testPoint = point.add(L.point(x, y));

    // Check if we've gone too far from the airport
    if (testPoint.distanceTo(point) > MAX_PIXEL_DISTANCE) {
      break; // Stop searching if we're too far
    }

    // Convert back to LatLng for actual placement
    const newPos = map.containerPointToLatLng(testPoint);

    // Check for overlaps
    let hasOverlap = false;
    for (const [code, details] of existingLabels) {
      if (code === airport) continue;
      const labelPoint = map.latLngToContainerPoint(details.labelPosition);
      const distance = testPoint.distanceTo(labelPoint);
      if (distance < labelDistance) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      return newPos;
    }

    // Spiral outward
    angle += Math.PI / 4;
    if (angle >= Math.PI * 2) {
      angle = 0;
      radius += labelMargin;
    }
  }

  // If no good position found, place it at maximum allowed distance
  const fallbackAngle = Math.random() * Math.PI * 2;
  const fallbackX = MAX_PIXEL_DISTANCE * Math.cos(fallbackAngle);
  const fallbackY = MAX_PIXEL_DISTANCE * Math.sin(fallbackAngle);
  return map.containerPointToLatLng(point.add(L.point(fallbackX, fallbackY)));
}

/**
 * Create airport label with connector line if needed
 * @param {string} airport - Airport code
 * @param {Array} position - [lat, lon] position array
 * @param {string} color - Color for the label
 * @param {Map|null} existingLabels - Optional map of existing labels
 * @param {boolean} addToMap - Whether to add the label to the map immediately
 * @returns {Object} Object containing label, connector, positions, and color
 */
function createAirportLabel(airport, position, color, existingLabels = null, addToMap = true) {
  // If no existingLabels provided, combine both maps
  const labelsToCheck = existingLabels || new Map([...labeledAirports, ...intermediateStopLabels]);
  const adjustedPosition = adjustLabelPosition(airport, position, labelsToCheck);

  // Create label
  const label = L.marker(adjustedPosition, {
    icon: L.divIcon({
      className: 'airport-label',
      html: `<div style="color: ${color}; font-weight: bold; background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px;">${airport}</div>`,
      iconSize: [40, 20],
      iconAnchor: [20, 10]
    })
  });

  if (addToMap) {
    label.addTo(map);
  }

  // Create connector line if label was moved
  let connector = null;
  if (adjustedPosition.lat !== position.lat || adjustedPosition.lng !== position.lng) {
    connector = L.polyline([position, adjustedPosition], {
      color: color,
      weight: 1,
      opacity: 0.5,
      dashArray: '3,3'
    });

    if (addToMap) {
      connector.addTo(map);
    }
  }

  return {
    label,
    connector,
    position: position,
    labelPosition: adjustedPosition,
    color: color
  };
}
