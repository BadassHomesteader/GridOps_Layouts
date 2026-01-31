/**
 * DimensionInput - Double-click to edit element dimensions
 *
 * Provides:
 * - Double-click on canvas element to show floating dimension editor
 * - Width/Height inputs (in inches) for all elements
 * - Quantity input for pallets
 * - Label input for perimeter walls
 * - Enter to apply, Escape to cancel
 */
import { UnitManager } from '../managers/UnitManager.js';
import { UndoManager } from '../managers/UndoManager.js';
import { Office } from '../shapes/Office.js';

export class DimensionInput {
  constructor(canvas, elementManager, selectionManager, coordinateConverter, capacityManager) {
    this.canvas = canvas;
    this.elementManager = elementManager;
    this.selectionManager = selectionManager;
    this.coordinateConverter = coordinateConverter;
    this.capacityManager = capacityManager;
    this.overlay = null;
    this.onEditPoints = null; // callback(element) when "Edit Points" clicked

    this.setupListeners();
  }

  /**
   * Setup double-click listener on canvas
   */
  setupListeners() {
    this.canvas.addEventListener('dblclick', (event) => {
      this.handleDoubleClick(event);
    });
  }

  /**
   * Handle double-click on canvas
   */
  handleDoubleClick(event) {
    // Close any existing overlay
    this.close();

    const canvasRect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;
    const world = this.coordinateConverter.screenToWorld(canvasX, canvasY);

    const element = this.elementManager.getElementAtPoint(world.x, world.y);
    if (!element) return;

    // Select the element
    this.selectionManager.selectElement(element);

    // Show editor near the click position
    this.showEditor(element, event.clientX, event.clientY);
  }

  /**
   * Show floating dimension editor near the element
   */
  showEditor(element, screenX, screenY) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      left: ${screenX + 10}px;
      top: ${screenY - 10}px;
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #333;
    `;

    const typeLabels = {
      wall: 'Wall',
      office: 'Office',
      pallet: 'Pallet',
      perimeterWall: 'Perimeter Wall',
      forklift: 'Forklift',
      polylineWall: 'Polyline Wall',
      textBox: 'Text Box'
    };

    const title = document.createElement('div');
    title.textContent = typeLabels[element.type] || element.type;
    title.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 10px;
    `;
    this.overlay.appendChild(title);

    // Polyline wall gets a specialized editor
    if (element.type === 'polylineWall') {
      this.buildPolylineEditor(element);
      return;
    }

    // Text box gets a specialized editor
    if (element.type === 'textBox') {
      this.buildTextBoxEditor(element);
      return;
    }

    // Width input (convert px to inches, then to display unit)
    const widthInches = element.width / 4;
    const widthDisplay = UnitManager.toDisplay(widthInches);
    const widthRow = this.createInputRow('X:', this.roundDisplay(widthDisplay), UnitManager.getLabel());
    widthRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
    this.overlay.appendChild(widthRow.row);

    // Height input
    const heightInches = element.height / 4;
    const heightDisplay = UnitManager.toDisplay(heightInches);
    const heightRow = this.createInputRow('Y:', this.roundDisplay(heightDisplay), UnitManager.getLabel());
    heightRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
    this.overlay.appendChild(heightRow.row);

    // Quantity and pallet height inputs for pallets
    let quantityRow = null;
    let palletHeightRow = null;
    if (element.type === 'pallet') {
      quantityRow = this.createInputRow('Qty:', element.quantity, '');
      quantityRow.input.min = 1;
      quantityRow.input.step = 1;
      this.overlay.appendChild(quantityRow.row);

      const phDisplay = UnitManager.toDisplay(element.palletHeight);
      palletHeightRow = this.createInputRow('P.Ht:', this.roundDisplay(phDisplay), UnitManager.getLabel());
      palletHeightRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
      palletHeightRow.input.min = 1;
      this.overlay.appendChild(palletHeightRow.row);
    }

    // Label input for perimeter walls and offices
    let labelRow = null;
    if (element.type === 'perimeterWall' || element.type === 'office') {
      labelRow = this.createTextInputRow('Label:', element.label || '');
      this.overlay.appendChild(labelRow.row);
    }

