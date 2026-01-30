# Architecture: Browser-Based 2D Warehouse Layout Tool

## Overview

A pure vanilla JavaScript/HTML/CSS application for designing warehouse layouts on a canvas grid. No build tools, no frameworks—just the browser platform.

**Core Technologies:**
- HTML5 Canvas for rendering
- Vanilla JavaScript (ES6 modules)
- CSS for UI styling
- JSONBin.io + localStorage for persistence

---

## 1. Component Boundaries

### 1.1 Canvas Renderer (`CanvasRenderer.js`)

**Responsibilities:**
- Manage the canvas element and rendering context
- Handle viewport transformations (pan, zoom)
- Orchestrate layered rendering
- Clear and redraw on state changes
- Convert between canvas coordinates and world coordinates

**Key Methods:**
```javascript
class CanvasRenderer {
  constructor(canvasElement)
  clear()
  render(state) // Orchestrates all layer rendering
  toWorldCoords(canvasX, canvasY)
  toCanvasCoords(worldX, worldY)
  setZoom(level)
  pan(deltaX, deltaY)
}
```

**Dependencies:** Grid, ElementManager, ForkliftController

---

### 1.2 Grid System (`Grid.js`)

**Responsibilities:**
- Define grid dimensions and cell size
- Snap coordinates to grid positions
- Render grid lines/cells
- Provide grid-based measurement utilities

**Key Methods:**
```javascript
class Grid {
  constructor(cellSize, columns, rows)
  snap(x, y) // Returns grid-aligned coordinates
  getCellAt(x, y) // Returns grid cell indices
  render(ctx, viewport) // Draw grid overlay
  getWorldDimensions() // Total grid size in pixels
}
```

**Dependencies:** None (foundational component)

---

### 1.3 Element Manager (`ElementManager.js`)

**Responsibilities:**
- Store and manage all warehouse elements (walls, pallets, shelves, etc.)
- Add, remove, update, select elements
- Provide hit-testing for element selection
- Render all elements in proper order
- Calculate element positions/dimensions

**Key Methods:**
```javascript
class ElementManager {
  constructor(grid)
  addElement(type, x, y, properties)
  removeElement(id)
  getElementAt(x, y) // Hit-testing
  selectElement(id)
  updateElement(id, properties)
  render(ctx)
  getAllElements()
  clear()
}
```

**Element Types:**
```javascript
{
  id: 'uuid',
  type: 'wall' | 'pallet' | 'shelf' | 'door' | 'zone',
  x: number,      // Grid-aligned world coordinates
  y: number,
  width: number,  // In grid cells
  height: number,
  properties: {
    // Type-specific properties
    color: string,
    label: string,
    rotation: number,
    // Pallets: SKU, quantity, weight
    // Shelves: capacity, levels
  },
  selectable: boolean,
  draggable: boolean
}
```

**Dependencies:** Grid

---

### 1.4 Inventory Sidebar (`InventorySidebar.js`)

**Responsibilities:**
- Display palette of available warehouse elements
- Handle drag-start events for element placement
- Display element properties panel
- Provide element templates

**Key Methods:**
```javascript
class InventorySidebar {
  constructor(containerElement, elementManager)
  renderPalette(elementTypes)
  onElementDragStart(type, template)
  showProperties(element)
  updateProperties(element, newProps)
}
```

**Dependencies:** ElementManager

---

### 1.5 Forklift Controller (`ForkliftController.js`)

**Responsibilities:**
- Maintain forklift position and state
- Handle keyboard input for movement
- Animate movement between grid cells
- Carry/drop pallets
- Render forklift sprite/shape

**Key Methods:**
```javascript
class ForkliftController {
  constructor(grid, collisionSystem)
  move(direction) // 'up' | 'down' | 'left' | 'right'
  update(deltaTime) // Animation tick
  pickupPallet(palletId)
  dropPallet()
  render(ctx)
  getPosition()
  getCarriedPallet()
}
```

**State:**
```javascript
{
  x: number,
  y: number,
  direction: 'up' | 'down' | 'left' | 'right',
  isMoving: boolean,
  speed: number, // Grid cells per second
  carriedPallet: elementId | null
}
```

**Dependencies:** Grid, CollisionSystem

---

### 1.6 Collision System (`CollisionSystem.js`)

