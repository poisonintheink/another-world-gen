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