# Common Pitfalls: Browser-Based Canvas Drawing Tools

This document catalogs common pitfalls when building a warehouse layout tool with HTML Canvas, vanilla JS, and no framework dependencies. Each pitfall includes warning signs, prevention strategies, and phase recommendations.

---

## Canvas-Specific Pitfalls

### 1. DPI/Retina Display Issues (Blurry Canvas)

**Problem**: Canvas appears blurry on high-DPI displays (Retina, 4K monitors) because the canvas logical size doesn't match physical pixel density.

**Warning Signs**:
- Text and lines appear fuzzy or blurred on Retina displays
- Sharp rendering on standard displays but blurry on high-DPI screens
- Grid lines look thick or antialiased when they should be crisp

**Prevention Strategy**:
```javascript
// Scale canvas for device pixel ratio
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Set actual size in memory (scale for DPI)
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Set display size (CSS pixels)
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  // Scale all drawing operations
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  return ctx;
}
```

**Address In**: Phase 1 (Foundation) - Set this up immediately in the initial canvas setup to avoid rework.

---

### 2. Coordinate System Confusion (Screen vs World vs Grid)

**Problem**: Three different coordinate systems create confusion: screen pixels, world coordinates, and grid cells. Mixing them causes misalignment, incorrect hit detection, and positioning bugs.

**Warning Signs**:
- Elements snap to wrong grid positions after zoom/pan
- Mouse clicks miss elements by a consistent offset
- Grid lines don't align with placed elements
- Drag-and-drop places elements at wrong coordinates

**Prevention Strategy**:
- Establish clear coordinate system definitions upfront:
  - **Screen coordinates**: Canvas pixels (0,0 = top-left corner)
  - **World coordinates**: Logical space in feet (independent of zoom/pan)
  - **Grid coordinates**: Integer grid cell indices
- Create conversion utilities and use consistently:

```javascript
const CoordinateSystem = {
  // Screen to world (accounts for pan/zoom)
  screenToWorld(screenX, screenY, camera) {
    return {
      x: (screenX - camera.offsetX) / camera.zoom,
      y: (screenY - camera.offsetY) / camera.zoom
    };
  },

  // World to grid (snap to grid cells)
  worldToGrid(worldX, worldY, gridSize) {
    return {
      col: Math.floor(worldX / gridSize),
      row: Math.floor(worldY / gridSize)
    };
  },

  // Grid to world (center of cell or corner)
  gridToWorld(col, row, gridSize, centered = true) {
    const offset = centered ? gridSize / 2 : 0;
    return {
      x: col * gridSize + offset,
      y: row * gridSize + offset
    };
  },

  // World to screen (for rendering)
  worldToScreen(worldX, worldY, camera) {
    return {
      x: worldX * camera.zoom + camera.offsetX,
      y: worldY * camera.zoom + camera.offsetY
    };
  }
};
```

**Address In**: Phase 1 (Foundation) - Core infrastructure. All coordinate transformations must be solid before building features.

---

### 3. Performance with Many Elements

**Problem**: Canvas redraws entire scene on every frame. With hundreds of elements (pallets, racks, walls), performance degrades, especially with zoom/pan/drag operations.

**Warning Signs**:
- Frame rate drops below 60fps with 100+ elements
- Dragging elements becomes laggy
- Mouse move events cause stuttering
- Canvas redraws take >16ms (visible in profiler)

**Prevention Strategy**:
- **Spatial partitioning**: Implement quadtree or grid-based spatial index
- **Dirty rectangle rendering**: Only redraw changed regions (complex for zoom/pan)
- **Culling**: Don't render elements outside viewport
- **Layering**: Use multiple canvases for static vs dynamic content
- **Batch rendering**: Group similar elements (all pallets, then all walls)
- **Throttle redraws**: Debounce mouse move events

```javascript
// Simple culling example
function renderVisibleElements(ctx, elements, camera, canvasWidth, canvasHeight) {
  const viewBounds = {
    left: -camera.offsetX / camera.zoom,
    top: -camera.offsetY / camera.zoom,
    right: (canvasWidth - camera.offsetX) / camera.zoom,
    bottom: (canvasHeight - camera.offsetY) / camera.zoom
  };

  for (const element of elements) {
    // Skip if entirely outside viewport
    if (element.x + element.width < viewBounds.left ||
        element.x > viewBounds.right ||
        element.y + element.height < viewBounds.top ||
        element.y > viewBounds.bottom) {
      continue;
    }
    element.render(ctx);
  }
}
```

**Address In**: Phase 2 (Drawing Tools) - Start with simple approach, add optimization when performance issues appear. Profile before optimizing.

---

### 4. Click Detection on Canvas Elements (Hit Testing)