    // Color picker for offices (Excel-style theme grid)
    let selectedColorIndex = null;
    if (element.type === 'office') {
      selectedColorIndex = element.colorIndex || 0;
      const colorSection = document.createElement('div');
      colorSection.style.cssText = `margin-bottom: 6px;`;

      const colorLabel = document.createElement('div');
      colorLabel.textContent = 'Color:';
      colorLabel.style.cssText = `margin-bottom: 4px;`;
      colorSection.appendChild(colorLabel);

      const cols = Office.GRID_COLS;
      const swatchContainer = document.createElement('div');
      swatchContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(${cols}, 18px);
        gap: 2px;
      `;

      Office.COLORS.forEach((color, idx) => {
        const swatch = document.createElement('div');
        swatch.style.cssText = `
          width: 18px; height: 18px;
          background: ${color.fill};
          border: 2px solid ${idx === selectedColorIndex ? '#333' : color.fill === '#ffffff' ? '#ccc' : 'transparent'};
          border-radius: 2px;
          cursor: pointer;
          box-sizing: border-box;
        `;
        swatch.title = color.name;
        swatch.addEventListener('click', () => {
          selectedColorIndex = idx;
          swatchContainer.querySelectorAll('div').forEach((s, i) => {
            const c = Office.COLORS[i];
            s.style.borderColor = i === idx ? '#333' : (c.fill === '#ffffff' ? '#ccc' : 'transparent');
          });
        });
        swatchContainer.appendChild(swatch);
      });

      colorSection.appendChild(swatchContainer);
      this.overlay.appendChild(colorSection);
    }

    // Drive-through checkbox for offices
    let driveThroughCheckbox = null;
    if (element.type === 'office') {
      const dtRow = document.createElement('div');
      dtRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      `;
      const dtLabel = document.createElement('label');
      dtLabel.style.cssText = `display: flex; align-items: center; gap: 6px; cursor: pointer;`;
      driveThroughCheckbox = document.createElement('input');
      driveThroughCheckbox.type = 'checkbox';
      driveThroughCheckbox.checked = !!element.driveThrough;
      driveThroughCheckbox.style.cssText = `margin: 0;`;
      const dtText = document.createElement('span');
      dtText.textContent = 'Drive-through (no collision)';
      dtLabel.appendChild(driveThroughCheckbox);
      dtLabel.appendChild(dtText);
      dtRow.appendChild(dtLabel);
      this.overlay.appendChild(dtRow);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex;
      gap: 6px;
      margin-top: 10px;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 4px 12px;
      background: #4a90d9;
      color: #fff;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    `;

    const apply = () => {
      // Save old properties for undo before applying changes
      const oldProps = {
        width: element.width,
        height: element.height
      };
      if (element.type === 'pallet') {
        oldProps.quantity = element.quantity;
        oldProps.palletHeight = element.palletHeight;
      }
      if (element.type === 'perimeterWall') oldProps.label = element.label;
      if (element.type === 'office') {
        oldProps.label = element.label;
        oldProps.colorIndex = element.colorIndex;
        oldProps.driveThrough = element.driveThrough;
      }
      UndoManager.pushProps(element, oldProps);

      // Convert display value → inches → pixels (4px per inch)
      const newWidth = UnitManager.fromDisplay(parseFloat(widthRow.input.value)) * 4;
      const newHeight = UnitManager.fromDisplay(parseFloat(heightRow.input.value)) * 4;

      if (!isNaN(newWidth) && newWidth > 0 && !isNaN(newHeight) && newHeight > 0) {
        element.setSize(newWidth, newHeight);
      }

      if (quantityRow && element.type === 'pallet') {
        const qty = parseInt(quantityRow.input.value);
        if (!isNaN(qty) && qty >= 1) {
          element.quantity = qty;
        }
        if (palletHeightRow) {
          const ph = UnitManager.fromDisplay(parseFloat(palletHeightRow.input.value));
          if (!isNaN(ph) && ph > 0) {
            element.palletHeight = ph;
          }
        }
        this.capacityManager.recalculate();
      }

      if (labelRow && element.type === 'perimeterWall') {
        element.label = labelRow.input.value || 'Perimeter';
      }

      if (element.type === 'office') {
        if (labelRow) {
          element.label = labelRow.input.value || 'Office';
        }
        if (selectedColorIndex != null) {
          element.colorIndex = selectedColorIndex;
        }
        if (driveThroughCheckbox) {
          element.driveThrough = driveThroughCheckbox.checked;
        }
      }

      this.close();
    };

    applyBtn.addEventListener('click', apply);
    cancelBtn.addEventListener('click', () => this.close());

    btnRow.appendChild(applyBtn);
    btnRow.appendChild(cancelBtn);
    this.overlay.appendChild(btnRow);

    // Keyboard handling
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      // Stop propagation so arrow keys don't move forklift while editing
      e.stopPropagation();
    });

    document.body.appendChild(this.overlay);

    // Focus first input
    widthRow.input.focus();
    widthRow.input.select();
  }

  /**
   * Build polyline-specific editor (thickness, info, Edit Points button)
   */
  buildPolylineEditor(element) {
    // Thickness input (convert px to inches, then to display unit)
    const thicknessInches = element.thickness / 4;
    const thicknessDisplay = UnitManager.toDisplay(thicknessInches);
    const thicknessRow = this.createInputRow('Thick:', this.roundDisplay(thicknessDisplay), UnitManager.getLabel());
    thicknessRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
    thicknessRow.input.min = 1;
    this.overlay.appendChild(thicknessRow.row);

    // Segment count (read-only)
    const segCount = Math.max(0, element.points.length - 1);
    const segRow = this.createReadOnlyRow('Segments:', `${segCount}`);
    this.overlay.appendChild(segRow);

    // Total length (read-only)
    const totalLengthInches = element.getTotalLength() / 4;
    const lengthDisplay = UnitManager.formatValue(totalLengthInches) + ' ' + UnitManager.getLabel();
    const lenRow = this.createReadOnlyRow('Length:', lengthDisplay);
    this.overlay.appendChild(lenRow);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 6px; margin-top: 10px;`;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 4px 12px; background: #4a90d9; color: #fff;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-family: inherit;
    `;

    const editPtsBtn = document.createElement('button');
    editPtsBtn.textContent = 'Edit Points';
    editPtsBtn.style.cssText = `
      padding: 4px 12px; background: #e8a735; color: #fff;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-family: inherit;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 4px 12px; background: #f5f5f5; color: #333;
      border: 1px solid #ccc; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-family: inherit;
    `;

    const apply = () => {
      const oldProps = { thickness: element.thickness };
      UndoManager.pushProps(element, oldProps);

      const newThickness = UnitManager.fromDisplay(parseFloat(thicknessRow.input.value)) * 4;
      if (!isNaN(newThickness) && newThickness > 0) {
        element.thickness = newThickness;
        element.updateBounds();
      }
      this.close();
    };

    applyBtn.addEventListener('click', apply);
    cancelBtn.addEventListener('click', () => this.close());
    editPtsBtn.addEventListener('click', () => {
      this.close();
      if (this.onEditPoints) {
        this.onEditPoints(element);
      }
    });

    btnRow.appendChild(applyBtn);
    btnRow.appendChild(editPtsBtn);
    btnRow.appendChild(cancelBtn);
    this.overlay.appendChild(btnRow);

    // Keyboard handling
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      e.stopPropagation();
    });

    document.body.appendChild(this.overlay);
    thicknessRow.input.focus();
    thicknessRow.input.select();
  }

  /**
   * Build text box editor (text, font size, color, width, height)
   */
  buildTextBoxEditor(element) {
    // Text input
    const textRow = this.createTextInputRow('Text:', element.text || '');
    this.overlay.appendChild(textRow.row);

    // Font size input (world pixels)
    const fontSizeRow = this.createInputRow('Size:', element.fontSize, 'pt');
    fontSizeRow.input.min = 4;
    fontSizeRow.input.step = 1;
    this.overlay.appendChild(fontSizeRow.row);

    // Color picker
    const colorRow = document.createElement('div');
    colorRow.style.cssText = `display: flex; align-items: center; gap: 6px; margin-bottom: 6px;`;
    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'Color:';
    colorLabel.style.cssText = `width: 45px;`;
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = element.textColor || '#333333';
    colorInput.style.cssText = `width: 40px; height: 28px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;`;
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorInput);
    this.overlay.appendChild(colorRow);

    // Width input
    const widthInches = element.width / 4;
    const widthDisplay = UnitManager.toDisplay(widthInches);
    const widthRow = this.createInputRow('X:', this.roundDisplay(widthDisplay), UnitManager.getLabel());
    widthRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
    this.overlay.appendChild(widthRow.row);

    // Height input
    const heightInches = element.height / 4;
    const heightDisplay = UnitManager.toDisplay(heightInches);
    const heightRow = this.createInputRow('Y:', this.roundDisplay(heightDisplay), UnitManager.getLabel());
    heightRow.input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
    this.overlay.appendChild(heightRow.row);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 6px; margin-top: 10px;`;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 4px 12px; background: #4a90d9; color: #fff;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-family: inherit;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 4px 12px; background: #f5f5f5; color: #333;
      border: 1px solid #ccc; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-family: inherit;
    `;

    const apply = () => {
      const oldProps = {
        text: element.text,
        fontSize: element.fontSize,
        textColor: element.textColor,
        width: element.width,
        height: element.height
      };
      UndoManager.pushProps(element, oldProps);

      element.text = textRow.input.value || 'Label';

      const newFontSize = parseFloat(fontSizeRow.input.value);
      if (!isNaN(newFontSize) && newFontSize >= 4) {
        element.fontSize = newFontSize;
      }

      element.textColor = colorInput.value;

      const newWidth = UnitManager.fromDisplay(parseFloat(widthRow.input.value)) * 4;
      const newHeight = UnitManager.fromDisplay(parseFloat(heightRow.input.value)) * 4;
      if (!isNaN(newWidth) && newWidth > 0 && !isNaN(newHeight) && newHeight > 0) {
        element.setSize(newWidth, newHeight);
      }

      this.close();
    };

    applyBtn.addEventListener('click', apply);
    cancelBtn.addEventListener('click', () => this.close());

    btnRow.appendChild(applyBtn);
    btnRow.appendChild(cancelBtn);
    this.overlay.appendChild(btnRow);

    // Keyboard handling
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      e.stopPropagation();
    });

    document.body.appendChild(this.overlay);
    textRow.input.focus();
    textRow.input.select();
  }

  /**
   * Create a read-only info row
   */
  createReadOnlyRow(label, value) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    `;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `width: 65px; color: #666;`;
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    valueSpan.style.cssText = `font-weight: 600;`;
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    return row;
  }

  /**
   * Create a labeled number input row
   */
  createInputRow(label, defaultValue, unit) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    `;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `width: 45px;`;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = defaultValue;
    input.min = 1;
    input.step = 1;
    input.style.cssText = `
      width: 60px;
      padding: 4px 6px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
    `;

    const unitSpan = document.createElement('span');
    unitSpan.textContent = unit;

    row.appendChild(labelSpan);
    row.appendChild(input);
    if (unit) row.appendChild(unitSpan);

    return { row, input };
  }

  /**
   * Create a labeled text input row
   */
  createTextInputRow(label, defaultValue) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    `;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `width: 45px;`;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText = `
      width: 100px;
      padding: 4px 6px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      color: #333;
    `;

    row.appendChild(labelSpan);
    row.appendChild(input);

    return { row, input };
  }

  /**
   * Round display value: 1 decimal for feet, whole number for inches
   */
  roundDisplay(val) {
    if (UnitManager.mode === 'feet') {
      return parseFloat(val.toFixed(1));
    }
    return Math.round(val);
  }

  /**
   * Close the editor overlay
   */
  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
