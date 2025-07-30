// Island shape generator using blob method with continental features
class IslandGenerator {
  constructor(config, random) {
    this.config = config;
    this.random = random;
    this.noise = new NoiseGenerator(random);
    this.size = config.MAP_SIZE;
    this.center = this.size / 2;
  }

  debugMaskValues(island, stage) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < island.mask.length; i++) {
      const value = island.mask[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      if (value > 0) count++;
    }

    console.log(`Debug ${stage}:`, {
      min: min.toFixed(3),
      max: max.toFixed(3),
      average: (sum / island.mask.length).toFixed(3),
      nonZeroPixels: count,
      coverage: ((count / island.mask.length) * 100).toFixed(1) + '%'
    });
  }

  // Generate the island mask with continental complexity
  generate() {
    const island = {
      width: this.size,
      height: this.size,
      mask: new Float32Array(this.size * this.size),
      landPixels: 0,
      bounds: { minX: this.size, minY: this.size, maxX: 0, maxY: 0 }
    };

    // Generate multiple blob centers for more interesting shapes
    const blobs = this.generateBlobCenters();
    console.log('Generated blobs:', blobs);

    // Create the base shape from multiple blobs
    this.generateMultiBlobShape(island, blobs);
    this.debugMaskValues(island, 'after blob generation');

    // Add continental features
    this.addContinentalFeatures(island);
    this.debugMaskValues(island, 'after continental features');

    // Add domain warping
    this.applyDomainWarping(island);
    this.debugMaskValues(island, 'after domain warping');

    // Convert to binary mask and clean up
    this.finalizeMask(island);
    console.log('Land pixels after finalize:', island.landPixels);

    // Add coastal detail
    this.addCoastalDetail(island);

    // Calculate metrics
    island.coverage = island.landPixels / (this.size * this.size);
    island.effectiveWidth = island.bounds.maxX - island.bounds.minX;
    island.effectiveHeight = island.bounds.maxY - island.bounds.minY;
    island.effectiveElongation = island.effectiveHeight / island.effectiveWidth; // Height/Width for vertical

    return island;
  }

  // Generate multiple blob centers for a more complex shape
  generateBlobCenters() {
    const blobs = [];

    // Scale all sizes relative to map size
    const scale = this.size / 1024;

    // LARGER main blob - increased by ~50% to get from 17% to ~35% coverage
    blobs.push({
      x: this.center + this.random.float(-50, 50) * scale,
      y: this.center + this.random.float(-100, 100) * scale,
      radiusX: this.random.float(200, 280) * scale,   // Increased from 150-200
      radiusY: this.random.float(350, 450) * scale,   // Increased from 250-350
      strength: 1.0
    });

    // Larger secondary blobs
    const secondaryCount = this.random.int(2, 3);
    for (let i = 0; i < secondaryCount; i++) {
      const angle = this.random.float(0, Math.PI * 2);
      const distance = this.random.float(80, 180) * scale;  // Slightly closer

      blobs.push({
        x: this.center + Math.cos(angle) * distance,
        y: this.center + Math.sin(angle) * distance,
        radiusX: this.random.float(100, 160) * scale,   // Increased from 80-120
        radiusY: this.random.float(140, 200) * scale,   // Increased from 100-160
        strength: this.random.float(0.7, 0.9)           // Slightly stronger
      });
    }

    // Larger peninsula blobs
    const peninsulaCount = this.random.int(1, 2);
    for (let i = 0; i < peninsulaCount; i++) {
      const angle = this.random.float(0, Math.PI * 2);
      const distance = this.random.float(180, 280) * scale;  // Slightly closer

      blobs.push({
        x: this.center + Math.cos(angle) * distance,
        y: this.center + Math.sin(angle) * distance,
        radiusX: this.random.float(50, 90) * scale,     // Increased from 40-70
        radiusY: this.random.float(120, 200) * scale,   // Increased from 100-160
        strength: this.random.float(0.5, 0.7),           // Slightly stronger
        rotation: angle
      });
    }

    console.log(`Generated ${blobs.length} blobs with sizes:`,
      blobs.map(b => ({
        radiusX: Math.round(b.radiusX),
        radiusY: Math.round(b.radiusY),
        strength: b.strength.toFixed(2)
      }))
    );

    return blobs;
  }

  generateMultiBlobShape(island, blobs) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        let value = 0;

        // Accumulate influence from all blobs
        for (const blob of blobs) {
          const influence = this.calculateBlobInfluence(x, y, blob);
          // Increased blending strength
          value += influence * blob.strength * 0.8;  // Increased from 0.5
        }

        // Clamp to reasonable range
        island.mask[index] = Math.min(1.0, value);
      }
    }
  }

  // Calculate influence of a single blob at a point
  calculateBlobInfluence(x, y, blob) {
    // Translate to blob center
    let dx = x - blob.x;
    let dy = y - blob.y;

    // Apply rotation if specified (for peninsulas)
    if (blob.rotation !== undefined) {
      const cos = Math.cos(-blob.rotation);
      const sin = Math.sin(-blob.rotation);
      const rotX = dx * cos - dy * sin;
      const rotY = dx * sin + dy * cos;
      dx = rotX;
      dy = rotY;
    }

    // Calculate distance with elliptical shape
    const distX = dx / blob.radiusX;
    const distY = dy / blob.radiusY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    // Add noise for organic edge
    const angle = Math.atan2(dy, dx);
    const noiseValue = this.noise.octaveNoise2D(
      blob.x * 0.01 + Math.cos(angle) * 3,
      blob.y * 0.01 + Math.sin(angle) * 3,
      3,
      0.5,
      0.5
    );

    // Smooth falloff with noise
    const threshold = 1.0 + noiseValue * this.config.COASTLINE_NOISE;
    const falloff = Math.max(0, (threshold - distance) / threshold);

    return falloff;// Squared for smoother blending
  }

  // Add continental features like ridges and valleys
  addContinentalFeatures(island) {
    // Add large-scale height variation (continental shelf)
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        if (island.mask[index] > 0.1) {  // Only modify existing land
          // Add continental "height" variation
          const continentalNoise = this.noise.octaveNoise2D(
            x * 0.003,
            y * 0.003,
            4,
            0.6,
            1.0
          );

          // Ridge running north-south (for vertical orientation)
          const ridgeX = this.center + Math.sin(y * 0.01) * 50;
          const ridgeDistance = Math.abs(x - ridgeX) / 100;
          const ridgeInfluence = Math.exp(-ridgeDistance * ridgeDistance) * 0.2; // Reduced

          // Modify, don't multiply - this preserves the shape better
          island.mask[index] = island.mask[index] * 0.8 + continentalNoise * 0.1 + ridgeInfluence * 0.1;
        }
      }
    }
  }

  // Add domain warping for more organic shapes
  applyDomainWarping(island) {
    const tempMask = new Float32Array(island.mask);
    const warpScale = 0.005;
    const warpStrength = 50; // pixels

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        // Get noise values for displacement
        const noiseX = this.noise.octaveNoise2D(x * warpScale, y * warpScale, 2, 0.5, 1.0);
        const noiseY = this.noise.octaveNoise2D(x * warpScale + 100, y * warpScale + 100, 2, 0.5, 1.0);

        // Calculate warped coordinates
        const warpedX = x + noiseX * warpStrength;
        const warpedY = y + noiseY * warpStrength;

        // Sample from warped position (with bounds checking)
        if (warpedX >= 0 && warpedX < this.size - 1 &&
          warpedY >= 0 && warpedY < this.size - 1) {
          // Bilinear interpolation for smooth sampling
          const x0 = Math.floor(warpedX);
          const x1 = Math.ceil(warpedX);
          const y0 = Math.floor(warpedY);
          const y1 = Math.ceil(warpedY);

          const fx = warpedX - x0;
          const fy = warpedY - y0;

          const v00 = island.mask[y0 * this.size + x0];
          const v10 = island.mask[y0 * this.size + x1];
          const v01 = island.mask[y1 * this.size + x0];
          const v11 = island.mask[y1 * this.size + x1];

          const v0 = v00 * (1 - fx) + v10 * fx;
          const v1 = v01 * (1 - fx) + v11 * fx;

          tempMask[y * this.size + x] = v0 * (1 - fy) + v1 * fy;
        }
      }
    }

    island.mask = tempMask;
  }

  // Convert float mask to binary and clean up
  finalizeMask(island) {
    // Much lower threshold based on the actual value distribution
    const threshold = 0.05;  // This should capture around 4-5% based on your distribution
    const tempMask = new Uint8Array(this.size * this.size);

    // Debug - show value distribution
    let histogram = new Array(10).fill(0);
    let above_threshold = 0;
    for (let i = 0; i < island.mask.length; i++) {
      const bucket = Math.min(9, Math.floor(island.mask[i] * 10));
      histogram[bucket]++;
      if (island.mask[i] > threshold) above_threshold++;
    }
    console.log('Value distribution:', histogram.map((count, i) =>
      `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}: ${((count / island.mask.length) * 100).toFixed(1)}%`
    ));
    console.log(`Pixels above threshold (${threshold}): ${above_threshold} (${(above_threshold / island.mask.length * 100).toFixed(1)}%)`);

    // First pass - apply threshold
    for (let i = 0; i < island.mask.length; i++) {
      tempMask[i] = island.mask[i] > threshold ? 1 : 0;
    }

    // Remove small islands (less than 100 pixels)
    this.removeSmallIslands(tempMask, 100);

    // Fill small holes (less than 50 pixels)
    this.fillSmallHoles(tempMask, 50);

    // Update final mask and count pixels
    island.landPixels = 0;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        island.mask[index] = tempMask[index];

        if (tempMask[index] === 1) {
          island.landPixels++;
          island.bounds.minX = Math.min(island.bounds.minX, x);
          island.bounds.minY = Math.min(island.bounds.minY, y);
          island.bounds.maxX = Math.max(island.bounds.maxX, x);
          island.bounds.maxY = Math.max(island.bounds.maxY, y);
        }
      }
    }
  }

  // Flood fill to find connected components
  floodFill(mask, startX, startY, targetValue, replacementValue) {
    const stack = [[startX, startY]];
    const filled = new Set();

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const index = y * this.size + x;
      const key = `${x},${y}`;

      if (x < 0 || x >= this.size || y < 0 || y >= this.size) continue;
      if (filled.has(key)) continue;
      if (mask[index] !== targetValue) continue;

      mask[index] = replacementValue;
      filled.add(key);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return filled.size;
  }

  // Remove small disconnected islands
  removeSmallIslands(mask, minSize) {
    const visited = new Uint8Array(this.size * this.size);
    const islands = [];

    // Find all LAND islands (not water!)
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x;
        if (mask[index] === 1 && visited[index] === 0) {
          // Make a copy to count pixels
          const islandPixels = new Set();
          const stack = [[x, y]];

          // Manual flood fill to track this specific island
          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const cidx = cy * this.size + cx;
            const key = `${cx},${cy}`;

            if (cx < 0 || cx >= this.size || cy < 0 || cy >= this.size) continue;
            if (islandPixels.has(key)) continue;
            if (mask[cidx] !== 1) continue;
            if (visited[cidx] === 1) continue;

            islandPixels.add(key);
            visited[cidx] = 1;

            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }

          islands.push({ x, y, size: islandPixels.size, pixels: islandPixels });
        }
      }
    }

    console.log(`Found ${islands.length} islands, sizes:`, islands.map(i => i.size));

    if (islands.length === 0) return;

    // Sort by size
    islands.sort((a, b) => b.size - a.size);

    // Keep only islands that are large enough
    const keepIslands = islands.filter(island =>
      island.size >= minSize || island.size >= islands[0].size * 0.1
    );

    console.log(`Keeping ${keepIslands.length} islands`);

    // Clear ALL land first
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) mask[i] = 0;
    }

    // Restore only the islands we want to keep
    for (const island of keepIslands) {
      for (const pixelKey of island.pixels) {
        const [x, y] = pixelKey.split(',').map(Number);
        const index = y * this.size + x;
        mask[index] = 1;
      }
    }
  }

  // Fill small holes in the landmass
  fillSmallHoles(mask, maxSize) {
    console.log('Filling small holes...');
    let holesFilled = 0;

    // Find all water regions that might be holes
    const visited = new Uint8Array(this.size * this.size);

    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        const index = y * this.size + x;

        if (mask[index] === 0 && visited[index] === 0) {
          // Find this water region
          const waterPixels = new Set();
          const stack = [[x, y]];
          let touchesEdge = false;

          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const cidx = cy * this.size + cx;
            const key = `${cx},${cy}`;

            if (cx <= 0 || cx >= this.size - 1 || cy <= 0 || cy >= this.size - 1) {
              touchesEdge = true;
            }

            if (cx < 0 || cx >= this.size || cy < 0 || cy >= this.size) continue;
            if (waterPixels.has(key)) continue;
            if (mask[cidx] !== 0) continue;

            waterPixels.add(key);
            visited[cidx] = 1;

            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }

          // If it's small and doesn't touch edge, fill it
          if (!touchesEdge && waterPixels.size < maxSize) {
            for (const pixelKey of waterPixels) {
              const [px, py] = pixelKey.split(',').map(Number);
              const pidx = py * this.size + px;
              mask[pidx] = 1;
            }
            holesFilled++;
          }
        }
      }
    }

    console.log(`Filled ${holesFilled} holes`);
  }

  // Add smaller scale detail to coastlines
  addCoastalDetail(island) {
    const tempMask = new Uint8Array(island.mask);

    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        const index = y * this.size + x;

        // Only process pixels near coastline
        if (this.isNearCoast(island.mask, x, y)) {
          // Multiple noise scales for different features
          const smallNoise = this.noise.octaveNoise2D(x * 0.05, y * 0.05, 2, 0.5, 1.0);
          const mediumNoise = this.noise.octaveNoise2D(x * 0.02, y * 0.02, 2, 0.5, 1.0);

          // Create small islands near coast
          if (smallNoise > 0.4 && island.mask[index] === 0) {
            if (this.hasLandNeighbor(island.mask, x, y)) {
              tempMask[index] = 1;
            }
          }
          // Create bays and inlets
          else if (mediumNoise < -0.3 && island.mask[index] === 1) {
            if (this.hasWaterNeighbor(island.mask, x, y)) {
              tempMask[index] = 0;
            }
          }
        }
      }
    }

    // Update mask and recount
    island.landPixels = 0;
    for (let i = 0; i < tempMask.length; i++) {
      island.mask[i] = tempMask[i];
      if (tempMask[i] === 1) island.landPixels++;
    }
  }

  isNearCoast(mask, x, y) {
    const index = y * this.size + x;
    const current = mask[index];

    // Check 5x5 neighborhood for more aggressive coastal detection
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

        const nIndex = ny * this.size + nx;
        if (mask[nIndex] !== current) return true;
      }
    }
    return false;
  }

  hasLandNeighbor(mask, x, y) {
    return this.hasNeighborType(mask, x, y, 1);
  }

  hasWaterNeighbor(mask, x, y) {
    return this.hasNeighborType(mask, x, y, 0);
  }

  hasNeighborType(mask, x, y, type) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;

        const nIndex = ny * this.size + nx;
        if (mask[nIndex] === type) return true;
      }
    }
    return false;
  }
}