**Problem**: Canvas is a bitmap - it doesn't track individual elements. You must implement hit testing manually, which gets complex with rotation, overlapping elements, and z-ordering.

**Warning Signs**:
- Clicks select wrong element
- Can't click small elements reliably
- Overlapping elements always select the same one
- Rotated elements have incorrect hit boxes

**Prevention Strategy**:
- Maintain element list with z-order (render order)
- Test in reverse render order (top to bottom)
- Use bounding box tests first, then precise tests if needed
- Consider click tolerance (expand hit box by a few pixels)

```javascript
function findElementAtPoint(worldX, worldY, elements) {
  // Test from top to bottom (reverse render order)
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];

    // Simple AABB test (axis-aligned bounding box)
    if (worldX >= element.x && worldX <= element.x + element.width &&
        worldY >= element.y && worldY <= element.y + element.height) {

      // For rotated elements, do additional precise test
      if (element.rotation !== 0) {
        if (pointInRotatedRect(worldX, worldY, element)) {
          return element;
        }
      } else {
        return element;
      }
    }
  }
  return null;
}

function pointInRotatedRect(px, py, rect) {
  // Rotate point back to element's local space
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const cos = Math.cos(-rect.rotation);
  const sin = Math.sin(-rect.rotation);
  const dx = px - cx;
  const dy = py - cy;
  const localX = dx * cos - dy * sin + cx;
  const localY = dx * sin + dy * cos + cy;

  return localX >= rect.x && localX <= rect.x + rect.width &&
         localY >= rect.y && localY <= rect.y + rect.height;
}
```

**Address In**: Phase 2 (Drawing Tools) - Essential for drag-and-drop and selection. Start with simple AABB, add rotation support as needed.

---

### 5. Canvas Resize Handling

**Problem**: Canvas resize clears content, and incorrect resize handling causes distortion, state loss, and coordinate system breakage.

**Warning Signs**:
- Canvas content disappears on window resize
- Elements appear stretched or squashed after resize
- Grid doesn't recalculate properly
- Camera/zoom state gets corrupted

**Prevention Strategy**:
- Separate logical state from rendering
- Store all element positions in world coordinates (not screen)
- Redraw from state after resize
- Update camera/viewport calculations

```javascript
window.addEventListener('resize', () => {
  // Save camera state
  const camera = getCurrentCamera();

  // Resize canvas (triggers clear)
  setupCanvas(canvas);

  // Restore camera state
  setCamera(camera);

  // Redraw everything from state
  renderScene();
});

// Debounced version for performance
const debouncedResize = debounce(() => {
  // resize logic
}, 150);
window.addEventListener('resize', debouncedResize);
```

**Address In**: Phase 1 (Foundation) - Set up proper resize handling early to avoid state loss bugs.

---

## Drawing Tool Pitfalls

### 6. Drag and Drop Edge Cases

**Problem**: Dragging elements near canvas edges, overlapping elements, or with grid snapping creates numerous edge cases that break UX.

**Warning Signs**:
- Elements disappear when dragged to edge
- Elements snap to wrong grid cell at canvas boundary
- Can't drag overlapping elements individually
- Drag offset shifts unexpectedly when grid snap toggles
- Elements "jump" when drag starts if click isn't centered

**Prevention Strategy**:
- Calculate drag offset from element origin to click point
- Constrain movement to canvas bounds (or allow off-canvas if intentional)
- Handle grid snap toggle during drag gracefully
- Prevent drag start if element is locked/immovable

```javascript
class DragController {
  constructor() {
    this.draggedElement = null;
    this.dragOffset = { x: 0, y: 0 };
    this.snapToGrid = true;
  }

  startDrag(element, worldX, worldY) {
    this.draggedElement = element;
    // Store offset from element origin to click point
    this.dragOffset.x = worldX - element.x;
    this.dragOffset.y = worldY - element.y;
  }

  updateDrag(worldX, worldY, gridSize) {
    if (!this.draggedElement) return;

    // Calculate new position accounting for offset
    let newX = worldX - this.dragOffset.x;
    let newY = worldY - this.dragOffset.y;

    // Apply grid snapping
    if (this.snapToGrid) {
      const grid = CoordinateSystem.worldToGrid(newX, newY, gridSize);
      const snapped = CoordinateSystem.gridToWorld(grid.col, grid.row, gridSize, false);
      newX = snapped.x;
      newY = snapped.y;
    }

    // Constrain to bounds (optional - warehouse might allow partial off-canvas)
    // newX = Math.max(0, Math.min(newX, maxWidth - element.width));
    // newY = Math.max(0, Math.min(newY, maxHeight - element.height));

    this.draggedElement.x = newX;
    this.draggedElement.y = newY;
  }

  endDrag() {
    this.draggedElement = null;
  }
}
```

