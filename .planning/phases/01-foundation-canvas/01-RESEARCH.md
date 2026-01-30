# Phase 1: Foundation & Canvas - Research

**Researched:** 2026-01-29
**Domain:** HTML5 Canvas with pan/zoom viewport navigation
**Confidence:** HIGH

## Summary

This phase establishes the foundation for a vanilla JavaScript canvas-based warehouse layout tool with configurable grid rendering, snap-to-grid placement, and smooth pan/zoom navigation. The research focused on HTML5 Canvas fundamentals, coordinate system architecture, viewport transformation patterns, DPI/Retina handling, and performance optimization techniques for grid-based drawing applications.

The standard approach for this type of application involves:
1. **Dual coordinate systems** - Screen pixels vs. world coordinates with conversion utilities
2. **Viewport transformation model** - Camera/viewport pattern using canvas context transforms
3. **requestAnimationFrame render loop** - Delta-time based animation for smooth 60fps rendering
4. **Integer grid coordinates** - Store element positions as grid cells to prevent floating-point drift
5. **DPI scaling via devicePixelRatio** - Scale canvas backing store for crisp Retina display rendering

**Primary recommendation:** Implement a viewport/camera model with three coordinate spaces (screen, world, grid) and dedicated conversion utilities. Use canvas context transforms for viewport rendering, requestAnimationFrame for the render loop, and integer grid coordinates for element storage. Scale canvas by devicePixelRatio for HiDPI displays.

## Standard Stack

The project uses vanilla JavaScript with no dependencies (per PROJECT.md constraints), relying on browser-native Canvas API.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 Canvas API | Native | 2D rendering surface | Native browser API, no dependencies needed |
| requestAnimationFrame | Native | Render loop timing | Syncs with display refresh, pauses in background tabs |
| devicePixelRatio | Native | HiDPI display detection | Standard for Retina/high-DPI canvas rendering |
| getBoundingClientRect | Native | Canvas positioning | Required for accurate mouse coordinate conversion |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OffscreenCanvas | Native (optional) | Pre-render caching | For expensive repeated drawing operations |
| CSS transforms | Native | GPU-accelerated scaling | Alternative to canvas scaling for performance |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla Canvas | Fabric.js | Fabric adds object model overhead; vanilla gives full control |
| Vanilla Canvas | Konva.js | Konva simplifies events but adds 200KB+ dependency |
| requestAnimationFrame | setInterval | setInterval doesn't sync with refresh rate, wastes battery |
| Integer grid coords | Floating-point | Floats accumulate precision errors over time |

**Installation:**
```bash
# No installation required - vanilla JavaScript with native APIs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── canvas/
│   ├── canvas.js           # Canvas setup, DPI scaling, resize handling
│   ├── viewport.js         # Viewport/camera state, pan/zoom logic
│   └── renderer.js         # Render loop, requestAnimationFrame coordination
├── grid/
│   ├── grid.js             # Grid rendering, snap-to-grid utilities
│   └── coordinates.js      # Coordinate conversion utilities
└── main.js                 # Entry point, initialization
```

### Pattern 1: Three Coordinate Spaces

**What:** Separate coordinate systems for screen pixels, world coordinates, and grid cells

**When to use:** Essential for any pan/zoom canvas application with grid snapping

**Implementation:**
```javascript
// Three coordinate spaces:
// 1. Screen Space - Canvas pixels (what user sees)
// 2. World Space - Infinite virtual canvas (independent of zoom/pan)
// 3. Grid Space - Integer grid cells (element storage)

class CoordinateConverter {
  constructor(viewport) {
    this.viewport = viewport;
  }

  // Screen → World
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.viewport.offsetX) / this.viewport.scale,
      y: (screenY - this.viewport.offsetY) / this.viewport.scale
    };
  }

  // World → Screen
  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.viewport.scale + this.viewport.offsetX,
      y: worldY * this.viewport.scale + this.viewport.offsetY
    };
  }

  // World → Grid (snap to grid)
  worldToGrid(worldX, worldY, gridSize) {
    return {
      x: Math.round(worldX / gridSize),
      y: Math.round(worldY / gridSize)
    };
  }

  // Grid → World
  gridToWorld(gridX, gridY, gridSize) {
    return {
      x: gridX * gridSize,
      y: gridY * gridSize
    };
  }

  // Screen → Grid (direct conversion for mouse events)
  screenToGrid(screenX, screenY, gridSize) {
    const world = this.screenToWorld(screenX, screenY);
    return this.worldToGrid(world.x, world.y, gridSize);
  }
}
```

