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
    this.activeSnapGuides = []; // current snap guide lines for rendering
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

    // Save pre-drag positions for undo (include points for polyline walls)
    this.preDragPositions = allSelected.map(el => {
      const pos = { element: el, x: el.x, y: el.y };
      if (el.type === 'polylineWall') {
        pos.points = el.points.map(p => ({ x: p.x, y: p.y }));
      }
      return pos;
    });

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
    this.activeSnapGuides = [];
    if (this.elementOffsets.length === 1) {
      const edgeSnapped = this.snapToEdges(primary, newX, newY);
      newX = edgeSnapped.x;
      newY = edgeSnapped.y;
    }

    // Update all selected element positions
    for (const offset of this.elementOffsets) {
      const el = offset.element;
      if (el.type === 'polylineWall') {
        // Polyline walls move by delta on all points
        const targetX = newX + offset.dx;
        const targetY = newY + offset.dy;
        const dx = targetX - el.x;
        const dy = targetY - el.y;
        if (dx !== 0 || dy !== 0) {
          el.move(dx, dy);
        }
      } else {
        el.x = newX + offset.dx;
        el.y = newY + offset.dy;
      }
    }
  }

  /**
   * Snap element edges to nearby element edges and record guide lines
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
    let bestXEdge = null; // the x-coordinate of the snapped vertical line
    let bestYEdge = null; // the y-coordinate of the snapped horizontal line

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

      // X-axis edge snaps: record the aligned x-coordinate
      const xSnaps = [
        { dist: Math.abs(dragLeft - otherLeft), val: otherLeft, edge: otherLeft },
        { dist: Math.abs(dragLeft - otherRight), val: otherRight, edge: otherRight },
        { dist: Math.abs(dragRight - otherLeft), val: otherLeft - w, edge: otherLeft },
        { dist: Math.abs(dragRight - otherRight), val: otherRight - w, edge: otherRight }
      ];

      for (const snap of xSnaps) {
        if (snap.dist < threshold && snap.dist < Math.abs(bestDx)) {
          bestDx = snap.dist;
          snapX = snap.val;
          bestXEdge = snap.edge;
        }
      }

      // Y-axis edge snaps: record the aligned y-coordinate
      const ySnaps = [
        { dist: Math.abs(dragTop - otherTop), val: otherTop, edge: otherTop },
        { dist: Math.abs(dragTop - otherBottom), val: otherBottom, edge: otherBottom },
        { dist: Math.abs(dragBottom - otherTop), val: otherTop - h, edge: otherTop },
        { dist: Math.abs(dragBottom - otherBottom), val: otherBottom - h, edge: otherBottom }
      ];

      for (const snap of ySnaps) {
        if (snap.dist < threshold && snap.dist < Math.abs(bestDy)) {
          bestDy = snap.dist;
          snapY = snap.val;
          bestYEdge = snap.edge;
        }
      }
    }

    // Build guide lines for rendering
    if (bestXEdge !== null && bestDx < threshold) {
      // Vertical guide line at the snapped x-coordinate
      const minY = Math.min(snapY, ...elements.filter(el => !selectedSet.has(el)).map(el => {
        const ob = el.getBounds();
        const near = Math.abs(ob.x - bestXEdge) < 1 || Math.abs(ob.x + ob.width - bestXEdge) < 1;
        return near ? ob.y : Infinity;
      }));
      const maxY = Math.max(snapY + h, ...elements.filter(el => !selectedSet.has(el)).map(el => {
        const ob = el.getBounds();
        const near = Math.abs(ob.x - bestXEdge) < 1 || Math.abs(ob.x + ob.width - bestXEdge) < 1;
        return near ? ob.y + ob.height : -Infinity;
      }));
      this.activeSnapGuides.push({ axis: 'x', pos: bestXEdge, min: minY, max: maxY });
    }

    if (bestYEdge !== null && bestDy < threshold) {
      // Horizontal guide line at the snapped y-coordinate
      const minX = Math.min(snapX, ...elements.filter(el => !selectedSet.has(el)).map(el => {
        const ob = el.getBounds();
        const near = Math.abs(ob.y - bestYEdge) < 1 || Math.abs(ob.y + ob.height - bestYEdge) < 1;
        return near ? ob.x : Infinity;
      }));
      const maxX = Math.max(snapX + w, ...elements.filter(el => !selectedSet.has(el)).map(el => {
        const ob = el.getBounds();
        const near = Math.abs(ob.y - bestYEdge) < 1 || Math.abs(ob.y + ob.height - bestYEdge) < 1;
        return near ? ob.x + ob.width : -Infinity;
      }));
      this.activeSnapGuides.push({ axis: 'y', pos: bestYEdge, min: minX, max: maxX });
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
    // Note: preDragPositions includes points[] for polylineWall elements,
    // which the undo handler uses to restore point positions

    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.elementOffsets = [];
    this.preDragPositions = [];
    this.activeSnapGuides = [];
  }

  /**
   * Get current drag state
   * @returns {boolean} true if currently dragging
   */
  getIsDragging() {
    return this.isDragging;
  }
}
