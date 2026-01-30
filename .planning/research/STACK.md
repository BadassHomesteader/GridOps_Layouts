# Technology Stack Research: 2D Warehouse Layout Drawing Tool

**Research Date**: 2026-01-29
**Context**: Vanilla JS/HTML/CSS browser-based warehouse floor plan drawing tool using pure HTML Canvas (no canvas libraries)

---

## 1. Canvas Rendering

### Rendering Loop Pattern
**Confidence: HIGH**

**Best Practice: requestAnimationFrame with Clear-Redraw Pattern**
```javascript
function gameLoop(timestamp) {
  // 1. Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Update state
  update(deltaTime);

  // 3. Render everything
  render(ctx);

  // 4. Request next frame
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

**Why This Works:**
- `requestAnimationFrame` synchronizes with display refresh (typically 60 FPS), ensuring smooth rendering aligned with screen redraws
- Browser automatically pauses when tab is inactive, saving CPU/battery
- Provides timestamp for calculating delta time for consistent movement speed across devices

**Sources:**
- [MDN - Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [How to Make a Game Loop in JavaScript](https://medium.com/@kristenrogers.kr75/how-to-make-a-game-loop-in-javascript-e7d2838bbe33)

### Double Buffering
**Confidence: MEDIUM**

**Approach: Offscreen Canvas for Complex Elements**
```javascript
// Create offscreen canvas for pre-rendering
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Pre-render complex graphics
function renderComplexElement(element) {
  offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
  // Draw complex element to offscreen canvas
  drawElement(offscreenCtx, element);

  // Copy to main canvas
  ctx.drawImage(offscreenCanvas, element.x, element.y);
}
```

**When to Use:**
- For warehouse elements that don't change frequently (walls, offices, shelving racks)
- Performance benefit: 5-9% improvement for line/rectangle drawing when dealing with many pixels
- **NOT needed for simple shapes** - overhead isn't worth it for basic rectangles

**What NOT to Do:**
- ❌ Don't double buffer everything - only pre-render static/complex elements
- ❌ Avoid creating new canvas elements every frame - reuse offscreen canvases
- ❌ Don't use for dynamic elements like the forklift (defeats the purpose)

**Sources:**
- [Optimising HTML5 Canvas Rendering](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/)
- [Easy double buffering on HTML5 canvas](https://coderwall.com/p/p4crrq/easy-double-buffering-on-html5-canvas)

### Coordinate Systems & Transforms
**Confidence: HIGH**

**Two Coordinate Systems Pattern:**
1. **World/Canvas Space** - Actual positions of warehouse elements (in feet)
2. **Screen Space** - Pixel positions on the visible canvas

**Transformation Pattern:**
```javascript
const camera = {
  x: 0,        // Camera position in world space
  y: 0,
  zoom: 1.0    // Zoom level (1.0 = 100%)
};

// Convert screen to world coordinates (for mouse clicks)
function screenToWorld(screenX, screenY) {
  return {
    x: screenX / camera.zoom - camera.x,
    y: screenY / camera.zoom - camera.y
  };
}

// Convert world to screen coordinates (for rendering)
function worldToScreen(worldX, worldY) {
  return {
    x: (worldX + camera.x) * camera.zoom,
    y: (worldY + camera.y) * camera.zoom
  };
}