**Address In**: Phase 2 (Drawing Tools) - Critical for usability. Test all edge cases thoroughly.

---

### 7. Undo/Redo Complexity

**Problem**: Naive undo/redo implementations (deep cloning entire state) cause memory bloat and performance issues. Partial state tracking misses changes.

**Warning Signs**:
- Memory usage grows with each action
- Undo/redo becomes slow with large layouts
- Circular references break JSON serialization
- Undo doesn't fully restore state (missing properties)
- Undo stack grows unbounded

**Prevention Strategy**:
- **Command pattern**: Store reversible actions, not full state snapshots
- **Limit stack size**: Cap at 50-100 actions
- **Batch operations**: Group rapid changes (like dragging) into single undo step
- **Immutable state**: Makes state snapshots safer but increases memory

```javascript
class CommandHistory {
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
  }
}

// Example command
class MoveElementCommand {
  constructor(element, oldX, oldY, newX, newY) {
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
```

**Address In**: Phase 3 (Enhancement) - Not MVP critical. Add after core features work.

---

### 8. Selection and Multi-Select Gotchas

**Problem**: Multi-select state tracking, group operations, and deselection edge cases create complex interaction bugs.

**Warning Signs**:
- Can't deselect elements
- Ctrl-click doesn't toggle selection properly
- Group drag moves elements by different amounts
- Delete removes wrong elements
- Selection visual state out of sync with actual state

**Prevention Strategy**:
- Maintain explicit selection set (Set or array of IDs)
- Handle Ctrl/Cmd key modifier consistently
- Group operations apply transforms relative to group center
- Click empty space clears selection

```javascript
class SelectionManager {
  constructor() {
    this.selectedIds = new Set();
  }

  select(elementId, additive = false) {
    if (!additive) {
      this.selectedIds.clear();
    }
    this.selectedIds.add(elementId);
  }

  deselect(elementId) {
    this.selectedIds.delete(elementId);
  }

  toggle(elementId) {
    if (this.selectedIds.has(elementId)) {
      this.selectedIds.delete(elementId);
    } else {
      this.selectedIds.add(elementId);
    }
  }

  clear() {
    this.selectedIds.clear();
  }

  isSelected(elementId) {
    return this.selectedIds.has(elementId);
  }

  getSelectedElements(allElements) {
    return allElements.filter(el => this.selectedIds.has(el.id));
  }
}
```

**Address In**: Phase 2 (Drawing Tools) - If supporting multi-select. For MVP, single selection is simpler.

---

### 9. Grid Snapping Precision Issues

**Problem**: Floating-point math causes grid snapping drift. Elements gradually shift off-grid after repeated operations.

**Warning Signs**:
- Elements slightly off-grid after multiple drags
- Grid lines don't align with element edges
- Rotation + snap causes position drift
- Zoom levels affect snap precision

**Prevention Strategy**:
- Store positions in grid coordinates internally (integers)
- Convert to world coordinates only for rendering
- Round explicitly, don't rely on floor/ceil alone
- Use integer grid cell indices as source of truth

```javascript
class GridElement {
  constructor(gridCol, gridRow, gridSize) {
    this.gridCol = gridCol;  // Integer grid coordinates
    this.gridRow = gridRow;
    this.gridSize = gridSize;
  }

  get worldX() {
    return this.gridCol * this.gridSize;
  }

  get worldY() {
    return this.gridRow * this.gridSize;
  }

  moveTo(worldX, worldY) {
    // Always snap to grid
    this.gridCol = Math.round(worldX / this.gridSize);
    this.gridRow = Math.round(worldY / this.gridSize);
  }
}

// For 6-inch grid precision with 1-foot base
const GRID_UNIT = 1; // 1 foot
const SNAP_RESOLUTION = 0.5; // 6 inches = 0.5 feet

function snapToGrid(worldValue, snapSize = SNAP_RESOLUTION) {
  return Math.round(worldValue / snapSize) * snapSize;
}
```

**Address In**: Phase 1 (Foundation) - Grid is core to warehouse layout. Get precision right from start.

---

### 10. Zoom/Pan Coordinate Transforms

**Problem**: Zoom/pan transform matrices are error-prone. Incorrect math causes drift, distortion, and broken mouse interaction.

**Warning Signs**:
- Canvas content drifts during zoom
- Pan doesn't follow mouse correctly
- Zoom doesn't center on mouse cursor
- Elements appear distorted at certain zoom levels
- Camera state gets corrupted after multiple operations

**Prevention Strategy**:
- Zoom toward mouse cursor position (not canvas center)
- Update camera offset when zooming to keep point under cursor fixed
- Clamp zoom levels (min/max)
- Separate camera state from rendering transforms

