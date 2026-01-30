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
import { CapacityManager } from './managers/CapacityManager.js';
import { SelectionManager } from './interaction/Selection.js';
import { DragMoveController } from './interaction/DragMove.js';
import { KeyboardController } from './interaction/KeyboardInput.js';
import { ForkliftController } from './interaction/ForkliftController.js';
import { Sidebar } from './ui/Sidebar.js';
import { CapacityDisplay } from './ui/CapacityDisplay.js';
import { DimensionInput } from './interaction/DimensionInput.js';
import { FileManager } from './managers/FileManager.js';
import { PrintManager } from './managers/PrintManager.js';
import { UnitManager } from './managers/UnitManager.js';
import { UndoManager } from './managers/UndoManager.js';

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
  const capacityManager = new CapacityManager(elementManager);
  const selectionManager = new SelectionManager(elementManager);
  const dragMoveController = new DragMoveController(selectionManager, coordinateConverter, grid);
  const keyboardController = new KeyboardController(selectionManager, elementManager, grid);
  const forkliftController = new ForkliftController(elementManager, selectionManager);

  // Initialize undo system
  UndoManager.init(elementManager, selectionManager, capacityManager);

  const sidebarElement = document.getElementById('sidebar');

  // Create capacity display container and add it at the top of sidebar
  const capacityContainer = document.createElement('div');
  sidebarElement.insertBefore(capacityContainer, sidebarElement.firstChild);
  const capacityDisplay = new CapacityDisplay(capacityManager, capacityContainer);

  const sidebar = new Sidebar(sidebarElement, coordinateConverter, elementManager, grid, capacityManager);
  sidebar.setupCanvasDrop(canvas);

  // File manager (save/open layouts)
  const fileManager = new FileManager(elementManager, capacityManager, selectionManager, capacityDisplay);
  sidebar.setFileManager(fileManager);

  // Print manager
  const printManager = new PrintManager(elementManager, capacityManager, canvasSetup, viewport, grid);
  sidebar.setPrintManager(printManager);

  // Dimension editor (double-click element on canvas to edit)
  const dimensionInput = new DimensionInput(canvas, elementManager, selectionManager, coordinateConverter, capacityManager);

  // Register draw callbacks (order matters: forklift update -> grid -> elements -> selection overlay)
  // Forklift update runs first to set collision state before element rendering
  renderer.addDrawCallback((ctx, viewport, deltaTime) => {
    forkliftController.update(deltaTime);
  });
  renderer.addDrawCallback(grid.draw.bind(grid));
  renderer.addDrawCallback(elementManager.drawAll.bind(elementManager));
  renderer.addDrawCallback(selectionManager.drawSelectionOverlay.bind(selectionManager));

  // Draw rubber band selection box
  renderer.addDrawCallback((ctx, vp, deltaTime) => {
    if (!isBoxSelecting || !boxStartWorld || !boxEndWorld) return;

    const x = Math.min(boxStartWorld.x, boxEndWorld.x);
    const y = Math.min(boxStartWorld.y, boxEndWorld.y);
    const w = Math.abs(boxEndWorld.x - boxStartWorld.x);
    const h = Math.abs(boxEndWorld.y - boxStartWorld.y);

    ctx.save();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.lineWidth = 1 / vp.scale;
    ctx.setLineDash([4 / vp.scale, 3 / vp.scale]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  });

  // --- Pan Input ---
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;
  let isSpaceHeld = false;

  // Track Space key for pan mode
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSpaceHeld) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
      event.preventDefault();
      isSpaceHeld = true;
      canvas.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      isSpaceHeld = false;
      if (!isPanning) {
        canvas.style.cursor = 'default';
      }
    }
  });

  // --- Rubber Band Selection ---
  let isBoxSelecting = false;
  let boxStartWorld = null;
  let boxEndWorld = null;

  canvas.addEventListener('mousedown', (event) => {
    // Middle-click or Space+left-click: start panning
    if (event.button === 1 || (event.button === 0 && isSpaceHeld)) {
      event.preventDefault();
      isPanning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.classList.add('panning');
      return;
    }

    // Only handle left-click from here
    if (event.button !== 0) return;

    // Get canvas-relative coordinates for hit testing
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Convert to world coordinates
    const world = coordinateConverter.screenToWorld(canvasX, canvasY);

    // Check if clicking on any selected element (start multi-drag)
    const clickedOnSelected = selectionManager.getSelectedAll().some(
      el => el.containsPoint(world.x, world.y)
    );
    if (clickedOnSelected) {
      dragMoveController.startDrag(world.x, world.y);
      canvas.style.cursor = 'move';
      return;
    }

    // Check if clicking on any element
    const hitElement = elementManager.getElementAtPoint(world.x, world.y);
    if (hitElement) {
      if (event.shiftKey) {
        // Shift+click: toggle element in/out of selection
        selectionManager.toggleElement(hitElement);
      } else {
        // Normal click: select only this element
        selectionManager.selectElement(hitElement);
      }
      // Start drag immediately
      dragMoveController.startDrag(world.x, world.y);
      canvas.style.cursor = 'move';
      return;
    }

    // Empty canvas click
    if (!event.shiftKey) {
      selectionManager.clearSelection();
    }

    // Start rubber band box selection
    isBoxSelecting = true;
    boxStartWorld = { x: world.x, y: world.y };
    boxEndWorld = { x: world.x, y: world.y };
    canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('mousemove', (event) => {
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Pan handling (middle-click or Space+drag)
    if (isPanning) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      viewport.pan(deltaX, deltaY);
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }

    // Element drag takes priority
    if (dragMoveController.getIsDragging()) {
      const world = coordinateConverter.screenToWorld(canvasX, canvasY);
      dragMoveController.updateDrag(world.x, world.y, event.shiftKey);
      return;
    }

    // Rubber band selection
    if (isBoxSelecting) {
      const world = coordinateConverter.screenToWorld(canvasX, canvasY);
      boxEndWorld = { x: world.x, y: world.y };
      return;
    }

    // Hover: update cursor and snap indicator
    currentMouseWorld = coordinateConverter.screenToWorld(canvasX, canvasY);
    const hoverElement = elementManager.getElementAtPoint(currentMouseWorld.x, currentMouseWorld.y);
    canvas.style.cursor = isSpaceHeld ? 'grab' : (hoverElement ? 'pointer' : 'default');
  });

  canvas.addEventListener('mouseup', (event) => {
    if (isPanning) {
      isPanning = false;
      canvas.classList.remove('panning');
      canvas.style.cursor = isSpaceHeld ? 'grab' : 'default';
      return;
    }

    if (dragMoveController.getIsDragging()) {
      dragMoveController.endDrag();
      canvas.style.cursor = 'default';
      return;
    }

    if (isBoxSelecting) {
      isBoxSelecting = false;
      canvas.style.cursor = 'default';

      // Select elements within the box
      if (boxStartWorld && boxEndWorld) {
        const dx = Math.abs(boxEndWorld.x - boxStartWorld.x);
        const dy = Math.abs(boxEndWorld.y - boxStartWorld.y);
        // Only select if box is meaningful size (> 4px)
        if (dx > 4 || dy > 4) {
          const elements = selectionManager.getElementsInRegion(
            boxStartWorld.x, boxStartWorld.y,
            boxEndWorld.x, boxEndWorld.y
          );
          selectionManager.selectMultiple(elements, event.shiftKey);
        }
      }
      boxStartWorld = null;
      boxEndWorld = null;
      return;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragMoveController.getIsDragging()) {
      dragMoveController.endDrag();
      canvas.style.cursor = 'default';
    }
    isBoxSelecting = false;
    boxStartWorld = null;
    boxEndWorld = null;
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

  // Prevent middle-click auto-scroll
  canvas.addEventListener('auxclick', (event) => { event.preventDefault(); });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    // Get canvas-relative coordinates
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // macOS trackpad: ctrlKey = pinch-to-zoom, no ctrlKey = two-finger pan
    // Mouse wheel: always zoom
    if (event.ctrlKey) {
      // Pinch-to-zoom (trackpad) or Ctrl+scroll (mouse)
      const zoomFactor = 1 - event.deltaY * 0.01;
      const newScale = viewport.scale * zoomFactor;
      if (newScale >= Viewport.MIN_SCALE && newScale <= Viewport.MAX_SCALE) {
        viewport.zoom(zoomFactor, canvasX, canvasY);
      }
    } else if (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) > 0) {
      // Two-finger trackpad pan OR mouse scroll-wheel zoom
      // Distinguish: trackpad sends both deltaX and deltaY, mouse only deltaY
      if (event.deltaMode === 0 && (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 50)) {
        // Likely trackpad: pan
        viewport.pan(-event.deltaX, -event.deltaY);
      } else {
        // Mouse wheel: zoom
        const zoomFactor = 1 - event.deltaY * 0.001;
        const newScale = viewport.scale * zoomFactor;
        if (newScale >= Viewport.MIN_SCALE && newScale <= Viewport.MAX_SCALE) {
          viewport.zoom(zoomFactor, canvasX, canvasY);
        }
      }
    }
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
    const btn1in = createButton('1in', '1in');

    const updateActiveButton = () => {
      [btn1ft, btn6in, btn1in].forEach(btn => {
        const isActive = btn.dataset.resolution === grid.resolution;
        btn.style.background = isActive ? 'rgba(100, 200, 255, 0.3)' : 'rgba(0, 0, 0, 0.05)';
        btn.style.borderColor = isActive ? 'rgba(50, 150, 220, 0.8)' : 'rgba(0, 0, 0, 0.2)';
      });
    };

    container.appendChild(btn1ft);
    container.appendChild(btn6in);
    container.appendChild(btn1in);
    document.body.appendChild(container);

    updateActiveButton();
  };

  createResolutionToggle();

  // --- Zoom-to-Fit Button ---
  const createZoomToFitButton = () => {
    const container = document.createElement('div');
    container.id = 'zoom-fit-control';
    container.style.cssText = `
      position: fixed;
      bottom: 50px;
      right: 16px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 12px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #333;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    `;

    const btn = document.createElement('button');
    btn.textContent = 'Fit All';
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
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0, 0, 0, 0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0, 0, 0, 0.05)'; });

    btn.addEventListener('click', (event) => {
      event.stopPropagation();

      const elements = elementManager.getAll();
      if (elements.length === 0) return;

      // Compute bounding box of all elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        const b = el.getBounds();
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }

      const worldW = maxX - minX;
      const worldH = maxY - minY;
      if (worldW <= 0 || worldH <= 0) return;

      // Get canvas logical size
      const { width: canvasW, height: canvasH } = canvasSetup.getLogicalSize();

      // Add padding (10% each side)
      const padding = 0.1;
      const availW = canvasW * (1 - 2 * padding);
      const availH = canvasH * (1 - 2 * padding);

      // Scale to fit
      const newScale = Math.min(availW / worldW, availH / worldH);
      const clampedScale = Math.max(Viewport.MIN_SCALE, Math.min(Viewport.MAX_SCALE, newScale));

      // Center the bounding box
      const centerWorldX = minX + worldW / 2;
      const centerWorldY = minY + worldH / 2;

      viewport.scale = clampedScale;
      viewport.offsetX = canvasW / 2 - centerWorldX * clampedScale;
      viewport.offsetY = canvasH / 2 - centerWorldY * clampedScale;
    });

    container.appendChild(btn);
    document.body.appendChild(container);
  };

  createZoomToFitButton();

  // --- Unit Toggle UI (in / ft) ---
  const createUnitToggle = () => {
    const container = document.createElement('div');
    container.id = 'unit-controls';
    container.style.cssText = `
      position: fixed;
      top: 52px;
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

    const createBtn = (text, mode) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.dataset.mode = mode;
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
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        UnitManager.setMode(mode);
      });
      return btn;
    };

    const btnIn = createBtn('in', 'inches');
    const btnFt = createBtn('ft', 'feet');

    const updateActive = () => {
      [btnIn, btnFt].forEach(btn => {
        const isActive = btn.dataset.mode === UnitManager.mode;
        btn.style.background = isActive ? 'rgba(100, 200, 255, 0.3)' : 'rgba(0, 0, 0, 0.05)';
        btn.style.borderColor = isActive ? 'rgba(50, 150, 220, 0.8)' : 'rgba(0, 0, 0, 0.2)';
      });
    };

    UnitManager.onChange(updateActive);

    container.appendChild(btnIn);
    container.appendChild(btnFt);
    document.body.appendChild(container);

    updateActive();
  };

  createUnitToggle();

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

  // Note: mouse position tracking now handled in main mousemove handler above

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

  // --- X/Y Axis Key (fixed position, bottom-left of canvas) ---
  const drawAxisKey = (ctx, vp, deltaTime) => {
    const { width, height } = canvasSetup.getLogicalSize();

    // Draw in screen space: reset to DPI-scaled identity
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(canvasSetup.dpr, canvasSetup.dpr);

    const originX = 50;
    const originY = height - 40;
    const axisLen = 40;

    // X axis (horizontal arrow, right)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + axisLen, originY);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(originX + axisLen - 6, originY - 4);
    ctx.lineTo(originX + axisLen, originY);
    ctx.lineTo(originX + axisLen - 6, originY + 4);
    ctx.stroke();

    // Y axis (vertical arrow, up)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, originY - axisLen);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(originX - 4, originY - axisLen + 6);
    ctx.lineTo(originX, originY - axisLen);
    ctx.lineTo(originX + 4, originY - axisLen + 6);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('X', originX + axisLen + 8, originY - 6);
    ctx.textBaseline = 'middle';
    ctx.fillText('Y', originX - 12, originY - axisLen);

    ctx.restore();

    // Re-apply viewport transform for subsequent callbacks
    vp.applyTransform(ctx);
  };

  renderer.addDrawCallback(drawAxisKey);

  // --- Scale Bar (fixed position, bottom-right of canvas) ---
  const drawScaleBar = (ctx, vp, deltaTime) => {
    const { width, height } = canvasSetup.getLogicalSize();

    // Draw in screen space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(canvasSetup.dpr, canvasSetup.dpr);

    // Nice world-pixel distances: 1in=4, 6in=24, 1ft=48, 2ft=96, 5ft=240, 10ft=480...
    const niceValues = [4, 8, 12, 24, 48, 96, 240, 480, 960, 2400, 4800, 9600, 24000, 48000];

    const targetBarPx = 120; // target bar width in screen px
    const worldPerPx = 1 / vp.scale;
    const targetWorld = targetBarPx * worldPerPx;

    // Find closest nice value
    let bestDist = niceValues[0];
    for (const nv of niceValues) {
      if (Math.abs(nv - targetWorld) < Math.abs(bestDist - targetWorld)) {
        bestDist = nv;
      }
    }

    const barPx = bestDist * vp.scale;
    const inches = bestDist / 4; // world px to inches
    const label = UnitManager.formatValue(inches) + ' ' + UnitManager.getLabel();

    // Position: bottom-right
    const barX = width - barPx - 20;
    const barY = height - 30;
    const barH = 6;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(barX - 8, barY - 16, barPx + 16, 30);

    // Bar
    ctx.fillStyle = '#555';
    ctx.fillRect(barX, barY, barPx, barH);

    // End ticks
    ctx.fillRect(barX, barY - 4, 2, barH + 8);
    ctx.fillRect(barX + barPx - 2, barY - 4, 2, barH + 8);

    // Label
    ctx.fillStyle = '#333';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, barX + barPx / 2, barY - 4);

    ctx.restore();

    // Re-apply viewport transform
    vp.applyTransform(ctx);
  };

  renderer.addDrawCallback(drawScaleBar);

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
