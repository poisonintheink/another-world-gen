// Region refinement - smoothing borders and creating counties
class RegionRefiner {
  constructor(config, island, voronoi) {
    this.config = config;
    this.island = island;
    this.voronoi = voronoi;
    this.size = config.MAP_SIZE;

    // Smoothing parameters
    this.SMOOTH_ITERATIONS = 3;
    this.SMOOTH_RADIUS = 2;
    this.SMOOTH_THRESHOLD = 0.5;
  }

  // Main refinement process
  refine() {
    console.log('Starting region refinement...');

    // Step 1: Identify and smooth borders
    this.smoothRegionBorders();

    // Step 2: Recalculate centroids after smoothing
    this.recalculateCentroids();

    // Step 3: Transform regions into counties with town centers
    this.createCounties();

    return this.voronoi;
  }

  // Smooth borders between regions (but not coastlines)
  smoothRegionBorders() {
    console.log('Smoothing region borders...');

    for (let iter = 0; iter < this.SMOOTH_ITERATIONS; iter++) {
      const newRegionMap = new Int16Array(this.voronoi.regionMap);

      // Find and smooth border pixels
      for (let y = 1; y < this.size - 1; y++) {
        for (let x = 1; x < this.size - 1; x++) {
          const index = y * this.size + x;

          // Skip water pixels
          if (this.island.mask[index] === 0) continue;

          const currentRegion = this.voronoi.regionMap[index];
          if (currentRegion === -1) continue;

          // Check if this is a border pixel
          if (this.isBorderPixel(x, y)) {
            // Don't smooth if adjacent to water (preserve coastlines)
            if (!this.isAdjacentToWater(x, y)) {
              const smoothedRegion = this.getSmoothingVote(x, y);
              if (smoothedRegion !== -1) {
                newRegionMap[index] = smoothedRegion;
              }
            }
          }
        }
      }

      // Apply smoothed map
      this.voronoi.regionMap = newRegionMap;
    }

    // Clean up any isolated pixels
    this.cleanupIsolatedPixels();
  }

  // Check if pixel is on border between regions
  isBorderPixel(x, y) {
    const index = y * this.size + x;
    const currentRegion = this.voronoi.regionMap[index];

    // Check 4-neighbors
    const neighbors = [
      { dx: 0, dy: -1 }, // top
      { dx: 1, dy: 0 },  // right
      { dx: 0, dy: 1 },  // bottom
      { dx: -1, dy: 0 }  // left
    ];

    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

      const nIndex = ny * this.size + nx;
      const neighborRegion = this.voronoi.regionMap[nIndex];

      // Different region (and not water)
      if (neighborRegion !== currentRegion && this.island.mask[nIndex] === 1) {
        return true;
      }
    }