// Apply transform before rendering
function render(ctx) {
  ctx.save();
  ctx.translate(camera.x * camera.zoom, camera.y * camera.zoom);
  ctx.scale(camera.zoom, camera.zoom);

  // Draw warehouse elements in world coordinates
  drawWarehouse(ctx);

  ctx.restore();
}
```

**Pan Implementation:**
```javascript
// On mouse drag
function pan(deltaX, deltaY) {
  // Divide by zoom for consistent pan feel
  camera.x += deltaX / camera.zoom;
  camera.y += deltaY / camera.zoom;
}
```

**Zoom Implementation:**
```javascript
// Zoom toward mouse cursor position
function zoom(screenX, screenY, zoomDelta) {
  const worldPos = screenToWorld(screenX, screenY);

  camera.zoom *= (1 + zoomDelta);
  camera.zoom = Math.max(0.1, Math.min(5.0, camera.zoom)); // Clamp

  // Adjust camera to keep same world point under cursor
  const newScreenPos = worldToScreen(worldPos.x, worldPos.y);
  camera.x += (screenX - newScreenPos.x) / camera.zoom;
  camera.y += (screenY - newScreenPos.y) / camera.zoom;
}
```

**What NOT to Do:**
- ❌ Don't manipulate canvas context transforms directly for every element (slow)
- ❌ Avoid forgetting to reset transforms (`ctx.save()`/`ctx.restore()`)
- ❌ Don't forget to convert mouse coordinates before hit testing

**Sources:**
- [Creating a Zoom UI - Steve Ruiz](https://www.steveruiz.me/posts/zoom-ui)
- [Panning and Zooming in HTML Canvas](https://harrisonmilbradt.com/blog/canvas-panning-and-zooming)
- [Panning and zooming algorithms](https://www.sunshine2k.de/articles/algorithm/panzoom/panzoom.html)

### Performance Optimization
**Confidence: HIGH**

**Key Techniques:**
1. **Batch Rendering** - Group similar draw calls together
2. **Dirty Rectangle** - Only redraw changed regions (advanced, not needed for warehouse tool)
3. **Layer Separation** - Use multiple canvases for static/dynamic layers
4. **Minimize State Changes** - Reduce `ctx.strokeStyle`, `ctx.fillStyle` changes

**Practical Optimization for Warehouse Tool:**
```javascript
// Good: Group similar elements
function renderWarehouses(ctx, elements) {
  // Draw all walls together
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  elements.filter(e => e.type === 'wall').forEach(wall => drawWall(ctx, wall));

  // Draw all racks together
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  elements.filter(e => e.type === 'rack').forEach(rack => drawRack(ctx, rack));
}
```

**Sources:**
- [HTML5 Canvas Performance Tips](https://gist.github.com/jaredwilli/5469626)

---

## 2. Grid Systems

### Configurable Snap-to-Grid
**Confidence: HIGH**

**Core Algorithm:**
```javascript
const gridConfig = {
  size: 12,           // 12 inches = 1 foot
  subSize: 6,         // 6 inches for fine grid
  snapEnabled: true,
  showGrid: true
};

function snapToGrid(x, y, useSubGrid = false) {
  if (!gridConfig.snapEnabled) return { x, y };

  const gridSize = useSubGrid ? gridConfig.subSize : gridConfig.size;
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize
  };
}

// Usage: Snap while dragging
function onMouseMove(e) {
  const worldPos = screenToWorld(e.clientX, e.clientY);

  // Shift key = fine grid, Ctrl = free-form override
  const useSubGrid = e.shiftKey;
  const snap = !e.ctrlKey; // Ctrl disables snapping

  if (snap) {
    const snapped = snapToGrid(worldPos.x, worldPos.y, useSubGrid);
    selectedElement.x = snapped.x;
    selectedElement.y = snapped.y;
  } else {
    selectedElement.x = worldPos.x;
    selectedElement.y = worldPos.y;
  }
}
```

**Grid Rendering:**
```javascript
function drawGrid(ctx) {
  if (!gridConfig.showGrid) return;

  ctx.save();
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 / camera.zoom; // Scale with zoom

  const startX = Math.floor(-camera.x);
  const startY = Math.floor(-camera.y);
  const endX = startX + canvas.width / camera.zoom;
  const endY = startY + canvas.height / camera.zoom;

  // Draw vertical lines
  for (let x = Math.floor(startX / gridConfig.size) * gridConfig.size;
       x < endX;
       x += gridConfig.size) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = Math.floor(startY / gridConfig.size) * gridConfig.size;
       y < endY;
       y += gridConfig.size) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.restore();
}
```

**Free-Form Override Pattern:**
```javascript
// Hold modifier key to disable snapping temporarily
const keyState = {
  ctrl: false,
  shift: false
};

document.addEventListener('keydown', e => {
  if (e.key === 'Control') keyState.ctrl = true;
  if (e.key === 'Shift') keyState.shift = true;
});

document.addEventListener('keyup', e => {
  if (e.key === 'Control') keyState.ctrl = false;
  if (e.key === 'Shift') keyState.shift = false;
});
```

**What NOT to Do:**
- ❌ Don't snap to grid during rendering - only snap user input coordinates
- ❌ Avoid drawing full grid at high zoom (performance) - calculate visible range
- ❌ Don't hardcode grid size - make it configurable for different warehouse scales

**Sources:**
- [Snap to Grid with KonvaJS](https://medium.com/@pierrebleroux/snap-to-grid-with-konvajs-c41eae97c13f)
- [Canvas Snap to Grid GitHub](https://github.com/faiyazbits/canvas-snap-to-grid)

---

## 3. Collision Detection

### 2D AABB (Axis-Aligned Bounding Box)
**Confidence: HIGH**

**Core Algorithm:**
```javascript
// AABB collision detection
function checkCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// Alternative: Check for NO collision (often clearer)
function hasGap(rect1, rect2) {
  return rect1.x + rect1.width < rect2.x ||  // rect1 left of rect2
         rect2.x + rect2.width < rect1.x ||  // rect2 left of rect1
         rect1.y + rect1.height < rect2.y || // rect1 above rect2
         rect2.y + rect2.height < rect1.y;   // rect2 above rect1
}

