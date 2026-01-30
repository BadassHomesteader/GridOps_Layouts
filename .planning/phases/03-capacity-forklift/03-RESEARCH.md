# Phase 3: Capacity & Forklift - Research

**Researched:** 2026-01-29
**Domain:** HTML5 Canvas game mechanics (collision detection, keyboard controls, reactive UI)
**Confidence:** HIGH

## Summary

Phase 3 requires implementing two distinct subsystems: (1) a real-time capacity calculator that tracks total pallet count across all elements, and (2) an interactive forklift driving system with collision detection and visual feedback. The standard approach uses vanilla JavaScript patterns well-established for canvas-based games: AABB collision detection for rectangular shapes, boolean key state tracking for smooth arrow key movement, and reactive state management for live UI updates.

The existing codebase already has the foundation in place: a requestAnimationFrame render loop with delta time calculation (renderer.js), element management with hit testing (ElementManager.js), and keyboard event infrastructure (KeyboardInput.js). Phase 3 extends these systems rather than creating new architectural patterns.

**Primary recommendation:** Use AABB (Axis-Aligned Bounding Box) collision detection for forklift-to-element collision testing, implement smooth keyboard movement with delta-time-based velocity, add a reactive capacity counter using the Observer or PubSub pattern, and provide visual collision feedback through temporary highlighting during blocked states.

## Standard Stack

### Core

The project is already using vanilla JavaScript with no external dependencies. This phase continues that pattern.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native Canvas API | Browser native | 2D rendering, collision detection | Zero dependencies, full control, excellent performance for 2D |
| requestAnimationFrame | Browser native | Game loop timing | Industry standard for smooth 60fps animations, automatic throttling |
| Proxy/PubSub | ES6+ native | Reactive state for capacity counter | Lightweight reactivity without framework overhead |

### Supporting

No external libraries needed. All functionality can be implemented with browser-native APIs.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native collision | matter.js, p2.js | Physics engines add 50-200kb for features we don't need (gravity, rotation, complex shapes) |
| Manual reactive state | VanJS, Alpine.js | Minimal frameworks (~6-20kb) provide reactivity, but add dependency for simple counter |
| AABB collision | SAT.js | Separating Axis Theorem handles rotated shapes, but forklift doesn't rotate (unnecessary complexity) |

**Installation:**
```bash
# No installation needed - using browser-native APIs only
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── interaction/
│   ├── KeyboardInput.js      # Existing - extend for arrow keys
│   └── ForkliftController.js # NEW - forklift movement + collision logic
├── managers/
│   ├── ElementManager.js     # Existing - extend for getAllElements()
│   └── CapacityManager.js    # NEW - calculate total capacity from all elements
├── shapes/
│   ├── Forklift.js           # Existing - extend with collision state
│   ├── Rack.js               # Existing - already has totalCapacity property
│   └── Pallet.js             # Existing - contributes 1 to count
└── ui/
    └── CapacityDisplay.js    # NEW - DOM element that updates on capacity change
```

### Pattern 1: AABB Collision Detection

**What:** Axis-Aligned Bounding Box collision checks whether two rectangles overlap by comparing their edges on both X and Y axes.

**When to use:** Perfect for axis-aligned rectangular objects (racks, walls, pallets, forklift) with no rotation.

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection
// Adapted from: https://blog.sklambert.com/html5-canvas-game-2d-collision-detection/

function checkAABBCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// Usage in forklift movement:
function checkForkliftCollision(forklift, elements) {
  const forkliftBounds = forklift.getBounds(); // { x, y, width, height }

  for (const element of elements) {
    if (element === forklift) continue; // Skip self

    const elementBounds = element.getBounds();
    if (checkAABBCollision(forkliftBounds, elementBounds)) {
      return element; // Collision detected
    }
  }
  return null; // No collision
}
```

**Optimization:** For 100+ elements, consider spatial partitioning (quadtree), but current project scope (warehouse layout) typically has <50 elements, so brute-force iteration is sufficient.

### Pattern 2: Smooth Arrow Key Movement with Delta Time

**What:** Track key states as booleans (pressed/released), update position in render loop using velocity × deltaTime.

**When to use:** Character/vehicle movement that should feel smooth and frame-rate independent.

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_Breakout_game_pure_JavaScript/Paddle_and_keyboard_controls
// Delta time pattern: https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors

class ForkliftController {
  constructor(forklift, elementManager) {
    this.forklift = forklift;
    this.elementManager = elementManager;

    // Key state tracking
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false
    };

    // Movement parameters
    this.speed = 192; // pixels per second (4 feet/sec at 48px/foot)

    this.setupKeyListeners();
  }

  setupKeyListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key in this.keys) {
        e.preventDefault(); // Prevent page scroll
        this.keys[e.key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key in this.keys) {
        this.keys[e.key] = false;
      }
    });
  }

  update(deltaTime) {
    // Calculate movement distance based on time
    const deltaSeconds = deltaTime / 1000;
    const moveDistance = this.speed * deltaSeconds;

    // Calculate desired position
    let dx = 0;
    let dy = 0;

    if (this.keys.ArrowUp) dy -= moveDistance;
    if (this.keys.ArrowDown) dy += moveDistance;
    if (this.keys.ArrowLeft) dx -= moveDistance;
    if (this.keys.ArrowRight) dx += moveDistance;

    // Try to move, revert if collision
    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
    }
  }

  tryMove(dx, dy) {
    // Save current position
    const oldX = this.forklift.x;
    const oldY = this.forklift.y;

    // Apply movement
    this.forklift.x += dx;
    this.forklift.y += dy;

    // Check collision
    const collision = this.checkCollision();

    if (collision) {
      // Revert movement
      this.forklift.x = oldX;
      this.forklift.y = oldY;

      // Set collision state for visual feedback
      this.forklift.isBlocked = true;
      this.forklift.blockedElement = collision;
    } else {
      this.forklift.isBlocked = false;
      this.forklift.blockedElement = null;
    }
  }

  checkCollision() {
    const forkliftBounds = this.forklift.getBounds();

    for (const element of this.elementManager.getAll()) {
      if (element === this.forklift) continue;
      if (element.type === 'pallet') continue; // Forklift can drive over pallets

      const elementBounds = element.getBounds();
      if (checkAABBCollision(forkliftBounds, elementBounds)) {
        return element;
      }
    }
    return null;
  }
}
```

### Pattern 3: Reactive Capacity Counter with Observer Pattern

**What:** Capacity counter observes ElementManager changes and automatically recalculates when elements are added/removed.

**When to use:** UI needs to stay in sync with underlying data without manual update calls.

**Example:**
```javascript
// Source: https://frontendmasters.com/blog/vanilla-javascript-reactivity/

class CapacityManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.observers = [];
    this.totalCapacity = 0;
    this.ceilingHeight = 144; // inches (12 feet default)
  }

  // Observer pattern: subscribe to capacity changes
  subscribe(callback) {
    this.observers.push(callback);
  }

  notify() {
    for (const callback of this.observers) {
      callback(this.totalCapacity);
    }
  }

  // Calculate total capacity from all elements
  calculateCapacity() {
    let total = 0;

    for (const element of this.elementManager.getAll()) {
      if (element.type === 'rack') {
        // Racks have computed property
        total += element.totalCapacity;
      } else if (element.type === 'pallet') {
        // Floor pallets: check stacking potential
        total += this.calculatePalletStacking(element);
      }
    }

    this.totalCapacity = total;
    this.notify(); // Tell observers capacity changed
  }

  calculatePalletStacking(pallet) {
    // Each pallet is 48 inches tall
    // How many can we stack given ceiling height?
    const maxStack = Math.floor(this.ceilingHeight / pallet.palletHeight);
    return Math.max(1, maxStack); // At least 1 (the floor pallet)
  }

  setCeilingHeight(heightInches) {
    this.ceilingHeight = heightInches;
    this.calculateCapacity(); // Recalculate and notify
  }
}

// UI integration
class CapacityDisplay {
  constructor(capacityManager, domElement) {
    this.domElement = domElement;

    // Subscribe to capacity changes
    capacityManager.subscribe((total) => {
      this.updateDisplay(total);
    });
  }

  updateDisplay(count) {
    this.domElement.textContent = `Total Capacity: ${count} pallets`;
  }
}
```

### Pattern 4: Visual Collision Feedback