```javascript
class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.offsetX = 0;      // Pan offset in screen pixels
    this.offsetY = 0;
    this.zoom = 1;         // Scale factor (1 = 100%)
    this.minZoom = 0.1;
    this.maxZoom = 5;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  zoomAt(screenX, screenY, zoomDelta) {
    const oldZoom = this.zoom;

    // Calculate new zoom level
    this.zoom *= zoomDelta;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    // Adjust offset to keep point under cursor fixed
    const zoomRatio = this.zoom / oldZoom;
    this.offsetX = screenX - (screenX - this.offsetX) * zoomRatio;
    this.offsetY = screenY - (screenY - this.offsetY) * zoomRatio;
  }

  pan(deltaX, deltaY) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  reset() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1;
  }

  applyTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.zoom, this.zoom);
  }
}
```

**Address In**: Phase 2 (Drawing Tools) or Phase 3 (Enhancement) - Not MVP critical, but highly desirable for usability.

---

## Game-Loop Pitfalls (Forklift Driving)

### 11. Frame-Rate Dependent Movement

**Problem**: Movement speed varies with frame rate. Fast machines move forklift faster than slow machines, breaking gameplay consistency.

**Warning Signs**:
- Forklift moves faster on high-refresh monitors (120Hz vs 60Hz)
- Inconsistent movement speed across devices
- Collision detection misses at high speeds
- Movement feels choppy on slower machines

**Prevention Strategy**:
- Use delta time (time since last frame) for movement
- Define speed in units per second, not units per frame
- Cap delta time to prevent huge jumps (lag spike protection)

```javascript
class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.lastTime = 0;
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
  }

  loop(currentTime) {
    if (!this.running) return;

    // Calculate delta in seconds
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta time to prevent huge jumps
    const clampedDelta = Math.min(deltaTime, 0.1); // Max 100ms

    // Update game state
    this.updateFn(clampedDelta);

    // Render
    this.renderFn();

    requestAnimationFrame((time) => this.loop(time));
  }
}

// Usage
class Forklift {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.speed = 5; // feet per second
  }

  update(deltaTime, input) {
    if (input.up) this.y -= this.speed * deltaTime;
    if (input.down) this.y += this.speed * deltaTime;
    if (input.left) this.x -= this.speed * deltaTime;
    if (input.right) this.x += this.speed * deltaTime;
  }
}
```

**Address In**: Phase 4 (Forklift Driving) - Essential for consistent driving experience.

---

### 12. Key Repeat vs Keydown/Keyup Tracking

**Problem**: Using keydown events for movement triggers key repeat delay and stutter. Holding keys doesn't give smooth movement.

**Warning Signs**:
- Initial delay when holding arrow key
- Stuttering movement instead of smooth
- Diagonal movement feels jerky
- Can't hold multiple keys smoothly

**Prevention Strategy**:
- Track key state (pressed/released) instead of events
- Update movement in game loop based on current key state
- Use keydown to set state, keyup to clear it

```javascript
class InputManager {
  constructor() {
    this.keys = {};

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Prevent default for arrow keys (stop page scroll)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Clear all keys on window blur (prevent stuck keys)
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  isKeyPressed(code) {
    return this.keys[code] === true;
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;

    if (this.isKeyPressed('ArrowUp')) dy -= 1;
    if (this.isKeyPressed('ArrowDown')) dy += 1;
    if (this.isKeyPressed('ArrowLeft')) dx -= 1;
    if (this.isKeyPressed('ArrowRight')) dx += 1;

    return { dx, dy };
  }
}
```

**Address In**: Phase 4 (Forklift Driving) - Correct input handling is critical for feel.

---

### 13. Collision Response (Stopping vs Sliding Along Walls)

**Problem**: Simple collision detection stops movement completely. This feels bad when moving diagonally into a wall - player expects to slide along it.

**Warning Signs**:
- Forklift stops dead when hitting wall at angle
- Can't slide along walls while holding diagonal keys
- Getting stuck in corners
- Movement feels "sticky" near obstacles

**Prevention Strategy**:
- Separate X and Y collision checks
- If X movement collides, try just Y
- If Y movement collides, try just X
- This gives natural wall-sliding behavior

```javascript
class CollisionSystem {
  moveWithCollision(forklift, dx, dy, obstacles) {
    const newX = forklift.x + dx;
    const newY = forklift.y + dy;

    // Try full movement
    if (!this.checkCollision(newX, newY, forklift.width, forklift.height, obstacles)) {
      forklift.x = newX;
      forklift.y = newY;
      return;
    }

    // Try just X movement (slide along Y wall)
    if (!this.checkCollision(newX, forklift.y, forklift.width, forklift.height, obstacles)) {
      forklift.x = newX;
      return;
    }

    // Try just Y movement (slide along X wall)
    if (!this.checkCollision(forklift.x, newY, forklift.width, forklift.height, obstacles)) {
      forklift.y = newY;
      return;
    }

    // Can't move at all (stuck in corner)
  }

  checkCollision(x, y, width, height, obstacles) {
    for (const obstacle of obstacles) {
      if (this.rectsOverlap(
        x, y, width, height,
        obstacle.x, obstacle.y, obstacle.width, obstacle.height
      )) {
        return true;
      }
    }
    return false;
  }

  rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
           x1 + w1 > x2 &&
           y1 < y2 + h2 &&
           y1 + h1 > y2;
  }
}
```

