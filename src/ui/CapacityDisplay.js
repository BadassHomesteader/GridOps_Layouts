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
    counterLabel.textContent = 'Total: ';

    this.countSpan = document.createElement('span');
    this.countSpan.textContent = '0';
    this.countSpan.style.cssText = `
      font-weight: 600;
    `;

    const counterUnit = document.createElement('span');
    counterUnit.textContent = ' pallets';

    counterRow.appendChild(counterLabel);
    counterRow.appendChild(this.countSpan);
    counterRow.appendChild(counterUnit);

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
   * Setup event subscriptions
   */
  setupSubscriptions() {
    // Subscribe to capacity changes
    this.capacityManager.subscribe((total) => {
      this.countSpan.textContent = total;
    });
  }
}
