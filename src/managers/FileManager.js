/**
 * FileManager - Local file save/open for warehouse layouts
 *
 * Provides:
 * - Save layout to local .json file
 * - Open layout from local .json file
 * - Serializes/deserializes all elements with type-specific properties
 */
import { UndoManager } from './UndoManager.js';
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';

export class FileManager {
  constructor(elementManager, capacityManager, selectionManager, capacityDisplay) {
    this.elementManager = elementManager;
    this.capacityManager = capacityManager;
    this.selectionManager = selectionManager;
    this.capacityDisplay = capacityDisplay;
    this.onLoad = null; // callback after file load (e.g. zoom-to-fit)
  }

  /**
   * Serialize current layout to JSON
   */
  serialize() {
    const elements = this.elementManager.getAll().map(el => el.toJSON());
    return JSON.stringify({
      version: 1,
      propertyAddress: this.capacityManager.propertyAddress || '',
      ceilingHeight: this.capacityManager.ceilingHeight || 0,
      palletConfig: {
        width: this.capacityManager.getPalletWidth(),
        height: this.capacityManager.getPalletHeight()
      },
      inventoryPerPallet: this.capacityManager.inventoryPerPallet || 0,
      elements
    }, null, 2);
  }

  /**
   * Deserialize layout from JSON and load into canvas
   */
  deserialize(json) {
    const data = JSON.parse(json);

    // Clear existing (including undo history)
    this.selectionManager.clearSelection();
    this.elementManager.clear();
    UndoManager.clear();

    // Restore property address
    if (data.propertyAddress) {
      this.capacityManager.propertyAddress = data.propertyAddress;
      if (this.capacityDisplay) {
        this.capacityDisplay.setAddress(data.propertyAddress);
      }
    }

    // Restore ceiling height
    if (data.ceilingHeight != null) {
      this.capacityManager.ceilingHeight = data.ceilingHeight;
      Pallet.ceilingHeight = data.ceilingHeight;
      if (this.capacityDisplay) {
        this.capacityDisplay.setCeilingHeight(data.ceilingHeight);
      }
    }

    // Restore pallet config
    if (data.palletConfig) {
      this.capacityManager.setPalletDimensions(
        data.palletConfig.width,
        data.palletConfig.height
      );
    }

    // Restore inventory per pallet
    if (data.inventoryPerPallet != null) {
      this.capacityManager.inventoryPerPallet = data.inventoryPerPallet;
      if (this.capacityDisplay) {
        this.capacityDisplay.setInventoryPerPallet(data.inventoryPerPallet);
      }
    }

    // Recreate elements
    for (const elData of data.elements) {
      const element = this.createElement(elData);
      if (element) {
        this.elementManager.add(element);
      }
    }

    // Trigger post-load callback (e.g. zoom-to-fit)
    if (this.onLoad) this.onLoad();
  }

  /**
   * Create element from serialized data
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
        console.error('Unknown element type in file:', data.type);
        return null;
    }
    return element;
  }

  /**
   * Save layout to local file
   */
  async save() {
    const json = this.serialize();

    // Try File System Access API first (Chrome/Edge)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'warehouse-layout.json',
          types: [{
            description: 'GridOps Layout',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
      }
    }

    // Fallback: download via anchor
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warehouse-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open layout from local file
   */
  async open() {
    // Try File System Access API first
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'GridOps Layout',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const file = await handle.getFile();
        const json = await file.text();
        this.deserialize(json);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
      }
    }

    // Fallback: file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const json = await file.text();
      this.deserialize(json);
    });
    input.click();
  }
}