**Address In**: Phase 4 (Forklift Driving) - Improves feel significantly. Worth implementing.

---

### 14. Diagonal Movement Speed (sqrt(2) Problem)

**Problem**: Moving diagonally (pressing up+right) moves at 1.414x speed (sqrt(2)) compared to cardinal directions. Breaks game balance and feels wrong.

**Warning Signs**:
- Forklift moves faster diagonally
- Inconsistent time to cross same distance
- Players exploit diagonal movement for speed

**Prevention Strategy**:
- Normalize movement vector before applying speed
- Diagonal movement should be same speed as cardinal

```javascript
class Forklift {
  update(deltaTime, input) {
    const movement = input.getMovementVector();
    let dx = movement.dx;
    let dy = movement.dy;

    // Normalize diagonal movement
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
      dx /= magnitude;
      dy /= magnitude;
    }

    // Apply speed
    dx *= this.speed * deltaTime;
    dy *= this.speed * deltaTime;

    // Apply collision and move
    collisionSystem.moveWithCollision(this, dx, dy, obstacles);
  }
}
```

**Address In**: Phase 4 (Forklift Driving) - Simple fix with big impact on feel.

---

## Persistence Pitfalls

### 15. Circular References in Serialization

**Problem**: Object graphs with circular references (parent->child, child->parent) break JSON.stringify(), causing serialization to fail silently or throw errors.

**Warning Signs**:
- JSON.stringify() throws "Converting circular structure to JSON"
- Save fails silently
- Restored state missing properties
- Infinite loops when traversing object graph

**Prevention Strategy**:
- Avoid bidirectional references in data model
- Use IDs to reference instead of direct object references
- Implement custom toJSON() methods
- Use serialization library that handles cycles (or strip before stringify)

```javascript
// BAD: Circular references
class Element {
  constructor(id) {
    this.id = id;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this; // Circular!
  }
}

// GOOD: ID-based references
class Element {
  constructor(id) {
    this.id = id;
    this.childIds = [];
    this.parentId = null;
  }

  addChild(child) {
    this.childIds.push(child.id);
    child.parentId = this.id;
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      childIds: this.childIds,
      parentId: this.parentId
    };
  }
}

// Serialize only data, not methods
function serializeState(elements) {
  return JSON.stringify({
    elements: elements.map(el => el.toJSON()),
    version: '1.0'
  });
}
```

**Address In**: Phase 1 (Foundation) - Design data model to avoid this from start.

---

### 16. JSONBin.io Rate Limits

**Problem**: JSONBin.io has rate limits (requests per minute/hour). Aggressive auto-save can hit limits and fail.

**Warning Signs**:
- Save requests return 429 (Too Many Requests)
- Users report "can't save" errors
- Auto-save fires too frequently
- Multiple tabs cause rate limit issues

**Prevention Strategy**:
- Debounce saves (wait N seconds after last change)
- Save on explicit user action, not every change
- Implement exponential backoff on rate limit errors
- Show save status indicator to user
- Use localStorage as immediate cache

```javascript
class CloudPersistence {
  constructor(apiKey, binId) {
    this.apiKey = apiKey;
    this.binId = binId;
    this.saveTimeout = null;
    this.saveDelay = 3000; // 3 seconds
    this.isSaving = false;
  }

  // Debounced save
  scheduleSave(data) {
    clearTimeout(this.saveTimeout);

    // Always save to localStorage immediately
    localStorage.setItem('warehouse_layout', JSON.stringify(data));

    // Debounce cloud save
    this.saveTimeout = setTimeout(() => {
      this.saveToCloud(data);
    }, this.saveDelay);
  }

  async saveToCloud(data) {
    if (this.isSaving) return;

    this.isSaving = true;
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.apiKey
        },
        body: JSON.stringify(data)
      });

      if (response.status === 429) {
        // Rate limited - retry with exponential backoff
        console.warn('Rate limited, retrying...');
        setTimeout(() => this.saveToCloud(data), 10000);
        return;
      }

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      console.log('Saved to cloud');
    } catch (error) {
      console.error('Cloud save error:', error);
      // Data still in localStorage as fallback
    } finally {
      this.isSaving = false;
    }
  }
}
```