function checkCollision(rect1, rect2) {
  return !hasGap(rect1, rect2);
}
```

**Forklift Movement with Collision Prevention:**
```javascript
function moveForklift(dx, dy) {
  // Calculate new position
  const newX = forklift.x + dx;
  const newY = forklift.y + dy;

  // Create test bounding box
  const testBox = {
    x: newX,
    y: newY,
    width: forklift.width,
    height: forklift.height
  };

  // Check collisions with all obstacles
  const obstacles = warehouseElements.filter(e =>
    e.type === 'wall' || e.type === 'obstacle' || e.type === 'rack'
  );

  for (const obstacle of obstacles) {
    if (checkCollision(testBox, obstacle)) {
      return; // Cancel movement if collision detected
    }
  }

  // No collision - update position
  forklift.x = newX;
  forklift.y = newY;
}
```

**Spatial Partitioning for Performance (Advanced):**
```javascript
// Only needed if you have 100+ collidable objects
// For warehouse tool with <50 objects, simple loop is fine

class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(object) {
    const key = this.getCellKey(object.x, object.y);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(object);
  }

  getNearby(x, y) {
    const nearby = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this.getCellKey(
          x + dx * this.cellSize,
          y + dy * this.cellSize
        );
        if (this.cells.has(key)) {
          nearby.push(...this.cells.get(key));
        }
      }
    }
    return nearby;
  }
}
```

**What NOT to Do:**
- ❌ Don't check collision AFTER moving - check BEFORE and prevent invalid moves
- ❌ Avoid checking forklift against pallets (they can overlap)
- ❌ Don't use spatial partitioning for <100 objects (premature optimization)
- ❌ Don't use pixel-perfect collision for rectangular objects (AABB is sufficient)

**Sources:**
- [MDN - 2D Collision Detection](https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection)
- [AABB 2D Collision Detection - Kishimoto Studios](https://kishimotostudios.com/articles/aabb_collision/)
- [2D Collision Detection - Level Up Coding](https://levelup.gitconnected.com/2d-collision-detection-8e50b6b8b5c0)

---

## 4. Keyboard Input

### Game-Loop Style Input Handling
**Confidence: HIGH**

**The Problem:**
Using `keydown` events directly causes choppy movement because:
1. Key repeat has built-in delay + pause between repeats
2. Not synced with `requestAnimationFrame` loop
3. Can't handle multiple simultaneous keys easily

**The Solution: Key State Tracking**
```javascript
// Track which keys are currently pressed
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Prevent default for arrow keys (stops page scrolling)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Check keys in game loop
function update(deltaTime) {
  const speed = 100; // pixels per second
  const distance = speed * (deltaTime / 1000);

  let dx = 0, dy = 0;

  if (keys['ArrowUp'] || keys['w']) dy -= distance;
  if (keys['ArrowDown'] || keys['s']) dy += distance;
  if (keys['ArrowLeft'] || keys['a']) dx -= distance;
  if (keys['ArrowRight'] || keys['d']) dx += distance;

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const factor = 1 / Math.sqrt(2);
    dx *= factor;
    dy *= factor;
  }

  if (dx !== 0 || dy !== 0) {
    moveForklift(dx, dy);
  }
}

// Game loop with delta time
let lastTimestamp = 0;
function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  update(deltaTime);
  render();

  requestAnimationFrame(gameLoop);
}
```

**Advanced: Velocity-Based Movement**
```javascript
const forklift = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  acceleration: 200,
  maxSpeed: 150,
  friction: 0.85
};

