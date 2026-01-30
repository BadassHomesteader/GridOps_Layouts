# Phase 2: Drawing & Elements - Research

**Researched:** 2026-01-29
**Domain:** HTML5 Canvas interactive drawing application with drag-and-drop and object selection
**Confidence:** HIGH

## Summary

Phase 2 builds interactive drawing capabilities on top of the Phase 1 canvas foundation. Research focused on patterns for implementing drag-and-drop, hit testing, selection management, and shape rendering without external libraries, consistent with the project's pure HTML Canvas approach.

The standard approach for canvas drawing applications uses a **retained-mode pattern** (maintaining an array of shape objects) even though Canvas itself is immediate-mode. This allows for hit testing, selection, and manipulation. The established Phase 1 architecture (renderer callbacks, coordinate conversion, viewport transform) provides an ideal foundation for adding shape management.

Key findings:
- **Shape management**: Array-based object store with render-loop iteration
- **Hit testing**: Reverse iteration (top-to-bottom) with bounding box + precise geometry checks
- **Drag-and-drop**: Three-phase pattern (mousedown + hit test → mousemove + update → mouseup + commit)
- **Performance**: Selective redraw strategies critical (avoid full canvas clear on every frame)
- **Selection feedback**: ctx.save()/restore() pattern for non-destructive visual overlays

**Primary recommendation:** Implement a Shape class hierarchy with Element base class, use array-based storage with z-index management, and leverage Phase 1's coordinate converter for all mouse-to-world transformations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pure HTML5 Canvas | Native API | Rendering and interaction | User decision: no dependencies, full control |
| ES6 Modules | Native | Code organization | Established in Phase 1, zero-config |
| Vanilla JavaScript | ES2024 | All logic | Matches Phase 1 architecture |

### Supporting
No external libraries. Pure canvas approach requires implementing:
- Shape object model (custom classes)
- Hit testing algorithm (custom geometry math)
- Drag-and-drop state machine (custom event handling)
- Selection management (custom state tracking)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure Canvas | Konva.js | Konva provides Transformer groups for selection/resize but violates "no dependencies" decision |
| Pure Canvas | Fabric.js | Fabric provides rich object model but adds 200KB+ and hides canvas details |
| Custom shapes | SVG overlay | SVG is retained-mode but mixing rendering models complicates architecture |

**Installation:**
No installation required. Pure canvas with native browser APIs.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shapes/              # Shape object model
│   ├── Element.js       # Base class for all warehouse elements
│   ├── Wall.js          # Wall element (rectangular)
│   ├── Office.js        # Office/obstacle element
│   ├── Rack.js          # Shelving rack with capacity
│   ├── Pallet.js        # Pallet with dimensions
│   └── Forklift.js      # Forklift element
├── interaction/         # User interaction handlers
│   ├── DragDrop.js      # Drag-and-drop logic (sidebar → canvas, canvas move)
│   ├── Selection.js     # Selection state and rendering
│   └── KeyboardInput.js # Delete key handling
├── managers/            # State management
│   └── ElementManager.js # Element storage, z-index, hit testing
├── canvas/              # (Phase 1) Canvas setup, viewport, renderer
├── grid/                # (Phase 1) Grid and coordinates
└── main.js              # Entry point
```

### Pattern 1: Retained-Mode Shape Object Model

**What:** Canvas is immediate-mode (draw and forget), but drawing applications need retained-mode (remember what was drawn). Maintain an array of shape objects with render methods.

**When to use:** Any canvas application requiring selection, modification, or interaction with drawn elements.

**Example:**
```javascript
// Base Element class
class Element {
  constructor(x, y, width, height) {
    this.x = x;           // World coordinates
    this.y = y;
    this.width = width;
    this.height = height;
    this.selected = false;
    this.id = crypto.randomUUID();
  }

  // Hit test: point-in-rectangle
  containsPoint(worldX, worldY) {
    return worldX >= this.x && worldX <= this.x + this.width &&
           worldY >= this.y && worldY <= this.y + this.height;
  }

  // Render callback signature matches Phase 1 renderer
  draw(ctx, viewport, deltaTime) {
    ctx.save();
    ctx.fillStyle = this.selected ? 'rgba(100, 200, 255, 0.3)' : 'rgba(200, 200, 200, 0.5)';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = this.selected ? 'rgba(50, 150, 220, 1)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2 / viewport.scale; // Scale-invariant stroke
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}

// Element manager maintains array
class ElementManager {
  constructor() {
    this.elements = [];
  }

