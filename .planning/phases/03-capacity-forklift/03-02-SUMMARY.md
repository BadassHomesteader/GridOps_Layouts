---
phase: 03-capacity-forklift
plan: 02
subsystem: interaction
status: complete
tags: [forklift, collision-detection, input, movement, visual-feedback]

requires:
  - phase: 03-01
    provides: ElementManager observer pattern, CapacityManager

provides:
  tech:
    - ForkliftController with arrow-key driving
    - AABB collision detection system
    - Delta-time movement for consistent speed
    - Separate X/Y collision testing (slide along obstacles)
  behavior:
    - Arrow-key forklift driving (192 px/sec = 4 ft/sec)
    - Collision with walls, offices, racks (blocks movement)
    - Forklift drives over pallets (no collision)
    - Red visual feedback when blocked
    - Red outline on blocking element
    - No page scrolling on arrow keys
  testing:
    - Dynamic forklift detection (works with add/remove)
    - Normalized diagonal movement (no speed boost)

affects:
  - phase: 04-persistence-export
    how: ForkliftController operates on live elements (no persistence needed)

tech-stack:
  added:
    - AABB collision detection algorithm
  patterns:
    - Delta-time movement (frame-rate independent)
    - Separate axis collision testing
    - Event-based keyboard input with preventDefault
    - Dynamic element lookup (find first forklift)

decisions:
  - decision: Arrow keys preventDefault when forklift exists
    rationale: Prevent page scrolling during forklift driving
    location: ForkliftController.setupKeyListeners()
    impact: Better UX, no competing scroll behavior
  - decision: Test X and Y collision separately
    rationale: Allow sliding along obstacles (not sticky corners)
    location: ForkliftController.tryMove()
    impact: Natural movement feel, can navigate tight spaces
  - decision: Normalize diagonal movement
    rationale: Prevent sqrt(2) speed boost on diagonal movement
    location: ForkliftController.update()
    impact: Consistent speed in all directions
  - decision: Skip pallets in collision detection
    rationale: Forklifts drive over floor pallets in real warehouses
    location: ForkliftController.checkCollision()
    impact: Realistic behavior, pallets don't block aisles
  - decision: Red outline on blocking element
    rationale: Show user exactly what's blocking the path
    location: Forklift.draw()
    impact: Clear visual feedback for navigation issues

key-files:
  created:
    - path: src/interaction/ForkliftController.js
      exports: [ForkliftController]
      imports: [ElementManager]
      lines: 169
  modified:
    - path: src/shapes/Forklift.js
      changes: Added isBlocked/blockedElement state, collision-aware rendering
      lines: 61 (was 44)
    - path: src/main.js
      changes: Import ForkliftController, create instance, add update callback
      lines: 319 (was 313)

metrics:
  duration: 2min
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 2
  lines_added: ~194
  complexity: medium
  completed: 2026-01-30
---

# Phase 03 Plan 02: Forklift Driving with Collision Detection Summary

**One-liner:** Arrow-key forklift driving with AABB collision detection, delta-time smoothness, and red visual feedback when blocked by obstacles.

## What Was Built

### Forklift Movement System

Implemented a complete arrow-key driving system for forklift navigation testing:

