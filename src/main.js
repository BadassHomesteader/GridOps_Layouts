/**
 * Main entry point
 *
 * Wires together:
 * - CanvasSetup (DPI-aware canvas)
 * - Viewport (pan/zoom camera)
 * - Renderer (animation loop)
 * - CoordinateConverter (coordinate space conversions)
 * - Grid (grid rendering with snap-to-grid)
 * - Input handlers (pan/zoom)
 */
import { CanvasSetup } from './canvas/canvas.js';
import { Viewport } from './canvas/viewport.js';
import { Renderer } from './canvas/renderer.js';
import { CoordinateConverter } from './grid/coordinates.js';
import { Grid } from './grid/grid.js';
import { ElementManager } from './managers/ElementManager.js';
import { SelectionManager } from './interaction/Selection.js';
import { KeyboardController } from './interaction/KeyboardInput.js';
import { Sidebar } from './ui/Sidebar.js';

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
  const grid = new Grid();

  // Initialize element management and UI
  const elementManager = new ElementManager();
  const selectionManager = new SelectionManager(elementManager);
  const keyboardController = new KeyboardController(selectionManager);
  const sidebarElement = document.getElementById('sidebar');
  const sidebar = new Sidebar(sidebarElement, coordinateConverter, elementManager, grid);
  sidebar.setupCanvasDrop(canvas);

  // Register draw callbacks (order matters: grid -> elements -> selection overlay)
  renderer.addDrawCallback(grid.draw.bind(grid));
  renderer.addDrawCallback(elementManager.drawAll.bind(elementManager));
  renderer.addDrawCallback(selectionManager.drawSelectionOverlay.bind(selectionManager));

  // --- Pan Input ---
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (event) => {
    // Get canvas-relative coordinates for hit testing
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Convert to world coordinates
    const world = coordinateConverter.screenToWorld(canvasX, canvasY);

    // Hit test: check if clicking on an element
    const hitElement = elementManager.getElementAtPoint(world.x, world.y);

    if (hitElement) {
      // Click on element: select it, don't start pan
      selectionManager.selectElement(hitElement);
      return;
    } else {
      // Click on empty space: clear selection and start pan
      selectionManager.clearSelection();
      isPanning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.classList.add('panning');
    }
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

  // --- Grid Resolution Toggle UI ---
  const createResolutionToggle = () => {
    const container = document.createElement('div');
    container.id = 'grid-controls';
    container.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 12px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #333;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    `;

    const createButton = (text, resolution) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.dataset.resolution = resolution;
      btn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        background: rgba(0, 0, 0, 0.05);
        color: #333;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 12px;
      `;

      btn.addEventListener('mouseenter', () => {
        if (grid.resolution !== resolution) {
          btn.style.background = 'rgba(0, 0, 0, 0.1)';
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (grid.resolution !== resolution) {
          btn.style.background = 'rgba(0, 0, 0, 0.05)';
        }
      });

      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        grid.setResolution(resolution);
        updateActiveButton();
      });

      return btn;
    };

    const btn1ft = createButton('1ft', '1ft');
    const btn6in = createButton('6in', '6in');

    const updateActiveButton = () => {
      [btn1ft, btn6in].forEach(btn => {
        const isActive = btn.dataset.resolution === grid.resolution;
        btn.style.background = isActive ? 'rgba(100, 200, 255, 0.3)' : 'rgba(0, 0, 0, 0.05)';
        btn.style.borderColor = isActive ? 'rgba(50, 150, 220, 0.8)' : 'rgba(0, 0, 0, 0.2)';
      });
    };

    container.appendChild(btn1ft);
    container.appendChild(btn6in);
    document.body.appendChild(container);

    updateActiveButton();
  };

  createResolutionToggle();

  // --- Snap-to-Grid Indicator ---
  let currentMouseWorld = { x: 0, y: 0 };
  let isShiftHeld = false;

  // Track Shift key state
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
      isShiftHeld = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
      isShiftHeld = false;
    }
  });

  // Track mouse position in world coordinates
  canvas.addEventListener('mousemove', (event) => {
    // Only update if not panning (reuse existing isPanning check)
    if (!isPanning) {
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;
      currentMouseWorld = coordinateConverter.screenToWorld(canvasX, canvasY);
    }
  });

  // Draw snap indicator
  const drawSnapIndicator = (ctx, viewport, deltaTime) => {
    if (!currentMouseWorld) return;

    const spacing = grid.getSpacing();
    let indicatorPos;

    if (isShiftHeld) {
      // Free-form mode: no indicator
      return;
    }

    // Snap to cell: floor to get the top-left corner of the cell the cursor is in
    const cellX = Math.floor(currentMouseWorld.x / spacing) * spacing;
    const cellY = Math.floor(currentMouseWorld.y / spacing) * spacing;

    ctx.save();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.fillRect(cellX, cellY, spacing, spacing);
    ctx.restore();
  };

  renderer.addDrawCallback(drawSnapIndicator);

  // Prevent pan from starting when clicking UI controls
  const originalMouseDown = canvas.onmousedown;
  canvas.addEventListener('mousedown', (event) => {
    if (event.target !== canvas) {
      event.stopPropagation();
      return;
    }
  });

  // Start render loop
  renderer.start();

  console.log('GridOps Layouts initialized');
  console.log('- Canvas:', canvasSetup.getLogicalSize());
  console.log('- DPI:', canvasSetup.dpr);
  console.log('- Viewport:', viewport);
});
