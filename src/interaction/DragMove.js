/**
 * DragMoveController - Drag-to-move interaction for selected elements
 *
 * Provides:
 * - Drag state management (isDragging, dragOffset)
 * - Offset preservation (no jump on drag start)
 * - Grid snap during drag (unless Shift held for free-form)
 * - Clean start/update/end API for mouse event handlers
 */
export class DragMoveController {
  constructor(selectionManager, coordinateConverter, grid) {
    this.selectionManager = selectionManager;
    this.coordinateConverter = coordinateConverter;
    this.grid = grid;

    // Drag state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 }; // offset from element origin to click point
  }

  /**
   * Start dragging the currently selected element
   * @param {number} worldX - world x coordinate of mouse down
   * @param {number} worldY - world y coordinate of mouse down
   * @returns {boolean} true if drag started, false if no selection
   */
  startDrag(worldX, worldY) {
    const element = this.selectionManager.getSelected();

    if (!element) {
      return false;
    }

    // Calculate offset from element origin to click point
    // This preserves the grab point so element doesn't jump
    this.dragOffset.x = worldX - element.x;
    this.dragOffset.y = worldY - element.y;

    this.isDragging = true;
    return true;
  }

  /**
   * Update element position during drag
   * @param {number} worldX - current world x coordinate
   * @param {number} worldY - current world y coordinate
   * @param {boolean} shiftKey - true if Shift key held (disables snap)
   */
  updateDrag(worldX, worldY, shiftKey) {
    if (!this.isDragging) {
      return;
    }

    const element = this.selectionManager.getSelected();
    if (!element) {
      return;
    }

    // Calculate new position (preserving offset)
    let newX = worldX - this.dragOffset.x;
    let newY = worldY - this.dragOffset.y;

    // Apply grid snap unless Shift key held
    if (!shiftKey) {
      const snapped = this.grid.snapToGrid(newX, newY);
      newX = snapped.x;
      newY = snapped.y;
    }

    // Update element position
    element.x = newX;
    element.y = newY;
  }

  /**
   * End drag operation
   */
  endDrag() {
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
  }

  /**
   * Get current drag state
   * @returns {boolean} true if currently dragging
   */
  getIsDragging() {
    return this.isDragging;
  }
}
