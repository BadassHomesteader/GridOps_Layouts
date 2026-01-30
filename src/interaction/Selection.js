/**
 * SelectionManager - Element selection state and visual feedback
 *
 * Provides:
 * - Single element selection tracking
 * - Selection state management (select/clear)
 * - Visual selection overlay with dashed border
 * - Delete selected element
 */
export class SelectionManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.selectedElement = null;
  }

  /**
   * Select an element
   * @param {Element|null} element - Element to select, or null to clear
   */
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

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectElement(null);
  }

  /**
   * Get currently selected element
   */
  getSelected() {
    return this.selectedElement;
  }

  /**
   * Delete currently selected element
   */
  deleteSelected() {
    if (this.selectedElement) {
      this.elementManager.remove(this.selectedElement);
      this.selectedElement = null;
    }
  }

  /**
   * Draw selection overlay (renderer callback signature)
   */
  drawSelectionOverlay(ctx, viewport, deltaTime) {
    if (!this.selectedElement) return;

    const element = this.selectedElement;
    const bounds = element.getBounds();

    ctx.save();

    // Dashed blue border
    ctx.strokeStyle = 'rgba(100, 200, 255, 1)';
    ctx.lineWidth = 3 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 4 / viewport.scale]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Draw corner resize handles
    const handleSize = 8 / viewport.scale;
    ctx.fillStyle = 'rgba(100, 200, 255, 1)';
    ctx.setLineDash([]); // Solid for handles

    // Top-left
    ctx.fillRect(
      bounds.x - handleSize / 2,
      bounds.y - handleSize / 2,
      handleSize,
      handleSize
    );

    // Top-right
    ctx.fillRect(
      bounds.x + bounds.width - handleSize / 2,
      bounds.y - handleSize / 2,
      handleSize,
      handleSize
    );

    // Bottom-left
    ctx.fillRect(
      bounds.x - handleSize / 2,
      bounds.y + bounds.height - handleSize / 2,
      handleSize,
      handleSize
    );

    // Bottom-right
    ctx.fillRect(
      bounds.x + bounds.width - handleSize / 2,
      bounds.y + bounds.height - handleSize / 2,
      handleSize,
      handleSize
    );

    ctx.restore();
  }
}