**Responsibilities:**
- Detect collisions between forklift and elements
- Validate movement before execution
- Provide collision queries for pathfinding

**Key Methods:**
```javascript
class CollisionSystem {
  constructor(elementManager)
  canMoveTo(x, y, excludeIds) // Boolean check
  getCollisionsAt(x, y) // Returns array of elements
  checkAABB(rect1, rect2) // Axis-aligned bounding box
}
```

**Dependencies:** ElementManager

---

### 1.7 Pallet Counter (`PalletCounter.js`)

**Responsibilities:**
- Track total pallet count
- Calculate warehouse utilization metrics
- Update display in real-time

**Key Methods:**
```javascript
class PalletCounter {
  constructor(elementManager, displayElement)
  update()
  getTotalPallets()
  getUtilization() // Percentage of grid filled
  render() // Update DOM display
}
```

**Dependencies:** ElementManager

---

### 1.8 Persistence Layer (`PersistenceManager.js`)

**Responsibilities:**
- Serialize/deserialize application state
- Save to JSONBin.io (cloud backup)
- Save to localStorage (local cache)
- Auto-save on state changes (debounced)
- Load saved layouts

**Key Methods:**
```javascript
class PersistenceManager {
  constructor(apiKey, binId)
  async save(state)
  async load()
  saveLocal(state)
  loadLocal()
  serialize(state) // To JSON
  deserialize(json) // From JSON
  enableAutoSave(interval)
}
```

**Serialized State Format:**
```json
{
  "version": "1.0.0",
  "timestamp": "ISO-8601",
  "grid": {
    "cellSize": 40,
    "columns": 50,
    "rows": 40
  },
  "elements": [...],
  "forklift": {
    "x": 0,
    "y": 0,
    "direction": "right"
  },
  "viewport": {
    "zoom": 1.0,
    "panX": 0,
    "panY": 0
  }
}
```

**Dependencies:** ElementManager, ForkliftController, CanvasRenderer

---

### 1.9 Input Handler (`InputHandler.js`)

**Responsibilities:**
- Centralize all input event handling
- Dispatch events to appropriate components
- Handle keyboard (forklift, shortcuts)
- Handle mouse (pan, select, drag elements)
- Handle touch (mobile support)

**Key Methods:**
```javascript
class InputHandler {
  constructor(canvasElement)
  onKeyDown(handler)
  onMouseDown(handler)
  onMouseMove(handler)
  onMouseUp(handler)
  onWheel(handler) // Zoom
  enableDragDrop(callbacks)
  destroy() // Remove listeners
}
```

**Event Flow:**
```
Keyboard → ForkliftController
Mouse Click → ElementManager (selection)
Mouse Drag (canvas) → CanvasRenderer (pan)
Mouse Drag (sidebar) → ElementManager (place element)
Mouse Wheel → CanvasRenderer (zoom)
```

**Dependencies:** None (event emitter)

---

## 2. Data Flow

### 2.1 User Input → State Change → Re-render Cycle

**Event-Driven Architecture:**
```
User Action
    ↓
InputHandler (captures event)
    ↓
Component (modifies state)
    ↓
StateManager (notifies subscribers)
    ↓
CanvasRenderer (re-renders)
```

**Example: Click to Select Element**
```
1. User clicks canvas
2. InputHandler captures mousedown event
3. InputHandler converts canvas coords to world coords
4. ElementManager.getElementAt(x, y) finds element
5. ElementManager.selectElement(id) updates selection state
6. StateManager emits 'stateChanged' event
7. CanvasRenderer.render() redraws with selection highlight
8. InventorySidebar.showProperties() displays element details
```

---

### 2.2 Element Creation Flow

**Sidebar → Canvas:**
```
1. User drags element from InventorySidebar
2. InventorySidebar emits 'elementDragStart' with type
3. InputHandler tracks mouse position over canvas
4. Grid.snap() provides grid-aligned preview position
5. CanvasRenderer renders ghost preview (semi-transparent)
6. User releases mouse (drop)
7. ElementManager.addElement(type, x, y)
8. StateManager notifies subscribers
9. CanvasRenderer re-renders with new element
10. PalletCounter.update() if element is pallet
11. PersistenceManager.save() (debounced)
```

---

### 2.3 Forklift Movement Flow

