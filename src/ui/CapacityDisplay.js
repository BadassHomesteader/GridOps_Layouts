/**
 * CapacityDisplay - Live-updating capacity counter UI
 *
 * Provides:
 * - Real-time total pallet count display
 * - Ceiling height configuration input
 * - Feet/inches conversion display
 * - Automatic updates via CapacityManager subscription
 */
export class CapacityDisplay {
  constructor(capacityManager, containerElement) {
    this.capacityManager = capacityManager;
    this.containerElement = containerElement;

    this.createUI();
    this.setupSubscriptions();
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

    // Title
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
      gap: 8px;
      font-size: 12px;
      color: #333;
    `;

    const ceilingLabel = document.createElement('span');
    ceilingLabel.textContent = 'Ceiling:';

    this.ceilingInput = document.createElement('input');
    this.ceilingInput.type = 'number';
    this.ceilingInput.value = this.capacityManager.getCeilingHeight();
    this.ceilingInput.min = 48;
    this.ceilingInput.step = 12;
    this.ceilingInput.style.cssText = `
      width: 60px;
      padding: 4px 6px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
    `;

    const inchesLabel = document.createElement('span');
    inchesLabel.textContent = 'in';

    this.feetLabel = document.createElement('span');
    this.feetLabel.style.cssText = `
      color: #666;
      font-size: 11px;
    `;
    this.updateFeetLabel();

    ceilingRow.appendChild(ceilingLabel);
    ceilingRow.appendChild(this.ceilingInput);
    ceilingRow.appendChild(inchesLabel);
    ceilingRow.appendChild(this.feetLabel);

    // Assemble
    display.appendChild(title);
    display.appendChild(counterRow);
    display.appendChild(ceilingRow);

    this.containerElement.appendChild(display);
  }

  /**
   * Setup event subscriptions
   */
  setupSubscriptions() {
    // Subscribe to capacity changes
    this.capacityManager.subscribe((total) => {
      this.countSpan.textContent = total;
    });

    // Handle ceiling input changes
    this.ceilingInput.addEventListener('input', () => {
      const value = parseInt(this.ceilingInput.value);
      if (!isNaN(value) && value >= 48) {
        this.capacityManager.setCeilingHeight(value);
        this.updateFeetLabel();
      }
    });
  }

  /**
   * Update feet conversion label
   */
  updateFeetLabel() {
    const inches = parseInt(this.ceilingInput.value);
    const feet = (inches / 12).toFixed(0);
    this.feetLabel.textContent = `(${feet}ft)`;
  }
}