**What:** Temporarily highlight forklift and colliding element with red/warning color when blocked.

**When to use:** Provide immediate visual feedback that movement is blocked without requiring text or alerts.

**Example:**
```javascript
// In Forklift.draw() method:
draw(ctx, viewport, deltaTime) {
  ctx.save();

  // Base color or collision color
  const baseColor = '#e8c84a'; // Yellow
  const blockedColor = '#ff4444'; // Red

  ctx.fillStyle = this.isBlocked ? blockedColor : baseColor;
  ctx.strokeStyle = this.isBlocked ? '#cc0000' : '#b8992e';
  ctx.lineWidth = this.isBlocked ? 3 / viewport.scale : 2 / viewport.scale;

  // Draw forklift
  ctx.fillRect(this.x, this.y, this.width, this.height);
  ctx.strokeRect(this.x, this.y, this.width, this.height);

  ctx.restore();

  // Optional: also highlight the blocking element
  if (this.isBlocked && this.blockedElement) {
    ctx.save();
    const bounds = this.blockedElement.getBounds();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 4 / viewport.scale;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }
}
```

### Anti-Patterns to Avoid

- **Frame-rate-dependent movement:** Don't use `x += 5` per frame. Always multiply by deltaTime or use fixed timestep.
- **Collision detection after rendering:** Check collisions during update phase, not in draw callbacks.
- **O(n²) collision checks without filtering:** Don't check every element against every other element. Forklift only needs to check against static elements.
- **Manual UI updates:** Don't call `updateCapacityDisplay()` scattered throughout code. Use observer pattern for centralized updates.
- **Continuous collision state:** Reset `isBlocked` to false at start of each update, only set true if collision detected that frame.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spatial indexing for 1000+ elements | Custom quadtree implementation | Already-verified quadtree library OR delay until needed | Edge cases (boundary insertion, rebalancing) are subtle. Current scope <<100 elements, premature optimization |
| Physics-based collision response | Custom momentum/friction calculations | Matter.js or p2.js | Complex interactions (stacking, sliding, rotation) require physics engine expertise |
| Swept collision detection | Custom raycast/swept AABB | Only if tunneling occurs | High-speed collision tunneling unlikely at 192px/sec with 60fps updates (3.2px/frame << 48px object size) |

**Key insight:** Warehouse layout tools don't need game-engine-level physics. AABB collision + position revert is sufficient for "forklift hits wall, stops moving" UX. Avoid over-engineering.

## Common Pitfalls

### Pitfall 1: Collision Tunneling at High Speeds

**What goes wrong:** Fast-moving objects pass through obstacles without detecting collision because they "teleport" past them between frames.

**Why it happens:** Discrete collision detection only checks current position, not the path traveled. If an object moves 50 pixels/frame and obstacle is 48 pixels wide, it can skip over.

**How to avoid:**
- Keep forklift speed reasonable (192 px/sec = 3.2px/frame at 60fps, well below object sizes)
- If needed, implement swept AABB (check line segment from old position to new position)

**Warning signs:** Forklift occasionally passes through thin walls (48px = 1ft width).

### Pitfall 2: Diagonal Movement Speed Boost

**What goes wrong:** Moving diagonally (up+right simultaneously) makes forklift move √2 faster than cardinal directions.

**Why it happens:** Applying full speed on both axes: `dx = speed, dy = speed` creates vector length `√(speed² + speed²) = speed × √2`.

**How to avoid:** Normalize diagonal movement vectors:
```javascript
if (dx !== 0 && dy !== 0) {
  // Diagonal movement - normalize to maintain consistent speed
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  dx = (dx / magnitude) * moveDistance;
  dy = (dy / magnitude) * moveDistance;
}
```

**Warning signs:** Forklift feels noticeably faster when moving diagonally.

### Pitfall 3: Sticky Collisions (Can't Slide Along Walls)

**What goes wrong:** When moving diagonally into a wall, both X and Y movement are blocked, preventing sliding along the wall.

**Why it happens:** Reverting entire movement `(dx, dy)` when collision detected, instead of testing X and Y components separately.

