/**
 * SelectionManager - Element selection state and visual feedback
 *
 * Provides:
 * - Single and multi-element selection tracking
 * - Shift+click to toggle individual elements
 * - Box/rubber-band selection support
 * - Visual selection overlay with dashed border
 * - Delete selected elements
 */
export class SelectionManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.selectedElements = [];
  }

  /**
   * Select a single element (clears previous selection)
   * @param {Element|null} element - Element to select, or null to clear
   */
  selectElement(element) {
    // Clear all previous selections
    for (const el of this.selectedElements) {
      el.selected = false;
    }
    this.selectedElements = [];

    if (element) {
      element.selected = true;
      this.selectedElements.push(element);
    }
  }

  /**
   * Toggle element in selection (for Shift+click)
   * @param {Element} element - Element to toggle
   */
  toggleElement(element) {
    const index = this.selectedElements.indexOf(element);
    if (index >= 0) {
      // Deselect
      element.selected = false;
      this.selectedElements.splice(index, 1);
    } else {
      // Add to selection
      element.selected = true;
      this.selectedElements.push(element);
    }
  }

  /**
   * Select multiple elements (for box selection)
   * @param {Element[]} elements - Elements to select
   * @param {boolean} additive - If true, add to existing selection
   */
  selectMultiple(elements, additive = false) {
    if (!additive) {
      for (const el of this.selectedElements) {
        el.selected = false;
      }
      this.selectedElements = [];
    }

    for (const el of elements) {
      if (!this.selectedElements.includes(el)) {
        el.selected = true;
        this.selectedElements.push(el);
      }
    }
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectElement(null);
  }

  /**
   * Get currently selected element (first selected, for backward compat)
   */
  getSelected() {
    return this.selectedElements.length > 0 ? this.selectedElements[0] : null;
  }

  /**
   * Get all selected elements
   */
  getSelectedAll() {
    return this.selectedElements;
  }

  /**
   * Check if an element is selected
   */
  isSelected(element) {
    return this.selectedElements.includes(element);
  }

  /**
   * Delete all selected elements
   */
  deleteSelected() {
    for (const el of this.selectedElements) {
      this.elementManager.remove(el);
    }
    this.selectedElements = [];
  }

  /**
   * Get elements within a rectangular region (for box selection)
   */
  getElementsInRegion(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    return this.elementManager.getAll().filter(el => {
      // Skip perimeter walls during drag selection
      if (el.type === 'perimeterWall') return false;
      const b = el.getBounds();
      return !(b.x + b.width < minX || b.x > maxX || b.y + b.height < minY || b.y > maxY);
    });
  }

  /**
   * Draw selection overlay for all selected elements (renderer callback signature)
   */
  drawSelectionOverlay(ctx, viewport, deltaTime) {
    if (this.selectedElements.length === 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 200, 255, 1)';
    ctx.lineWidth = 3 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 4 / viewport.scale]);

    for (const element of this.selectedElements) {
      const bounds = element.getBounds();
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    ctx.restore();
  }
}