function update(deltaTime) {
  const dt = deltaTime / 1000;

  // Apply acceleration based on input
  if (keys['ArrowUp']) forklift.vy -= forklift.acceleration * dt;
  if (keys['ArrowDown']) forklift.vy += forklift.acceleration * dt;
  if (keys['ArrowLeft']) forklift.vx -= forklift.acceleration * dt;
  if (keys['ArrowRight']) forklift.vx += forklift.acceleration * dt;

  // Apply friction
  forklift.vx *= forklift.friction;
  forklift.vy *= forklift.friction;

  // Clamp to max speed
  const speed = Math.sqrt(forklift.vx ** 2 + forklift.vy ** 2);
  if (speed > forklift.maxSpeed) {
    forklift.vx = (forklift.vx / speed) * forklift.maxSpeed;
    forklift.vy = (forklift.vy / speed) * forklift.maxSpeed;
  }

  // Update position
  moveForklift(forklift.vx * dt, forklift.vy * dt);
}
```

**What NOT to Do:**
- ❌ Don't move in `keydown` handler - only set key state
- ❌ Avoid using `setInterval` for game loop - use `requestAnimationFrame`
- ❌ Don't forget to normalize diagonal movement (or it's faster than cardinal)
- ❌ Don't hardcode movement distance - use delta time for consistent speed

**Sources:**
- [Game Mechanics in JavaScript - Keyboard Input](https://lawrencewhiteside.com/courses/game-mechanics-in-javascript/keyboard-input/)
- [MDN - Desktop Mouse and Keyboard Controls](https://developer.mozilla.org/en-US/docs/Games/Techniques/Control_mechanisms/Desktop_with_mouse_and_keyboard)
- [Detecting Multiple Keys in JavaScript](https://www.xjavascript.com/blog/how-to-detect-if-multiple-keys-are-pressed-at-once-using-javascript/)
- [Managing Simultaneous Key Events](https://medium.com/@joshbwasserman/managing-simultaneous-keypressed-events-in-javascript-78da1b3b14de)

---

## 5. State Management

### Application State Structure
**Confidence: HIGH**

**Recommended State Architecture:**
```javascript
const appState = {
  // Canvas/viewport state
  camera: {
    x: 0,
    y: 0,
    zoom: 1.0
  },

  // Warehouse elements (serializable)
  elements: [
    {
      id: 'uuid-1',
      type: 'wall',
      x: 0, y: 0,
      width: 100, height: 10,
      color: '#333'
    },
    {
      id: 'uuid-2',
      type: 'rack',
      x: 50, y: 50,
      width: 40, height: 20,
      capacity: 10,
      pallets: 5
    }
    // ... more elements
  ],

  // UI/interaction state (non-serializable)
  selection: {
    elementIds: [],
    bounds: null
  },

  tool: 'select', // 'select', 'wall', 'rack', 'pallet', etc.

  forklift: {
    x: 100, y: 100,
    width: 10, height: 10,
    vx: 0, vy: 0,
    rotation: 0
  },

  grid: {
    size: 12,
    subSize: 6,
    snapEnabled: true,
    showGrid: true
  },

  // Metadata
  metadata: {
    warehouseName: 'Warehouse A',
    created: '2026-01-29',
    modified: '2026-01-29'
  }
};
```

**Separating Serializable vs Ephemeral State:**
```javascript
// Serialize only what needs to be saved
function getSerializableState() {
  return {
    version: 1,
    elements: appState.elements,
    forklift: appState.forklift,
    camera: appState.camera,
    grid: appState.grid,
    metadata: {
      ...appState.metadata,
      modified: new Date().toISOString()
    }
  };
}

// Restore from saved state
function loadState(savedState) {
  appState.elements = savedState.elements || [];
  appState.forklift = savedState.forklift || getDefaultForklift();
  appState.camera = savedState.camera || { x: 0, y: 0, zoom: 1.0 };
  appState.grid = savedState.grid || getDefaultGrid();
  appState.metadata = savedState.metadata || {};

  // Reset ephemeral state
  appState.selection = { elementIds: [], bounds: null };
  appState.tool = 'select';
}
```

### Undo/Redo Implementation
**Confidence: HIGH**

**Two Approaches:**

#### 1. Memento Pattern (State Snapshots)
**Best for drawing tools with infrequent changes**

```javascript
const history = {
  past: [],    // Stack of previous states
  present: null, // Current state
  future: []   // Redo stack
};

// Deep clone state
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

// Save snapshot when user makes a change
function commitChange() {
  if (history.present) {
    history.past.push(cloneState(history.present));

    // Limit history size to prevent memory issues
    if (history.past.length > 50) {
      history.past.shift();
    }
  }

  history.present = cloneState(getSerializableState());
  history.future = []; // Clear redo stack on new action
}

function undo() {
  if (history.past.length === 0) return;

  history.future.push(cloneState(history.present));
  history.present = history.past.pop();

  loadState(history.present);
}

function redo() {
  if (history.future.length === 0) return;

  history.past.push(cloneState(history.present));
  history.present = history.future.pop();

  loadState(history.present);
}

