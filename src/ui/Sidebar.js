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
import { Rack } from '../shapes/Rack.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';

const PALETTE = [
  { type: 'wall', label: 'Wall', desc: '1ft x 10ft', icon: '|' },
  { type: 'office', label: 'Office', desc: '10ft x 10ft', icon: '#' },
  { type: 'rack', label: 'Rack', desc: '4ft x 1ft', icon: '=' },
  { type: 'pallet', label: 'Pallet', desc: '48" x 40"', icon: 'P' },
  { type: 'forklift', label: 'Forklift', desc: '2ft x 1ft', icon: 'FK' }
];

export class Sidebar {
  constructor(sidebarElement, coordinateConverter, elementManager, grid) {
    this.sidebarElement = sidebarElement;
    this.coordinateConverter = coordinateConverter;
    this.elementManager = elementManager;
    this.grid = grid;
    this.canvas = null;

    this.createPalette();
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

    return itemDiv;
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
      }
    });
  }

  /**
   * Factory method to create element instances
   */
  createElement(type, x, y) {
    switch (type) {
      case 'wall':
        return new Wall(x, y);
      case 'office':
        return new Office(x, y);
      case 'rack':
        return new Rack(x, y);
      case 'pallet':
        return new Pallet(x, y);
      case 'forklift':
        return new Forklift(x, y);
      default:
        console.error('Unknown element type:', type);
        return null;
    }
  }
}
