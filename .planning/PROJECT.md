# GridOps Layouts

## What This Is

A browser-based warehouse layout tool where users draw floor plans (walls, offices, obstacles, shelving racks) on a grid canvas, place pallets from an inventory bin, and drive a forklift around with arrow keys to test aisle accessibility. The core question it answers: "Can we fit enough inventory in this warehouse?"

## Core Value

Quickly determine total pallet capacity of a warehouse layout — including floor stacks and shelving — before committing to a space.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Grid-based canvas with configurable grid size (1ft or 6in increments)
- [ ] Snap-to-grid by default, hold key for free-form placement
- [ ] Drag-and-drop element placement from a sidebar inventory bin
- [ ] Drawable/placeable elements: walls, offices, obstacles, shelving racks, pallets, forklifts
- [ ] User-defined pallet dimensions (width x depth x height for volume/stacking)
- [ ] Pallet orientation rotation (90°)
- [ ] Shelving racks as floor obstacles with configurable pallet capacity per shelf level
- [ ] Configurable ceiling height to inform stacking limits
- [ ] Running total pallet count (floor pallets + stacked + on shelves)
- [ ] Forklift with realistic default dimensions (user-adjustable)
- [ ] Arrow-key forklift driving to test aisle accessibility and collision detection
- [ ] Cloud sync persistence (JSONBin.io style, like GRC_Launchpad)
- [ ] localStorage fallback for offline use
- [ ] Pure HTML Canvas rendering (no framework dependencies for canvas)

### Out of Scope

- Auto-fill / automatic pallet arrangement — user places everything manually
- 3D visualization — this is a 2D top-down tool
- Multi-user collaboration — single user
- PDF/image export — v1 focuses on interactive use
- Space utilization percentage — total pallet count is the key metric
- Real physics simulation — forklift driving is grid-based collision detection, not physics
- Mobile support — desktop browser tool

## Context

- User evaluates warehouse spaces for inventory capacity as part of business operations
- Typical setup: pallets 2-high on floor, shelving racks above with 2 more pallets per shelf, sometimes a second shelf for 5 total high
- Shelving rack floor footprint (support legs) matters as an obstacle; vertical capacity is user-configured
- Persistence pattern borrowed from existing GRC_Launchpad app (JSONBin.io + localStorage + static fallback)
- Pure HTML Canvas chosen — no framework dependencies for the drawing surface
- Grid units in feet with user-configurable grid resolution (1ft or 6in)

## Constraints

- **Rendering**: Pure HTML Canvas — no canvas libraries (Fabric.js, etc.)
- **Persistence**: JSONBin.io cloud sync with localStorage fallback (matching GRC_Launchpad pattern)
- **Platform**: Desktop browser, no mobile optimization needed
- **Dependencies**: Minimal — vanilla JS/HTML/CSS, no build tools required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pure HTML Canvas over library | User preference, full control, no dependencies | — Pending |
| Grid snap + free-form toggle | Best of both worlds — clean layouts with precision option | — Pending |
| Manual pallet placement over auto-fill | User wants hands-on spatial control | — Pending |
| Arrow-key forklift driving | Most intuitive for testing real aisle navigation | — Pending |
| JSONBin.io persistence | Proven pattern from GRC_Launchpad, cloud sync with offline fallback | — Pending |
| Feet as base unit | US warehouse standard, configurable grid resolution | — Pending |

---
*Last updated: 2026-01-29 after initialization*
