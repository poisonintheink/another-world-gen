// Canvas rendering utilities
class CanvasRenderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.size = config.MAP_SIZE;

    // Set canvas size
    this.canvas.width = this.size;
    this.canvas.height = this.size;
  }

  renderIsland(island) {
    // Create image data
    const imageData = this.ctx.createImageData(this.size, this.size);
    const data = imageData.data;

    // Convert colors to RGB
    const oceanRGB = this.hexToRGB(this.config.OCEAN_COLOR);
    const landRGB = this.hexToRGB(this.config.LAND_COLOR);

    // Fill pixels
    for (let i = 0; i < island.mask.length; i++) {
      const pixelIndex = i * 4;
      const isLand = island.mask[i] === 1;

      const color = isLand ? landRGB : oceanRGB;
      data[pixelIndex] = color.r;
      data[pixelIndex + 1] = color.g;
      data[pixelIndex + 2] = color.b;
      data[pixelIndex + 3] = 255;
    }

    // Put image data
    this.ctx.putImageData(imageData, 0, 0);

    // Draw metrics if enabled
    if (this.config.SHOW_METRICS) {
      this.drawMetrics(island);
    }
  }

  renderVoronoi(island, voronoi) {
    // Create image data
    const imageData = this.ctx.createImageData(this.size, this.size);
    const data = imageData.data;

    // Convert colors to RGB
    const oceanRGB = this.hexToRGB(this.config.OCEAN_COLOR);
    const regionColors = this.config.REGION_COLORS.map(c => this.hexToRGB(c));

    // Fill pixels based on regions
    for (let i = 0; i < voronoi.regionMap.length; i++) {
      const pixelIndex = i * 4;
      const regionId = voronoi.regionMap[i];

      let color;
      if (island.mask[i] === 0) {
        // Water
        color = oceanRGB;
      } else if (regionId === -1) {
        // Land but no region (shouldn't happen much)
        color = { r: 100, g: 100, b: 100 };
      } else {
        // Region color
        color = regionColors[regionId % regionColors.length];
      }

      data[pixelIndex] = color.r;
      data[pixelIndex + 1] = color.g;
      data[pixelIndex + 2] = color.b;
      data[pixelIndex + 3] = 255;
    }

    // Put image data
    this.ctx.putImageData(imageData, 0, 0);

    // Draw region borders if enabled
    if (this.config.SHOW_REGION_BORDERS) {
      this.drawRegionBorders(voronoi);
    }

    // Draw seed points if enabled
    if (this.config.SHOW_SEED_POINTS) {
      this.drawSeedPoints(voronoi);
    }

    // Draw metrics
    if (this.config.SHOW_METRICS) {
      this.drawVoronoiMetrics(island, voronoi);
    }
  }

  drawRegionBorders(voronoi) {
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.lineWidth = 1;

    // Find border pixels
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const index = y * this.size + x;
        const regionId = voronoi.regionMap[index];

        if (regionId === -1) continue;

        // Check right and bottom neighbors
        const rightIndex = index + 1;
        const bottomIndex = index + this.size;

        if (voronoi.regionMap[rightIndex] !== regionId) {
          // Draw vertical line
          this.ctx.beginPath();
          this.ctx.moveTo(x + 1, y);
          this.ctx.lineTo(x + 1, y + 1);
          this.ctx.stroke();
        }

        if (voronoi.regionMap[bottomIndex] !== regionId) {
          // Draw horizontal line
          this.ctx.beginPath();
          this.ctx.moveTo(x, y + 1);
          this.ctx.lineTo(x + 1, y + 1);
          this.ctx.stroke();
        }
      }
    }
  }

  drawSeedPoints(voronoi) {
    this.ctx.fillStyle = 'black';
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;

    for (const region of voronoi.regions) {
      const point = region.seedPoint;

      // Draw seed point
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw centroid as X
      const c = region.centroid;
      this.ctx.strokeStyle = 'red';
      this.ctx.beginPath();
      this.ctx.moveTo(c.x - 3, c.y - 3);
      this.ctx.lineTo(c.x + 3, c.y + 3);
      this.ctx.moveTo(c.x - 3, c.y + 3);
      this.ctx.lineTo(c.x + 3, c.y - 3);
      this.ctx.stroke();
      this.ctx.strokeStyle = 'white';
    }
  }

  drawVoronoiMetrics(island, voronoi) {
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'black';
    this.ctx.font = '14px monospace';
    this.ctx.lineWidth = 3;

    const metrics = [
      `Land Coverage: ${(island.coverage * 100).toFixed(1)}%`,
      `Regions: ${voronoi.regions.length}`,
      `Avg Region Size: ${Math.round(island.landPixels / voronoi.regions.length).toLocaleString()} pixels`,
      `Elongation: ${island.effectiveElongation.toFixed(2)}`
    ];

    metrics.forEach((text, i) => {
      const y = 20 + i * 20;
      this.ctx.strokeText(text, 10, y);
      this.ctx.fillText(text, 10, y);
    });
  }

  drawMetrics(island) {
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'black';
    this.ctx.font = '14px monospace';
    this.ctx.lineWidth = 3;

    const metrics = [
      `Land Coverage: ${(island.coverage * 100).toFixed(1)}%`,
      `Land Pixels: ${island.landPixels.toLocaleString()}`,
      `Elongation: ${island.effectiveElongation.toFixed(2)}`,
      `Effective Size: ${island.effectiveWidth}x${island.effectiveHeight}`
    ];

    metrics.forEach((text, i) => {
      const y = 20 + i * 20;
      this.ctx.strokeText(text, 10, y);
      this.ctx.fillText(text, 10, y);
    });
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
}