// Usage: Commit after user completes action
document.addEventListener('mouseup', () => {
  if (currentAction === 'dragging' || currentAction === 'drawing') {
    commitChange();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') undo();
  if (e.ctrlKey && e.key === 'y') redo();
});
```

#### 2. Command Pattern
**Best for fine-grained undo with many small actions**

```javascript
class Command {
  execute() {}
  undo() {}
}

class AddElementCommand extends Command {
  constructor(element) {
    super();
    this.element = element;
  }

  execute() {
    appState.elements.push(this.element);
  }

  undo() {
    const index = appState.elements.indexOf(this.element);
    if (index > -1) appState.elements.splice(index, 1);
  }
}

class MoveElementCommand extends Command {
  constructor(element, oldX, oldY, newX, newY) {
    super();
    this.element = element;
    this.oldX = oldX;
    this.oldY = oldY;
    this.newX = newX;
    this.newY = newY;
  }

  execute() {
    this.element.x = this.newX;
    this.element.y = this.newY;
  }

  undo() {
    this.element.x = this.oldX;
    this.element.y = this.oldY;
  }
}

// Command manager
const commandHistory = {
  past: [],
  future: []
};

function executeCommand(command) {
  command.execute();
  commandHistory.past.push(command);
  commandHistory.future = [];

  if (commandHistory.past.length > 50) {
    commandHistory.past.shift();
  }
}

function undo() {
  if (commandHistory.past.length === 0) return;
  const command = commandHistory.past.pop();
  command.undo();
  commandHistory.future.push(command);
}

function redo() {
  if (commandHistory.future.length === 0) return;
  const command = commandHistory.future.pop();
  command.execute();
  commandHistory.past.push(command);
}
```

**Recommendation for Warehouse Tool:**
Use **Memento Pattern** because:
- User actions are discrete (place element, move element, delete element)
- State is relatively small (dozens of elements, not thousands)
- Simpler to implement and reason about
- Snapshot on `mouseup` events is sufficient

**What NOT to Do:**
- ❌ Don't snapshot on every `mousemove` - only on action completion
- ❌ Avoid deep cloning large non-serializable objects (like canvas contexts)
- ❌ Don't store unlimited history - cap at 50-100 states
- ❌ Don't use Command pattern for simple drawing tools (over-engineering)

**Sources:**
- [Intro to Undo/Redo Systems in JavaScript](https://medium.com/fbbd/intro-to-writing-undo-redo-systems-in-javascript-af17148a852b)
- [The Memento Pattern in JavaScript](https://medium.com/@artemkhrenov/the-memento-pattern-in-javascript-state-preservation-made-simple-9ef1e7705651)
- [Command-based Undo for JS Apps](https://dev.to/npbee/command-based-undo-for-js-apps-34d6)
- [Canvas Undo/Redo Example](https://codepen.io/abidibo/pen/kdRZjV)

---

## 6. Persistence

### JSONBin.io API Patterns
**Confidence: HIGH**

**Setup:**
```javascript
const JSONBIN_CONFIG = {
  baseURL: 'https://api.jsonbin.io/v3',
  masterKey: 'YOUR_API_KEY', // Store securely, not in client code
  binId: null // Set after first save
};

// Create new bin (first save)
async function createBin(data) {
  const response = await fetch(`${JSONBIN_CONFIG.baseURL}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_CONFIG.masterKey
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  JSONBIN_CONFIG.binId = result.metadata.id;

  // Save bin ID to localStorage for future sessions
  localStorage.setItem('warehouseBinId', JSONBIN_CONFIG.binId);

  return result;
}

// Update existing bin
async function updateBin(data) {
  if (!JSONBIN_CONFIG.binId) {
    return createBin(data);
  }

  const response = await fetch(
    `${JSONBIN_CONFIG.baseURL}/b/${JSONBIN_CONFIG.binId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_CONFIG.masterKey,
        'X-Bin-Versioning': 'true' // Enable version history
      },
      body: JSON.stringify(data)
    }
  );

  return await response.json();
}

// Load from bin
async function loadBin(binId) {
  const response = await fetch(
    `${JSONBIN_CONFIG.baseURL}/b/${binId}/latest`,
    {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_CONFIG.masterKey
      }
    }
  );

  const result = await response.json();
  return result.record; // Actual data is in .record property
}

