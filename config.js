// Configuration constants for the map generator
const CONFIG = {
  // Map settings
  MAP_SIZE: 1024,

  // Island generation
  ISLAND_ELONGATION: 2.0,    // Height/width ratio (vertical orientation)
  ISLAND_SIZE: 0.35,         // Percentage of map covered
  COASTLINE_NOISE: 0.40,     // Increased for more variation
  NOISE_OCTAVES: 4,          // Detail levels for coastline

  // Visual settings
  OCEAN_COLOR: '#2E86AB',
  LAND_COLOR: '#8B7355',

  // Debug
  DEBUG_MODE: true,
  SHOW_METRICS: true
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}