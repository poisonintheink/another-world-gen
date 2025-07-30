// Seeded random number generator utilities
class Random {
  constructor(seed) {
    this.seed = this.hashCode(seed);
    this.original = this.seed;
  }

  // Simple hash function for string seeds
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Seeded random number generator (Park-Miller)
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  // Random float between min and max
  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  // Random integer between min and max (inclusive)
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }

  // Reset to original seed
  reset() {
    this.seed = this.original;
  }
}

// Simple 2D noise function for coastline generation
class NoiseGenerator {
  constructor(random) {
    this.random = random;
    this.permutation = this.generatePermutation();
  }

  generatePermutation() {
    const perm = [];
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
    }

    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = this.random.int(0, i);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    // Duplicate for wraparound
    return perm.concat(perm);
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x, y) {
    // Find unit square
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative x,y in square
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of corners
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;

    // Blend results from corners
    return this.lerp(v,
      this.lerp(u,
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y)
      ),
      this.lerp(u,
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1)
      )
    );
  }

  // Octaved noise for more detail
  octaveNoise2D(x, y, octaves, persistence = 0.5, scale = 0.1) {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}