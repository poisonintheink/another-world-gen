// Voronoi region generator for the island
class VoronoiGenerator {
  constructor(config, random, island) {
    this.config = config;
    this.random = random;
    this.island = island;
    this.size = config.MAP_SIZE;
  }

  // Generate Voronoi regions on the island
  generate() {
    console.log('Generating Voronoi regions...');

    // Calculate how many points we need - increase buffer for safety
    const landArea = this.island.landPixels;
    const avgRegionSize = landArea / this.config.TARGET_REGIONS;
    const pointsNeeded = Math.ceil(this.config.TARGET_REGIONS * 1.5);

    console.log(`Land area: ${landArea}, Target regions: ${this.config.TARGET_REGIONS}, Points to place: ${pointsNeeded}`);

    // Generate seed points within the island
    const seedPoints = this.generateSeedPoints(pointsNeeded);

    // Create Voronoi regions using pixel-based approach
    const voronoi = this.createVoronoiRegions(seedPoints);

    // Remove regions that touch water/edge
    this.removeEdgeRegions(voronoi);

    // Remove regions that are too small
    this.removeSmallRegions(voronoi);

    // Calculate region properties
    this.calculateRegionProperties(voronoi);

    console.log(`Final region count: ${voronoi.regions.length}`);

    return voronoi;
  }

