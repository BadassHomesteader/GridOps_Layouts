# Roadmap: GridOps Layouts

## Overview

GridOps Layouts delivers a browser-based warehouse capacity planning tool through 4 phases. Foundation establishes the grid canvas and viewport controls. Drawing Tools enables element placement and manipulation. Capacity & Forklift adds warehouse intelligence (pallet counting, collision detection, accessibility testing). Persistence enables cloud sync and offline use. Each phase delivers independently valuable functionality, building from core rendering through domain-specific features to practical save/load.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Canvas** - Grid system, snap-to-grid, pan/zoom viewport
- [x] **Phase 2: Drawing & Elements** - Element placement, selection, all warehouse element types
- [ ] **Phase 3: Capacity & Forklift** - Pallet counting, forklift navigation, collision detection
- [ ] **Phase 4: Persistence** - Cloud sync, localStorage fallback, save/load

## Phase Details

### Phase 1: Foundation & Canvas
**Goal**: User can draw on a configurable grid canvas with smooth pan/zoom navigation
**Depends on**: Nothing (first phase)
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, GRID-05, GRID-06
**Success Criteria** (what must be TRUE):
  1. User can configure grid resolution between 1ft and 6in increments
  2. User can pan the viewport by dragging canvas background
  3. User can zoom in/out with scroll wheel centered on cursor
  4. Grid displays crisp and aligned on high-DPI displays (no blurriness)
  5. Snap-to-grid works by default with modifier key override for free-form placement
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Canvas scaffold, DPI scaling, viewport model, pan/zoom input, render loop
- [x] 01-02-PLAN.md — Grid rendering, resolution toggle (1ft/6in), snap-to-grid with Shift override

### Phase 2: Drawing & Elements
**Goal**: User can place, select, move, and delete all warehouse element types
**Depends on**: Phase 1 (requires grid and canvas)
**Requirements**: DRAW-01, DRAW-02, DRAW-03, DRAW-04, DRAW-05, ELEM-01, ELEM-02, ELEM-03, ELEM-04, ELEM-05
**Success Criteria** (what must be TRUE):
  1. User can drag elements from sidebar palette onto canvas
  2. User can click to select elements with visual feedback (selection highlight)
  3. User can drag selected elements to move them on grid
  4. User can delete selected elements with keyboard shortcut
  5. All element types (walls, offices, racks, pallets, forklift) are placeable and resizable
  6. Shelving racks display configurable pallet capacity per shelf level
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Element base class, 5 warehouse subclasses, ElementManager
- [x] 02-02-PLAN.md — Sidebar palette, drag-to-canvas, selection, keyboard shortcuts
- [x] 02-03-PLAN.md — Drag-to-move, mouse event priority, end-to-end verification

### Phase 3: Capacity & Forklift
**Goal**: User can calculate total warehouse pallet capacity and test aisle accessibility interactively
**Depends on**: Phase 2 (requires element library)
**Requirements**: CAP-01, CAP-02, CAP-03, FORK-01, FORK-02, FORK-03
**Success Criteria** (what must be TRUE):
  1. User sees running total pallet count updating as elements are placed/removed
  2. Total count includes floor pallets, stacked pallets (respects ceiling height), and shelf pallets
  3. User can drive forklift with arrow keys to test aisle navigation
  4. Forklift stops when colliding with walls, obstacles, or racks (cannot drive through)
  5. User receives visual feedback when forklift is blocked (collision highlight)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 4: Persistence
**Goal**: User can save layouts to cloud and reload them across sessions and devices
**Depends on**: Phase 3 (requires complete feature set to serialize)
**Requirements**: SAVE-01, SAVE-02, SAVE-03
**Success Criteria** (what must be TRUE):
  1. User's layout auto-saves to localStorage immediately on changes
  2. User's layout syncs to JSONBin.io cloud storage (async, debounced)
  3. User can reload saved layout on page open, falling back to localStorage if cloud unavailable
  4. User can work offline with localStorage persistence when cloud sync fails
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Canvas | 2/2 | Complete | 2026-01-30 |
| 2. Drawing & Elements | 3/3 | Complete | 2026-01-30 |
| 3. Capacity & Forklift | 0/TBD | Not started | - |
| 4. Persistence | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-29*
*Depth: quick (4 phases)*
*Coverage: 25/25 v1 requirements mapped*
