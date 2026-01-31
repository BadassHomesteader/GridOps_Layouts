/**
 * Sidebar - Element palette with drag-to-canvas placement
 *
 * Provides:
 * - Visual palette of all element types
 * - Drag-and-drop to canvas
 * - Grid-snapped element creation
 * - Element factory for instantiation
 */
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';
import { PolylineWall } from '../shapes/PolylineWall.js';
import { TextBox } from '../shapes/TextBox.js';
import { UnitManager } from '../managers/UnitManager.js';
import { UndoManager } from '../managers/UndoManager.js';
import { AlignmentManager } from '../managers/AlignmentManager.js';

const PALETTE = [
  { type: 'wall', label: 'Wall', desc: '1ft x 10ft', icon: '|' },
  { type: 'perimeterWall', label: 'Perimeter', desc: '10ft x 10ft', icon: '[]' },
  { type: 'office', label: 'Office', desc: '10ft x 10ft', icon: '#' },
  { type: 'pallet', label: 'Pallet', desc: '48" x 40"', icon: 'P' },
  { type: 'forklift', label: 'Forklift', desc: '2ft x 1ft', icon: 'FK' },
  { type: 'polylineWall', label: 'Poly Wall', desc: 'Freeform', icon: '\u2571' },
  { type: 'textBox', label: 'Text', desc: 'Label', icon: 'T' }
];

export class Sidebar {
  constructor(sidebarElement, coordinateConverter, elementManager, grid, capacityManager) {
    this.sidebarElement = sidebarElement;
    this.coordinateConverter = coordinateConverter;
    this.elementManager = elementManager;
    this.grid = grid;
    this.capacityManager = capacityManager;
    this.canvas = null;
    this.defaultSizeOverlay = null;

    // Default sizes in pixels for each element type (pallet uses capacityManager instead)
    this.defaultSizes = {
      wall:          { width: 48,  height: 480 },  // 1ft x 10ft
      perimeterWall: { width: 480, height: 480 },  // 10ft x 10ft
      office:        { width: 480, height: 480 },  // 10ft x 10ft
      forklift:      { width: 96,  height: 48 },   // 2ft x 1ft
      polylineWall:  { width: 480, height: 240 },  // 10ft x 5ft L-shape
      textBox:       { width: 480, height: 96 },   // 10ft x 2ft
    };

    this.fileManager = null;
    this.paletteDescElements = {}; // type -> desc DOM element for updating text
    this.createPalette();

    // Set initial descriptions using UnitManager (overwrite static PALETTE.desc)
    this.refreshAllDescriptions();

    // Refresh palette descriptions when unit mode changes
    UnitManager.onChange(() => this.refreshAllDescriptions());
  }

  /**
   * Refresh all palette item descriptions for current unit mode
   */
  refreshAllDescriptions() {
    for (const item of PALETTE) {
      if (item.type === 'polylineWall' || item.type === 'textBox') {
        // Polyline wall and text box show static descriptions
        continue;
      } else if (item.type === 'pallet') {
        const pw = this.capacityManager.getPalletWidth();
        const ph = this.capacityManager.getPalletHeight();
        this.updatePaletteDesc(item.type, pw, ph);
      } else {
        const ds = this.defaultSizes[item.type];
        if (ds) {
          this.updatePaletteDesc(item.type, ds.width / 4, ds.height / 4);
        }
      }
    }
  }

  /**
   * Set file manager for save/open buttons
   */
  setFileManager(fileManager) {
    this.fileManager = fileManager;
    this.printManager = null;
    this.createFileButtons();
    this.createShortcutsLegend();
  }

  /**
   * Set print manager for print button
   */
  setPrintManager(printManager) {
    this.printManager = printManager;
  }

  /**
   * Set selection manager for alignment buttons
   */
  setSelectionManager(selectionManager) {
    this.alignmentManager = new AlignmentManager(selectionManager);
    this.createAlignmentButtons();
  }