**Keyboard → Position Update → Collision Check → Render:**
```
1. User presses arrow key
2. InputHandler captures keydown event
3. ForkliftController.move(direction) called
4. ForkliftController calculates target position
5. Grid.snap() ensures grid alignment
6. CollisionSystem.canMoveTo(x, y) checks validity
7. If valid:
   a. ForkliftController updates position
   b. Animation starts (isMoving = true)
   c. requestAnimationFrame loop for smooth movement
8. ForkliftController.update(deltaTime) each frame
9. CanvasRenderer.render() shows animated movement
10. When animation complete, isMoving = false
11. If on pallet and carrying nothing, offer pickup
```

**Collision Detection Detail:**
```javascript
// Before move
const targetX = forklift.x + directionDelta.x;
const targetY = forklift.y + directionDelta.y;

// Check bounds
if (targetX < 0 || targetX >= grid.columns) return false;

// Check element collisions
const forkliftBounds = {
  x: targetX,
  y: targetY,
  width: 1, // 1 grid cell
  height: 1
};

const collisions = collisionSystem.getCollisionsAt(forkliftBounds);
const blocking = collisions.filter(el => el.type === 'wall' || el.type === 'shelf');

if (blocking.length > 0) return false; // Blocked
```

---

### 2.4 Save/Load Flow

**State → Serialize → JSONBin/localStorage:**

**Save:**
```
1. State change occurs (e.g., element added)
2. StateManager emits 'stateChanged'
3. PersistenceManager receives event (debounced 2s)
4. PersistenceManager.serialize(state)
   - Extracts elements from ElementManager
   - Extracts forklift state from ForkliftController
   - Extracts viewport from CanvasRenderer
   - Bundles into JSON object
5. PersistenceManager.saveLocal(json) → localStorage
6. PersistenceManager.save(json) → JSONBin.io API
7. Success/error feedback to user
```

**Load:**
```
1. User clicks "Load Layout" or app initializes
2. PersistenceManager.load()
   a. Try JSONBin.io first (most recent)
   b. Fallback to localStorage if offline
3. PersistenceManager.deserialize(json)
4. ElementManager.clear() then add all elements
5. ForkliftController.setPosition(x, y)
6. CanvasRenderer.setViewport(zoom, pan)
7. CanvasRenderer.render()
8. PalletCounter.update()
```

---

## 3. Data Model

### 3.1 Core Application State

**Centralized State Object:**
```javascript
const appState = {
  // Grid configuration
  grid: {
    cellSize: 40,        // Pixels per grid cell
    columns: 50,
    rows: 40,
    showGrid: true,
    snapToGrid: true
  },

  // All warehouse elements
  elements: [
    {
      id: 'elem_001',
      type: 'wall',
      x: 5,              // Grid cell coordinates
      y: 10,
      width: 1,
      height: 5,
      properties: {
        color: '#333',
        thickness: 0.2   // Fraction of cell
      }
    },
    {
      id: 'elem_002',
      type: 'pallet',
      x: 8,
      y: 12,
      width: 1,
      height: 1,
      properties: {
        sku: 'SKU-12345',
        quantity: 48,
        weight: 1200,     // kg
        color: '#ff9800'
      }
    },
    {
      id: 'elem_003',
      type: 'shelf',
      x: 15,
      y: 5,
      width: 3,
      height: 1,
      properties: {
        levels: 4,
        capacity: 16,      // Pallets
        occupied: 12,
        color: '#2196f3'
      }
    }
  ],

  // Current selection
  selection: {
    elementId: 'elem_002',
    mode: 'select'       // 'select' | 'drag' | 'resize'
  },

  // Forklift state
  forklift: {
    x: 0,
    y: 0,
    direction: 'right',
    isMoving: false,
    speed: 4,            // Cells per second
    carriedPallet: null  // Element ID or null
  },

  // Viewport/camera
  viewport: {
    zoom: 1.0,           // 0.5 to 2.0
    panX: 0,             // World offset in pixels
    panY: 0,
    canvasWidth: 1200,
    canvasHeight: 800
  },

  // UI state
  ui: {
    sidebarOpen: true,
    tool: 'select',      // 'select' | 'pan' | 'place'
    placingType: null    // Element type being placed
  },

  // Metrics
  metrics: {
    totalPallets: 0,
    totalShelves: 0,
    utilization: 0.0     // Percentage
  }
};
```

---

### 3.2 Element Type Definitions