**Address In**: Phase 5 (Persistence) - Implement with proper debouncing and error handling from start.

---

### 17. Save Conflicts / Data Loss

**Problem**: Multiple browser tabs or rapid saves can cause race conditions, overwriting newer data with older data.

**Warning Signs**:
- Recent changes disappear after page reload
- Two tabs open = lost changes
- Save operation completes but data is old version
- Undo history gets corrupted

**Prevention Strategy**:
- Single tab enforcement (detect multiple tabs)
- Optimistic locking with version numbers
- Timestamp-based conflict detection
- Warn user before overwriting newer data
- Consider last-write-wins with warning

```javascript
class VersionedPersistence {
  constructor() {
    this.currentVersion = 0;
  }

  async save(data) {
    const saveData = {
      ...data,
      version: this.currentVersion + 1,
      timestamp: Date.now()
    };

    // Save to cloud
    await this.saveToCloud(saveData);

    this.currentVersion = saveData.version;
  }

  async load() {
    const cloudData = await this.loadFromCloud();
    const localData = this.loadFromLocal();

    // Use newer data (by timestamp)
    if (!cloudData) return localData;
    if (!localData) return cloudData;

    if (cloudData.timestamp > localData.timestamp) {
      console.log('Using cloud data (newer)');
      return cloudData;
    } else if (localData.timestamp > cloudData.timestamp) {
      console.warn('Local data is newer than cloud!');
      // Prompt user or auto-save local to cloud
      return localData;
    }

    return cloudData;
  }

  // Detect multiple tabs (optional)
  enforceSingleTab() {
    const tabId = Date.now() + Math.random();
    localStorage.setItem('activeTab', tabId);

    window.addEventListener('storage', (e) => {
      if (e.key === 'activeTab' && e.newValue !== tabId) {
        alert('Another tab is active. Please close this tab to avoid data conflicts.');
      }
    });
  }
}
```

**Address In**: Phase 5 (Persistence) - Critical for data integrity. Test multi-tab scenarios.

---

### 18. Large State Serialization Performance

**Problem**: Serializing hundreds of elements becomes slow. Blocking the main thread causes UI freezes during save/load.

**Warning Signs**:
- Save operation takes >100ms
- UI freezes when saving
- JSON.stringify shows up in profiler
- Large layouts (1000+ elements) become unusable

