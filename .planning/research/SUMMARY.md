# Project Research Summary

**Project:** GridOps Warehouse Layout Tool
**Domain:** Browser-based 2D Canvas Drawing Tool (Warehouse Planning)
**Researched:** January 29, 2026
**Confidence:** HIGH

## Executive Summary

This is a browser-based warehouse floor plan design tool that merges 2D CAD drawing capabilities with warehouse domain expertise. Expert warehouse layout tools (WarehouseBlueprint, SmartDraw) combine standard drawing patterns (grid, snap, drag-and-drop) with industry-specific intelligence (aisle widths, forklift clearance, pallet capacity). The recommended approach is **vanilla JavaScript with HTML5 Canvas** using pure web platform APIs—no frameworks, no build tools—following game-engine patterns (requestAnimationFrame loop, key state tracking, AABB collision detection) rather than traditional DOM manipulation.

The critical success factor is encoding warehouse operations knowledge (standard pallet sizes, forklift turning radius, aisle width requirements) into the tool. The main technical risk is canvas performance with hundreds of elements during pan/zoom/drag operations, mitigated through viewport culling, spatial partitioning, and hybrid event-driven + animation loop rendering. The main domain risk is balancing feature completeness (professional tools have 1000+ element libraries) with MVP simplicity—research recommends starting with 5-7 core element types (walls, racks, pallets, forklift, zones) and proven patterns (grid-aligned placement, AABB collision, memento undo/redo).

Research confidence is high across all areas: stack choices are validated by MDN documentation and industry best practices, feature requirements come from analysis of commercial tools, architecture patterns are proven in game development, and pitfalls are documented in canvas performance guides.

## Key Findings

### Recommended Stack

**Use pure vanilla JavaScript with HTML5 Canvas and ES6 modules.** No frameworks, no build tools required—modern browsers support all needed APIs natively. This approach prioritizes simplicity, eliminates dependency management, and provides direct control over rendering performance.

**Core technologies:**
- **HTML5 Canvas (2D context):** Rendering engine — outperforms SVG for 100+ dynamic elements, provides pixel-level control, integrates cleanly with requestAnimationFrame
- **Vanilla JavaScript (ES6 modules):** Application logic — native browser support eliminates build step, module system provides clean separation of concerns
- **localStorage + JSONBin.io:** Dual persistence — localStorage for instant local save, JSONBin.io for cloud backup without backend infrastructure
- **requestAnimationFrame:** Render loop — browser-optimized 60 FPS rendering, automatic pausing when tab inactive
- **Grid-based coordinates:** Spatial system — integer grid cells (1 foot = 12 inches) prevent floating-point drift, simplify collision detection

**Critical implementation patterns:**
- Dual coordinate systems (screen pixels vs world coordinates)
- Event-driven rendering for static state + animation loop for forklift movement
- Key state tracking (not keydown events) for smooth movement
- Memento pattern for undo/redo (state snapshots on action completion)
- Viewport culling to render only visible elements

### Expected Features

**Must have (table stakes):**
- **Grid system with snap-to-grid** — foundational structure for all 2D CAD tools, configurable cell size with toggle
- **Click-and-place object library** — walls, racks, pallets, doors, zones; standard warehouse element types
- **Selection and delete** — click to select with visual feedback, delete key to remove
- **Drag-to-move elements** — standard drawing tool interaction, grid-aligned during drag
- **Undo/redo (Ctrl+Z/Y)** — required for error correction, limited history stack (50 actions)
- **Pan/zoom viewport** — essential for large warehouses, mouse wheel zoom centered on cursor
- **Total pallet capacity counter** — key warehouse metric, updates in real-time as racks placed

**Should have (competitive differentiators):**
- **Forklift keyboard navigation** — arrow keys drive forklift sprite to test aisle accessibility
- **Aisle width validation** — visual indicators (red/yellow/green) for forklift clearance by type
- **Smart aisle calculator** — select forklift type (counterbalance 12-13ft, narrow aisle 8-9ft), tool validates widths automatically
- **Rack configuration** — set levels high (3/4/5 pallets), positions per beam, pallets deep for accurate capacity
- **Quick copy/duplicate** — Ctrl+C/V or Alt+drag for repetitive rack placement
- **Export to PNG/PDF** — share layouts with stakeholders without requiring tool access

