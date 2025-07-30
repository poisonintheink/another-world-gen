// Main entry point for testing island generation
function initializeIslandGenerator() {
  // Get or create canvas
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) {
    console.error('Canvas element with id "mapCanvas" not found');
    return;
  }

  // Initialize components
  const random = new Random('test123');
  const islandGen = new IslandGenerator(CONFIG, random);
  const renderer = new CanvasRenderer(canvas, CONFIG);

  // Generate and render island
  console.log('Generating island...');
  const island = islandGen.generate();

  console.log('Island generated:', {
    coverage: (island.coverage * 100).toFixed(1) + '%',
    landPixels: island.landPixels,
    elongation: island.effectiveElongation.toFixed(2)
  });

  // Generate Voronoi regions
  const voronoiGen = new VoronoiGenerator(CONFIG, random, island);
  const voronoi = voronoiGen.generate();

  // Render with Voronoi regions
  renderer.renderVoronoi(island, voronoi);

  return { island, voronoi, islandGen, voronoiGen, renderer };
}

// Auto-run if DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIslandGenerator);
  } else {
    initializeIslandGenerator();
  }
}