// Initialize on load
async function init() {
  const savedBinId = localStorage.getItem('warehouseBinId');
  if (savedBinId) {
    JSONBIN_CONFIG.binId = savedBinId;
    try {
      const data = await loadBin(savedBinId);
      loadState(data);
    } catch (err) {
      console.error('Failed to load from JSONBin', err);
      // Fall back to localStorage
      loadFromLocalStorage();
    }
  } else {
    loadFromLocalStorage();
  }
}
```

**Auto-Save Pattern:**
```javascript
let autoSaveTimeout = null;

function scheduleAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    const state = getSerializableState();

    // Save to both localStorage (fast) and JSONBin (cloud backup)
    saveToLocalStorage(state);

    try {
      await updateBin(state);
      console.log('Auto-saved to cloud');
    } catch (err) {
      console.error('Cloud save failed', err);
    }
  }, 2000); // 2 second debounce
}

// Call after any state change
function onStateChange() {
  scheduleAutoSave();
}
```

**What NOT to Do:**
- ❌ Don't save on every keystroke/mouse move - debounce to 2-5 seconds
- ❌ Avoid storing API keys in client code - use backend proxy or accept user-provided keys
- ❌ Don't rely solely on JSONBin - always have localStorage fallback
- ❌ Don't ignore version control - enable it to prevent data loss

**Sources:**
- [JSONBin.io API Reference](https://jsonbin.io/api-reference)
- [JSONBin.io Get Started Guide](https://jsonbin.io/api-reference/bins/get-started)
- [JSONBin Personal RESTful API](https://gomakethings.com/jsonbin-a-personal-restful-api-service/)

### localStorage Serialization
**Confidence: HIGH**

**Best Practices:**

```javascript
const STORAGE_KEY = 'warehouse_layout_v1';

// Save to localStorage
function saveToLocalStorage(state) {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    console.log('Saved to localStorage:', (serialized.length / 1024).toFixed(2), 'KB');
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Try deleting old layouts.');
    }
    console.error('localStorage save failed', err);
  }
}

// Load from localStorage
function loadFromLocalStorage() {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;

    const state = JSON.parse(serialized);

    // Validate version
    if (state.version !== 1) {
      console.warn('State version mismatch, migrating...');
      return migrateState(state);
    }

    return state;
  } catch (err) {
    console.error('localStorage load failed', err);
    return null;
  }
}

// Clear localStorage
function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
```

**Handling Non-Serializable Data:**
```javascript
// Problem: Functions, circular references, Dates don't serialize well

// Solution: Custom serialization
function serializeElement(element) {
  return {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    // Don't serialize render function, hitTest function, etc.
  };
}

function deserializeElement(data) {
  const element = { ...data };

  // Re-attach methods based on type
  switch (element.type) {
    case 'wall':
      element.render = renderWall;
      element.hitTest = hitTestRect;
      break;
    case 'rack':
      element.render = renderRack;
      element.hitTest = hitTestRect;
      break;
  }

  return element;
}
```

**Compression for Large States (Advanced):**
```javascript
// Only needed if state exceeds 1MB

// Using LZ-based compression (include library like lz-string)
import LZString from 'lz-string';

function saveCompressed(state) {
  const json = JSON.stringify(state);
  const compressed = LZString.compress(json);
  localStorage.setItem(STORAGE_KEY, compressed);
}

function loadCompressed() {
  const compressed = localStorage.getItem(STORAGE_KEY);
  const json = LZString.decompress(compressed);
  return JSON.parse(json);
}
```

**What NOT to Do:**
- ❌ Don't store circular references (JSON.stringify will fail)
- ❌ Avoid storing large binary data (images) - use IndexedDB instead
- ❌ Don't assume 10MB storage - some browsers limit to 5MB
- ❌ Don't forget error handling - localStorage can throw exceptions

**Sources:**
- [How to Use localStorage in JavaScript](https://strapi.io/blog/how-to-use-localstorage-in-javascript)
- [Storing JavaScript Objects in localStorage](https://blog.logrocket.com/storing-retrieving-javascript-objects-localstorage/)
- [JSON and localStorage Guide](https://frontend.turing.edu/lessons/module-1/json-and-localstorage.html)
- [Using localStorage in Modern Applications](https://rxdb.info/articles/localstorage.html)

### Save/Load Architecture
**Confidence: HIGH**

**Recommended Flow:**

```
User Action → State Change → Debounced Auto-Save
                                  ↓
                    ┌─────────────┴─────────────┐
                    ↓                           ↓
            localStorage (immediate)    JSONBin.io (async)
                    ↓                           ↓
              Primary backup              Cloud backup
```

**Implementation:**
```javascript
class PersistenceManager {
  constructor() {
    this.autoSaveDelay = 2000;
    this.autoSaveTimer = null;
    this.isSaving = false;
  }