**Defer to v2+ (anti-features for MVP):**
- 3D visualization / isometric view — major complexity increase for limited value
- Multi-user real-time collaboration — requires backend infrastructure, conflict resolution
- Advanced rack types (cantilever, flow, push-back) — start with standard selective pallet racking (95% of warehouses)
- WMS/ERP integration — each system has different API, endless scope creep
- Conveyor systems / material handling — entire new domain of flow dynamics
- Mobile touch optimization — warehouse planning done on desktop; optimize desktop-first

### Architecture Approach

Use **component-based modular architecture** with clear separation of concerns. Each component has single responsibility and minimal dependencies, organized in dependency order (Grid → CanvasRenderer → StateManager → ElementManager → ForkliftController). State management uses centralized observable state with event notifications on changes. Rendering uses hybrid approach: event-driven redraws when state changes (efficient for static layouts) + requestAnimationFrame loop when forklift moving (smooth animation).

**Major components:**

1. **Grid (no dependencies)** — define grid dimensions/cell size, snap coordinates to grid, render grid overlay, provide grid-based measurements
2. **CanvasRenderer (depends: Grid)** — manage canvas element and context, apply viewport transforms (pan/zoom), coordinate conversions (screen ↔ world ↔ grid), orchestrate layered rendering
3. **StateManager (no dependencies)** — centralized application state, subscribe/notify pattern for state changes, serialization support
4. **ElementManager (depends: Grid)** — store all warehouse elements (walls/racks/pallets), add/remove/update operations, hit-testing for selection, element rendering in z-order
5. **CollisionSystem (depends: ElementManager)** — AABB collision detection, validate forklift movement before execution, query nearby elements for pathfinding
6. **ForkliftController (depends: Grid, CollisionSystem)** — forklift position and direction state, keyboard input handling via key state tracking, smooth animation between grid cells, pallet pickup/drop
7. **PersistenceManager (depends: ElementManager, ForkliftController, CanvasRenderer)** — serialize/deserialize state to JSON, save to localStorage + JSONBin.io, auto-save with debouncing (2-3 seconds)

**Data flow:** User Input → InputHandler (captures events) → Component (modifies state) → StateManager (notifies subscribers) → CanvasRenderer (re-renders). State stored in world coordinates (grid cells as integers), converted to screen coordinates only during rendering.

### Critical Pitfalls

1. **Coordinate system confusion (screen vs world vs grid)** — Three coordinate spaces create alignment bugs if mixed. Prevention: establish conversion utilities upfront (screenToWorld, worldToGrid, gridToWorld), use consistently throughout codebase. Address in Phase 1 (Foundation) before building features.

2. **Frame-rate dependent movement** — Forklift moves faster on high-refresh monitors (120Hz vs 60Hz) if speed defined per-frame. Prevention: use delta time (seconds since last frame), define speed in units-per-second not units-per-frame, cap delta time to prevent lag spikes. Address in Phase 4 (Forklift Navigation).

