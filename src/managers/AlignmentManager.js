/**
 * AlignmentManager - Align and distribute selected elements
 *
 * Provides:
 * - Align top, bottom, left, right
 * - Distribute horizontal, vertical (equal spacing)
 * - Undo integration for all operations
 */
import { UndoManager } from './UndoManager.js';

export class AlignmentManager {
  constructor(selectionManager) {
    this.selectionManager = selectionManager;
  }

  /**
   * Get selected elements (requires 2+ for align, 3+ for distribute)
   */
  getSelected(minCount = 2) {
    const selected = this.selectionManager.getSelectedAll();
    if (selected.length < minCount) return null;
    return selected;
  }

  /**
   * Align all selected elements to the topmost element's top edge
   */
  alignTop() {
    const selected = this.getSelected();
    if (!selected) return;
    const minY = Math.min(...selected.map(el => el.y));
    UndoManager.pushMove(selected);
    for (const el of selected) {
      el.y = minY;
    }
  }

  /**
   * Align all selected elements to the bottommost element's bottom edge
   */
  alignBottom() {
    const selected = this.getSelected();
    if (!selected) return;
    const maxBottom = Math.max(...selected.map(el => el.y + el.height));
    UndoManager.pushMove(selected);
    for (const el of selected) {
      el.y = maxBottom - el.height;
    }
  }

  /**
   * Align all selected elements to the leftmost element's left edge
   */
  alignLeft() {
    const selected = this.getSelected();
    if (!selected) return;
    const minX = Math.min(...selected.map(el => el.x));
    UndoManager.pushMove(selected);
    for (const el of selected) {
      el.x = minX;
    }
  }

  /**
   * Align all selected elements to the rightmost element's right edge
   */
  alignRight() {
    const selected = this.getSelected();
    if (!selected) return;
    const maxRight = Math.max(...selected.map(el => el.x + el.width));
    UndoManager.pushMove(selected);
    for (const el of selected) {
      el.x = maxRight - el.width;
    }
  }

  /**
   * Distribute elements with equal horizontal spacing between them
   * Requires 3+ elements. Anchors leftmost and rightmost, spreads the rest.
   */
  distributeHorizontal() {
    const selected = this.getSelected(3);
    if (!selected) return;

    // Sort by x position
    const sorted = [...selected].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Total space minus element widths
    const totalSpan = (last.x + last.width) - first.x;
    const totalWidths = sorted.reduce((sum, el) => sum + el.width, 0);
    const gap = (totalSpan - totalWidths) / (sorted.length - 1);

    UndoManager.pushMove(selected);
    let currentX = first.x;
    for (const el of sorted) {
      el.x = currentX;
      currentX += el.width + gap;
    }
  }

  /**
   * Distribute elements with equal vertical spacing between them
   * Requires 3+ elements. Anchors topmost and bottommost, spreads the rest.
   */
  distributeVertical() {
    const selected = this.getSelected(3);
    if (!selected) return;

    // Sort by y position
    const sorted = [...selected].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Total space minus element heights
    const totalSpan = (last.y + last.height) - first.y;
    const totalHeights = sorted.reduce((sum, el) => sum + el.height, 0);
    const gap = (totalSpan - totalHeights) / (sorted.length - 1);

    UndoManager.pushMove(selected);
    let currentY = first.y;
    for (const el of sorted) {
      el.y = currentY;
      currentY += el.height + gap;
    }
  }
}