  // Schedule auto-save (debounced)
  scheduleSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.save(), this.autoSaveDelay);
  }

  // Save to both storage backends
  async save() {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const state = getSerializableState();

      // Save to localStorage (fast, synchronous)
      saveToLocalStorage(state);

      // Save to JSONBin (slow, asynchronous)
      try {
        await updateBin(state);
        this.showStatus('Saved to cloud ✓');
      } catch (err) {
        this.showStatus('Cloud save failed (saved locally)');
        console.error(err);
      }
    } finally {
      this.isSaving = false;
    }
  }

  // Load with fallback chain
  async load() {
    // Try cloud first
    const binId = localStorage.getItem('warehouseBinId');
    if (binId) {
      try {
        const cloudState = await loadBin(binId);
        loadState(cloudState);
        this.showStatus('Loaded from cloud');
        return;
      } catch (err) {
        console.error('Cloud load failed, trying localStorage', err);
      }
    }

    // Fallback to localStorage
    const localState = loadFromLocalStorage();
    if (localState) {
      loadState(localState);
      this.showStatus('Loaded from local storage');
    } else {
      this.showStatus('No saved data found');
    }
  }

  // Export as JSON file
  exportToFile() {
    const state = getSerializableState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Import from JSON file
  importFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        loadState(state);
        this.scheduleSave();
        this.showStatus('Imported successfully');
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  }

  showStatus(message) {
    // Update UI status indicator
    console.log(message);
  }
}

const persistence = new PersistenceManager();

// Hook into state changes
function onStateChange() {
  persistence.scheduleSave();
}
```

**What NOT to Do:**
- ❌ Don't save synchronously on every change (blocks UI)
- ❌ Avoid saving while another save is in progress (queue instead)
- ❌ Don't lose data if cloud save fails - always have localStorage backup
- ❌ Don't forget export/import functionality for user control

---

## 7. Project Structure

### Recommended File Organization
**Confidence: MEDIUM**

**Feature-First Structure (Recommended for 2026):**

```
warehouse-layout-tool/
├── index.html
├── styles/
│   ├── main.css
│   └── toolbar.css
├── src/
│   ├── main.js              # Entry point, initialization
│   ├── config.js            # Configuration constants
│   │
│   ├── core/
│   │   ├── canvas.js        # Canvas setup, rendering loop
│   │   ├── camera.js        # Pan/zoom, coordinate transforms
│   │   └── grid.js          # Grid rendering, snap-to-grid
│   │
│   ├── state/
│   │   ├── app-state.js     # Main application state
│   │   ├── history.js       # Undo/redo implementation
│   │   └── persistence.js   # Save/load, localStorage, JSONBin
│   │
│   ├── input/
│   │   ├── keyboard.js      # Keyboard input handling
│   │   ├── mouse.js         # Mouse events (click, drag, wheel)
│   │   └── tools.js         # Drawing tools (select, wall, rack, etc.)
│   │
│   ├── entities/
│   │   ├── element.js       # Base element class/factory
│   │   ├── wall.js          # Wall rendering & behavior
│   │   ├── office.js        # Office rendering & behavior
│   │   ├── rack.js          # Rack rendering & behavior
│   │   ├── pallet.js        # Pallet rendering & behavior
│   │   ├── obstacle.js      # Obstacle rendering & behavior
│   │   └── forklift.js      # Forklift movement & rendering
│   │
│   ├── collision/
│   │   └── aabb.js          # AABB collision detection
│   │
│   └── utils/
│       ├── geometry.js      # Point/rect math utilities
│       ├── uuid.js          # ID generation
│       └── dom.js           # DOM helper functions
│
└── assets/
    └── (images, if needed)
```

**Alternative: Simple Structure (For smaller apps):**

```
warehouse-layout-tool/
├── index.html
├── style.css
└── js/
    ├── app.js               # Main entry point
    ├── canvas.js            # Canvas & rendering
    ├── input.js             # Keyboard & mouse
    ├── collision.js         # Collision detection
    ├── persistence.js       # Save/load
    └── elements.js          # All element types
```

**Module Pattern (ES6 Modules):**

```javascript
// main.js
import { initCanvas, render } from './core/canvas.js';
import { initKeyboard } from './input/keyboard.js';
import { loadState } from './state/persistence.js';
import { appState } from './state/app-state.js';

async function init() {
  initCanvas();
  initKeyboard();
  await loadState();

  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  update(timestamp);
  render();
  requestAnimationFrame(gameLoop);
}