3. **Canvas performance with many elements** — Redrawing entire scene every frame degrades with 100+ elements. Prevention: viewport culling (don't render off-screen elements), batch rendering (group similar elements), spatial partitioning if needed (quadtree for 500+ elements), hybrid render strategy (event-driven for static, animation loop for forklift). Address in Phase 2 (Drawing Tools) with profiling.

4. **DPI/Retina display blurriness** — Canvas appears fuzzy on high-DPI displays if logical size doesn't match physical pixels. Prevention: scale canvas by devicePixelRatio on setup, apply to both canvas dimensions and context scale. Address in Phase 1 (Foundation) during initial canvas setup.

5. **Grid snapping precision drift** — Floating-point math causes elements to drift off-grid after repeated operations. Prevention: store positions as integer grid coordinates internally, convert to world coordinates only for rendering, use Math.round explicitly. Address in Phase 1 (Foundation) as grid is core to warehouse layout.

6. **JSONBin.io rate limits** — Aggressive auto-save hits API rate limits (429 errors). Prevention: debounce saves (2-3 seconds after last change), save to localStorage immediately (fast), save to cloud async (slower), implement exponential backoff on errors. Address in Phase 5 (Persistence) with proper debouncing from start.

7. **Key repeat vs keydown/keyup tracking** — Using keydown events for movement causes initial delay and stutter due to key repeat. Prevention: track key state (pressed/released) in object, check state in game loop, update movement based on current keys held. Address in Phase 4 (Forklift Navigation) for smooth driving experience.

## Implications for Roadmap

Based on research, suggested 5-phase structure with clear dependencies:

### Phase 1: Foundation Infrastructure
**Rationale:** Core rendering engine and grid system have no dependencies and are prerequisites for all other features. Grid-based coordinates are fundamental to warehouse layout precision.

**Delivers:** Canvas rendering with pan/zoom, grid system with snap-to-grid, coordinate conversion utilities, DPI-correct display

**Addresses:**
- Grid system with snap-to-grid (table stakes from FEATURES.md)
- Pan/zoom viewport (table stakes)

**Avoids:**
- Coordinate system confusion (pitfall #1) — establishes coordinate utilities upfront
- DPI/Retina blurriness (pitfall #4) — handles in initial canvas setup
- Grid snapping precision drift (pitfall #5) — uses integer grid coordinates from start

**Research needs:** SKIP (well-documented Canvas API, MDN has comprehensive guides)

### Phase 2: Drawing Tools
**Rationale:** Element placement, selection, and manipulation build on foundation grid/rendering. These are core CAD functionality required before warehouse-specific intelligence.

**Delivers:** Element library (walls, racks, pallets, zones), click-and-place placement, drag-to-move, selection with visual feedback, delete selected, basic copy/paste

**Uses:** Grid (for snapping), CanvasRenderer (for hit-testing and rendering)

**Implements:** ElementManager component, hit-testing algorithm, drag controller

**Addresses:**
- Click-and-place object library (table stakes)
- Selection and delete (table stakes)
- Drag-to-move elements (table stakes)
- Quick copy/duplicate (competitive differentiator)

**Avoids:**
- Canvas performance with many elements (pitfall #3) — implements viewport culling and batching
- Drag and drop edge cases (from PITFALLS.md) — proper offset calculation and grid snap handling

**Research needs:** SKIP (standard CAD patterns, well-documented in drawing tool tutorials)

### Phase 3: Warehouse Intelligence
**Rationale:** Domain-specific features differentiate from generic drawing tools. Builds on element library from Phase 2, adds warehouse operations knowledge.

**Delivers:** Pallet capacity counter, rack configuration (levels/positions/depth), aisle width validation with visual indicators, forklift type selector with clearance rules

**Uses:** ElementManager (to count racks and calculate capacity), domain knowledge (standard pallet 48"×40", forklift clearances)

**Addresses:**
- Total pallet capacity counter (table stakes)
- Rack configuration (competitive differentiator)
- Aisle width validation (competitive differentiator)
- Smart aisle calculator (competitive differentiator)

**Avoids:** Feature creep into WMS territory (anti-feature from FEATURES.md) — focus on layout planning, not inventory management

**Research needs:** LOW (FEATURES.md already documents forklift clearance standards, pallet dimensions)

### Phase 4: Forklift Navigation
**Rationale:** Interactive accessibility testing requires collision detection and game loop patterns. Depends on element library (walls/racks as obstacles) and grid system (for movement).

**Delivers:** Forklift sprite with arrow key driving, smooth grid-to-grid animation, collision detection with walls/racks, wall-sliding behavior, pallet pickup/drop

**Uses:** Grid (for movement snapping), CollisionSystem (AABB detection), game loop with delta time

**Implements:** ForkliftController component, InputManager (key state tracking), collision response with sliding

**Addresses:**
- Forklift keyboard navigation (competitive differentiator)
- Validates aisle accessibility interactively

**Avoids:**
- Frame-rate dependent movement (pitfall #2) — uses delta time from start
- Key repeat vs keydown/keyup (pitfall #7) — tracks key state, not events
- Diagonal movement speed issue (from PITFALLS.md) — normalizes movement vector

**Research needs:** SKIP (game development patterns well-documented, see MDN Game Development guides)

### Phase 5: Persistence & Polish
**Rationale:** Save/load enables practical use. Undo/redo improves UX. Export shares layouts. Builds on complete feature set from prior phases.

**Delivers:** Auto-save to localStorage + JSONBin.io, load on startup with fallback, undo/redo (50-action limit), export to PNG/PDF, keyboard shortcuts (Ctrl+Z/Y/C/V/Delete)

**Uses:** StateManager (for serialization), all components (for complete state snapshot)

**Implements:** PersistenceManager component, CommandHistory (memento pattern)

**Addresses:**
- Undo/redo (table stakes)
- Export to PNG/PDF (competitive differentiator)
- Cloud backup for cross-device access

**Avoids:**
- JSONBin rate limits (pitfall #6) — debounced saves with localStorage fallback
- Circular references in serialization (from PITFALLS.md) — uses ID-based references, custom toJSON()
- Save conflicts / data loss (from PITFALLS.md) — timestamp-based conflict detection

**Research needs:** LOW (JSONBin.io API is documented, localStorage patterns are standard)

### Phase Ordering Rationale

- **Foundation first (Phase 1)** because grid and rendering are dependencies for all features; getting coordinate systems right prevents rework
- **Drawing tools before domain logic (Phase 2 → 3)** because warehouse intelligence needs element library to operate on
- **Forklift after elements exist (Phase 4)** because collision detection requires obstacles (walls/racks) to be placeable first
- **Persistence last (Phase 5)** because complete feature set must exist before state can be fully serialized; undo/redo wraps all operations

**Dependency chain:** Grid → Canvas → Elements → Intelligence → Forklift → Persistence

**Grouping logic:** Each phase delivers independently valuable increment (Phase 1 = can draw and navigate, Phase 2 = can place warehouse objects, Phase 3 = gets capacity metrics, Phase 4 = tests accessibility, Phase 5 = saves work)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3:** May need additional research on specific forklift models/clearances if going beyond research findings (currently covers counterbalance, narrow aisle, VNA)
- **Phase 5:** If export to PDF proves complex (research suggests jsPDF library, but may need evaluation)

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Canvas rendering and grid systems have comprehensive MDN documentation
- **Phase 2:** Drawing tool patterns are well-established (hit-testing, drag-and-drop)
- **Phase 4:** Game loop patterns extensively documented in game development resources

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | MDN official documentation validates all Canvas API choices; ES6 modules have native browser support; requestAnimationFrame is standard game loop pattern |
| Features | HIGH | Commercial tool analysis (WarehouseBlueprint, SmartDraw) validates feature requirements; forklift clearance standards from Toyota docs; pallet dimensions are industry standard (48"×40") |
| Architecture | HIGH | Component boundaries align with separation of concerns; dependency order is clear; data flow follows proven event-driven + game loop hybrid pattern |
| Pitfalls | HIGH | Canvas performance issues documented in MDN optimization guide; coordinate confusion and frame-rate dependence are classic game dev pitfalls; JSONBin rate limits in API docs |

**Overall confidence:** HIGH

All four research areas have strong source validation. Stack choices come from official platform documentation (MDN). Features validated against commercial tools and industry standards (OSHA, forklift manufacturers). Architecture patterns proven in game development and drawing tools. Pitfalls documented in performance guides and developer war stories.

### Gaps to Address

**Minor gaps requiring validation during implementation:**

- **Element visual styling:** Research focused on functionality; may need design iteration for element appearance (colors, icons, labels)
- **Mobile responsiveness:** Research assumes desktop-first; if mobile demand emerges in Phase 6+, may need touch gesture research
- **Large layout performance:** Viewport culling and spatial partitioning described conceptually; may need profiling-driven optimization during Phase 2 to determine exact thresholds (100 vs 500 elements)
- **PDF export library choice:** Research suggests jsPDF; may need quick evaluation of alternatives (html2canvas, pdfmake) during Phase 5 planning

**How to handle:**
- Visual styling: iterate based on user feedback after Phase 2 ships
- Mobile: defer until usage analytics show demand
- Performance: profile during Phase 2 with 100+ test elements, optimize only if metrics show <60 FPS
- PDF export: evaluate libraries during Phase 5 kickoff, choose based on file size and API simplicity

## Sources

### Primary (HIGH confidence)
- **MDN Canvas API Tutorial** — canvas rendering, coordinate transforms, optimization techniques
- **MDN Game Development Guide** — requestAnimationFrame loop, delta time, keyboard input patterns
- **JSONBin.io API Reference** — cloud persistence, rate limits, versioning
- **Toyota Forklifts - Aisle Width Standards** — forklift clearance requirements by type
- **WarehouseBlueprint.com** — commercial tool feature analysis
- **SmartDraw Warehouse Layout Software** — industry standard features

### Secondary (MEDIUM confidence)
- **Game Programming Patterns (gameprogrammingpatterns.com)** — command pattern for undo/redo, game loop architecture
- **HTML5 Rocks - High DPI Canvas** — retina display handling
- **AG Grid - Canvas Rendering Optimization** — performance techniques (culling, batching)

### Tertiary (LOW confidence)
- Community blog posts on canvas drawing tools — validated against official docs before inclusion

---
*Research completed: January 29, 2026*
*Ready for roadmap: yes*