**Wall:**
```javascript
{
  type: 'wall',
  x: number,
  y: number,
  width: number,        // Length in grid cells
  height: number,       // Typically 1 for horizontal, width for vertical
  properties: {
    color: '#333',
    thickness: 0.2,     // Visual thickness
    label: 'North Wall'
  }
}
```

**Pallet:**
```javascript
{
  type: 'pallet',
  x: number,
  y: number,
  width: 1,             // Always 1x1
  height: 1,
  properties: {
    sku: string,
    quantity: number,
    weight: number,
    color: '#ff9800',
    label: string
  }
}
```

**Shelf:**
```javascript
{
  type: 'shelf',
  x: number,
  y: number,
  width: number,        // Multi-cell
  height: number,
  properties: {
    levels: number,     // Vertical capacity
    capacity: number,   // Total pallet slots
    occupied: number,   // Current usage
    color: '#2196f3',
    label: 'Aisle A'
  }
}
```

**Door:**
```javascript
{
  type: 'door',
  x: number,
  y: number,
  width: number,
  height: number,
  properties: {
    isOpen: boolean,
    direction: 'in' | 'out' | 'both',
    color: '#4caf50'
  }
}
```

**Zone (Area Marker):**
```javascript
{
  type: 'zone',
  x: number,
  y: number,
  width: number,
  height: number,
  properties: {
    label: 'Receiving',
    color: 'rgba(255, 0, 0, 0.1)',
    borderColor: '#f00',
    purpose: 'receiving' | 'shipping' | 'storage' | 'staging'
  }
}
```

---

### 3.3 Session State (Non-Persisted)

**Runtime-only data:**
```javascript
const sessionState = {
  // Animation state
  animation: {
    frameId: null,           // requestAnimationFrame ID
    lastFrameTime: 0,
    deltaTime: 0
  },

  // Input tracking
  input: {
    mouseX: 0,
    mouseY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    keysPressed: new Set()   // Active keys
  },

  // Temporary preview state
  preview: {
    active: false,
    elementType: null,
    x: 0,
    y: 0
  },

  // History for undo/redo
  history: {
    past: [],                // Previous states
    future: []               // Redo states
  }
};
```

---

## 4. Rendering Architecture

### 4.1 Layer Ordering (Bottom to Top)

**Rendering Sequence:**
```
1. Background (solid color)
2. Grid lines
3. Zones (semi-transparent)
4. Shelves
5. Pallets (not carried)
6. Walls
7. Doors
8. Forklift (with carried pallet if any)
9. Selection highlight
10. Preview/ghost element (during placement)
11. UI overlays (debug info, coordinates)
```

**Implementation:**
```javascript
class CanvasRenderer {
  render(state) {
    this.clear();
    this.applyViewportTransform(state.viewport);

    // Layer 1-2: Background & Grid
    this.renderBackground();
    if (state.grid.showGrid) {
      this.grid.render(this.ctx, state.viewport);
    }

    // Layer 3-7: Static elements (sorted by layer)
    const sortedElements = this.sortElementsByLayer(state.elements);
    for (const element of sortedElements) {
      this.renderElement(element, state);
    }

    // Layer 8: Forklift
    this.forkliftController.render(this.ctx);

    // Layer 9: Selection
    if (state.selection.elementId) {
      this.renderSelectionHighlight(state.selection.elementId);
    }

    // Layer 10: Preview
    if (state.preview.active) {
      this.renderPreview(state.preview);
    }

    this.resetTransform();
  }

  sortElementsByLayer(elements) {
    const layerOrder = {
      'zone': 1,
      'shelf': 2,
      'pallet': 3,
      'wall': 4,
      'door': 5
    };
    return elements.sort((a, b) => layerOrder[a.type] - layerOrder[b.type]);
  }
}
```

---

### 4.2 Render Loop Strategy

**Hybrid Approach: Event-Driven + Animation Loop**

**Event-Driven Rendering (Default):**
```javascript
class StateManager {
  constructor() {
    this.state = initialState;
    this.listeners = [];
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn(this.state));
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }
}

// In main app
const stateManager = new StateManager();
stateManager.subscribe((state) => {
  renderer.render(state);
});
```

