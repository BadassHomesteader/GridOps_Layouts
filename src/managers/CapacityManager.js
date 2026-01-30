/**
 * CapacityManager - Pallet capacity calculation with reactive updates
 *
 * Provides:
 * - Total pallet count (sum of pallet quantities)
 * - Global pallet dimension configuration
 * - Observer pattern for capacity updates
 */
export class CapacityManager {
  constructor(elementManager) {
    this.elementManager = elementManager;
    this.observers = [];
    this.totalCapacity = 0;
    this.palletConfig = { width: 48, height: 40 }; // default pallet dimensions in inches
    this.propertyAddress = '';
    this.ceilingHeight = 0; // ceiling height in inches (0 = no limit)
    this.inventoryPerPallet = 0; // items per pallet (0 = not tracking)

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
    const inventoryTotal = this.inventoryPerPallet > 0
      ? this.totalCapacity * this.inventoryPerPallet : 0;
    for (const observer of this.observers) {
      observer(this.totalCapacity, inventoryTotal);
    }
  }

  /**
   * Recalculate total capacity from all pallet elements
   */
  recalculate() {
    let total = 0;

    for (const element of this.elementManager.getAll()) {
      if (element.type === 'pallet') {
        total += element.quantity;
      }
    }

    this.totalCapacity = total;
    this.notify();
  }

  /**
   * Get global pallet width (inches)
   */
  getPalletWidth() {
    return this.palletConfig.width;
  }

  /**
   * Get global pallet height (inches)
   */
  getPalletHeight() {
    return this.palletConfig.height;
  }

  /**
   * Set global pallet dimensions
   * @param {number} width - width in inches
   * @param {number} height - height in inches
   */
  setPalletDimensions(width, height) {
    this.palletConfig.width = width;
    this.palletConfig.height = height;
  }

  /**
   * Get current total capacity
   * @returns {number} - total pallet count
   */
  getTotal() {
    return this.totalCapacity;
  }
}