  // Generate seed points within the island bounds - IMPROVED VERSION
  // Generate seed points within the island bounds - IMPROVED DISTRIBUTION
  generateSeedPoints(count) {
    const points = [];

    // First, create a density map to understand where land is
    const landPixels = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        if (this.island.mask[index] === 1) {
          landPixels.push({ x, y });
        }
      }
    }

    console.log(`Found ${landPixels.length} land pixels to distribute ${count} points across`);

    // Method 1: Stratified sampling - divide land into regions and place one point per region
    if (count <= 20) {  // For reasonable region counts, use stratified sampling
      // Shuffle land pixels for randomness
      for (let i = landPixels.length - 1; i > 0; i--) {
        const j = Math.floor(this.random.next() * (i + 1));
        [landPixels[i], landPixels[j]] = [landPixels[j], landPixels[i]];
      }

      // Calculate stride to evenly sample across all land pixels
      const stride = Math.floor(landPixels.length / count);

      for (let i = 0; i < count && i * stride < landPixels.length; i++) {
        // Start at evenly spaced positions
        const baseIndex = i * stride;

        // Add some randomness within the stride
        const jitter = Math.floor(this.random.float(0, stride * 0.5));
        const index = Math.min(baseIndex + jitter, landPixels.length - 1);

        const pixel = landPixels[index];

        // Check minimum distance to other points
        const minDist = Math.sqrt(this.island.landPixels / count) * 0.5; // Dynamic min distance
        let tooClose = false;

        for (const other of points) {
          const dist = Math.sqrt((pixel.x - other.x) ** 2 + (pixel.y - other.y) ** 2);
          if (dist < minDist) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          points.push({ x: pixel.x, y: pixel.y, id: points.length });
        }
      }
    }

    // Method 2: If we still need more points, use relaxation
    let attempts = 0;
    const maxAttempts = count * 50;
    const minDist = Math.sqrt(this.island.landPixels / count) * 0.4;

    while (points.length < count && attempts < maxAttempts) {
      attempts++;

      // Pick a random land pixel
      const pixel = landPixels[Math.floor(this.random.next() * landPixels.length)];

      // Check distance to existing points
      let tooClose = false;
      for (const other of points) {
        const dist = Math.sqrt((pixel.x - other.x) ** 2 + (pixel.y - other.y) ** 2);
        if (dist < minDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        points.push({ x: pixel.x, y: pixel.y, id: points.length });
      }
    }

    // Optional: Apply Lloyd's relaxation for better distribution
    if (points.length >= count * 0.8) {  // Only if we got most points we wanted
      this.relaxSeedPoints(points, 2);  // 2 iterations
    }

    console.log(`Placed ${points.length} seed points after ${attempts} attempts`);
    return points;
  }

  // Lloyd's relaxation to improve point distribution
  relaxSeedPoints(points, iterations = 1) {
    for (let iter = 0; iter < iterations; iter++) {
      // Calculate Voronoi regions for current points
      const tempVoronoi = this.createVoronoiRegions(points);
      this.calculateRegionProperties(tempVoronoi);

      // Move each point toward its region's centroid
      for (let i = 0; i < points.length; i++) {
        const region = tempVoronoi.regions.find(r => r.seedPoint.id === points[i].id);
        if (region && region.pixels > 0) {
          // Move point 50% toward centroid
          const dx = region.centroid.x - points[i].x;
          const dy = region.centroid.y - points[i].y;

          const newX = Math.round(points[i].x + dx * 0.5);
          const newY = Math.round(points[i].y + dy * 0.5);

          // Ensure new position is on land
          const index = newY * this.size + newX;
          if (index >= 0 && index < this.island.mask.length && this.island.mask[index] === 1) {
            points[i].x = newX;
            points[i].y = newY;
          }
        }
      }
    }

    console.log('Applied Lloyd\'s relaxation to improve distribution');
  }

  // Check if a seed point location is valid
  isValidSeedPoint(x, y, existingPoints, minDistance) {
    // Check bounds
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return false;

    // Check if on land
    const index = y * this.size + x;
    if (this.island.mask[index] !== 1) return false;

    // Remove water distance check - we WANT regions near water!

    // Check distance to other points
    for (const other of existingPoints) {
      const dist = Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2);
      if (dist < minDistance) return false;
    }

    return true;
  }

  // Get distance to nearest water pixel (simple approximation)
  getDistanceToWater(x, y) {
    const checkRadius = 20;

    for (let r = 1; r <= checkRadius; r++) {
      // Check in expanding circles
      for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
        const checkX = Math.round(x + Math.cos(angle) * r);
        const checkY = Math.round(y + Math.sin(angle) * r);

        if (checkX < 0 || checkX >= this.size || checkY < 0 || checkY >= this.size) {
          return r;
        }

        const index = checkY * this.size + checkX;
        if (this.island.mask[index] === 0) {
          return r;
        }
      }
    }

    return checkRadius;
  }

  // Create Voronoi regions using pixel-based approach
  createVoronoiRegions(seedPoints) {
    const voronoi = {
      width: this.size,
      height: this.size,
      points: seedPoints,
      regionMap: new Int16Array(this.size * this.size), // Which region each pixel belongs to
      regions: []
    };

    // Initialize region map with -1 (no region)
    voronoi.regionMap.fill(-1);

    // For each pixel, find nearest seed point
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;

        // Skip water pixels
        if (this.island.mask[index] === 0) continue;

        // Find nearest seed point
        let minDist = Infinity;
        let nearestId = -1;

        for (const point of seedPoints) {
          const dist = (x - point.x) ** 2 + (y - point.y) ** 2; // Squared distance is fine
          if (dist < minDist) {
            minDist = dist;
            nearestId = point.id;
          }
        }

        voronoi.regionMap[index] = nearestId;
      }
    }

    // Create region objects
    for (let i = 0; i < seedPoints.length; i++) {
      voronoi.regions.push({
        id: i,
        seedPoint: seedPoints[i],
        pixels: 0,
        touchesEdge: false,
        touchesWater: false,
        neighbors: new Set(),
        bounds: {
          minX: this.size,
          minY: this.size,
          maxX: 0,
          maxY: 0
        }
      });
    }

    return voronoi;
  }

  // Remove regions that touch water or map edge
  // Remove regions that touch map edge ONLY (not water!)
  removeEdgeRegions(voronoi) {
    const regionsToRemove = new Set();

    // Only check actual map edges
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        const regionId = voronoi.regionMap[index];

        if (regionId === -1) continue;

        // Only remove if touching the actual map boundary
        if (x === 0 || x === this.size - 1 || y === 0 || y === this.size - 1) {
          voronoi.regions[regionId].touchesEdge = true;
          regionsToRemove.add(regionId);
        }
      }
    }

    console.log(`Removing ${regionsToRemove.size} regions that touch map edge`);

    // Remove the regions
    for (let i = 0; i < voronoi.regionMap.length; i++) {
      if (regionsToRemove.has(voronoi.regionMap[i])) {
        voronoi.regionMap[i] = -1;
      }
    }

    // Filter out removed regions
    voronoi.regions = voronoi.regions.filter(r => !regionsToRemove.has(r.id));
  }

  // Remove regions that are too small
  removeSmallRegions(voronoi) {
    // Count pixels per region
    for (let i = 0; i < voronoi.regionMap.length; i++) {
      const regionId = voronoi.regionMap[i];
      if (regionId !== -1) {
        const region = voronoi.regions.find(r => r.id === regionId);
        if (region) region.pixels++;
      }
    }

    // Find regions that are too small
    const regionsToRemove = new Set();
    for (const region of voronoi.regions) {
      if (region.pixels < this.config.MIN_REGION_SIZE) {
        regionsToRemove.add(region.id);
      }
    }

    console.log(`Removing ${regionsToRemove.size} small regions`);

    // Remove small regions
    for (let i = 0; i < voronoi.regionMap.length; i++) {
      if (regionsToRemove.has(voronoi.regionMap[i])) {
        voronoi.regionMap[i] = -1;
      }
    }

    // Filter out removed regions
    voronoi.regions = voronoi.regions.filter(r => !regionsToRemove.has(r.id));

    // Reassign IDs to be sequential
    const idMap = new Map();
    voronoi.regions.forEach((region, index) => {
      idMap.set(region.id, index);
      region.id = index;
    });

    // Update region map with new IDs
    for (let i = 0; i < voronoi.regionMap.length; i++) {
      const oldId = voronoi.regionMap[i];
      if (oldId !== -1 && idMap.has(oldId)) {
        voronoi.regionMap[i] = idMap.get(oldId);
      }
    }
  }

  // Calculate region properties (bounds, neighbors, centroids)
  calculateRegionProperties(voronoi) {
    // Reset region properties
    for (const region of voronoi.regions) {
      region.pixels = 0;
      region.neighbors.clear();
      region.bounds = {
        minX: this.size,
        minY: this.size,
        maxX: 0,
        maxY: 0
      };
      region.centroid = { x: 0, y: 0 };
    }

    // Calculate bounds and find neighbors
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        const regionId = voronoi.regionMap[index];

        if (regionId === -1) continue;

        const region = voronoi.regions[regionId];
        region.pixels++;

        // Update bounds
        region.bounds.minX = Math.min(region.bounds.minX, x);
        region.bounds.minY = Math.min(region.bounds.minY, y);
        region.bounds.maxX = Math.max(region.bounds.maxX, x);
        region.bounds.maxY = Math.max(region.bounds.maxY, y);

        // Add to centroid calculation
        region.centroid.x += x;
        region.centroid.y += y;

        // Check neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

            const nIndex = ny * this.size + nx;
            const neighborId = voronoi.regionMap[nIndex];

            if (neighborId !== -1 && neighborId !== regionId) {
              region.neighbors.add(neighborId);
            }
          }
        }
      }
    }

    // Finalize centroids
    for (const region of voronoi.regions) {
      if (region.pixels > 0) {
        region.centroid.x = Math.round(region.centroid.x / region.pixels);
        region.centroid.y = Math.round(region.centroid.y / region.pixels);
      }

      // Convert neighbors Set to Array
      region.neighbors = Array.from(region.neighbors);
    }

    // Log region info
    console.log('Region properties:', voronoi.regions.map(r => ({
      id: r.id,
      pixels: r.pixels,
      neighbors: r.neighbors.length,
      centroid: r.centroid
    })));
  }
}