/**
 * Main entry point
 *
 * Wires together:
 * - CanvasSetup (DPI-aware canvas)
 * - Viewport (pan/zoom camera)
 * - Renderer (animation loop)
 * - CoordinateConverter (coordinate space conversions)
 * - Input handlers (pan/zoom)
 */
import { CanvasSetup } from './canvas/canvas.js';
import { Viewport } from './canvas/viewport.js';
import { Renderer } from './canvas/renderer.js';
import { CoordinateConverter } from './grid/coordinates.js';

document.addEventListener('DOMContentLoaded', () => {
  // Get canvas element
  const canvas = document.getElementById('gridCanvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Initialize core components
  const canvasSetup = new CanvasSetup(canvas);
  const viewport = new Viewport();
  const renderer = new Renderer(canvasSetup, viewport);
  const coordinateConverter = new CoordinateConverter(viewport);

  // --- Pan Input ---
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (event) => {
    isPanning = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.classList.add('panning');
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!isPanning) return;

    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;

    viewport.pan(deltaX, deltaY);

    lastX = event.clientX;
    lastY = event.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isPanning = false;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    canvas.classList.remove('panning');
  });

  // --- Zoom Input ---
  // Cache canvas offset for coordinate conversion
  let canvasRect = canvas.getBoundingClientRect();

  // Update cached rect on resize and scroll
  const updateCanvasRect = () => {
    canvasRect = canvas.getBoundingClientRect();
  };
  window.addEventListener('resize', updateCanvasRect);
  window.addEventListener('scroll', updateCanvasRect);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    // Get canvas-relative coordinates
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Calculate zoom factor
    const zoomFactor = 1 - event.deltaY * 0.001;

    // Clamp: check if zoom would exceed bounds
    const newScale = viewport.scale * zoomFactor;
    if (newScale < Viewport.MIN_SCALE || newScale > Viewport.MAX_SCALE) {
      return; // Don't zoom if would exceed bounds
    }

    // Apply zoom
    viewport.zoom(zoomFactor, canvasX, canvasY);
  }, { passive: false });

  // Start render loop
  renderer.start();

  console.log('GridOps Layouts initialized');
  console.log('- Canvas:', canvasSetup.getLogicalSize());
  console.log('- DPI:', canvasSetup.dpr);
  console.log('- Viewport:', viewport);
});
