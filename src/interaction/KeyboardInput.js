/**
 * KeyboardController - Global keyboard input handling
 *
 * Provides:
 * - Delete/Backspace to remove selected elements
 * - Escape to clear selection
 * - Ctrl+C to copy selected elements
 * - Ctrl+V to paste copied elements
 * - Ctrl+Z to undo last action
 * - Arrow keys to nudge selected elements
 * - Input field detection (don't interfere with text input)
 */
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';
import { UndoManager } from '../managers/UndoManager.js';

export class KeyboardController {
  constructor(selectionManager, elementManager, grid) {
    this.selectionManager = selectionManager;
    this.elementManager = elementManager;
    this.grid = grid;
    this.clipboard = []; // Array of serialized element data
    this.pasteOffset = 24; // offset in world pixels per paste
    this.setupKeyboardListeners();
  }

  /**
   * Setup window-level keyboard event listeners
   */
  setupKeyboardListeners() {
    window.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    // Don't interfere with text input in forms
    if (this.isTextInputActive(event.target)) {
      return;
    }

    // Ctrl+Z / Cmd+Z: undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      UndoManager.undo();
      return;
    }

    // Delete or Backspace: remove selected elements
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      const selected = this.selectionManager.getSelectedAll();
      if (selected.length > 0) {
        UndoManager.pushDelete(selected);
      }
      this.selectionManager.deleteSelected();
      return;
    }

    // Escape: clear selection
    if (event.key === 'Escape') {
      this.selectionManager.clearSelection();
      return;
    }

    // Ctrl+C / Cmd+C: copy selected elements
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      event.preventDefault();
      this.copy();
      return;
    }

    // Ctrl+V / Cmd+V: paste copied elements
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      event.preventDefault();
      this.paste();
      return;
    }

    // Arrow keys: nudge selected elements (skip if forklift is selected — ForkliftController handles it)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      const selected = this.selectionManager.getSelectedAll();
      if (selected.length === 0) return;
      // If a forklift is selected, let ForkliftController handle arrow keys
      if (selected.some(el => el.type === 'forklift')) return;

      event.preventDefault();
      const step = event.shiftKey ? 4 : this.grid.getSpacing(); // Shift = 1 inch (4px)
      let dx = 0, dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      if (event.key === 'ArrowRight') dx = step;
      if (event.key === 'ArrowUp') dy = -step;
      if (event.key === 'ArrowDown') dy = step;

      // Push undo snapshot before moving
      UndoManager.pushMove(selected);
      for (const el of selected) {
        el.x += dx;
        el.y += dy;
      }
      return;
    }
  }

  /**
   * Copy selected elements to clipboard
   */
  copy() {
    const selected = this.selectionManager.getSelectedAll();
    if (selected.length === 0) return;

    this.clipboard = selected.map(el => el.toJSON());
  }

  /**
   * Paste clipboard elements with offset
   */
  paste() {
    if (this.clipboard.length === 0) return;

    // Clear current selection
    this.selectionManager.clearSelection();

    const newElements = [];
    for (const data of this.clipboard) {
      const element = this.createElement(data);
      if (element) {
        // Offset pasted elements so they don't overlap originals
        element.x += this.pasteOffset;
        element.y += this.pasteOffset;
        this.elementManager.add(element);
        newElements.push(element);
      }
    }

    // Select all pasted elements and push undo for the batch
    if (newElements.length > 0) {
      this.selectionManager.selectMultiple(newElements);
      // Push one undo entry that removes all pasted elements
      for (const el of newElements) {
        UndoManager.pushAdd(el);
      }
    }

    // Update clipboard positions so next paste offsets further
    this.clipboard = this.clipboard.map(data => ({
      ...data,
      x: data.x + this.pasteOffset,
      y: data.y + this.pasteOffset
    }));
  }

  /**
   * Create element from serialized data (same as FileManager)
   */
  createElement(data) {
    let element;
    switch (data.type) {
      case 'wall':
        element = new Wall(data.x, data.y, data.width, data.height);
        break;
      case 'office':
        element = new Office(data.x, data.y, data.width, data.height);
        if (data.label) element.label = data.label;
        if (data.colorIndex != null) element.colorIndex = data.colorIndex;
        if (data.driveThrough) element.driveThrough = data.driveThrough;
        break;
      case 'pallet':
        element = new Pallet(data.x, data.y, data.width, data.height, data.palletHeight);
        if (data.quantity) element.quantity = data.quantity;
        break;
      case 'perimeterWall':
        element = new PerimeterWall(data.x, data.y, data.width, data.height);
        if (data.wallThickness) element.wallThickness = data.wallThickness;
        if (data.label) element.label = data.label;
        break;
      case 'forklift':
        element = new Forklift(data.x, data.y, data.width, data.height);
        if (data.rotation) element.rotation = data.rotation;
        break;
      default:
        return null;
    }
    return element;
  }

  /**
   * Check if target is a text input element
   */
  isTextInputActive(target) {
    if (!target) return false;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }

    // Check for contentEditable
    if (target.isContentEditable) {
      return true;
    }

    return false;
  }
}
