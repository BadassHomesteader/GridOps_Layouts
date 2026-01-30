/**
 * CapacityManager - Pallet capacity calculation with reactive updates
 *
 * Provides:
 * - Total warehouse pallet capacity calculation
 * - Rack capacity contribution (levels x palletsPerLevel)
 * - Floor pallet stacking contribution (ceiling height / pallet height)
 * - Ceiling height configuration
 * - Observer pattern for capacity updates
 */
export class CapacityManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.observers = [];
    this.totalCapacity = 0;
    this.ceilingHeight = 144; // 12 feet in inches (default)

    // Subscribe to element changes
    this.elementManager.subscribe(() => this.recalculate());

    // Initial calculation
    this.recalculate();
  }

  /**
   * Subscribe to capacity changes
   * @param {Function} callback - callback to invoke with total capacity
   */
  subscribe(callback) {
    this.observers.push(callback);
  }

  /**
   * Notify all observers of capacity change
   */
  notify() {
    for (const observer of this.observers) {
      observer(this.totalCapacity);
    }
  }

  /**
   * Recalculate total capacity from all elements
   */
  recalculate() {
    let total = 0;

    for (const element of this.elementManager.getAll()) {
      if (element.type === 'rack') {
        // Rack contributes its total capacity (levels x palletsPerLevel)
        total += element.totalCapacity;
      } else if (element.type === 'pallet') {
        // Floor pallet contributes stacking potential
        total += Math.max(1, Math.floor(this.ceilingHeight / element.palletHeight));
      }
    }

    this.totalCapacity = total;
    this.notify();
  }

  /**
   * Set ceiling height and recalculate
   * @param {number} inches - ceiling height in inches
   */
  setCeilingHeight(inches) {
    this.ceilingHeight = inches;
    this.recalculate();
  }

  /**
   * Get current ceiling height
   * @returns {number} - ceiling height in inches
   */
  getCeilingHeight() {
    return this.ceilingHeight;
  }

  /**
   * Get current total capacity
   * @returns {number} - total pallet capacity
   */
  getTotal() {
    return this.totalCapacity;
  }
}
