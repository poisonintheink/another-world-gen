// Configuration constants for the map generator
const CONFIG = {
  // Map settings
  MAP_SIZE: 1024,

  // Island generation
  ISLAND_ELONGATION: 2.0,    // Height/width ratio (vertical orientation)
  ISLAND_SIZE: 0.35,         // Percentage of map covered
  COASTLINE_NOISE: 0.40,     // Increased for more variation
  NOISE_OCTAVES: 4,          // Detail levels for coastline

  // Voronoi generation
  TARGET_REGIONS: 7,         // Desired number of regions
  REGION_BUFFER: 1.4,        // Multiply target to account for edge removal
  MIN_REGION_SIZE: 2000,     // Minimum pixels per region
  POINT_JITTER: 0.4,         // How much to randomize grid points (0-1)

  // Visual settings
  OCEAN_COLOR: '#2E86AB',
  LAND_COLOR: '#8B7355',
  REGION_COLORS: [           // Palette for regions
    '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557',
    '#F4A261', '#E76F51', '#2A9D8F', '#E9C46A', '#264653'
  ],

  // Debug
  DEBUG_MODE: true,
  SHOW_METRICS: true,
  SHOW_SEED_POINTS: true,    // Show Voronoi seed points
  SHOW_REGION_BORDERS: true  // Highlight region boundaries
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}