    return false;
  }

  // Check if pixel is adjacent to water
  isAdjacentToWater(x, y) {
    const neighbors = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
    ];

    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

      const nIndex = ny * this.size + nx;
      if (this.island.mask[nIndex] === 0) {
        return true;
      }
    }

    return false;
  }

  // Get smoothing vote based on neighboring regions
  getSmoothingVote(x, y) {
    const regionCounts = new Map();

    // Count regions in radius
    for (let dy = -this.SMOOTH_RADIUS; dy <= this.SMOOTH_RADIUS; dy++) {
      for (let dx = -this.SMOOTH_RADIUS; dx <= this.SMOOTH_RADIUS; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

        const nIndex = ny * this.size + nx;

        // Only count land pixels
        if (this.island.mask[nIndex] === 1) {
          const region = this.voronoi.regionMap[nIndex];
          if (region !== -1) {
            regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
          }
        }
      }
    }

    // Find majority region
    let maxCount = 0;
    let majorityRegion = -1;
    const totalCount = Array.from(regionCounts.values()).reduce((a, b) => a + b, 0);

    for (const [region, count] of regionCounts) {
      if (count > maxCount && count / totalCount >= this.SMOOTH_THRESHOLD) {
        maxCount = count;
        majorityRegion = region;
      }
    }

    return majorityRegion;
  }

  // Remove isolated pixels (single pixels surrounded by different region)
  cleanupIsolatedPixels() {
    const newRegionMap = new Int16Array(this.voronoi.regionMap);

    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        const index = y * this.size + x;

        if (this.island.mask[index] === 0) continue;

        const currentRegion = this.voronoi.regionMap[index];
        if (currentRegion === -1) continue;

        // Count matching neighbors
        let matchingNeighbors = 0;
        let differentRegion = -1;

        const neighbors = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
        ];

        for (const { dx, dy } of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          const nIndex = ny * this.size + nx;

          if (this.island.mask[nIndex] === 1) {
            const neighborRegion = this.voronoi.regionMap[nIndex];
            if (neighborRegion === currentRegion) {
              matchingNeighbors++;
            } else if (neighborRegion !== -1) {
              differentRegion = neighborRegion;
            }
          }
        }

        // If isolated, switch to neighbor region
        if (matchingNeighbors === 0 && differentRegion !== -1) {
          newRegionMap[index] = differentRegion;
        }
      }
    }

    this.voronoi.regionMap = newRegionMap;
  }

  // Recalculate centroids after smoothing
  recalculateCentroids() {
    console.log('Recalculating centroids...');

    // Reset centroid data
    for (const region of this.voronoi.regions) {
      region.centroid = { x: 0, y: 0 };
      region.pixels = 0;
    }

    // Sum positions
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        const regionId = this.voronoi.regionMap[index];

        if (regionId !== -1) {
          const region = this.voronoi.regions[regionId];
          if (region) {
            region.centroid.x += x;
            region.centroid.y += y;
            region.pixels++;
          }
        }
      }
    }

    // Calculate averages
    for (const region of this.voronoi.regions) {
      if (region.pixels > 0) {
        region.centroid.x = Math.round(region.centroid.x / region.pixels);
        region.centroid.y = Math.round(region.centroid.y / region.pixels);
      }
    }
  }

  // Transform regions into counties with town centers
  createCounties() {
    console.log('Creating counties with town centers...');

    for (const region of this.voronoi.regions) {
      // Create county data
      region.county = {
        id: region.id,
        name: `County ${region.id + 1}`, // Placeholder names
        townCenter: null
      };

      // Find best location for town center
      const townLocation = this.findBestTownLocation(region);
      if (townLocation) {
        region.county.townCenter = townLocation;
      } else {
        // Fallback to centroid if no better location found
        console.warn(`Using centroid for county ${region.id} town center`);
        region.county.townCenter = { ...region.centroid };
      }
    }
  }

  // Find best location for town center (away from borders, on land)
  findBestTownLocation(region) {
    const candidates = [];
    const minDistFromBorder = 10; // Minimum pixels from border

    // Search area around centroid
    const searchRadius = 30;
    const cx = region.centroid.x;
    const cy = region.centroid.y;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const x = cx + dx;
        const y = cy + dy;

        if (x < 0 || x >= this.size || y < 0 || y >= this.size) continue;

        const index = y * this.size + x;

        // Must be in this region
        if (this.voronoi.regionMap[index] !== region.id) continue;

        // Must be on land
        if (this.island.mask[index] !== 1) continue;

        // Check distance from borders
        const distFromBorder = this.getDistanceFromBorder(x, y, region.id);
        const distFromWater = this.getDistanceFromWater(x, y);

        if (distFromBorder >= minDistFromBorder && distFromWater >= 5) {
          candidates.push({
            x, y,
            score: distFromBorder + distFromWater * 0.5, // Prefer away from borders and water
            distFromCentroid: Math.sqrt(dx * dx + dy * dy)
          });
        }
      }
    }

    // Sort by score (higher is better) and prefer closer to centroid
    candidates.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 1) {
        return a.distFromCentroid - b.distFromCentroid;
      }
      return scoreDiff;
    });

    return candidates[0] || null;
  }

  // Get minimum distance from pixel to region border
  getDistanceFromBorder(x, y, regionId) {
    let minDist = Infinity;

    // Simple approach: expand outward until we hit a different region
    for (let radius = 1; radius < 50; radius++) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
        const nx = Math.round(x + Math.cos(angle) * radius);
        const ny = Math.round(y + Math.sin(angle) * radius);

        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) {
          return radius;
        }

        const nIndex = ny * this.size + nx;
        if (this.voronoi.regionMap[nIndex] !== regionId) {
          return radius;
        }
      }
    }

    return 50; // Max distance checked
  }

  // Get minimum distance from pixel to water
  getDistanceFromWater(x, y) {
    for (let radius = 1; radius < 30; radius++) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
        const nx = Math.round(x + Math.cos(angle) * radius);
        const ny = Math.round(y + Math.sin(angle) * radius);

        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

        const nIndex = ny * this.size + nx;
        if (this.island.mask[nIndex] === 0) {
          return radius;
        }
      }
    }

    return 30; // Max distance checked
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RegionRefiner;
}