  add(element) {
    this.elements.push(element);
  }

  // Render all (called from Phase 1 renderer callback)
  drawAll(ctx, viewport, deltaTime) {
    for (const element of this.elements) {
      element.draw(ctx, viewport, deltaTime);
    }
  }

  // Hit test: iterate in reverse (top element first)
  getElementAtPoint(worldX, worldY) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      if (this.elements[i].containsPoint(worldX, worldY)) {
        return this.elements[i];
      }
    }
    return null;
  }
}
```

### Pattern 2: Three-Phase Drag-and-Drop State Machine

**What:** Drag-and-drop requires tracking state across mousedown, mousemove, and mouseup events. Use a state machine with drag context.

**When to use:** For both sidebar-to-canvas placement and canvas element movement.

**Example:**
```javascript
class DragDropController {
  constructor(canvas, coordinateConverter, elementManager) {
    this.canvas = canvas;
    this.coordinateConverter = coordinateConverter;
    this.elementManager = elementManager;

    // Drag state
    this.isDragging = false;
    this.draggedElement = null;
    this.dragStartWorld = { x: 0, y: 0 };
    this.dragOffsetWorld = { x: 0, y: 0 };

    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const world = this.coordinateConverter.screenToWorld(canvasX, canvasY);

    // Hit test
    const element = this.elementManager.getElementAtPoint(world.x, world.y);
    if (element) {
      this.isDragging = true;
      this.draggedElement = element;
      this.dragStartWorld = world;
      // Store offset from element origin to click point
      this.dragOffsetWorld = {
        x: world.x - element.x,
        y: world.y - element.y
      };
    }
  }

  onMouseMove(event) {
    if (!this.isDragging || !this.draggedElement) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const world = this.coordinateConverter.screenToWorld(canvasX, canvasY);

    // Update element position (maintain offset)
    this.draggedElement.x = world.x - this.dragOffsetWorld.x;
    this.draggedElement.y = world.y - this.dragOffsetWorld.y;

    // Grid snap: check Shift key (Phase 1 convention)
    if (!event.shiftKey) {
      const snapped = this.grid.snapToGrid(this.draggedElement.x, this.draggedElement.y);
      this.draggedElement.x = snapped.x;
      this.draggedElement.y = snapped.y;
    }
  }

  onMouseUp(event) {
    this.isDragging = false;
    this.draggedElement = null;
  }
}
```

### Pattern 3: Selection Management with Visual Feedback

**What:** Track selected element(s) and render selection highlight overlay. Use ctx.save()/restore() for non-destructive rendering.

**When to use:** Any application with selectable objects.

**Example:**
```javascript
class SelectionManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.selectedElement = null;
  }

  selectElement(element) {
    // Clear previous selection
    if (this.selectedElement) {
      this.selectedElement.selected = false;
    }

    // Set new selection
    this.selectedElement = element;
    if (element) {
      element.selected = true;
    }
  }

  clearSelection() {
    this.selectElement(null);
  }

  deleteSelected() {
    if (!this.selectedElement) return;

    this.elementManager.remove(this.selectedElement);
    this.selectedElement = null;
  }

  // Draw selection overlay (called from renderer callback)
  drawSelectionOverlay(ctx, viewport, deltaTime) {
    if (!this.selectedElement) return;

    const el = this.selectedElement;
    ctx.save();

    // Selection highlight: thicker border with glow effect
    ctx.strokeStyle = 'rgba(100, 200, 255, 1)';
    ctx.lineWidth = 3 / viewport.scale; // Scale-invariant
    ctx.setLineDash([5 / viewport.scale, 5 / viewport.scale]); // Dashed border
    ctx.strokeRect(el.x, el.y, el.width, el.height);

    ctx.restore();
  }
}
```

### Pattern 4: Sidebar Palette Drag-to-Canvas

**What:** HTML drag-and-drop API for sidebar elements, create new canvas element on drop.

**When to use:** Toolbox/palette UI pattern for placing new elements.

**Example:**
```javascript
// Sidebar palette item
class PaletteItem {
  constructor(elementType, elementData) {
    this.elementType = elementType; // 'wall', 'rack', etc.
    this.elementData = elementData; // Default dimensions
    this.setupDragListeners();
  }

