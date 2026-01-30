/**
 * DragMoveController - Drag-to-move interaction for selected elements
 *
 * Provides:
 * - Single and multi-element drag
 * - Offset preservation (no jump on drag start)
 * - Grid snap during drag (unless Shift held for free-form)
 * - Edge snapping to nearby elements
 * - Undo integration (saves pre-drag positions)
 * - Clean start/update/end API for mouse event handlers
 */
import { UndoManager } from '../managers/UndoManager.js';

export class DragMoveController {
  constructor(selectionManager, coordinateConverter, grid) {
    this.selectionManager = selectionManager;
    this.coordinateConverter = coordinateConverter;
    this.grid = grid;

    // Drag state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 }; // offset from primary element origin to click point
    this.elementOffsets = []; // offsets for all selected elements relative to primary
    this.preDragPositions = []; // saved positions for undo
    this.snapThreshold = 8; // world-space pixels (~2 inches)
  }

  /**
   * Start dragging all selected elements
   * @param {number} worldX - world x coordinate of mouse down
   * @param {number} worldY - world y coordinate of mouse down
   * @returns {boolean} true if drag started, false if no selection
   */
  startDrag(worldX, worldY) {
    const primary = this.selectionManager.getSelected();
    if (!primary) return false;

    // Offset from primary element origin to click point
    this.dragOffset.x = worldX - primary.x;
    this.dragOffset.y = worldY - primary.y;

    // Store offsets for all selected elements relative to primary
    const allSelected = this.selectionManager.getSelectedAll();
    this.elementOffsets = allSelected.map(el => ({
      element: el,
      dx: el.x - primary.x,
      dy: el.y - primary.y
    }));

    // Save pre-drag positions for undo
    this.preDragPositions = allSelected.map(el => ({
      element: el,
      x: el.x,
      y: el.y
    }));

    this.isDragging = true;
    return true;
  }

  /**
   * Update element positions during drag
   * @param {number} worldX - current world x coordinate
   * @param {number} worldY - current world y coordinate
   * @param {boolean} shiftKey - true if Shift key held (disables snap)
   */
  updateDrag(worldX, worldY, shiftKey) {
    if (!this.isDragging) return;

    const primary = this.selectionManager.getSelected();
    if (!primary) return;

    // Calculate new primary position (preserving offset)
    let newX = worldX - this.dragOffset.x;
    let newY = worldY - this.dragOffset.y;

    // Apply grid snap unless Shift key held
    if (!shiftKey) {
      const snapped = this.grid.snapToGrid(newX, newY);
      newX = snapped.x;
      newY = snapped.y;
    }

    // Apply edge snapping to nearby elements (only for single selection)
    if (this.elementOffsets.length === 1) {
      const edgeSnapped = this.snapToEdges(primary, newX, newY);
      newX = edgeSnapped.x;
      newY = edgeSnapped.y;
    }

    // Update all selected element positions
    for (const offset of this.elementOffsets) {
      offset.element.x = newX + offset.dx;
      offset.element.y = newY + offset.dy;
    }
  }

  /**
   * Snap element edges to nearby element edges
   */
  snapToEdges(draggedElement, newX, newY) {
    const elements = this.selectionManager.elementManager.getAll();
    const selectedSet = new Set(this.selectionManager.getSelectedAll());
    const w = draggedElement.width;
    const h = draggedElement.height;
    const threshold = this.snapThreshold;

    let bestDx = Infinity;
    let bestDy = Infinity;
    let snapX = newX;
    let snapY = newY;

    const dragLeft = newX;
    const dragRight = newX + w;
    const dragTop = newY;
    const dragBottom = newY + h;

    for (const other of elements) {
      if (selectedSet.has(other)) continue;

      const ob = other.getBounds();
      const otherLeft = ob.x;
      const otherRight = ob.x + ob.width;
      const otherTop = ob.y;
      const otherBottom = ob.y + ob.height;

      const xSnaps = [
        { dist: Math.abs(dragLeft - otherLeft), val: otherLeft },
        { dist: Math.abs(dragLeft - otherRight), val: otherRight },
        { dist: Math.abs(dragRight - otherLeft), val: otherLeft - w },
        { dist: Math.abs(dragRight - otherRight), val: otherRight - w }
      ];

      for (const snap of xSnaps) {
        if (snap.dist < threshold && snap.dist < Math.abs(bestDx)) {
          bestDx = snap.dist;
          snapX = snap.val;
        }
      }

      const ySnaps = [
        { dist: Math.abs(dragTop - otherTop), val: otherTop },
        { dist: Math.abs(dragTop - otherBottom), val: otherBottom },
        { dist: Math.abs(dragBottom - otherTop), val: otherTop - h },
        { dist: Math.abs(dragBottom - otherBottom), val: otherBottom - h }
      ];

      for (const snap of ySnaps) {
        if (snap.dist < threshold && snap.dist < Math.abs(bestDy)) {
          bestDy = snap.dist;
          snapY = snap.val;
        }
      }
    }

    return { x: snapX, y: snapY };
  }

  /**
   * End drag operation
   */
  endDrag() {
    // Push undo snapshot if any element actually moved
    if (this.preDragPositions.length > 0) {
      const moved = this.preDragPositions.some(
        pos => pos.element.x !== pos.x || pos.element.y !== pos.y
      );
      if (moved) {
        UndoManager.push({ type: 'move', positions: this.preDragPositions });
      }
    }

    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.elementOffsets = [];
    this.preDragPositions = [];
  }

  /**
   * Get current drag state
   * @returns {boolean} true if currently dragging
   */
  getIsDragging() {
    return this.isDragging;
  }
}
