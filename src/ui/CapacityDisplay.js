/**
 * CapacityDisplay - Live-updating capacity counter UI
 *
 * Provides:
 * - Real-time total pallet count display
 * - Global pallet dimension configuration (width, height)
 * - Automatic updates via CapacityManager subscription
 */
import { Pallet } from '../shapes/Pallet.js';
import { UnitManager } from '../managers/UnitManager.js';

export class CapacityDisplay {
  constructor(capacityManager, containerElement) {
    this.capacityManager = capacityManager;
    this.containerElement = containerElement;

    this.createUI();
    this.setupSubscriptions();
  }

  /**
   * Get property address value
   */
  getAddress() {
    return this.addressInput ? this.addressInput.value : '';
  }

  /**
   * Set property address value
   */
  setAddress(address) {
    if (this.addressInput) {
      this.addressInput.value = address;
    }
  }

  /**
   * Create DOM structure for capacity display
   */
  createUI() {
    // Main container
    const display = document.createElement('div');
    display.id = 'capacity-display';
    display.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #ddd;
    `;

    // Property address section
    const addressLabel = document.createElement('div');
    addressLabel.textContent = 'Property Address';
    addressLabel.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      color: #333;
      margin-bottom: 6px;
    `;

    this.addressInput = document.createElement('input');
    this.addressInput.type = 'text';
    this.addressInput.placeholder = 'Enter address...';
    this.addressInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
      margin-bottom: 14px;
      box-sizing: border-box;
    `;

    // Sync address input to capacityManager
    this.addressInput.addEventListener('input', () => {
      this.capacityManager.propertyAddress = this.addressInput.value;
    });

    // Capacity title
    const title = document.createElement('div');
    title.textContent = 'Capacity';
    title.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
    `;

    // Counter row
    const counterRow = document.createElement('div');
    counterRow.style.cssText = `
      margin-bottom: 12px;
      font-size: 12px;
      color: #333;
    `;

    const counterLabel = document.createElement('span');
    counterLabel.textContent = 'Pallets: ';

    this.countSpan = document.createElement('span');
    this.countSpan.textContent = '0';
    this.countSpan.style.cssText = `
      font-weight: 600;
    `;

    counterRow.appendChild(counterLabel);
    counterRow.appendChild(this.countSpan);

    // Items per pallet row
    const ippRow = document.createElement('div');
    ippRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      font-size: 12px;
      color: #333;
    `;

    const ippLabel = document.createElement('span');
    ippLabel.textContent = 'Items/Pallet:';

    this.ippInput = document.createElement('input');
    this.ippInput.type = 'number';
    this.ippInput.value = '';
    this.ippInput.placeholder = '0';
    this.ippInput.min = 0;
    this.ippInput.step = 1;
    this.ippInput.style.cssText = `
      width: 50px;
      padding: 3px 5px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
    `;

    this.ippInput.addEventListener('input', () => {
      const val = parseInt(this.ippInput.value);
      this.capacityManager.inventoryPerPallet = (!isNaN(val) && val > 0) ? val : 0;
      this.capacityManager.recalculate();
    });

    ippRow.appendChild(ippLabel);
    ippRow.appendChild(this.ippInput);

    // Inventory total row (only visible when items/pallet > 0)
    this.inventoryRow = document.createElement('div');
    this.inventoryRow.style.cssText = `
      margin-bottom: 12px;
      font-size: 12px;
      color: #333;
      display: none;
    `;

    const invLabel = document.createElement('span');
    invLabel.textContent = 'Inventory: ';

    this.inventorySpan = document.createElement('span');
    this.inventorySpan.textContent = '0';
    this.inventorySpan.style.cssText = `font-weight: 600;`;

    const invUnit = document.createElement('span');
    invUnit.textContent = ' items';

    this.inventoryRow.appendChild(invLabel);
    this.inventoryRow.appendChild(this.inventorySpan);
    this.inventoryRow.appendChild(invUnit);

    // Ceiling height row
    const ceilingRow = document.createElement('div');
    ceilingRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 12px;
      color: #333;
    `;

    const ceilingLabel = document.createElement('span');
    ceilingLabel.textContent = 'Ceiling:';

    this.ceilingInput = document.createElement('input');
    this.ceilingInput.type = 'number';
    this.ceilingInput.value = '';
    this.ceilingInput.placeholder = 'ft';
    this.ceilingInput.min = 0;
    this.ceilingInput.step = 1;
    this.ceilingInput.style.cssText = `
      width: 50px;
      padding: 3px 5px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
    `;

    this.ceilingUnitSpan = document.createElement('span');
    this.ceilingUnitSpan.textContent = UnitManager.getLabel();

    this.ceilingInput.addEventListener('input', () => {
      const val = parseFloat(this.ceilingInput.value);
      // Convert display value to inches for storage
      const inches = (!isNaN(val) && val > 0) ? Math.round(UnitManager.fromDisplay(val)) : 0;
      this.capacityManager.ceilingHeight = inches;
      Pallet.ceilingHeight = inches;
    });

    // Update label and value when unit mode changes
    UnitManager.onChange(() => {
      this.ceilingUnitSpan.textContent = UnitManager.getLabel();
      const currentInches = this.capacityManager.ceilingHeight || 0;
      this.ceilingInput.value = currentInches > 0 ? Math.round(UnitManager.toDisplay(currentInches)) : '';
    });

    ceilingRow.appendChild(ceilingLabel);
    ceilingRow.appendChild(this.ceilingInput);
    ceilingRow.appendChild(this.ceilingUnitSpan);

    // Assemble
    display.appendChild(addressLabel);
    display.appendChild(this.addressInput);
    display.appendChild(title);
    display.appendChild(counterRow);
    display.appendChild(ippRow);
    display.appendChild(this.inventoryRow);
    display.appendChild(ceilingRow);

    this.containerElement.appendChild(display);
  }

  /**
   * Set ceiling height (in inches) and update input
   */
  setCeilingHeight(inches) {
    if (this.ceilingInput) {
      this.ceilingInput.value = inches > 0 ? Math.round(UnitManager.toDisplay(inches)) : '';
    }
  }

  /**
   * Set inventory per pallet value and update input
   */
  setInventoryPerPallet(count) {
    if (this.ippInput) {
      this.ippInput.value = count > 0 ? count : '';
    }
  }

  /**
   * Setup event subscriptions
   */
  setupSubscriptions() {
    // Subscribe to capacity changes
    this.capacityManager.subscribe((total, inventoryTotal) => {
      this.countSpan.textContent = total;
      if (inventoryTotal > 0) {
        this.inventorySpan.textContent = inventoryTotal.toLocaleString();
        this.inventoryRow.style.display = '';
      } else {
        this.inventoryRow.style.display = 'none';
      }
    });
  }
}