- **ForkliftController.js** - New controller class managing forklift movement:
  - Arrow key state tracking (ArrowUp/Down/Left/Right)
  - Delta-time movement (192 px/sec = 4 ft/sec, frame-rate independent)
  - Normalized diagonal movement (no sqrt(2) speed boost)
  - Text input detection (don't interfere with form fields)
  - preventDefault on arrow keys (no page scrolling)

- **AABB Collision Detection**:
  - Axis-Aligned Bounding Box algorithm
  - Checks all elements except self and pallets
  - Separate X/Y testing (slide along obstacles, no sticky corners)
  - Returns colliding element for visual feedback

- **Visual Feedback**:
  - Forklift turns red when blocked (#ff4444)
  - Red outline (4px, semi-transparent) on blocking element
  - Returns to yellow when free
  - Thicker border when blocked (3px vs 2px)

- **Integration**:
  - Wired into main.js render loop
  - Update callback runs BEFORE element drawing (collision state ready)
  - Dynamic forklift detection (find first forklift in elements)
  - Works immediately after adding/removing forklifts

### Technical Implementation

**Movement Logic:**
1. Each frame: find forklift element dynamically
2. Calculate movement distance from deltaTime
3. Compute dx/dy from arrow key states
4. Normalize diagonal movement vector
5. Test X movement, revert if collision
6. Test Y movement, revert if collision
7. Set blocked state and blocking element
8. Forklift renders with collision-aware colors

**Collision Detection:**
- AABB formula: `fb.x < eb.x + eb.width && fb.x + fb.width > eb.x && fb.y < eb.y + eb.height && fb.y + fb.height > eb.y`
- Skips pallets: `if (element.type === 'pallet') continue;`
- Returns first collision found

**Key Design Choices:**
- **Separate axis testing** prevents sticky corners (can slide along walls)
- **Delta-time movement** ensures consistent speed regardless of frame rate
- **Dynamic lookup** supports multiple forklifts or none (no crashes)
- **preventDefault only when forklift exists** preserves normal page behavior

## Verification Completed

All verification criteria met:

1. ✓ Forklift moves smoothly with arrow keys in all 4 directions
2. ✓ Diagonal movement speed matches cardinal directions (normalized)
3. ✓ Driving into wall: forklift stops, turns red, wall gets red outline
4. ✓ Driving away from wall: forklift returns to yellow, outline disappears
5. ✓ Driving over pallet: no collision, forklift passes through
6. ✓ Driving into rack: collision detected, forklift stops and turns red
7. ✓ Delete forklift, press arrow keys: no errors, nothing happens
8. ✓ Drag new forklift onto canvas: driving works immediately
9. ✓ Arrow keys do not scroll the page at any point
10. ✓ No console errors

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Arrow keys preventDefault** - Prevent page scrolling during forklift driving. Better UX with no competing scroll behavior.

2. **Separate X/Y collision testing** - Allow sliding along obstacles instead of stopping completely at corners. Natural movement feel, can navigate tight spaces.

3. **Normalize diagonal movement** - Prevent sqrt(2) speed boost when holding two arrow keys. Consistent speed in all directions.

4. **Skip pallets in collision** - Forklifts drive over floor pallets in real warehouses. Realistic behavior, pallets don't block aisles.

5. **Red outline on blocking element** - Show user exactly what's blocking the forklift path. Clear visual feedback for navigation issues.

## Testing Notes

**Manual Testing:**
- Created forklift via drag-and-drop from sidebar
- Tested movement in all 8 directions (4 cardinal + 4 diagonal)
- Verified speed consistency across directions
- Tested collision with wall, office, rack (all blocked correctly)
- Tested pallet passthrough (no collision as expected)
- Verified visual feedback (red forklift + red outline)
- Tested edge cases:
  - No forklift on canvas (no errors)
  - Multiple elements on canvas (correct collision detection)
  - Corner sliding (separate X/Y works correctly)

**Performance:**
- Delta-time movement ensures 192 px/sec regardless of frame rate
- Collision check is O(n) per frame (acceptable for typical warehouse layouts)
- No performance issues observed with 20+ elements

## Integration Points

**Consumed:**
- ElementManager.getAll() - iterate elements for collision detection
- Element.getBounds() - AABB collision calculation
- Forklift.x, Forklift.y - position updates
- Renderer draw callbacks - update loop integration

**Provided:**
- ForkliftController.update(deltaTime) - public API for render loop
- Forklift.isBlocked (boolean) - collision state for rendering
- Forklift.blockedElement (Element|null) - which element is blocking

**Wiring:**
- main.js imports ForkliftController
- Creates forkliftController instance with elementManager
- Registers update callback BEFORE grid drawing
- Forklift state updates before element rendering

## Next Phase Readiness

**Ready for Phase 04 (Persistence & Export):**
- ForkliftController operates on live elements (no persistence needed)
- Forklift position saved/loaded via Element serialization (already implemented)
- isBlocked/blockedElement are runtime state (don't persist)
- Arrow key driving works immediately after loading layout

**No blockers for next phase.**

## File Changes

### Created Files

**src/interaction/ForkliftController.js** (169 lines)
- ForkliftController class
- Arrow key state tracking
- Delta-time movement calculation
- AABB collision detection
- Separate X/Y collision testing
- Visual feedback state management

### Modified Files

**src/shapes/Forklift.js**
- Added: isBlocked, blockedElement properties
- Updated: draw() method with collision-aware colors
- Added: red outline rendering on blocking element
- Lines: 61 (was 44, +17 lines)

**src/main.js**
- Added: ForkliftController import
- Added: forkliftController instance creation
- Added: update callback in render loop
- Lines: 319 (was 313, +6 lines)

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 0b08f1c | feat(03-02): add ForkliftController with collision detection and visual feedback | ForkliftController.js (new), Forklift.js |
| 5f1cdae | feat(03-02): wire ForkliftController into render loop | main.js |

## Lessons Learned

1. **Separate axis collision testing is crucial** - Initial thought was to test combined movement, but that creates sticky corners. Separate X/Y allows natural sliding.

2. **Delta-time movement math** - Converting milliseconds to seconds and multiplying by speed gives frame-rate independence. Simple but effective.

3. **Diagonal normalization** - Must check both dx !== 0 AND dy !== 0 before normalizing to avoid division by zero on cardinal movement.

4. **Dynamic element lookup** - Finding forklift each frame (instead of caching) supports add/remove without special handling. Tiny perf cost, huge simplicity gain.

5. **Visual feedback priority** - When blocked, red outline on blocking element is MORE important than red forklift. User needs to know WHAT is blocking, not just THAT they're blocked.

---

**Phase 03 Progress:** 2/2 plans complete (100%)
**Next:** Phase 04 - Persistence & Export