**Animation Loop (When Forklift Moving):**
```javascript
class App {
  constructor() {
    this.isAnimating = false;
    this.animationFrameId = null;
  }

  startAnimationLoop() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.lastFrameTime = performance.now();
    this.animate();
  }

  animate(currentTime) {
    if (!this.isAnimating) return;

    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Seconds
    this.lastFrameTime = currentTime;

    // Update animated components
    this.forkliftController.update(deltaTime);

    // Render
    this.renderer.render(this.stateManager.state);

    // Continue loop
    this.animationFrameId = requestAnimationFrame((t) => this.animate(t));
  }

  stopAnimationLoop() {
    this.isAnimating = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Start loop when forklift moves
forkliftController.on('movementStart', () => app.startAnimationLoop());
forkliftController.on('movementEnd', () => app.stopAnimationLoop());
```

---

### 4.3 Viewport Transform (Pan/Zoom)

**Canvas Transformation Matrix:**
```javascript
class CanvasRenderer {
  applyViewportTransform(viewport) {
    const { zoom, panX, panY, canvasWidth, canvasHeight } = viewport;

    // Center the origin
    this.ctx.translate(canvasWidth / 2, canvasHeight / 2);

    // Apply zoom
    this.ctx.scale(zoom, zoom);

    // Apply pan (inverted because we're moving the world, not camera)
    this.ctx.translate(-panX, -panY);
  }

  resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Convert mouse coords to world coords
  toWorldCoords(canvasX, canvasY) {
    const { zoom, panX, panY, canvasWidth, canvasHeight } = this.viewport;

    // Adjust for center origin
    const adjustedX = canvasX - canvasWidth / 2;
    const adjustedY = canvasY - canvasHeight / 2;

    // Inverse zoom and pan
    const worldX = (adjustedX / zoom) + panX;
    const worldY = (adjustedY / zoom) + panY;

    return { x: worldX, y: worldY };
  }

  // Convert world coords to canvas coords
  toCanvasCoords(worldX, worldY) {
    const { zoom, panX, panY, canvasWidth, canvasHeight } = this.viewport;

    const x = ((worldX - panX) * zoom) + canvasWidth / 2;
    const y = ((worldY - panY) * zoom) + canvasHeight / 2;

    return { x, y };
  }

  zoom(delta, centerX, centerY) {
    // Zoom toward mouse position
    const worldPoint = this.toWorldCoords(centerX, centerY);

    const newZoom = Math.max(0.5, Math.min(2.0, this.viewport.zoom + delta));
    const zoomRatio = newZoom / this.viewport.zoom;

    // Adjust pan to keep world point under cursor
    this.viewport.panX = worldPoint.x - (worldPoint.x - this.viewport.panX) / zoomRatio;
    this.viewport.panY = worldPoint.y - (worldPoint.y - this.viewport.panY) / zoomRatio;
    this.viewport.zoom = newZoom;
  }

  pan(deltaX, deltaY) {
    // deltaX/deltaY are in canvas pixels, convert to world units
    this.viewport.panX -= deltaX / this.viewport.zoom;
    this.viewport.panY -= deltaY / this.viewport.zoom;
  }
}
```

---

### 4.4 Rendering Optimization

**Techniques:**

1. **Dirty Rectangle Tracking** (optional, for large grids):
```javascript
// Only re-render changed regions
const dirtyRect = calculateDirtyRect(changedElements);
ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
// ... render only elements in dirty rect
```