  /**
   * Create save/open/print buttons at top of sidebar
   */
  createFileButtons() {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 12px 8px;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 8px;
    `;

    const btnStyle = `
      flex: 1;
      padding: 8px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.2s;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = btnStyle + 'background: #4a90d9; color: #fff; border-color: #3670a9;';
    saveBtn.addEventListener('click', () => this.fileManager.save());
    saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#3670a9'; });
    saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = '#4a90d9'; });

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Open';
    openBtn.style.cssText = btnStyle + 'background: #f5f5f5; color: #333;';
    openBtn.addEventListener('click', () => this.fileManager.open());
    openBtn.addEventListener('mouseenter', () => { openBtn.style.background = '#e8e8e8'; });
    openBtn.addEventListener('mouseleave', () => { openBtn.style.background = '#f5f5f5'; });

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.style.cssText = btnStyle + 'background: #f5f5f5; color: #333;';
    printBtn.addEventListener('click', () => {
      if (this.printManager) this.printManager.print();
    });
    printBtn.addEventListener('mouseenter', () => { printBtn.style.background = '#e8e8e8'; });
    printBtn.addEventListener('mouseleave', () => { printBtn.style.background = '#f5f5f5'; });

    // Undo/Redo buttons (Excel-style small arrows)
    const undoBtn = document.createElement('button');
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7a3 3 0 0 1 0 6H9"/><polyline points="6 4 3 7 6 10"/></svg>`;
    undoBtn.style.cssText = `
      width: 30px; height: 30px; border: 1px solid #ccc; border-radius: 4px;
      cursor: pointer; font-size: 12px; font-family: inherit;
      background: #f5f5f5; color: #555; display: flex; align-items: center;
      justify-content: center; padding: 0; transition: all 0.15s;
    `;
    undoBtn.disabled = !UndoManager.canUndo();
    undoBtn.addEventListener('click', () => UndoManager.undo());

    const redoBtn = document.createElement('button');
    redoBtn.title = 'Redo (Ctrl+Shift+Z)';
    redoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7H6a3 3 0 0 0 0 6h1"/><polyline points="10 4 13 7 10 10"/></svg>`;
    redoBtn.style.cssText = undoBtn.style.cssText;
    redoBtn.disabled = !UndoManager.canRedo();
    redoBtn.addEventListener('click', () => UndoManager.redo());

    const updateUndoRedoState = () => {
      undoBtn.disabled = !UndoManager.canUndo();
      redoBtn.disabled = !UndoManager.canRedo();
      undoBtn.style.opacity = undoBtn.disabled ? '0.35' : '1';
      redoBtn.style.opacity = redoBtn.disabled ? '0.35' : '1';
      undoBtn.style.cursor = undoBtn.disabled ? 'default' : 'pointer';
      redoBtn.style.cursor = redoBtn.disabled ? 'default' : 'pointer';
    };
    updateUndoRedoState();
    UndoManager.onChange(updateUndoRedoState);

    for (const btn of [undoBtn, redoBtn]) {
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) { btn.style.background = '#e0e0e0'; btn.style.borderColor = '#999'; }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f5f5f5'; btn.style.borderColor = '#ccc';
      });
    }

    container.appendChild(saveBtn);
    container.appendChild(openBtn);
    container.appendChild(printBtn);

    // Separator + undo/redo group
    const separator = document.createElement('div');
    separator.style.cssText = `width: 1px; background: #ddd; align-self: stretch; margin: 4px 0;`;
    container.appendChild(separator);
    container.appendChild(undoBtn);
    container.appendChild(redoBtn);

    // Insert at very top of sidebar
    this.sidebarElement.insertBefore(container, this.sidebarElement.firstChild);
  }

  /**
   * Create alignment and distribution buttons
   */
  createAlignmentButtons() {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 8px;
      border-bottom: 1px solid #ddd;
    `;

    const header = document.createElement('div');
    header.textContent = 'Align';
    header.style.cssText = `
      font-weight: 600;
      font-size: 12px;
      color: #333;
      margin-bottom: 6px;
      padding: 0 4px;
    `;
    container.appendChild(header);

    const btnStyle = `
      width: 32px;
      height: 28px;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
      background: #f5f5f5;
      color: #555;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
    `;

    const makeBtn = (title, svg, action) => {
      const btn = document.createElement('button');
      btn.title = title;
      btn.innerHTML = svg;
      btn.style.cssText = btnStyle;
      btn.addEventListener('click', action);
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e0e0e0';
        btn.style.borderColor = '#999';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f5f5f5';
        btn.style.borderColor = '#ccc';
      });
      return btn;
    };

    // SVG icons (16x16 viewBox)
    const svgWrap = (paths) => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${paths}</svg>`;

    const alignRow = document.createElement('div');
    alignRow.style.cssText = `display: flex; gap: 4px; margin-bottom: 4px;`;

    // Align Left: vertical line on left, rects flush to it
    alignRow.appendChild(makeBtn('Align Left',
      svgWrap('<line x1="2" y1="1" x2="2" y2="15"/><rect x="2" y="3" width="10" height="3" fill="currentColor" stroke="none"/><rect x="2" y="9" width="7" height="3" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.alignLeft()
    ));

    // Align Right: vertical line on right, rects flush to it
    alignRow.appendChild(makeBtn('Align Right',
      svgWrap('<line x1="14" y1="1" x2="14" y2="15"/><rect x="4" y="3" width="10" height="3" fill="currentColor" stroke="none"/><rect x="7" y="9" width="7" height="3" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.alignRight()
    ));

    // Align Top: horizontal line on top, rects flush to it
    alignRow.appendChild(makeBtn('Align Top',
      svgWrap('<line x1="1" y1="2" x2="15" y2="2"/><rect x="3" y="2" width="3" height="10" fill="currentColor" stroke="none"/><rect x="9" y="2" width="3" height="7" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.alignTop()
    ));

    // Align Bottom: horizontal line on bottom, rects flush to it
    alignRow.appendChild(makeBtn('Align Bottom',
      svgWrap('<line x1="1" y1="14" x2="15" y2="14"/><rect x="3" y="4" width="3" height="10" fill="currentColor" stroke="none"/><rect x="9" y="7" width="3" height="7" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.alignBottom()
    ));

    container.appendChild(alignRow);

    const distRow = document.createElement('div');
    distRow.style.cssText = `display: flex; gap: 4px;`;

    // Distribute Horizontal: three rects spread horizontally
    distRow.appendChild(makeBtn('Distribute Horizontal',
      svgWrap('<rect x="1" y="4" width="3" height="8" fill="currentColor" stroke="none"/><rect x="6.5" y="4" width="3" height="8" fill="currentColor" stroke="none"/><rect x="12" y="4" width="3" height="8" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.distributeHorizontal()
    ));

    // Distribute Vertical: three rects spread vertically
    distRow.appendChild(makeBtn('Distribute Vertical',
      svgWrap('<rect x="4" y="1" width="8" height="3" fill="currentColor" stroke="none"/><rect x="4" y="6.5" width="8" height="3" fill="currentColor" stroke="none"/><rect x="4" y="12" width="8" height="3" fill="currentColor" stroke="none"/>'),
      () => this.alignmentManager.distributeVertical()
    ));

    container.appendChild(distRow);

    // Insert after file buttons (second child, after capacity display and file buttons)
    const fileSection = this.sidebarElement.querySelector('div');
    if (fileSection && fileSection.nextSibling) {
      this.sidebarElement.insertBefore(container, fileSection.nextSibling);
    } else {
      this.sidebarElement.appendChild(container);
    }
  }

  /**
   * Create palette UI in sidebar
   */
  createPalette() {
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Elements';
    title.style.cssText = `
      margin: 0;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      border-bottom: 1px solid #ddd;
    `;
    this.sidebarElement.appendChild(title);

    // Palette items container
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 8px;
    `;

    // Create each palette item
    PALETTE.forEach(item => {
      const itemDiv = this.createPaletteItem(item);
      container.appendChild(itemDiv);
    });

    this.sidebarElement.appendChild(container);
  }

  /**
   * Create individual palette item
   */
  createPaletteItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.draggable = true;
    itemDiv.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: grab;
      user-select: none;
      transition: all 0.2s;
    `;

    // Icon
    const icon = document.createElement('div');
    icon.textContent = item.icon;
    icon.style.cssText = `
      display: inline-block;
      width: 24px;
      text-align: center;
      font-weight: bold;
      margin-right: 8px;
      color: #666;
    `;

    // Content container
    const content = document.createElement('div');
    content.style.cssText = `
      display: inline-block;
      vertical-align: top;
    `;

    // Label
    const label = document.createElement('div');
    label.textContent = item.label;
    label.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: #333;
      margin-bottom: 2px;
    `;

    // Description
    const desc = document.createElement('div');
    desc.textContent = item.desc;
    desc.style.cssText = `
      font-size: 11px;
      color: #666;
    `;

    content.appendChild(label);
    content.appendChild(desc);
    itemDiv.appendChild(icon);
    itemDiv.appendChild(content);

    // Store desc element reference for updating
    this.paletteDescElements[item.type] = desc;

    // Hover effects
    itemDiv.addEventListener('mouseenter', () => {
      itemDiv.style.background = '#f9f9f9';
      itemDiv.style.borderColor = '#999';
    });

    itemDiv.addEventListener('mouseleave', () => {
      itemDiv.style.background = '#ffffff';
      itemDiv.style.borderColor = '#ccc';
    });

    // Drag start
    itemDiv.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('application/json', JSON.stringify({ type: item.type }));
      event.dataTransfer.effectAllowed = 'copy';
      itemDiv.style.opacity = '0.5';
    });

    // Drag end
    itemDiv.addEventListener('dragend', () => {
      itemDiv.style.opacity = '1';
    });

    // Double-click to edit default size
    itemDiv.addEventListener('dblclick', (event) => {
      event.preventDefault();
      this.showDefaultSizeEditor(item, event.clientX, event.clientY);
    });

    return itemDiv;
  }

  /**
   * Show floating popup to edit default size for an element type
   */
  showDefaultSizeEditor(item, screenX, screenY) {
    // Close any existing overlay
    if (this.defaultSizeOverlay) {
      this.defaultSizeOverlay.remove();
      this.defaultSizeOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
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

    const title = document.createElement('div');
    title.textContent = `Default ${item.label} Size`;
    title.style.cssText = `font-weight: 600; font-size: 13px; margin-bottom: 10px;`;
    overlay.appendChild(title);

    const createRow = (label, value, unit) => {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; align-items: center; gap: 6px; margin-bottom: 6px;`;
      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.cssText = `width: 45px;`;
      const input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      input.min = 0.1;
      input.step = UnitManager.mode === 'feet' ? 0.1 : 1;
      input.style.cssText = `
        width: 60px; padding: 4px 6px; border: 1px solid #ccc;
        border-radius: 3px; font-family: inherit; font-size: 12px; color: #333;
      `;
      const unitSpan = document.createElement('span');
      unitSpan.textContent = unit;
      row.appendChild(lbl);
      row.appendChild(input);
      row.appendChild(unitSpan);
      return { row, input };
    };

    const roundDisplay = (val) => {
      if (UnitManager.mode === 'feet') return parseFloat(val.toFixed(1));
      return Math.round(val);
    };

    let widthRow, heightRow, palletHeightRow;

    const unit = UnitManager.getLabel();
    if (item.type === 'pallet') {
      // Pallet uses inches via capacityManager
      const pw = this.capacityManager.getPalletWidth();
      const ph = this.capacityManager.getPalletHeight();
      widthRow = createRow('Width:', roundDisplay(UnitManager.toDisplay(pw)), unit);
      heightRow = createRow('Height:', roundDisplay(UnitManager.toDisplay(ph)), unit);
      palletHeightRow = createRow('P.Ht:', roundDisplay(UnitManager.toDisplay(Pallet.defaultPalletHeight)), unit);
    } else {
      // Other types: convert px to inches (px / 4), then to display unit
      const defaults = this.defaultSizes[item.type];
      widthRow = createRow('Width:', roundDisplay(UnitManager.toDisplay(defaults.width / 4)), unit);
      heightRow = createRow('Height:', roundDisplay(UnitManager.toDisplay(defaults.height / 4)), unit);
    }

    overlay.appendChild(widthRow.row);
    overlay.appendChild(heightRow.row);
    if (palletHeightRow) overlay.appendChild(palletHeightRow.row);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 6px; margin-top: 10px;`;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 4px 12px; background: #4a90d9; color: #fff; border: none;
      border-radius: 3px; cursor: pointer; font-size: 12px; font-family: inherit;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 4px 12px; background: #f5f5f5; color: #333; border: 1px solid #ccc;
      border-radius: 3px; cursor: pointer; font-size: 12px; font-family: inherit;
    `;

    const apply = () => {
      const wDisplay = parseFloat(widthRow.input.value);
      const hDisplay = parseFloat(heightRow.input.value);
      if (isNaN(wDisplay) || wDisplay < 0.1 || isNaN(hDisplay) || hDisplay < 0.1) return;

      // Convert display value back to inches
      const wInches = Math.round(UnitManager.fromDisplay(wDisplay));
      const hInches = Math.round(UnitManager.fromDisplay(hDisplay));

      if (item.type === 'pallet') {
        this.capacityManager.setPalletDimensions(wInches, hInches);
        if (palletHeightRow) {
          const phDisplay = parseFloat(palletHeightRow.input.value);
          if (!isNaN(phDisplay) && phDisplay > 0) {
            Pallet.defaultPalletHeight = Math.round(UnitManager.fromDisplay(phDisplay));
          }
        }
      } else {
        // Store in pixels (inches * 4)
        this.defaultSizes[item.type] = { width: wInches * 4, height: hInches * 4 };
      }

      // Update palette item description text
      this.updatePaletteDesc(item.type, wInches, hInches);

      close();
    };

    const close = () => {
      overlay.remove();
      this.defaultSizeOverlay = null;
    };

    applyBtn.addEventListener('click', apply);
    cancelBtn.addEventListener('click', close);

    btnRow.appendChild(applyBtn);
    btnRow.appendChild(cancelBtn);
    overlay.appendChild(btnRow);

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      e.stopPropagation();
    });

    document.body.appendChild(overlay);
    this.defaultSizeOverlay = overlay;

    widthRow.input.focus();
    widthRow.input.select();
  }

  /**
   * Update palette item description with new dimensions (in inches)
   */
  updatePaletteDesc(type, widthInches, heightInches) {
    const descEl = this.paletteDescElements[type];
    if (!descEl) return;

    const wLabel = UnitManager.formatValue(widthInches);
    const hLabel = UnitManager.formatValue(heightInches);
    const unit = UnitManager.getLabel();
    descEl.textContent = `${wLabel} x ${hLabel} ${unit}`;
  }

  /**
   * Create keyboard shortcuts legend
   */
  createShortcutsLegend() {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 8px 12px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #666;
    `;

    const header = document.createElement('div');
    header.textContent = 'Shortcuts';
    header.style.cssText = `
      font-weight: 600;
      font-size: 12px;
      color: #333;
      margin-bottom: 6px;
      cursor: pointer;
      user-select: none;
    `;

    const list = document.createElement('div');
    list.style.cssText = `line-height: 1.6;`;

    const shortcuts = [
      ['Space + Drag', 'Pan canvas'],
      ['Two-finger drag', 'Pan (trackpad)'],
      ['Pinch', 'Zoom (trackpad)'],
      ['Scroll wheel', 'Zoom in/out'],
      ['Click', 'Select element'],
      ['Shift + Click', 'Toggle select'],
      ['Drag (empty)', 'Box select'],
      ['Double-click', 'Edit dimensions'],
      ['Shift + Drag', 'Free-form move'],
      ['Del / Backspace', 'Delete selected'],
      ['Escape', 'Clear selection'],
      ['\u2318Z', 'Undo'],
      ['\u2318\u21e7Z / \u2318Y', 'Redo'],
      ['\u2318C / \u2318V', 'Copy / Paste'],
      ['Arrow keys', 'Nudge selected'],
      ['Shift + Arrow', 'Nudge 1 inch'],
      ['Arrow (forklift)', 'Drive forklift'],
      ['R', 'Rotate forklift'],
    ];

    for (const [key, action] of shortcuts) {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; justify-content: space-between; gap: 4px;`;
      const keySpan = document.createElement('span');
      keySpan.textContent = key;
      keySpan.style.cssText = `font-weight: 500; color: #444; white-space: nowrap;`;
      const actionSpan = document.createElement('span');
      actionSpan.textContent = action;
      actionSpan.style.cssText = `text-align: right; color: #888;`;
      row.appendChild(keySpan);
      row.appendChild(actionSpan);
      list.appendChild(row);
    }

    container.appendChild(header);
    container.appendChild(list);
    this.sidebarElement.appendChild(container);
  }

  /**
   * Setup canvas drop handling
   */
  setupCanvasDrop(canvas) {
    this.canvas = canvas;

    // Allow drop on canvas
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    // Handle drop
    canvas.addEventListener('drop', (event) => {
      event.preventDefault();

      // Get element type from drag data
      const data = JSON.parse(event.dataTransfer.getData('application/json'));
      if (!data || !data.type) return;

      // Convert drop position to canvas coordinates
      const canvasRect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      // Convert to world coordinates
      const world = this.coordinateConverter.screenToWorld(canvasX, canvasY);

      // Snap to grid (unless Shift is held)
      let x = world.x;
      let y = world.y;
      if (!event.shiftKey) {
        const snapped = this.grid.snapToGrid(world.x, world.y);
        x = snapped.x;
        y = snapped.y;
      }

      // Create element at drop position
      const element = this.createElement(data.type, x, y);
      if (element) {
        this.elementManager.add(element);
        UndoManager.pushAdd(element);
      }
    });
  }

  /**
   * Factory method to create element instances
   */
  createElement(type, x, y) {
    const ds = this.defaultSizes[type];
    switch (type) {
      case 'wall':
        return new Wall(x, y, ds.width, ds.height);
      case 'office':
        return new Office(x, y, ds.width, ds.height);
      case 'pallet': {
        const pw = this.capacityManager ? this.capacityManager.getPalletWidth() : 48;
        const ph = this.capacityManager ? this.capacityManager.getPalletHeight() : 40;
        return new Pallet(x, y, pw * 4, ph * 4, Pallet.defaultPalletHeight);
      }
      case 'perimeterWall':
        return new PerimeterWall(x, y, ds.width, ds.height);
      case 'forklift':
        return new Forklift(x, y, ds.width, ds.height);
      case 'polylineWall': {
        // Default L-shape: 10ft right, then 5ft down
        const points = [
          { x, y },
          { x: x + ds.width, y },
          { x: x + ds.width, y: y + ds.height }
        ];
        return new PolylineWall(points);
      }
      case 'textBox':
        return new TextBox(x, y, ds.width, ds.height);
      default:
        console.error('Unknown element type:', type);
        return null;
    }
  }
}
