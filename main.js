// Main entry point for testing island generation
let currentComponents = null;
let isRefined = false;

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

  // Store components globally for refinement
  currentComponents = { island, voronoi, islandGen, voronoiGen, renderer };
  isRefined = false;

  // Render with Voronoi regions
  renderer.renderVoronoi(island, voronoi, false);

  // Update button states
  updateButtonStates();

  return currentComponents;
}

function refineRegions() {
  if (!currentComponents) {
    console.error('No island generated yet');
    return;
  }

  const { island, voronoi, renderer } = currentComponents;

  // Create region refiner
  const refiner = new RegionRefiner(CONFIG, island, voronoi);

  // Refine regions
  console.log('Refining regions...');
  refiner.refine();

  // Store refiner
  currentComponents.refiner = refiner;
  isRefined = true;

  // Re-render with refined regions and town centers
  renderer.renderVoronoi(island, voronoi, true);

  // Update button states
  updateButtonStates();

  console.log('Refinement complete:', {
    smoothedBorders: true,
    townCenters: voronoi.regions.filter(r => r.county && r.county.townCenter).length
  });
}

function toggleView() {
  if (!currentComponents || !isRefined) return;

  const { island, voronoi, renderer } = currentComponents;

  // Toggle between showing seed points and town centers
  const showTowns = !document.getElementById('toggleBtn').dataset.showingTowns;
  document.getElementById('toggleBtn').dataset.showingTowns = showTowns;

  renderer.renderVoronoi(island, voronoi, showTowns);

  // Update button text
  document.getElementById('toggleBtn').textContent = showTowns ? 'Show Seed Points' : 'Show Town Centers';
}

function updateButtonStates() {
  const refineBtn = document.getElementById('refineBtn');
  const toggleBtn = document.getElementById('toggleBtn');

  if (refineBtn) {
    refineBtn.disabled = !currentComponents || isRefined;
    refineBtn.textContent = isRefined ? 'Regions Refined' : 'Refine Regions';
  }

  if (toggleBtn) {
    toggleBtn.disabled = !isRefined;
    toggleBtn.style.display = isRefined ? 'inline-block' : 'none';
  }
}

// Auto-run if DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIslandGenerator);
  } else {
    initializeIslandGenerator();
  }
}