/**
 * UndoManager - Snapshot-based undo system
 *
 * Provides:
 * - Push snapshots before mutating actions
 * - Ctrl+Z to undo last action
 * - Snapshot types: add, delete, move, resize, props
 * - Max 50 history entries
 */
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';

class _UndoManager {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
    this.elementManager = null;
    this.selectionManager = null;
    this.capacityManager = null;
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
   * Push a snapshot onto the history stack
   */
  push(snapshot) {
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
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
    const positions = elements.map(el => ({
      element: el,
      x: el.x,
      y: el.y
    }));
    this.push({ type: 'move', positions });
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

    switch (snapshot.type) {
      case 'add':
        // Undo add = remove the element
        this.elementManager.remove(snapshot.element);
        this.selectionManager.clearSelection();
        break;

      case 'delete':
        // Undo delete = re-create elements from serialized data
        this.selectionManager.clearSelection();
        for (const data of snapshot.elements) {
          const element = this.createElement(data);
          if (element) {
            this.elementManager.add(element);
          }
        }
        break;

      case 'move':
        // Undo move = restore original positions
        for (const pos of snapshot.positions) {
          pos.element.x = pos.x;
          pos.element.y = pos.y;
        }
        break;

      case 'props':
        // Undo property change = restore old values
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
  }
}

export const UndoManager = new _UndoManager();