  setupDragListeners() {
    this.domElement.draggable = true;
    this.domElement.addEventListener('dragstart', (event) => {
      // Store element type in dataTransfer
      event.dataTransfer.setData('element-type', this.elementType);
      event.dataTransfer.setData('element-data', JSON.stringify(this.elementData));
    });
  }
}

// Canvas drop handler
class CanvasDropHandler {
  constructor(canvas, coordinateConverter, elementManager, grid) {
    this.canvas = canvas;
    this.coordinateConverter = coordinateConverter;
    this.elementManager = elementManager;
    this.grid = grid;
    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener('dragover', (event) => {
      event.preventDefault(); // Allow drop
    });

    this.canvas.addEventListener('drop', (event) => {
      event.preventDefault();

      const elementType = event.dataTransfer.getData('element-type');
      const elementData = JSON.parse(event.dataTransfer.getData('element-data'));

      // Convert drop position to world coordinates
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      const world = this.coordinateConverter.screenToWorld(canvasX, canvasY);

      // Snap to grid (center of element at drop point)
      const snapped = this.grid.snapToGrid(
        world.x - elementData.width / 2,
        world.y - elementData.height / 2
      );

      // Create element instance
      const ElementClass = this.getElementClass(elementType);
      const element = new ElementClass(snapped.x, snapped.y, elementData);
      this.elementManager.add(element);
    });
  }

