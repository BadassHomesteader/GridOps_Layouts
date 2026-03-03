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
import { ProjectBrowser } from './ui/ProjectBrowser.js';
import { init as initAuth, getUser, isAuthenticated, logout, login } from './auth/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize auth first (may redirect to Microsoft login)
  await initAuth();

  if (!isAuthenticated()) {
    // Show login splash screen
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-btn').addEventListener('click', () => login());
    return;
  }

  // Authenticated — show the app
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

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

  // Project browser (cloud project list)
  const projectBrowser = new ProjectBrowser(fileManager);
  fileManager.setProjectBrowser(projectBrowser);

  // Auth: show user in sidebar and wire up logout
  sidebar.setLogout(logout);
  sidebar.setFileManager(fileManager);
  const user = getUser();
  if (user) sidebar.setUser(user);

  // Print manager
  const printManager = new PrintManager(elementManager, capacityManager, canvasSetup, viewport, grid);
  sidebar.setPrintManager(printManager);

  // Alignment buttons
  sidebar.setSelectionManager(selectionManager);

  // Dimension editor (double-click element on canvas to edit)
  const dimensionInput = new DimensionInput(canvas, elementManager, selectionManager, coordinateConverter, capacityManager);

  // --- Point Edit Mode (for polyline walls) ---
  let isPointEditing = false;
  let editingPolyline = null;
  let draggingPointIndex = -1;

  const enterPointEditMode = (element) => {
    isPointEditing = true;
    editingPolyline = element;
    editingPolyline.editing = true;
    editingPolyline.selectedPointIndex = -1;
    draggingPointIndex = -1;
    canvas.style.cursor = 'crosshair';
  };

  const exitPointEditMode = () => {
    if (editingPolyline) {
      editingPolyline.editing = false;
      editingPolyline.selectedPointIndex = -1;
    }
    isPointEditing = false;
    editingPolyline = null;
    draggingPointIndex = -1;
    canvas.style.cursor = 'default';
  };

  // Wire up DimensionInput "Edit Points" callback
  dimensionInput.onEditPoints = (element) => {
    enterPointEditMode(element);
  };

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

  // Draw snap guide lines during edge snapping
  renderer.addDrawCallback((ctx, vp) => {
    const guides = dragMoveController.activeSnapGuides;
    if (!guides || guides.length === 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.7)';
    ctx.lineWidth = 1 / vp.scale;
    ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);

    for (const g of guides) {
      ctx.beginPath();
      if (g.axis === 'x') {
        // Vertical guide line
        ctx.moveTo(g.pos, g.min);
        ctx.lineTo(g.pos, g.max);
      } else {
        // Horizontal guide line
        ctx.moveTo(g.min, g.pos);
        ctx.lineTo(g.max, g.pos);
      }
      ctx.stroke();
    }

    ctx.restore();
  });

  // --- Pan Input ---
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;
  let isSpaceHeld = false;

  // Track Space key for pan mode + point-edit mode keys
  window.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;

    if (event.code === 'Space' && !isSpaceHeld) {
      event.preventDefault();
      isSpaceHeld = true;
      canvas.style.cursor = 'grab';
    }

    // Point edit mode: Escape to exit, Backspace to delete selected point
    if (isPointEditing && editingPolyline) {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitPointEditMode();
      } else if ((event.key === 'Backspace' || event.key === 'Delete') && editingPolyline.selectedPointIndex >= 0) {
        event.preventDefault();
        UndoManager.pushPoints(editingPolyline);
        const removed = editingPolyline.removePoint(editingPolyline.selectedPointIndex);
        if (removed) {
          editingPolyline.selectedPointIndex = -1;
        }
      }
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

    // --- Point Edit Mode handling ---
    if (isPointEditing && editingPolyline) {
      const handleRadius = 8 / (viewport.scale || 1);

      // Check if clicking on a point handle
      const pointIdx = editingPolyline.getPointAtWorld(world.x, world.y, handleRadius);
      if (pointIdx >= 0) {
        // Select and start dragging this point
        editingPolyline.selectedPointIndex = pointIdx;
        draggingPointIndex = pointIdx;
        UndoManager.pushPoints(editingPolyline);
        return;
      }

      // Check if clicking on a segment (insert new point)
      const segIdx = editingPolyline.getClosestSegment(world.x, world.y);
      if (segIdx >= 0) {
        // Check distance to segment
        const p1 = editingPolyline.points[segIdx];
        const p2 = editingPolyline.points[segIdx + 1];
        const dist = editingPolyline.pointToSegmentDist(world.x, world.y, p1.x, p1.y, p2.x, p2.y);
        if (dist < editingPolyline.thickness / 2 + handleRadius) {
          // Insert point on segment at click location
          UndoManager.pushPoints(editingPolyline);
          const snapped = grid.snapToGrid(world.x, world.y);
          editingPolyline.insertPoint(segIdx, { x: snapped.x, y: snapped.y });
          editingPolyline.selectedPointIndex = segIdx + 1;
          draggingPointIndex = segIdx + 1;
          return;
        }
      }

      // Clicked on empty space — exit point edit mode
      exitPointEditMode();
      return;
    }

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

    // Point-edit drag takes priority
    if (isPointEditing && draggingPointIndex >= 0 && editingPolyline) {
      const world = coordinateConverter.screenToWorld(canvasX, canvasY);
      const snapped = event.shiftKey ? world : grid.snapToGrid(world.x, world.y);
      editingPolyline.points[draggingPointIndex].x = snapped.x;
      editingPolyline.points[draggingPointIndex].y = snapped.y;
      editingPolyline.updateBounds();
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

    // End point drag
    if (isPointEditing && draggingPointIndex >= 0) {
      draggingPointIndex = -1;
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
    if (isPointEditing && draggingPointIndex >= 0) {
      draggingPointIndex = -1;
    }
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

  // --- Zoom-to-Fit ---
  const zoomToFit = () => {
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

    const { width: canvasW, height: canvasH } = canvasSetup.getLogicalSize();
    const padding = 0.1;
    const availW = canvasW * (1 - 2 * padding);
    const availH = canvasH * (1 - 2 * padding);
    const newScale = Math.min(availW / worldW, availH / worldH);
    const clampedScale = Math.max(Viewport.MIN_SCALE, Math.min(Viewport.MAX_SCALE, newScale));
    const centerWorldX = minX + worldW / 2;
    const centerWorldY = minY + worldH / 2;

    viewport.scale = clampedScale;
    viewport.offsetX = canvasW / 2 - centerWorldX * clampedScale;
    viewport.offsetY = canvasH / 2 - centerWorldY * clampedScale;
  };

  // Zoom-to-fit after file open
  fileManager.onLoad = zoomToFit;

  const createZoomControls = () => {
    const container = document.createElement('div');
    container.id = 'zoom-controls';
    container.style.cssText = `
      position: fixed;
      bottom: 50px;
      right: 16px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #333;
      box-shadow: 0 1px 6px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 0;
      overflow: hidden;
    `;

    const btnStyle = `
      width: 32px; height: 32px; border: none; background: transparent;
      color: #444; cursor: pointer; font-size: 16px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s; padding: 0; font-family: inherit;
    `;

    const zoomOut = document.createElement('button');
    zoomOut.textContent = '\u2212';
    zoomOut.title = 'Zoom Out';
    zoomOut.style.cssText = btnStyle;

    const zoomLabel = document.createElement('span');
    zoomLabel.style.cssText = `
      min-width: 48px; text-align: center; font-size: 11px;
      font-weight: 600; color: #555; user-select: none; cursor: pointer;
    `;
    zoomLabel.title = 'Reset to 100%';

    const zoomIn = document.createElement('button');
    zoomIn.textContent = '+';
    zoomIn.title = 'Zoom In';
    zoomIn.style.cssText = btnStyle;

    const divider = document.createElement('div');
    divider.style.cssText = `width: 1px; height: 20px; background: #ddd;`;

    const fitBtn = document.createElement('button');
    fitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6V2h4"/><path d="M14 6V2h-4"/><path d="M2 10v4h4"/><path d="M14 10v4h-4"/></svg>`;
    fitBtn.title = 'Fit All';
    fitBtn.style.cssText = btnStyle + 'width: 36px;';

    const updateLabel = () => {
      zoomLabel.textContent = Math.round(viewport.scale * 100) + '%';
    };
    updateLabel();

    // Update zoom label on every frame via render callback
    renderer.addDrawCallback(() => updateLabel());

    const getCanvasCenter = () => {
      const { width, height } = canvasSetup.getLogicalSize();
      return { x: width / 2, y: height / 2 };
    };

    zoomIn.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = getCanvasCenter();
      viewport.zoom(1.25, c.x, c.y);
    });

    zoomOut.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = getCanvasCenter();
      viewport.zoom(0.8, c.x, c.y);
    });

    zoomLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      // Reset to 100% centered on current view center
      const c = getCanvasCenter();
      const worldCenterX = (c.x - viewport.offsetX) / viewport.scale;
      const worldCenterY = (c.y - viewport.offsetY) / viewport.scale;
      viewport.scale = 1;
      viewport.offsetX = c.x - worldCenterX;
      viewport.offsetY = c.y - worldCenterY;
    });

    fitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomToFit();
    });

    for (const btn of [zoomOut, zoomIn, fitBtn]) {
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0,0,0,0.07)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    }

    container.appendChild(zoomOut);
    container.appendChild(zoomLabel);
    container.appendChild(zoomIn);
    container.appendChild(divider);
    container.appendChild(fitBtn);
    document.body.appendChild(container);
  };

  createZoomControls();

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
