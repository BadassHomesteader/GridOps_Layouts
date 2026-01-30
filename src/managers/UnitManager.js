/**
 * UnitManager - Global unit mode singleton (inches vs feet)
 *
 * Provides:
 * - Toggle between inches and feet display modes
 * - Conversion helpers for display/input values
 * - Observer pattern to notify listeners on mode change
 */
class _UnitManager {
  constructor() {
    this.mode = 'inches'; // 'inches' | 'feet'
    this.listeners = [];
  }

  toggle() {
    this.setMode(this.mode === 'inches' ? 'feet' : 'inches');
  }

  setMode(mode) {
    this.mode = mode;
    this.listeners.forEach(fn => fn(mode));
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  /** Returns unit label: 'in' or 'ft' */
  getLabel() {
    return this.mode === 'feet' ? 'ft' : 'in';
  }

  /** Convert inches to display value (inches as-is, or inches/12 for feet) */
  toDisplay(inches) {
    return this.mode === 'feet' ? inches / 12 : inches;
  }

  /** Convert display value back to inches */
  fromDisplay(val) {
    return this.mode === 'feet' ? val * 12 : val;
  }

  /** Format an inch value for display as a string */
  formatValue(inches) {
    const v = this.toDisplay(inches);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
}

export const UnitManager = new _UnitManager();