2. **Culling** (don't render off-screen elements):
```javascript
isInViewport(element, viewport) {
  const elementWorld = this.getElementBounds(element);
  const viewportWorld = this.getViewportBounds(viewport);
  return this.rectsIntersect(elementWorld, viewportWorld);
}

render(state) {
  const visibleElements = state.elements.filter(el =>
    this.isInViewport(el, state.viewport)
  );
  // Render only visible elements
}
```

3. **Object Pooling** (reuse objects):
```javascript
// Avoid creating new objects in render loop
// Pre-allocate coordinate objects
const tempCoords = { x: 0, y: 0 };

// Reuse in calculations
function updatePosition() {
  tempCoords.x = newX;
  tempCoords.y = newY;
  grid.snap(tempCoords); // Modifies in place
  return tempCoords;
}
```

4. **Batch Rendering** (minimize state changes):
```javascript
// Group elements by color/stroke to minimize ctx state changes
const groupedByStyle = groupBy(elements, el => el.properties.color);
for (const [color, group] of groupedByStyle) {
  ctx.fillStyle = color;
  group.forEach(el => {
    ctx.fillRect(el.x, el.y, el.width, el.height);
  });
}
```

---

## 5. Build Order & Implementation Sequence

### Phase 1: Foundation (No dependencies)

**1.1 Grid System**
- Implement Grid class
- Grid snapping logic
- Grid rendering
- Test: Draw grid on canvas

**1.2 Canvas Renderer**
- Basic canvas setup
- Clear/render cycle
- Coordinate transform utilities
- Test: Render grid with pan/zoom

**1.3 Input Handler**
- Event listener setup
- Mouse/keyboard capture
- Coordinate conversion integration
- Test: Log click positions in world coords

---

### Phase 2: Core State & Elements

**2.1 State Manager**
- Central state object
- Subscribe/notify pattern
- State update methods
- Test: State changes trigger re-renders

**2.2 Element Manager**
- Element storage (array/map)
- Add/remove/update elements
- Element rendering (basic shapes)
- Test: Add wall, pallet, shelf manually

**2.3 Hit Testing & Selection**
- getElementAt() implementation
- Selection state
- Selection highlight rendering
- Test: Click to select elements

---

### Phase 3: Interaction

**3.1 Inventory Sidebar**
- HTML/CSS sidebar layout
- Element palette rendering
- Drag-and-drop setup
- Test: Drag element from sidebar to canvas

**3.2 Element Placement**
- Drag event handling
- Ghost preview rendering
- Grid-aligned placement
- Test: Place elements on grid

**3.3 Element Properties Panel**
- Property form display
- Property editing
- Update element on change
- Test: Edit pallet SKU, shelf capacity

---

### Phase 4: Forklift & Collision

**4.1 Forklift Controller (Static)**
- Forklift state
- Basic rendering (rectangle or sprite)
- Position management
- Test: Render forklift at position

**4.2 Collision System**
- AABB collision detection
- canMoveTo() validation
- Test: Detect wall collisions

**4.3 Forklift Movement**
- Keyboard input integration
- Grid-based movement
- Collision-aware movement
- Test: Drive forklift with arrow keys

**4.4 Forklift Animation**
- Smooth interpolation between cells
- requestAnimationFrame loop
- Direction sprites/rotation
- Test: Smooth forklift movement

**4.5 Pallet Pickup/Drop**
- Carry pallet logic
- Render carried pallet on forklift
- Drop pallet at new location
- Test: Move pallet with forklift

---

### Phase 5: Persistence

**5.1 Serialization**
- State to JSON
- JSON to state
- Version handling
- Test: Serialize and deserialize state

**5.2 localStorage Integration**
- Save on state change (debounced)
- Load on app init
- Test: Refresh page, layout persists

**5.3 JSONBin.io Integration**
- API setup (key, bin ID)
- Cloud save
- Cloud load with fallback
- Test: Save/load from cloud

**5.4 Auto-Save**
- Debounced save trigger
- Save status indicator
- Error handling
- Test: Auto-save after edits

---

### Phase 6: Polish & Metrics

**6.1 Pallet Counter**
- Count pallets in ElementManager
- Display in UI
- Real-time updates
- Test: Count updates on add/remove

**6.2 Viewport Controls**
- Pan with mouse drag
- Zoom with scroll wheel
- Zoom buttons (UI)
- Reset view button
- Test: Navigate large warehouse

**6.3 Undo/Redo**
- History stack
- State snapshots
- Ctrl+Z / Ctrl+Shift+Z
- Test: Undo element placement

**6.4 Keyboard Shortcuts**
- Delete selected element
- Copy/paste
- Deselect (Esc)
- Test: All shortcuts work

**6.5 Mobile/Touch Support**
- Touch event handling
- Pinch-to-zoom
- Touch drag for pan
- Test on mobile device

---

### Phase 7: Advanced Features (Optional)

**7.1 Multi-Select**
- Click + drag selection box
- Shift-click to add to selection
- Group move

**7.2 Rotation**
- Rotate elements (90° increments)
- Keyboard shortcut (R)
- Collision detection for rotated elements

**7.3 Copy/Paste Layouts**
- Export layout to JSON file
- Import layout from file
- Template library

**7.4 Print/Export**
- Export canvas to PNG
- Print layout
- Generate PDF report

---

## Dependency Graph

```
Grid (no deps)
  ↓
CanvasRenderer ← InputHandler (no deps)
  ↓
StateManager (no deps)
  ↓
ElementManager
  ↓                ↓
CollisionSystem  PalletCounter
  ↓
ForkliftController
  ↓
InventorySidebar
  ↓
PersistenceManager
```

**Critical Path:**
Grid → CanvasRenderer → StateManager → ElementManager → ForkliftController → Complete App

---

## File Structure

```
/
├── index.html                 # Entry point
├── styles.css                 # Global styles
├── js/
│   ├── main.js                # App initialization
│   ├── Grid.js
│   ├── CanvasRenderer.js
│   ├── StateManager.js
│   ├── ElementManager.js
│   ├── InventorySidebar.js
│   ├── ForkliftController.js
│   ├── CollisionSystem.js
│   ├── PalletCounter.js
│   ├── PersistenceManager.js
│   ├── InputHandler.js
│   └── utils/
│       ├── geometry.js        # AABB, snap, distance utils
│       ├── events.js          # EventEmitter helper
│       └── constants.js       # Element types, colors
└── assets/
    ├── forklift-sprite.png    # Optional sprite
    └── icons/                 # Sidebar icons
```

---

## Key Design Decisions

### 1. Why No Framework?
- **Simplicity**: No build step, no dependency management
- **Learning**: Pure platform features
- **Performance**: Direct canvas manipulation, no virtual DOM overhead
- **Portability**: Runs anywhere with a browser

### 2. Why Event-Driven + Animation Loop Hybrid?
- **Efficiency**: No wasted frames when static
- **Smoothness**: 60 FPS movement when needed
- **Battery**: Save power on mobile when idle

### 3. Why Grid-Based Coordinates?
- **Simplicity**: Easy alignment, no floating-point errors
- **UX**: Predictable placement
- **Collision**: Trivial AABB checks
- **Scale**: Easier to reason about large warehouses

### 4. Why JSONBin.io + localStorage?
- **No Backend**: Avoid server setup
- **Offline First**: localStorage for instant load
- **Cloud Backup**: JSONBin for cross-device sync
- **Cost**: Free tier sufficient for personal use

### 5. Why Canvas Over SVG?
- **Performance**: Better for many elements (100+)
- **Control**: Direct pixel manipulation
- **Simplicity**: Single render method vs DOM tree
- **Animation**: requestAnimationFrame integration

---

## Performance Targets

- **Load time**: < 1 second (including assets)
- **Render time**: < 16ms per frame (60 FPS)
- **Max elements**: 500+ without lag
- **Grid size**: 100x100 cells
- **Zoom range**: 0.5x to 2.0x
- **Auto-save delay**: 2 seconds after last edit

---

## Browser Compatibility

**Target:** Modern browsers (2023+)
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required APIs:**
- Canvas 2D context
- ES6 modules (type="module")
- localStorage
- requestAnimationFrame
- Fetch API (for JSONBin.io)

**Polyfills:** None required for modern browsers

---

## Testing Strategy

### Unit Tests (Manual)
- Grid snapping accuracy
- Collision detection edge cases
- Coordinate transformations
- Serialization round-trip

### Integration Tests
- Place element → save → reload → verify
- Move forklift → collision → blocked
- Select element → edit → update display

### User Acceptance Tests
- Draw complete warehouse layout
- Move 10 pallets with forklift
- Save and load from cloud
- Zoom/pan across large layout

---

## Future Enhancements (Out of Scope for MVP)

1. **Pathfinding**: A* for forklift auto-navigation
2. **Multi-User**: WebSocket-based collaboration
3. **3D View**: Three.js integration for isometric view
4. **Analytics**: Heatmaps, utilization graphs
5. **Import CAD**: Parse DXF/DWG files
6. **Mobile App**: Native wrapper (Capacitor)
7. **AI Assistant**: Suggest optimal layouts
8. **Inventory Integration**: Sync with WMS APIs

---

## Conclusion

This architecture provides a solid foundation for a browser-based warehouse layout tool. The modular design allows incremental development, with each phase building on the previous. The hybrid rendering approach balances performance with simplicity, and the dual-persistence strategy ensures data safety without backend complexity.

**Start with Phase 1**, build the grid and renderer, then progressively add features. Each component has clear responsibilities and minimal dependencies, making the system easy to understand, test, and extend.
