/**
 * UndoManager - Snapshot-based undo/redo system
 *
 * Provides:
 * - Push snapshots before mutating actions
 * - Ctrl+Z to undo, Ctrl+Shift+Z / Ctrl+Y to redo
 * - Snapshot types: add, delete, move, resize, props, points
 * - Max 50 history entries
 */
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';
import { PolylineWall } from '../shapes/PolylineWall.js';
import { TextBox } from '../shapes/TextBox.js';

class _UndoManager {
  constructor() {
    this.history = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.elementManager = null;
    this.selectionManager = null;
    this.capacityManager = null;
    this.onChangeCallbacks = [];
  }

  /**
   * Wire up dependencies (called once from main.js)
   */
  init(elementManager, selectionManager, capacityManager) {
    this.elementManager = elementManager;
    this.selectionManager = selectionManager;
    this.capacityManager = capacityManager;
  }

  /**
   * Register a callback for undo/redo state changes
   */
  onChange(callback) {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Notify listeners of state change
   */
  notifyChange() {
    for (const cb of this.onChangeCallbacks) cb();
  }

  /**
   * Push a snapshot onto the history stack (clears redo stack)
   */
  push(snapshot) {
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.redoStack = [];
    this.notifyChange();
  }

  /**
   * Push snapshot for element addition (undo = remove)
   */
  pushAdd(element) {
    this.push({ type: 'add', element });
  }

  /**
   * Push snapshot for element deletion (undo = re-create)
   * @param {Array} elements - array of elements about to be deleted
   */
  pushDelete(elements) {
    const serialized = elements.map(el => el.toJSON());
    this.push({ type: 'delete', elements: serialized });
  }

  /**
   * Push snapshot for move (undo = restore positions)
   * @param {Array} elements - elements about to be moved
   */
  pushMove(elements) {
    const positions = elements.map(el => {
      const pos = { element: el, x: el.x, y: el.y };
      if (el.type === 'polylineWall') {
        pos.points = el.points.map(p => ({ x: p.x, y: p.y }));
      }
      return pos;
    });
    this.push({ type: 'move', positions });
  }

  /**
   * Push snapshot for polyline point editing (undo = restore old points)
   */
  pushPoints(element) {
    this.push({
      type: 'points',
      element,
      oldPoints: element.points.map(p => ({ x: p.x, y: p.y }))
    });
  }

  /**
   * Push snapshot for resize/property changes (undo = restore old values)
   * @param {Element} element - element about to change
   * @param {Object} props - object of { key: oldValue } to restore
   */
  pushProps(element, props) {
    this.push({ type: 'props', element, props });
  }

  /**
   * Undo the last action
   */
  undo() {
    if (this.history.length === 0) return;
    if (!this.elementManager) return;

    const snapshot = this.history.pop();

    // Build redo snapshot from current state before restoring
    const redoSnapshot = this.buildRedoSnapshot(snapshot);

    this.applySnapshot(snapshot);

    if (redoSnapshot) {
      this.redoStack.push(redoSnapshot);
    }
    this.notifyChange();
  }

  /**
   * Redo the last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return;
    if (!this.elementManager) return;

    const snapshot = this.redoStack.pop();

    // Build undo snapshot from current state before re-applying
    const undoSnapshot = this.buildRedoSnapshot(snapshot);

    this.applySnapshot(snapshot);

    if (undoSnapshot) {
      this.history.push(undoSnapshot);
    }
    this.notifyChange();
  }

  /**
   * Apply a snapshot (used by both undo and redo)
   */
  applySnapshot(snapshot) {
    switch (snapshot.type) {
      case 'add':
        // Remove the element
        this.elementManager.remove(snapshot.element);
        this.selectionManager.clearSelection();
        break;

      case 'add_batch':
        // Remove elements matching the serialized data (by id)
        this.selectionManager.clearSelection();
        for (const data of snapshot.elements) {
          const existing = this.elementManager.getAll().find(el => el.id === data.id);
          if (existing) {
            this.elementManager.remove(existing);
          }
        }
        break;

      case 'delete':
        // Re-create elements from serialized data
        this.selectionManager.clearSelection();
        for (const data of snapshot.elements) {
          const element = this.createElement(data);
          if (element) {
            this.elementManager.add(element);
          }
        }
        break;

      case 'move':
        for (const pos of snapshot.positions) {
          if (pos.points && pos.element.type === 'polylineWall') {
            pos.element.points = pos.points.map(p => ({ x: p.x, y: p.y }));
            pos.element.updateBounds();
          } else {
            pos.element.x = pos.x;
            pos.element.y = pos.y;
          }
        }
        break;

      case 'points':
        snapshot.element.points = snapshot.oldPoints.map(p => ({ x: p.x, y: p.y }));
        snapshot.element.updateBounds();
        break;

      case 'props':
        for (const [key, value] of Object.entries(snapshot.props)) {
          snapshot.element[key] = value;
        }
        if (this.capacityManager) {
          this.capacityManager.recalculate();
        }
        break;
    }
  }

  /**
   * Build a reverse snapshot from the current state before applying an undo/redo.
   * The returned snapshot, when applied, reverses the effect.
   */
  buildRedoSnapshot(snapshot) {
    switch (snapshot.type) {
      case 'add':
        // Undo-add removed the element; redo needs to re-create it
        return { type: 'delete', elements: [snapshot.element.toJSON()] };

      case 'delete':
        // Undo-delete re-created elements; redo needs to remove them
        // (elements are about to be re-created; snapshot.elements is the serialized data)
        return { type: 'add_batch', elements: snapshot.elements };

      case 'add_batch':
        // Redo of add_batch = remove the re-created elements by serialized data
        return { type: 'delete', elements: snapshot.elements };

      case 'move': {
        // Capture current positions as the redo target
        const positions = snapshot.positions.map(pos => {
          const p = { element: pos.element, x: pos.element.x, y: pos.element.y };
          if (pos.element.type === 'polylineWall') {
            p.points = pos.element.points.map(pt => ({ x: pt.x, y: pt.y }));
          }
          return p;
        });
        return { type: 'move', positions };
      }

      case 'points': {
        return {
          type: 'points',
          element: snapshot.element,
          oldPoints: snapshot.element.points.map(p => ({ x: p.x, y: p.y }))
        };
      }

      case 'props': {
        // Capture current values of the same keys
        const currentProps = {};
        for (const key of Object.keys(snapshot.props)) {
          currentProps[key] = snapshot.element[key];
        }
        return { type: 'props', element: snapshot.element, props: currentProps };
      }

      default:
        return null;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.history.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Create element from serialized data (mirrors FileManager.createElement)
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
      case 'polylineWall':
        element = new PolylineWall(data.points || []);
        if (data.thickness) element.thickness = data.thickness;
        break;
      case 'textBox':
        element = new TextBox(data.x, data.y, data.width, data.height, data.text);
        if (data.fontSize) element.fontSize = data.fontSize;
        if (data.textColor) element.textColor = data.textColor;
        break;
      default:
        return null;
    }
    return element;
  }

  /**
   * Clear all history (e.g. on file open)
   */
  clear() {
    this.history = [];
    this.redoStack = [];
    this.notifyChange();
  }
}

export const UndoManager = new _UndoManager();