  getElementClass(type) {
    const classes = {
      'wall': Wall,
      'office': Office,
      'rack': Rack,
      'pallet': Pallet,
      'forklift': Forklift
    };
    return classes[type] || Element;
  }
}
```

### Pattern 5: Keyboard Input for Element Deletion

**What:** Window-level keydown listener for Delete/Backspace, check if selection exists, remove from manager.

**When to use:** Standard desktop application keyboard shortcuts.

**Example:**
```javascript
class KeyboardController {
  constructor(selectionManager) {
    this.selectionManager = selectionManager;
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (event) => {
      // Delete or Backspace key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Prevent browser back navigation on Backspace
        event.preventDefault();
        this.selectionManager.deleteSelected();
      }

      // Escape key: clear selection
      if (event.key === 'Escape') {
        this.selectionManager.clearSelection();
      }
    });
  }
}
```

### Anti-Patterns to Avoid

- **Clearing entire canvas every frame**: Use established Phase 1 pattern where renderer clears once, then all callbacks draw. Don't clear inside element draw methods.
- **Mixing screen and world coordinates**: Always use CoordinateConverter. Never do manual offset/scale math in element code.
- **Direct DOM element creation for shapes**: Stay in canvas rendering pipeline. Don't mix DOM and canvas for visual elements.
- **Modifying ctx state without save/restore**: Always wrap state changes in ctx.save()/restore() pairs to avoid leaking state.
- **Hit testing with pixel sampling**: Use geometry math (point-in-rectangle), not getImageData pixel testing—much faster and accurate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID counter | `crypto.randomUUID()` | Native browser API, guaranteed unique, standard |
| Bounding box math | Custom rectangle class | Simple object `{x, y, width, height}` with utility functions | Avoid over-engineering, YAGNI |
| Event coordinate conversion | Manual offset/scale calculation | Phase 1's CoordinateConverter class | Already handles all three coordinate spaces correctly |
| Grid snapping | Duplicate snap logic per element | Phase 1's Grid.snapToGrid() method | Single source of truth, consistent behavior |
| Viewport culling | Per-element visibility checks | Phase 1's Viewport.getVisibleBounds() | Already optimized, used by grid rendering |

**Key insight:** Phase 1 established robust patterns for coordinate conversion, viewport transforms, and rendering pipeline. Don't recreate these—extend them. The existing architecture is designed for exactly this phase's needs.

## Common Pitfalls

### Pitfall 1: Z-Order/Stacking Issues
**What goes wrong:** Elements render in wrong order, newly created elements appear behind old ones, or selection doesn't match visual top element.

**Why it happens:** Array iteration order determines render order. JavaScript arrays maintain insertion order, so later elements render on top. Hit testing must iterate in reverse (from end to start) to match visual stacking.

**How to avoid:**
- Render elements in array order (forward iteration)
- Hit test in reverse order (backward iteration)
- If explicit z-ordering needed, sort array before rendering or store z-index property

**Warning signs:**
- Click selects element visually underneath
- Newly placed elements hidden behind existing ones
- Selection highlight appears under element visually "on top"

### Pitfall 2: Canvas State Leakage
**What goes wrong:** Element renders with wrong color, line width, or transform. Subsequent elements inherit unintended styles.

**Why it happens:** Canvas context is a state machine. Setting fillStyle, lineWidth, or transform affects all subsequent draw calls until explicitly changed. Forgetting ctx.restore() leaves state dirty.

**How to avoid:**
- **Always** wrap element draw methods in ctx.save()/restore()
- Set all required state explicitly (don't assume defaults)
- Use scale-invariant line widths: `lineWidth / viewport.scale`

**Warning signs:**
- Elements render with colors from other elements
- Line widths change at different zoom levels
- Selection highlights affect subsequent element rendering

**Code pattern:**
```javascript
draw(ctx, viewport, deltaTime) {
  ctx.save(); // ← CRITICAL: save clean state

  // Set all state explicitly
  ctx.fillStyle = '...';
  ctx.strokeStyle = '...';
  ctx.lineWidth = 2 / viewport.scale;

  // Draw operations
  ctx.fillRect(...);
  ctx.strokeRect(...);

  ctx.restore(); // ← CRITICAL: restore clean state
}
```

### Pitfall 3: Drag Offset Jumping
**What goes wrong:** When starting to drag an element, it "jumps" so the mouse is at the element's origin instead of where you clicked.

**Why it happens:** Setting `element.x = mouse.x` without accounting for where on the element the user clicked. The element's origin snaps to the cursor.

**How to avoid:**
- On mousedown, calculate offset: `clickOffset = mouseWorld - elementOrigin`
- On mousemove, preserve offset: `elementOrigin = mouseWorld - clickOffset`
- Example from Pattern 2 shows correct implementation

**Warning signs:**
- Element jumps when drag starts
- Element origin follows cursor instead of maintaining grab point
- Small elements become hard to drag accurately

### Pitfall 4: Grid Snap Fighting with Free-Form Mode
**What goes wrong:** Grid snapping applies when user holds Shift (free-form mode), or snap doesn't work at all.

**Why it happens:** Inverting the logic from Phase 1's convention. Phase 1 established: normal = snap to grid, Shift held = free-form.

**How to avoid:**
- Check `!event.shiftKey` before applying snap (snap when Shift NOT held)
- Document convention clearly in code comments
- Consider UI indicator showing current snap mode

**Warning signs:**
- User complaints about "backwards" snap behavior
- Elements won't snap to grid in default mode
- Holding Shift enables snapping instead of disabling it

### Pitfall 5: Performance: Redrawing Everything Every Frame
**What goes wrong:** Application becomes sluggish with many elements (>100 shapes). Frame rate drops below 60fps.

**Why it happens:** Clearing entire canvas and redrawing all elements every frame (16ms budget) becomes expensive. Each element render involves multiple canvas API calls.

**How to avoid:**
- **Initial implementation (this phase)**: Full redraw is acceptable for <1000 elements
- **Future optimization**: Only request new frame when state changes (element moved/added/removed)
- **Advanced optimization**: Use off-screen canvases for static content (deferred to later phase)

**Warning signs:**
- Visible frame drops during pan/zoom
- Lag when dragging elements
- DevTools Performance tab shows long frame times

**Mitigation strategy for Phase 2:**
```javascript
// In renderer or main.js
let needsRedraw = true;

function requestRedraw() {
  needsRedraw = true;
}

// Call requestRedraw() when:
// - Element moved/added/removed
// - Selection changes
// - Viewport pan/zoom
// - Grid resolution changes