**How to avoid:** Test X and Y movement independently:
```javascript
tryMove(dx, dy) {
  const oldX = this.forklift.x;
  const oldY = this.forklift.y;

  // Try X movement first
  this.forklift.x += dx;
  if (this.checkCollision()) {
    this.forklift.x = oldX; // Revert X only
  }

  // Try Y movement separately
  this.forklift.y += dy;
  if (this.checkCollision()) {
    this.forklift.y = oldY; // Revert Y only
  }
}
```

**Warning signs:** Forklift stops completely when approaching walls at an angle, can't slide parallel to wall.

### Pitfall 4: Stale Capacity Count After Element Deletion

**What goes wrong:** Capacity counter doesn't update after user deletes racks or pallets.

**Why it happens:** CapacityManager calculates once, but ElementManager.remove() doesn't trigger recalculation.

**How to avoid:** Hook capacity recalculation into ElementManager lifecycle:
```javascript
// In ElementManager.add()
add(element) {
  this.elements.push(element);
  this.notifyObservers('add', element);
}

// In ElementManager.remove()
remove(element) {
  const index = this.elements.indexOf(element);
  if (index !== -1) {
    this.elements.splice(index, 1);
    this.notifyObservers('remove', element);
  }
}

// CapacityManager subscribes to ElementManager
elementManager.subscribe((event, element) => {
  this.calculateCapacity();
});
```

**Warning signs:** Deleting racks doesn't reduce total capacity count.

### Pitfall 5: Arrow Keys Scrolling Page

**What goes wrong:** Pressing arrow keys scrolls the browser window/page instead of moving forklift.

**Why it happens:** Browser default behavior for arrow keys is page scrolling.

**How to avoid:** Call `preventDefault()` in keydown handler for arrow keys:
```javascript
window.addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) {
    e.preventDefault(); // Block page scroll
    this.keys[e.key] = true;
  }
});
```

**Warning signs:** Page scrolls when trying to drive forklift.

## Code Examples

Verified patterns from official sources:

### AABB Collision Detection (Complete)

```javascript
// Source: https://blog.sklambert.com/html5-canvas-game-2d-collision-detection/
// Verified pattern for rectangular collision

function checkAABBCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// Element.getBounds() already exists - use it:
const forkliftBounds = forklift.getBounds();
const wallBounds = wall.getBounds();

if (checkAABBCollision(forkliftBounds, wallBounds)) {
  console.log('Collision detected!');
}
```

### Arrow Key State Tracking

```javascript
// Source: https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_Breakout_game_pure_JavaScript/Paddle_and_keyboard_controls

class KeyboardController {
  constructor() {
    this.keys = {};

    document.addEventListener('keydown', (e) => {
      // Support both modern and legacy key names
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        this.keys.right = true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        this.keys.left = true;
      }
      if (e.key === 'ArrowUp' || e.key === 'Up') {
        this.keys.up = true;
      }
      if (e.key === 'ArrowDown' || e.key === 'Down') {
        this.keys.down = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        this.keys.right = false;
      }
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        this.keys.left = false;
      }
      if (e.key === 'ArrowUp' || e.key === 'Up') {
        this.keys.up = false;
      }
      if (e.key === 'ArrowDown' || e.key === 'Down') {
        this.keys.down = false;
      }
    });
  }

  isPressed(key) {
    return this.keys[key] || false;
  }
}
```

### Delta Time Movement Calculation

```javascript
// Source: https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors
// Pattern: velocity × time = distance

class ForkliftController {
  update(deltaTime) {
    // deltaTime is milliseconds since last frame (from renderer.js)
    const seconds = deltaTime / 1000;
    const speed = 192; // pixels per second (4 feet/sec)

    // Calculate movement for this frame
    const moveDistance = speed * seconds;

    // Apply based on keys pressed
    if (this.keys.up) this.forklift.y -= moveDistance;
    if (this.keys.down) this.forklift.y += moveDistance;
    if (this.keys.left) this.forklift.x -= moveDistance;
    if (this.keys.right) this.forklift.x += moveDistance;
  }
}

// Called from main.js:
// renderer.addDrawCallback((ctx, viewport, deltaTime) => {
//   forkliftController.update(deltaTime);
// });
```

### Capacity Calculation