**Source:** Pattern synthesized from multiple sources including [Harrison Milbradt's Canvas Pan/Zoom Tutorial](https://harrisonmilbradt.com/blog/canvas-panning-and-zooming) and [Steve Ruiz's Zoom UI Guide](https://www.steveruiz.me/posts/zoom-ui)

### Pattern 2: Viewport/Camera Model

**What:** Track viewport state (position, scale) and apply via canvas transforms

**When to use:** For all pan/zoom canvas applications

**Implementation:**
```javascript
class Viewport {
  constructor() {
    this.offsetX = 0;    // Pan offset X
    this.offsetY = 0;    // Pan offset Y
    this.scale = 1;      // Zoom level (1 = 100%)
  }

  applyTransform(ctx) {
    // Reset to identity
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Apply viewport transform
    ctx.setTransform(
      this.scale, 0,
      0, this.scale,
      this.offsetX, this.offsetY
    );
  }

  pan(deltaX, deltaY) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  zoom(zoomFactor, focusX, focusY) {
    // Zoom toward focus point (mouse cursor)
    const worldFocusBefore = {
      x: (focusX - this.offsetX) / this.scale,
      y: (focusY - this.offsetY) / this.scale
    };

    this.scale *= zoomFactor;

    // Adjust offset to keep focus point stable
    this.offsetX = focusX - worldFocusBefore.x * this.scale;
    this.offsetY = focusY - worldFocusBefore.y * this.scale;
  }

  getVisibleBounds(canvasWidth, canvasHeight) {
    // Calculate world coordinates of visible area
    const topLeft = {
      x: -this.offsetX / this.scale,
      y: -this.offsetY / this.scale
    };
    const bottomRight = {
      x: (canvasWidth - this.offsetX) / this.scale,
      y: (canvasHeight - this.offsetY) / this.scale
    };
    return { topLeft, bottomRight };
  }
}
```

**Source:** Based on [Harrison Milbradt's viewport transformation pattern](https://harrisonmilbradt.com/blog/canvas-panning-and-zooming) and [Steve Ruiz's camera model](https://www.steveruiz.me/posts/zoom-ui)

### Pattern 3: requestAnimationFrame Render Loop with Delta Time

**What:** Continuous render loop using requestAnimationFrame with delta time calculation

**When to use:** Required for smooth animation independent of refresh rate

**Implementation:**
```javascript
class Renderer {
  constructor(canvas, viewport, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewport = viewport;
    this.grid = grid;
    this.running = false;
    this.lastTimestamp = 0;
  }

  start() {
    this.running = true;
    requestAnimationFrame((timestamp) => this.render(timestamp));
  }

  stop() {
    this.running = false;
  }

  render(timestamp) {
    // Calculate delta time (ms since last frame)
    const deltaTime = this.lastTimestamp ? timestamp - this.lastTimestamp : 0;
    this.lastTimestamp = timestamp;

    // Clear canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply viewport transform
    this.viewport.applyTransform(this.ctx);

    // Draw grid
    this.grid.draw(this.ctx, this.viewport);

    // Draw elements (future phases)
    // this.drawElements(deltaTime);

    // Continue loop
    if (this.running) {
      requestAnimationFrame((ts) => this.render(ts));
    }
  }
}
```

**Source:** [MDN requestAnimationFrame documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) and [Sandro Maglione's game rendering loop pattern](https://www.sandromaglione.com/articles/game-rendering-loop-in-typescript)

### Pattern 4: DPI/Retina Scaling

**What:** Scale canvas backing store by devicePixelRatio for crisp rendering on HiDPI displays

**When to use:** Critical for all canvas applications to avoid blurry rendering on Retina displays

**Implementation:**
```javascript
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Set display size (CSS pixels)
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  // Set actual canvas size (scaled by DPI)
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Scale context to compensate
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  return { canvas, ctx, dpr };
}

// Handle window resize
function handleResize(canvas, ctx, dpr) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}
```

**Source:** [MDN devicePixelRatio documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) and [Kirupa's HiDPI Canvas Tutorial](https://www.kirupa.com/canvas/canvas_high_dpi_retina.htm)

### Pattern 5: Mouse Event Coordinate Conversion

**What:** Convert mouse event coordinates to canvas coordinates accounting for canvas position and scroll

**When to use:** Required for all mouse interactions (pan, click, drag)

**Implementation:**
```javascript
class MouseHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.updateCanvasOffset();

    // Recalculate on resize/scroll
    window.addEventListener('resize', () => this.updateCanvasOffset());
    window.addEventListener('scroll', () => this.updateCanvasOffset());
  }

  updateCanvasOffset() {
    const rect = this.canvas.getBoundingClientRect();
    this.offsetX = rect.left;
    this.offsetY = rect.top;
  }

  getCanvasCoordinates(event) {
    return {
      x: event.clientX - this.offsetX,
      y: event.clientY - this.offsetY
    };
  }
}

// Usage with panning
canvas.addEventListener('mousedown', (e) => {
  const coords = mouseHandler.getCanvasCoordinates(e);
  startPan(coords.x, coords.y);
});

canvas.addEventListener('mousemove', (e) => {
  if (isPanning) {
    const coords = mouseHandler.getCanvasCoordinates(e);
    updatePan(coords.x, coords.y);
  }
});
```

**Source:** [MDN getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) and [RipTutorial Canvas Mouse Coordinates](https://riptutorial.com/html5-canvas/example/19534/mouse-coordinates-after-resizing--or-scrolling-)

### Pattern 6: Viewport Culling (Optimization)

**What:** Only render grid lines and elements within visible viewport bounds

**When to use:** Performance optimization for large grids and many elements

**Implementation:**
```javascript
class Grid {
  draw(ctx, viewport) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Calculate visible world bounds
    const bounds = viewport.getVisibleBounds(canvasWidth, canvasHeight);

    // Calculate grid line range to draw
    const startX = Math.floor(bounds.topLeft.x / this.gridSize) * this.gridSize;
    const endX = Math.ceil(bounds.bottomRight.x / this.gridSize) * this.gridSize;
    const startY = Math.floor(bounds.topLeft.y / this.gridSize) * this.gridSize;
    const endY = Math.ceil(bounds.bottomRight.y / this.gridSize) * this.gridSize;

    // Draw only visible grid lines
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1 / viewport.scale; // Keep line width constant in screen space

    for (let x = startX; x <= endX; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }
}
```

**Source:** [Infinite Canvas Tutorial - Viewport Culling](https://infinitecanvas.cc/guide/lesson-008) and [Sandro Maglione's Infinite Canvas](https://www.sandromaglione.com/articles/infinite-canvas-html-with-zoom-and-pan)

### Anti-Patterns to Avoid

- **Storing element positions as screen coordinates** - Always use world or grid coordinates; screen coords change with pan/zoom
- **Floating-point grid coordinates** - Use integers to prevent accumulation of precision errors
- **Redrawing entire canvas on every event** - Use render loop with dirty flag; only redraw when viewport/elements change
- **Forgetting to reset transform before clearing** - Always `setTransform(1,0,0,1,0,0)` before `clearRect()`
- **Not accounting for DPI** - Canvas will appear blurry on Retina displays without devicePixelRatio scaling
- **Using setInterval for animation** - Always use requestAnimationFrame for smooth, power-efficient rendering

## Don't Hand-Roll

Problems that look simple but have subtle complexity:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DPI detection | Custom display detection logic | `window.devicePixelRatio` | Native API handles all device types, edge cases |
| Mouse coordinate conversion | Manual offset calculations | `getBoundingClientRect()` | Handles scroll, resize, CSS transforms automatically |
| Animation timing | Custom timestamp tracking | `requestAnimationFrame` timestamp arg | High-resolution, synchronized across animations |
| Grid snapping | Custom rounding logic | `Math.round(coord / gridSize)` | Simple, prevents off-by-one errors |
| Viewport bounds calculation | Manual min/max tracking | Calculate from viewport transform | Always accurate, no state synchronization issues |

**Key insight:** Canvas coordinate transformations handle most complexity. Don't manually track zoom/pan effects on individual elements—let the canvas transform do the work. Store elements in world coordinates, apply viewport transform once, and draw normally.

## Common Pitfalls

### Pitfall 1: Coordinate System Confusion

**What goes wrong:** Mixing screen, world, and grid coordinates leads to incorrect positioning, especially after pan/zoom operations. Elements appear in wrong locations or mouse clicks don't register.

**Why it happens:** Canvas has multiple coordinate spaces in play simultaneously:
- Screen space (canvas pixels on display)
- World space (virtual infinite canvas)
- Grid space (discrete grid cells for snapping)

**How to avoid:**
1. Always store element positions in grid coordinates (integers)
2. Convert to world coordinates for rendering: `worldX = gridX * gridSize`
3. Apply viewport transform before drawing
4. Create dedicated conversion utilities and use them consistently
5. Never store or use screen coordinates for element positions

**Warning signs:**
- Elements move when you pan/zoom
- Mouse clicks are offset from visual elements
- Grid snapping breaks after zooming
- Positions work at zoom=1 but fail at other zoom levels

**Example:**
```javascript
// ❌ WRONG - Storing screen coordinates
element.x = mouseEvent.clientX;  // Breaks when viewport changes

// ✅ CORRECT - Store grid coordinates
const canvasCoords = getCanvasCoordinates(mouseEvent);
const worldCoords = viewport.screenToWorld(canvasCoords.x, canvasCoords.y);
const gridCoords = worldToGrid(worldCoords.x, worldCoords.y, gridSize);
element.gridX = gridCoords.x;  // Integer grid cell
element.gridY = gridCoords.y;  // Survives pan/zoom
```

**Source:** Synthesis from [Steve Ruiz's coordinate conversion guide](https://www.steveruiz.me/posts/zoom-ui) and [W3Schools Canvas Coordinates](https://www.w3schools.com/graphics/canvas_coordinates.asp)

### Pitfall 2: Blurry Canvas on Retina/HiDPI Displays

**What goes wrong:** Canvas appears blurry or pixelated on high-resolution displays (MacBook Retina, 4K monitors). Grid lines look fuzzy, text is hard to read.

**Why it happens:** Canvas has two sizes:
1. Display size (CSS pixels) - how big it looks
2. Backing store size (actual pixels) - resolution of drawing buffer

On HiDPI displays, 1 CSS pixel = 2+ device pixels. If you don't scale the backing store, the browser upscales a low-res image, causing blur.

**How to avoid:**
1. Always multiply canvas width/height by `window.devicePixelRatio`
2. Set CSS size separately to control display dimensions
3. Scale the context by DPR to maintain coordinate consistency
4. Recalculate on window resize (DPR can change when moving between displays)

**Warning signs:**
- Canvas looks sharp on standard displays but blurry on Retina
- Text and thin lines appear fuzzy
- Other HTML elements are crisp but canvas content isn't
- Grid lines are thick and blurry instead of thin and sharp

**Example:**
```javascript
// ❌ WRONG - Canvas will be blurry on HiDPI
canvas.width = 800;
canvas.height = 600;

// ✅ CORRECT - Crisp on all displays
const dpr = window.devicePixelRatio || 1;
canvas.style.width = '800px';
canvas.style.height = '600px';
canvas.width = 800 * dpr;
canvas.height = 600 * dpr;
ctx.scale(dpr, dpr);
```

**Source:** [MDN devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio), [Kirupa HiDPI Tutorial](https://www.kirupa.com/canvas/canvas_high_dpi_retina.htm), [Callum Locke's HiDPI Canvas Gist](https://gist.github.com/callumlocke/cc258a193839691f60dd)

### Pitfall 3: Floating-Point Coordinate Drift

**What goes wrong:** Over time, element positions drift from grid alignment. Snap-to-grid stops working correctly. Elements that should align no longer do. Accumulating precision errors compound with operations.

**Why it happens:** JavaScript numbers use IEEE 754 floating-point, which cannot exactly represent many decimal values. Repeated operations (0.1 + 0.2 ≠ 0.3) accumulate errors. Pan/zoom calculations involve division, introducing more imprecision.

**How to avoid:**
1. Store element positions as **integer grid coordinates** (e.g., gridX: 5, gridY: 10)
2. Convert to world coordinates only during rendering: `worldX = gridX * gridSize`
3. When snapping mouse input, always round to nearest integer grid cell
4. Never store intermediate floating-point positions
5. Use grid space as source of truth, world/screen coordinates are derived

**Warning signs:**
- Elements slowly drift away from grid lines over multiple interactions
- "Snapped" elements are slightly off-grid after several move operations
- Positions like 5.000000000001 or 4.999999999998 instead of 5.0
- Elements that should align have tiny gaps between them

**Example:**
```javascript
// ❌ WRONG - Accumulates floating-point errors
element.x = element.x + delta;  // Repeated additions drift over time
element.x = Math.round(element.x / gridSize) * gridSize;  // Store float

// ✅ CORRECT - Integer grid coordinates prevent drift
const worldX = element.gridX * gridSize + delta;
const newGridX = Math.round(worldX / gridSize);
element.gridX = newGridX;  // Store integer, no accumulation
```

**Source:** [GameDev.net discussion on int vs float positioning](https://www.gamedev.net/forums/topic/606563-should-positions-be-defined-as-ints-or-floats/), [Game Developer article on float precision](https://www.gamedeveloper.com/design/overcoming-floating-point-precision-errors-)

### Pitfall 4: Incorrect Mouse Coordinate Conversion After Resize/Scroll

**What goes wrong:** Mouse clicks register at wrong locations. Panning starts with a sudden jump. Coordinates are correct initially but break after window resize or scroll.

**Why it happens:** `getBoundingClientRect()` returns the canvas position relative to the viewport, which changes when:
- Window is scrolled (canvas position changes)
- Window is resized (canvas might reflow)
- Browser zoom changes (coordinate scaling)

If you calculate canvas offset once at initialization, it becomes stale after these events.

**How to avoid:**
1. Recalculate canvas offset on resize and scroll events
2. Store offset values in a variable for performance (getBoundingClientRect isn't free)
3. Call recalculation before mouse coordinate conversion if unsure
4. Consider caching with event listeners for automatic updates

**Warning signs:**
- Clicks work correctly at startup but fail after resizing window
- Scrolling page causes mouse coordinates to be offset
- Panning jumps when you first click after a resize
- Coordinates are off by exactly the scroll amount

**Example:**
```javascript
// ❌ WRONG - Stale offset after resize/scroll
const rect = canvas.getBoundingClientRect();
const offsetX = rect.left;
canvas.addEventListener('click', (e) => {
  const x = e.clientX - offsetX;  // Broken after scroll/resize
});

// ✅ CORRECT - Recalculate offset on relevant events
let offsetX, offsetY;

function updateOffset() {
  const rect = canvas.getBoundingClientRect();
  offsetX = rect.left;
  offsetY = rect.top;
}

updateOffset();
window.addEventListener('resize', updateOffset);
window.addEventListener('scroll', updateOffset);

canvas.addEventListener('click', (e) => {
  const x = e.clientX - offsetX;  // Always accurate
});
```

**Source:** [RipTutorial Canvas Mouse Coordinates](https://riptutorial.com/html5-canvas/example/19534/mouse-coordinates-after-resizing--or-scrolling-), [HTML5 Canvas Tutorials Mouse Coordinates](https://www.html5canvastutorials.com/advanced/html5-canvas-mouse-coordinates/)

### Pitfall 5: Sub-Pixel Rendering Anti-Aliasing Performance

**What goes wrong:** Grid lines appear blurry or doubled. Canvas rendering is slow. Lines that should be 1px wide appear as 2px semi-transparent lines.

**Why it happens:** Canvas coordinates specify edges between pixels, not pixel centers. A line at x=10 spans pixels 9.5-10.5, overlapping two pixel columns. The browser anti-aliases this, drawing semi-transparent pixels.

For crisp 1px lines, coordinates must align with pixel centers (whole numbers + 0.5 offset).

**How to avoid:**
1. For vertical/horizontal 1px lines: offset coordinates by 0.5
2. For general rendering: use `Math.floor()` or `Math.round()` to snap to whole pixels
3. Set line width before calculating offsets
4. When viewport is scaled, adjust line width inversely to maintain screen-space width

**Warning signs:**
- Grid lines appear gray instead of black
- Lines are 2px wide instead of 1px
- Canvas looks "soft" or blurry even on non-HiDPI displays
- Performance is slow due to excessive anti-aliasing

**Example:**
```javascript
// ❌ WRONG - Blurry 2px wide line
ctx.moveTo(10, 0);
ctx.lineTo(10, 100);
ctx.stroke();

// ✅ CORRECT - Crisp 1px line
ctx.moveTo(10.5, 0);
ctx.lineTo(10.5, 100);
ctx.stroke();

// ✅ CORRECT - For elements, round to whole pixels
ctx.drawImage(img, Math.floor(x), Math.floor(y));
```

**Source:** [Dive Into HTML5 Canvas](https://diveinto.html5doctor.com/canvas.html), [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

### Pitfall 6: Not Resetting Transform Before Clearing Canvas

**What goes wrong:** Previous frame's content persists as "ghosts". Canvas doesn't clear properly. Visual artifacts accumulate over frames. Clear operation only affects part of canvas.

**Why it happens:** `clearRect(0, 0, width, height)` operates in current transformed coordinate space. If viewport is zoomed/panned, those "0,0" coordinates might not be top-left corner of physical canvas. The clear operation clears the wrong region.

**How to avoid:**
1. Always reset transform to identity before clearing: `ctx.setTransform(1, 0, 0, 1, 0, 0)`
2. Clear using physical canvas dimensions, not world dimensions
3. Then apply viewport transform for drawing
4. Use this sequence every frame

**Warning signs:**
- Previous drawings don't fully clear
- Clear operation leaves artifacts
- Canvas becomes progressively more filled with old content
- Panning reveals fragments of old drawings
- Issue appears only after zooming/panning

**Example:**
```javascript
// ❌ WRONG - Clears wrong area when transformed
ctx.clearRect(0, 0, canvas.width, canvas.height);  // Wrong coords!
viewport.applyTransform(ctx);
drawGrid();

// ✅ CORRECT - Reset before clear
ctx.setTransform(1, 0, 0, 1, 0, 0);  // Identity transform
ctx.clearRect(0, 0, canvas.width, canvas.height);
viewport.applyTransform(ctx);  // Now apply viewport
drawGrid();
```

**Source:** [Harrison Milbradt Pan/Zoom Tutorial](https://harrisonmilbradt.com/blog/canvas-panning-and-zooming), common pattern in canvas libraries

## Code Examples

Verified patterns from official sources:

### Complete Canvas Setup with DPI Handling
```javascript
// Source: MDN + DPI best practices
class CanvasSetup {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { alpha: false });
    this.dpr = window.devicePixelRatio || 1;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    // Set CSS display size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Set backing store size (scaled for HiDPI)
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    // Scale context to maintain logical coordinate system
    this.ctx.scale(this.dpr, this.dpr);
  }

  getLogicalSize() {
    return {
      width: this.canvas.width / this.dpr,
      height: this.canvas.height / this.dpr
    };
  }
}
```

### Pan Handling with Mouse Events
```javascript
// Source: Harrison Milbradt + Steve Ruiz patterns
class PanHandler {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.isPanning = false;
    this.lastX = 0;
    this.lastY = 0;

    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.startPan(e));
    this.canvas.addEventListener('mousemove', (e) => this.updatePan(e));
    this.canvas.addEventListener('mouseup', () => this.endPan());
    this.canvas.addEventListener('mouseleave', () => this.endPan());
  }

  startPan(event) {
    this.isPanning = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  updatePan(event) {
    if (!this.isPanning) return;

    const deltaX = event.clientX - this.lastX;
    const deltaY = event.clientY - this.lastY;

    this.viewport.pan(deltaX, deltaY);

    this.lastX = event.clientX;
    this.lastY = event.clientY;

    // Trigger redraw
    this.canvas.dispatchEvent(new CustomEvent('viewport-changed'));
  }

  endPan() {
    this.isPanning = false;
    this.canvas.style.cursor = 'grab';
  }
}
```

### Zoom Handling with Wheel Events
```javascript
// Source: Steve Ruiz + Harrison Milbradt zoom-to-cursor pattern
class ZoomHandler {
  constructor(canvas, viewport, mouseHandler) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.mouseHandler = mouseHandler;

    this.minZoom = 0.1;
    this.maxZoom = 10;
    this.zoomSpeed = 0.001;

    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
  }

  handleWheel(event) {
    event.preventDefault();

    // Get mouse position in canvas coordinates
    const canvasCoords = this.mouseHandler.getCanvasCoordinates(event);

    // Calculate zoom factor
    const zoomFactor = 1 - event.deltaY * this.zoomSpeed;
    const newScale = this.viewport.scale * zoomFactor;

    // Clamp zoom level
    if (newScale < this.minZoom || newScale > this.maxZoom) {
      return;
    }

    // Zoom toward cursor position
    this.viewport.zoom(zoomFactor, canvasCoords.x, canvasCoords.y);

    // Trigger redraw
    this.canvas.dispatchEvent(new CustomEvent('viewport-changed'));
  }
}
```

### Grid Rendering with Viewport Culling
```javascript
// Source: Infinite Canvas tutorial + optimization patterns
class Grid {
  constructor(gridSize = 12, subGridSize = 1) {
    this.gridSize = gridSize;      // Major grid (12 inches = 1 foot)
    this.subGridSize = subGridSize; // Minor grid (1 inch)
  }

  draw(ctx, viewport) {
    const logicalWidth = ctx.canvas.width / (window.devicePixelRatio || 1);
    const logicalHeight = ctx.canvas.height / (window.devicePixelRatio || 1);

    // Calculate visible bounds in world space
    const bounds = viewport.getVisibleBounds(logicalWidth, logicalHeight);

    // Draw sub-grid (6-inch marks)
    if (viewport.scale > 0.5) {  // Only draw when zoomed in enough
      this.drawGridLines(
        ctx,
        bounds,
        this.subGridSize,
        'rgba(200, 200, 200, 0.3)',
        0.5 / viewport.scale
      );
    }

    // Draw major grid (1-foot marks)
    this.drawGridLines(
      ctx,
      bounds,
      this.gridSize,
      'rgba(150, 150, 150, 0.6)',
      1 / viewport.scale
    );
  }

  drawGridLines(ctx, bounds, spacing, color, lineWidth) {
    const startX = Math.floor(bounds.topLeft.x / spacing) * spacing;
    const endX = Math.ceil(bounds.bottomRight.x / spacing) * spacing;
    const startY = Math.floor(bounds.topLeft.y / spacing) * spacing;
    const endY = Math.ceil(bounds.bottomRight.y / spacing) * spacing;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x += spacing) {
      ctx.moveTo(x + 0.5, bounds.topLeft.y);
      ctx.lineTo(x + 0.5, bounds.bottomRight.y);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += spacing) {
      ctx.moveTo(bounds.topLeft.x, y + 0.5);
      ctx.lineTo(bounds.bottomRight.x, y + 0.5);
    }

    ctx.stroke();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval for animation | requestAnimationFrame | 2011 (widely supported 2015+) | Syncs with display refresh, pauses in background, better battery life |
| Manual DPI detection | window.devicePixelRatio | Standard since 2015 | Reliable HiDPI support across all devices |
| Canvas 2D only | OffscreenCanvas for threading | Chrome 69+ (2018) | Background rendering, but limited browser support |
| CSS for canvas size | Separate CSS and canvas dimensions | Always best practice | Prevents blur, maintains resolution |
| Single canvas layer | Multiple layered canvases | Performance pattern since ~2012 | Reduces redraw, improves animation FPS |

**Deprecated/outdated:**
- **excanvas.js** (IE8 Canvas polyfill): IE8 is dead, not needed in 2026
- **Scaling with drawImage**: Use CSS transforms for GPU acceleration instead
- **Avoiding translate/rotate/scale**: Modern browsers optimize transforms well
- **Flash canvas libraries**: Flash is completely dead

## Open Questions

Things that couldn't be fully resolved:

1. **Grid resolution switching performance**
   - What we know: Need to support 1ft and 6in grid resolution per requirements
   - What's unclear: Best UX for switching between resolutions (toggle button? zoom-based automatic?)
   - Recommendation: Start with toggle button UI, consider zoom-based auto-switch in future phase

2. **Optimal zoom limits**
   - What we know: Need minZoom and maxZoom to prevent unusable states
   - What's unclear: Ideal values for warehouse floor plan use case (feet/inches scale)
   - Recommendation: Start with minZoom: 0.1 (zoom out 10x), maxZoom: 10 (zoom in 10x), tune during testing

3. **Touch/trackpad gesture support**
   - What we know: PROJECT.md says "desktop browser tool" with no mobile requirement
   - What's unclear: Should we support trackpad pinch-to-zoom on laptops?
   - Recommendation: Phase 1 supports mouse only (wheel zoom, drag pan). Evaluate trackpad gestures in future phase based on user feedback

4. **Render loop optimization strategy**
   - What we know: requestAnimationFrame runs continuously, can waste CPU
   - What's unclear: Should we use dirty flag to pause rendering when nothing changes?
   - Recommendation: Phase 1 uses continuous loop for simplicity. Add dirty flag optimization in Phase 2 if performance testing shows need

## Sources

### Primary (HIGH confidence)

- [MDN Web Docs: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Official Canvas performance guide
- [MDN Web Docs: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Animation loop timing
- [MDN Web Docs: devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) - HiDPI handling
- [MDN Web Docs: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Canvas positioning

### Secondary (MEDIUM confidence)

- [Harrison Milbradt: Canvas Panning and Zooming](https://harrisonmilbradt.com/blog/canvas-panning-and-zooming) - Viewport transformation pattern
- [Steve Ruiz: Creating a Zoom UI](https://www.steveruiz.me/posts/zoom-ui) - Camera/viewport model with coordinate conversion
- [Sandro Maglione: Infinite Canvas with Zoom and Pan](https://www.sandromaglione.com/articles/infinite-canvas-html-with-zoom-and-pan) - Complete implementation example
- [Sandro Maglione: Game Rendering Loop in TypeScript](https://www.sandromaglione.com/articles/game-rendering-loop-in-typescript) - requestAnimationFrame patterns
- [Kirupa: Canvas HiDPI/Retina Support](https://www.kirupa.com/canvas/canvas_high_dpi_retina.htm) - DPI scaling tutorial
- [Callum Locke: Retina Canvas Fix (GitHub Gist)](https://gist.github.com/callumlocke/cc258a193839691f60dd) - Concise HiDPI solution
- [AG Grid Blog: Optimising HTML5 Canvas Rendering](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) - Performance optimization techniques
- [Infinite Canvas Tutorial: Viewport Culling](https://infinitecanvas.cc/guide/lesson-008) - Rendering optimization
- [HTML5 Canvas Tutorials: Mouse Coordinates](https://www.html5canvastutorials.com/advanced/html5-canvas-mouse-coordinates/) - Mouse event handling
- [RipTutorial: Mouse Coordinates After Resize/Scroll](https://riptutorial.com/html5-canvas/example/19534/mouse-coordinates-after-resizing--or-scrolling-) - Event handling edge cases
- [W3Schools: Canvas Coordinates](https://www.w3schools.com/graphics/canvas_coordinates.asp) - Coordinate system basics
- [Chuck Kollars: Canvas Two Coordinate Scales](https://www.ckollars.org/canvas-two-coordinate-scales.html) - Dual coordinate system explanation

### Tertiary (LOW confidence - WebSearch only)

- [GameDev.net: Integer vs Float Positioning](https://www.gamedev.net/forums/topic/606563-should-positions-be-defined-as-ints-or-floats/) - Grid coordinate storage patterns (community discussion)
- [Game Developer: Overcoming Floating Point Precision Errors](https://www.gamedeveloper.com/design/overcoming-floating-point-precision-errors-) - Float precision issues (article)
- [Medium: Snap to Grid with KonvaJS](https://medium.com/@pierrebleroux/snap-to-grid-with-konvajs-c41eae97c13f) - Grid snapping algorithm (library-specific but pattern applicable)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All native browser APIs verified via MDN official docs
- Architecture patterns: **HIGH** - Patterns verified across multiple authoritative sources (MDN, established tutorials)
- Coordinate systems: **HIGH** - Documented in MDN and multiple educational sources
- DPI/HiDPI handling: **HIGH** - MDN official documentation plus verified community implementations
- Pitfalls: **MEDIUM-HIGH** - Common issues documented across multiple sources, some from community experience
- Performance optimization: **MEDIUM** - Mix of official MDN guidance and verified community best practices
- Grid coordinate storage: **MEDIUM** - Game dev community consensus, mathematically sound, but not "official" Canvas guidance

**Research date:** 2026-01-29
**Valid until:** ~60 days (stable domain - canvas API hasn't changed significantly in years)

**Notes:**
- Canvas 2D API is mature and stable (minimal changes since 2015)
- All patterns are proven and widely used in production canvas applications
- No experimental APIs recommended - all features have broad browser support
- Project constraints (vanilla JS, no dependencies) align perfectly with standard practices