// In render loop:
if (!needsRedraw) {
  requestAnimationFrame(render);
  return; // Skip drawing this frame
}
needsRedraw = false;
// ... proceed with drawing
```

### Pitfall 6: Mouse Events During Pan
**What goes wrong:** Clicking to select an element starts panning instead, or panning drags elements unintentionally.

**Why it happens:** Phase 1's pan handler and Phase 2's element drag handler both respond to mousedown. Event handling order and state management conflicts.

**How to avoid:**
- **Priority order**: Element interaction takes precedence over pan
- On mousedown: check for element hit first, only start pan if no element hit
- Track separate state: `isPanning` vs `isDraggingElement`
- Prevent pan when dragging element

**Warning signs:**
- Can't select elements (pan steals mousedown)
- Selecting element pans viewport
- Dragging element also pans viewport

**Code pattern:**
```javascript
canvas.addEventListener('mousedown', (event) => {
  const world = coordinateConverter.screenToWorld(...);
  const element = elementManager.getElementAtPoint(world.x, world.y);

  if (element) {
    // Start element drag (Phase 2)
    startElementDrag(element, world);
    return; // Don't start pan
  }

  // No element hit: start pan (Phase 1)
  startPan(event.clientX, event.clientY);
});
```

### Pitfall 7: Forgetting to Prevent Text Input Deletion
**What goes wrong:** User types in a text field, presses Backspace to correct typo, and deletes selected element instead.

**Why it happens:** Keyboard listener is on window, catches all Backspace/Delete presses regardless of focus.

**How to avoid:**
- Check `event.target` before handling delete key
- Don't delete if focus is on an input, textarea, or contenteditable element
- This phase has no text inputs (warehouse elements only), but important for future phases

**Warning signs:**
- Elements disappear unexpectedly while user types
- Can't use Backspace in any text field

**Code pattern (for future phases with text input):**
```javascript
window.addEventListener('keydown', (event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    // Check if user is typing in an input field
    const target = event.target;
    if (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable) {
      return; // Let input handle the key
    }

    event.preventDefault();
    selectionManager.deleteSelected();
  }
});
```

## Code Examples

Verified patterns from official sources:

### Canvas State Management
```javascript
// Source: MDN Canvas API - Applying styles and colors
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors

// ALWAYS wrap state changes in save/restore
ctx.save();
ctx.fillStyle = 'rgba(0, 0, 200, 0.5)';
ctx.fillRect(10, 10, 100, 100);
ctx.restore(); // Clean state for next draw call

// Scale-invariant line widths (account for viewport zoom)
ctx.save();
ctx.lineWidth = 2 / viewport.scale; // 2px visual width at any zoom
ctx.strokeRect(x, y, width, height);
ctx.restore();
```

### Hit Testing with Geometry
```javascript
// Source: W3C Canvas hit testing proposal
// https://www.w3.org/wiki/Canvas_hit_testing

// Point-in-rectangle test (standard algorithm)
function hitTestRectangle(element, worldX, worldY) {
  return worldX >= element.x &&
         worldX <= element.x + element.width &&
         worldY >= element.y &&
         worldY <= element.y + element.height;
}

// Iterate in reverse for correct z-order
function getTopElementAtPoint(elements, worldX, worldY) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestRectangle(elements[i], worldX, worldY)) {
      return elements[i];
    }
  }
  return null;
}
```

### Optimized Canvas Clearing (from web.dev)
```javascript
// Source: Improving HTML5 Canvas Performance - web.dev
// https://web.dev/articles/canvas-performance

// ✓ GOOD: Clear only once per frame (Phase 1 renderer pattern)
function render() {
  ctx.clearRect(0, 0, width, height); // Once at start
  for (const element of elements) {
    element.draw(ctx);
  }
}

// ✗ BAD: Clearing inside element draw methods
function elementDraw(ctx) {
  ctx.clearRect(this.x, this.y, this.width, this.height); // Don't do this!
  ctx.fillRect(this.x, this.y, this.width, this.height);
}

// Advanced: Selective redraw (for future optimization)
// "Keep track of the drawn bounding box, and only clear that"
let dirtyRect = null;
function render() {
  if (dirtyRect) {
    ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    // Redraw only elements intersecting dirtyRect
  }
}
```

### HTML5 Drag and Drop for Sidebar Palette
```javascript
// Source: MDN Drag and Drop API
// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

// Sidebar palette item (draggable)
paletteElement.draggable = true;
paletteElement.addEventListener('dragstart', (event) => {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'wall',
    width: 48,  // 1 foot (gridSize)
    height: 48
  }));
});