```javascript
// Pattern: Iterate all elements, sum capacity based on type

class CapacityManager {
  calculateTotalCapacity() {
    let total = 0;

    for (const element of this.elementManager.getAll()) {
      if (element.type === 'rack') {
        // Racks already have totalCapacity property
        total += element.totalCapacity;
      } else if (element.type === 'pallet') {
        // Floor pallet: calculate stacking potential
        const stackHeight = Math.floor(this.ceilingHeight / element.palletHeight);
        total += Math.max(1, stackHeight);
      }
    }

    return total;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval for game loop | requestAnimationFrame | ~2011 | rAF syncs with display refresh (60/120/144Hz), prevents wasted frames, better performance |
| Fixed frame step (always 16.67ms) | Delta time accumulator | ~2014 | Smooth on high-refresh displays, frame-rate independent physics |
| Manual event delegation | Declarative key state objects | ~2015 | Cleaner code, easier to check "is key pressed" in update loop |
| jQuery for DOM updates | Native DOM + modern reactive patterns | ~2020 | Zero dependency, better performance, native Proxy/Observer |

**Deprecated/outdated:**
- `keyCode` property: Use `key` or `code` instead (IE/Edge legacy support only)
- `setInterval`/`setTimeout` for animation: Use `requestAnimationFrame` for all visual updates
- Checking collision in `draw()` methods: Separate update/render phases (update checks collision, render just draws)

## Open Questions

Things that couldn't be fully resolved:

1. **Should ceiling height be global or per-zone?**
   - What we know: Requirement CAP-02 says "configurable ceiling height setting" (singular)
   - What's unclear: Does entire warehouse have one ceiling height, or can sections vary?
   - Recommendation: Start with global setting (simpler UX), add per-zone later if user requests

2. **Should forklift drive over floor pallets or collide?**
   - What we know: Success criterion says "stops when colliding with walls, obstacles, or racks"
   - What's unclear: Are floor pallets "obstacles"? Real forklifts can drive over pallets to pick them up.
   - Recommendation: Allow forklift to drive over pallets (skip collision check for element.type === 'pallet'), matches real-world behavior

3. **How should capacity counter handle overlapping pallets?**
   - What we know: Grid snap prevents accidental overlap, but user can hold Shift for free-form placement
   - What's unclear: If two pallets occupy same space, count as 1 or 2?
   - Recommendation: Count each element instance (even if overlapping), display warning if overlaps detected

## Sources

### Primary (HIGH confidence)

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Official browser API documentation for game loop timing
- [MDN: Paddle and Keyboard Controls](https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_Breakout_game_pure_JavaScript/Paddle_and_keyboard_controls) - Official canvas game tutorial for arrow key patterns
- [MDN: 3D Collision Detection](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection) - Authoritative guide to AABB algorithm
- [Frontend Masters: Vanilla JavaScript Reactivity](https://frontendmasters.com/blog/vanilla-javascript-reactivity/) - Modern patterns for reactive state without frameworks

### Secondary (MEDIUM confidence)

- [Chris Courses: Standardizing Frame Rates](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Verified delta time implementation pattern (Jan 2026)
- [Sklambert: Canvas 2D Collision Detection](https://blog.sklambert.com/html5-canvas-game-2d-collision-detection/) - AABB implementation with spatial partitioning guidance
- [Spicy Yoghurt: Collision Detection and Physics](https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics) - Comprehensive collision response patterns
- [Spicy Yoghurt: Smooth Canvas Animation](https://spicyyoghurt.com/tutorials/html5-javascript-game-development/create-a-smooth-canvas-animation) - Delta time movement patterns

### Tertiary (LOW confidence)

- [KIRUPA: Moving Shapes with Keyboard](https://www.kirupa.com/canvas/moving_shapes_canvas_keyboard.htm) - Basic keyboard movement tutorial (cross-verified with MDN)
- [Medium: State Management in Vanilla JS 2026](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - Recent trends article (needs validation in practice)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Browser-native APIs, no dependency needed, patterns well-established since ~2015
- Architecture: HIGH - All patterns verified against MDN and multiple tutorial sources, fits existing codebase structure
- Pitfalls: HIGH - Diagonal speed boost, sticky collisions, arrow key scrolling are documented issues with verified solutions

**Research date:** 2026-01-29
**Valid until:** ~60 days (stable domain, patterns unchanged since 2015, browser APIs mature)