init();
```

```html
<!-- index.html -->
<script type="module" src="src/main.js"></script>
```

**Alternative: IIFE Pattern (No build step):**

```javascript
// app.js
(function() {
  'use strict';

  const App = {
    state: {},
    init() { /* ... */ },
    render() { /* ... */ }
  };

  App.init();

  window.WarehouseApp = App; // Expose if needed
})();
```

**Recommended Approach for Warehouse Tool:**
Use **Feature-First ES6 Modules** because:
- Modern browsers support ES6 modules natively (no build step needed)
- Clear separation of concerns
- Easy to test individual modules
- Scales well as app grows

**What NOT to Do:**
- ❌ Don't organize by file type (all models in one folder, all views in another) - organize by feature
- ❌ Avoid single monolithic `app.js` file (hard to maintain beyond ~500 lines)
- ❌ Don't use global variables - use modules or a single global namespace
- ❌ Don't prematurely split into dozens of tiny files - start simple, refactor when needed

**Build Tool (Optional):**
For production, consider bundling with **Vite** (zero-config):
```bash
npm create vite@latest warehouse-tool -- --template vanilla
```

Benefits:
- Hot module reload during development
- Minification for production
- No complex configuration needed

**Sources:**
- [How I Structure Vanilla JS Projects](https://gomakethings.com/how-i-structure-my-vanilla-js-projects/)
- [Google Pulito - Vanilla JS Structure](https://github.com/google/pulito)
- [Vanilla Bean - Structure Guidelines](https://github.com/wiledal/vanilla-bean)
- [Basic Vanilla JS Project Setup](https://plainenglish.io/blog/the-basic-vanilla-js-project-setup-9290dce6403f)

---

## Summary Table

| Area | Approach | Confidence | Why |
|------|----------|------------|-----|
| **Rendering Loop** | `requestAnimationFrame` with clear-redraw | HIGH | Browser-optimized, smooth 60 FPS |
| **Double Buffering** | Offscreen canvas for static elements | MEDIUM | 5-9% performance gain for complex elements |
| **Coordinates** | Dual coordinate systems (world/screen) | HIGH | Standard pattern for pan/zoom |
| **Grid** | Snap-to-grid with modifier key override | HIGH | Flexible for users, simple math |
| **Collision** | AABB with pre-movement testing | HIGH | Simple, fast, sufficient for rectangles |
| **Keyboard** | Key state tracking + game loop | HIGH | Smooth movement, multi-key support |
| **State** | Centralized state object | HIGH | Easy to serialize, debug, test |
| **Undo/Redo** | Memento pattern (snapshots) | HIGH | Simple, appropriate for discrete actions |
| **Persistence** | localStorage + JSONBin.io dual-save | HIGH | Fast local + cloud backup redundancy |
| **Serialization** | `JSON.stringify/parse` | HIGH | Native, fast, widely supported |
| **File Structure** | Feature-first ES6 modules | MEDIUM | Modern, scalable, no build step needed |

---

## Key Takeaways

### DO:
✅ Use `requestAnimationFrame` for rendering loop
✅ Track keyboard state in object, check in game loop
✅ Convert mouse coordinates to world space before hit testing
✅ Implement AABB collision BEFORE moving forklift
✅ Debounce auto-save to 2-5 seconds
✅ Save to both localStorage (fast) and JSONBin (cloud)
✅ Use ES6 modules for clean code organization
✅ Limit undo history to 50-100 states
✅ Normalize diagonal movement speed
✅ Use `ctx.save()/restore()` around transforms

### DON'T:
❌ Don't move on `keydown` events directly
❌ Don't forget to convert screen↔world coordinates
❌ Don't save on every mousemove (debounce!)
❌ Don't store unlimited undo history
❌ Don't check collision after moving (prevent invalid moves)
❌ Don't forget error handling for localStorage/JSONBin
❌ Don't use spatial partitioning for <100 objects
❌ Don't organize files by type (controllers/, views/, etc.)
❌ Don't hardcode grid size or movement speed
❌ Don't rely solely on cloud storage (always have local backup)

---

## Additional Resources

### Canvas & Rendering
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Canvas Deep Dive (HTML Spec)](https://html.spec.whatwg.org/multipage/canvas.html)

### Game Development Patterns
- [MDN Game Development Guide](https://developer.mozilla.org/en-US/docs/Games)
- [Game Programming Patterns (Web)](https://gameprogrammingpatterns.com/)

### JavaScript Best Practices
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
- [JavaScript.info](https://javascript.info/)

---

**End of Stack Research Document**