// Canvas drop target
canvas.addEventListener('dragover', (event) => {
  event.preventDefault(); // Required to allow drop
  event.dataTransfer.dropEffect = 'copy';
});

canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('application/json'));
  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  // Use Phase 1 coordinate converter
  const world = coordinateConverter.screenToWorld(canvasX, canvasY);
  createElementAtPosition(data.type, world.x, world.y, data);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pixel-based hit testing (getImageData) | Geometry-based hit testing (math) | ~2015 (HTML5 Canvas maturity) | 10-100x faster, more accurate |
| Full canvas libraries (Fabric.js, Konva.js) | Library-free canvas with ES6 classes | 2020+ (modern JS, bundle size awareness) | Zero dependencies, full control, smaller bundle |
| Manual coordinate math | Dedicated CoordinateConverter class | 2018+ (separation of concerns) | Cleaner code, easier debugging |
| setTransform() for viewport | ctx.transform() cumulative | Phase 1 decision | Preserves DPI scaling chain |
| Attach events to document | Attach to window or specific element | 2016+ (event delegation clarity) | Better event scoping, prevents conflicts |

**Deprecated/outdated:**
- **Flash-era drag-and-drop**: Old tutorials use complex mouseenter/mouseleave tracking. Modern approach: simple three-state machine (down/move/up).
- **jQuery drag plugins**: Pre-ES6 era libraries for drag-and-drop. Native HTML5 Drag and Drop API is well-supported (since IE11) and sufficient.
- **requestAnimationFrame polyfills**: Phase 1 uses native rAF without fallback. All modern browsers support (IE10+).

## Open Questions

1. **Resize handle implementation**
   - What we know: Konva uses bounding box with corner/edge handles. Standard pattern is 8 handles (4 corners + 4 edges).
   - What's unclear: Whether to implement full resize in this phase or defer. Requirements say "resizable" but success criteria don't verify resize interaction.
   - Recommendation: Implement property-based resize (elements have width/height properties, can be modified) but defer interactive resize handles to Phase 3 or 4. This phase focuses on placement, selection, movement, deletion.

2. **Multi-selection support**
   - What we know: Common pattern is Shift/Ctrl-click to add to selection, drag rectangle for area selection.
   - What's unclear: Requirements don't mention multi-selection explicitly.
   - Recommendation: Implement single-selection only for Phase 2 (simpler, meets requirements). Multi-selection can be added in future phase if needed.

3. **Undo/redo for element operations**
   - What we know: Command pattern is standard (store reverse operations in stack).
   - What's unclear: Not mentioned in Phase 2 requirements.
   - Recommendation: Defer to future phase. Focus on core CRUD operations first.

## Sources

### Primary (HIGH confidence)
- MDN Canvas API Tutorial - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN Canvas Transformations - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Transformations
- MDN Drag and Drop API - https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- web.dev Canvas Performance - https://web.dev/articles/canvas-performance (verified current, updated 2024-2025)
- W3C Canvas hit testing - https://www.w3.org/wiki/Canvas_hit_testing
- HTML Standard canvas specification - https://html.spec.whatwg.org/dev/canvas.html (updated 2026-01-20)

### Secondary (MEDIUM confidence)
- Konva.js selection/transform patterns - https://konvajs.org/docs/select_and_transform/Basic_demo.html (library implementation reference, verified approach)
- Canvas performance optimization techniques - https://gist.github.com/jaredwilli/5469626 (GitHub community patterns)
- HTML5 Canvas testing best practices - https://www.askui.com/blog-posts/html5-canvas-testing-techniques-tools-and-best-practices

### Tertiary (LOW confidence - flagged for validation)
- ECS pattern for canvas games - https://github.com/yagl/ecs and https://blog.kartones.net/post/ecs-in-javascript/ (game-specific, may be over-engineered for warehouse layout tool)
- Design tool handle patterns - https://bjango.com/articles/designtoolcanvashandles/ (UI/UX insights, not implementation details)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure Canvas decision already made, no external dependencies verified
- Architecture: HIGH - Patterns verified with MDN official docs, web.dev performance guide, established Phase 1 foundation
- Pitfalls: HIGH - Common issues documented in multiple sources (web.dev, W3C wiki, community articles)
- Code examples: HIGH - All examples based on official MDN documentation or verified web.dev patterns

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable domain, Canvas API is mature and changes slowly)