**Prevention Strategy**:
- Profile serialization performance
- Use Web Workers for serialization (non-blocking)
- Compress data before save (pako.js for gzip)
- Only serialize changed elements (delta saves)
- Lazy load on startup (don't load everything upfront)

```javascript
// Simple delta save approach
class DeltaPersistence {
  constructor() {
    this.lastSavedState = null;
    this.dirtyElements = new Set();
  }

  markDirty(elementId) {
    this.dirtyElements.add(elementId);
  }

  async save(allElements) {
    if (this.dirtyElements.size === 0) return;

    // Only serialize changed elements
    const changedElements = allElements.filter(el =>
      this.dirtyElements.has(el.id)
    );

    const delta = {
      timestamp: Date.now(),
      changes: changedElements.map(el => el.toJSON())
    };

    await this.saveDelta(delta);

    this.dirtyElements.clear();
    this.lastSavedState = allElements.map(el => el.toJSON());
  }
}

// Web Worker serialization (for very large states)
// main.js
const serializerWorker = new Worker('serializer-worker.js');

function saveAsync(data) {
  serializerWorker.postMessage({ action: 'serialize', data });
}

serializerWorker.onmessage = (e) => {
  if (e.data.action === 'serialized') {
    // Upload serialized JSON to JSONBin
    uploadToCloud(e.data.json);
  }
};

// serializer-worker.js
self.onmessage = (e) => {
  if (e.data.action === 'serialize') {
    const json = JSON.stringify(e.data.data);
    self.postMessage({ action: 'serialized', json });
  }
};
```

**Address In**: Phase 5 (Persistence) - Only if needed. Start simple, optimize if slow.

---

## Architecture Pitfalls

### 19. Spaghetti Code Without Clear Module Boundaries

**Problem**: No separation between rendering, state management, input handling, and business logic. Everything in one file, functions accessing globals, tight coupling.

**Warning Signs**:
- Single 2000+ line JavaScript file
- Functions accessing global state directly
- Can't test individual components
- Changing one feature breaks unrelated features
- Duplicate code everywhere

**Prevention Strategy**:
- Separate concerns from start:
  - **State**: Element data, camera, selection
  - **Rendering**: Canvas drawing code
  - **Input**: Mouse/keyboard handling
  - **Logic**: Collision, grid snapping, calculation
  - **Persistence**: Save/load
- Use modules or classes to enforce boundaries
- Keep files under 300-400 lines

```javascript
// Good architecture structure
// main.js - Entry point, wires everything together
// state.js - State management
// renderer.js - Canvas rendering
// input.js - Input handling
// collision.js - Collision detection
// persistence.js - Save/load
// elements/ - Element classes (Pallet, Rack, Wall, Forklift)

// Example module structure
// state.js
export class AppState {
  constructor() {
    this.elements = [];
    this.camera = new Camera();
    this.selection = new SelectionManager();
    this.config = { gridSize: 1, snapToGrid: true };
  }

  addElement(element) {
    this.elements.push(element);
  }

  removeElement(elementId) {
    this.elements = this.elements.filter(el => el.id !== elementId);
  }
}

// renderer.js
export class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
  }

  render() {
    this.clear();
    this.state.camera.applyTransform(this.ctx);
    this.drawGrid();
    this.drawElements();
    this.drawSelection();
  }
}

// main.js
import { AppState } from './state.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';

const state = new AppState();
const renderer = new Renderer(canvas, state);
const input = new InputManager(canvas, state);

function gameLoop() {
  renderer.render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
```

**Address In**: Phase 1 (Foundation) - Set up clean architecture from day one. Refactoring later is painful.

---

### 20. Canvas Redraws on Every Mouse Move

**Problem**: Rendering entire canvas on every mousemove event (60+ times per second) when nothing changed causes performance issues.

**Warning Signs**:
- CPU usage spikes when moving mouse
- Profiler shows render() called constantly
- Battery drain on laptops
- Fan spins up when canvas is active

**Prevention Strategy**:
- Only render when state actually changes
- Set dirty flag on state changes
- Debounce/throttle hover effects
- Consider requestAnimationFrame-based render loop (not event-driven)

```javascript
class RenderController {
  constructor(renderer) {
    this.renderer = renderer;
    this.isDirty = true;
    this.isAnimating = false;
    this.rafId = null;
  }

  markDirty() {
    this.isDirty = true;
    this.ensureRenderScheduled();
  }

  startAnimation() {
    this.isAnimating = true;
    this.ensureRenderScheduled();
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  ensureRenderScheduled() {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;

      if (this.isDirty || this.isAnimating) {
        this.renderer.render();
        this.isDirty = false;
      }

      if (this.isAnimating) {
        this.ensureRenderScheduled();
      }
    });
  }
}

// Usage
const renderController = new RenderController(renderer);

// Mark dirty on state changes
function moveElement(element, x, y) {
  element.x = x;
  element.y = y;
  renderController.markDirty();
}

// Throttle hover highlighting
let lastHoverRender = 0;
canvas.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastHoverRender > 16) { // ~60fps max
    updateHover(e);
    renderController.markDirty();
    lastHoverRender = now;
  }
});

// Animation (forklift driving)
function startDriving() {
  renderController.startAnimation();
}

function stopDriving() {
  renderController.stopAnimation();
}
```

**Address In**: Phase 1 (Foundation) - Avoid performance debt from start.

---

### 21. Memory Leaks from Event Listeners

**Problem**: Event listeners not cleaned up when elements are removed or components destroyed. Memory usage grows over time.

**Warning Signs**:
- Memory usage increases over time (check DevTools Memory profiler)
- Heap snapshots show growing number of detached DOM nodes
- Event handlers fire for deleted elements
- Performance degrades after using app for a while

**Prevention Strategy**:
- Always removeEventListener when done
- Use AbortController for easy cleanup
- Avoid anonymous functions as handlers (can't remove them)
- Clean up on element removal

```javascript
// BAD: Memory leak
class ElementController {
  constructor(element, canvas) {
    this.element = element;
    canvas.addEventListener('click', (e) => {
      this.handleClick(e);
    });
    // This listener never gets removed!
  }
}

// GOOD: Proper cleanup
class ElementController {
  constructor(element, canvas) {
    this.element = element;
    this.canvas = canvas;
    this.abortController = new AbortController();

    // Use AbortController for automatic cleanup
    canvas.addEventListener('click', (e) => {
      this.handleClick(e);
    }, { signal: this.abortController.signal });

    // Or store handler reference
    this.clickHandler = (e) => this.handleClick(e);
    canvas.addEventListener('click', this.clickHandler);
  }

  destroy() {
    // Cleanup with AbortController
    this.abortController.abort();

    // Or manual removal
    this.canvas.removeEventListener('click', this.clickHandler);
  }
}

// Global event manager
class EventManager {
  constructor() {
    this.listeners = [];
  }

  addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push({ target, event, handler, options });
  }

  removeAllListeners() {
    for (const { target, event, handler } of this.listeners) {
      target.removeEventListener(event, handler);
    }
    this.listeners = [];
  }
}
```

**Address In**: Phase 1 (Foundation) - Build cleanup patterns into architecture from start.

---

### 22. State Mutation Bugs

**Problem**: Direct state mutation without tracking creates bugs where state is out of sync with UI, undo/redo breaks, and persistence saves stale data.

**Warning Signs**:
- UI doesn't update after state change
- Undo doesn't restore correct state
- Save/load produces different state
- Debugging shows state has changed but no one knows when/why

**Prevention Strategy**:
- Immutable state updates (copy-on-write)
- State change events/observers
- Centralized state mutations (Redux-style actions)
- Freeze objects in development to catch mutations

```javascript
// BAD: Direct mutation
function moveElement(element, x, y) {
  element.x = x;
  element.y = y;
  // Nothing knows this changed!
}

// GOOD: Tracked mutations with events
class AppState extends EventTarget {
  constructor() {
    super();
    this.elements = [];
  }

  updateElement(elementId, changes) {
    const element = this.elements.find(el => el.id === elementId);
    if (!element) return;

    const oldState = { ...element };
    Object.assign(element, changes);

    this.dispatchEvent(new CustomEvent('elementUpdated', {
      detail: { element, oldState, changes }
    }));
  }

  addElement(element) {
    this.elements.push(element);
    this.dispatchEvent(new CustomEvent('elementAdded', {
      detail: { element }
    }));
  }
}

// Listen for changes
state.addEventListener('elementUpdated', (e) => {
  console.log('Element updated:', e.detail);
  renderController.markDirty();
  persistence.markDirty();
  commandHistory.recordChange(e.detail);
});

// Immutable approach (more memory, safer)
class ImmutableState {
  constructor(data) {
    this.data = Object.freeze({ ...data });
  }

  update(changes) {
    return new ImmutableState({
      ...this.data,
      ...changes
    });
  }
}
```

**Address In**: Phase 1 (Foundation) - Choose state management approach early. Consistent pattern prevents bugs.

---

## Phase Recommendations Summary

### Phase 1 (Foundation - MVP Critical)
1. DPI/Retina display handling
2. Coordinate system architecture
3. Grid snapping precision
4. Canvas resize handling
5. Data model (avoid circular references)
6. Clean module architecture
7. Event listener cleanup patterns
8. State mutation tracking
9. Render optimization (dirty flag)

### Phase 2 (Drawing Tools)
10. Hit testing / click detection
11. Drag and drop edge cases
12. Selection management (start simple)
13. Performance optimization (as needed)

### Phase 3 (Enhancement - Post-MVP)
14. Undo/redo system
15. Zoom/pan (highly desirable but not blocking)

### Phase 4 (Forklift Driving)
16. Delta time movement
17. Input state tracking (not events)
18. Collision response with wall sliding
19. Diagonal movement normalization

### Phase 5 (Persistence)
20. JSONBin.io rate limiting and debounce
21. Save conflict detection
22. Serialization performance (only if needed)

---

## Testing Checklist

For each phase, test these scenarios to catch pitfalls early:

**Foundation Testing**:
- [ ] Open on Retina display - is it sharp?
- [ ] Resize window - does content stay correct?
- [ ] Place element at grid boundary - does it snap correctly?
- [ ] Check coordinate conversion with console logs
- [ ] Profile render performance (DevTools)

**Drawing Tools Testing**:
- [ ] Click very small elements
- [ ] Click overlapping elements
- [ ] Drag element to canvas edge
- [ ] Drag element partially off-canvas
- [ ] Toggle grid snap during drag
- [ ] Place 100+ elements - is it smooth?

**Forklift Testing**:
- [ ] Drive on different refresh rate monitors (60Hz vs 120Hz)
- [ ] Hold diagonal keys - is speed same as cardinal?
- [ ] Drive into wall at angle - does it slide?
- [ ] Hold key and switch tabs - does key get stuck?

**Persistence Testing**:
- [ ] Save/load with 100+ elements
- [ ] Open two tabs - does one overwrite other?
- [ ] Measure save time with profiler
- [ ] Save rapidly - does it hit rate limits?
- [ ] Kill browser mid-save - is data corrupted?

---

## Resources and References

**Canvas Rendering**:
- MDN Canvas Tutorial: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial
- High DPI Canvas: https://www.html5rocks.com/en/tutorials/canvas/hidpi/
- Canvas Performance: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

**Game Loop Patterns**:
- Game Loop (Game Programming Patterns): https://gameprogrammingpatterns.com/game-loop.html
- Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/

**Architecture**:
- Command Pattern: https://gameprogrammingpatterns.com/command.html
- Observer Pattern: https://gameprogrammingpatterns.com/observer.html

**Collision Detection**:
- AABB Collision: https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
- Separating Axis Theorem: For rotated rectangle collision

---

*Document created: 2026-01-29*
*Last updated: 2026-01-29*
