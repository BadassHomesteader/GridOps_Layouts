/**
 * FileManager - Save/open warehouse layouts (cloud + local file)
 *
 * Provides:
 * - Cloud save/load via API (shared projects)
 * - Local file export/import (backward compatible)
 * - Serializes/deserializes all elements with type-specific properties
 */
import { UndoManager } from './UndoManager.js';
import { Wall } from '../shapes/Wall.js';
import { Office } from '../shapes/Office.js';
import { Pallet } from '../shapes/Pallet.js';
import { Forklift } from '../shapes/Forklift.js';
import { PerimeterWall } from '../shapes/PerimeterWall.js';
import { PolylineWall } from '../shapes/PolylineWall.js';
import { TextBox } from '../shapes/TextBox.js';
import { apiGet, apiPost, apiPut } from '../auth/api-client.js';

export class FileManager {
  constructor(elementManager, capacityManager, selectionManager, capacityDisplay) {
    this.elementManager = elementManager;
    this.capacityManager = capacityManager;
    this.selectionManager = selectionManager;
    this.capacityDisplay = capacityDisplay;
    this.onLoad = null; // callback after file load (e.g. zoom-to-fit)

    // Cloud project state
    this.currentProjectId = null;
    this.currentProjectName = null;
    this.currentProjectCanEdit = true;
  }

  /**
   * Serialize current layout to JSON string
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
      case 'polylineWall':
        element = new PolylineWall(data.points || []);
        if (data.thickness) element.thickness = data.thickness;
        break;
      case 'textBox':
        element = new TextBox(data.x, data.y, data.width, data.height, data.text);
        if (data.fontSize) element.fontSize = data.fontSize;
        if (data.textColor) element.textColor = data.textColor;
        break;
      default:
        console.error('Unknown element type in file:', data.type);
        return null;
    }
    return element;
  }

  // --- Cloud Methods ---

  /**
   * Save current layout to cloud project.
   * If no current project, prompts to create one.
   */
  async save() {
    if (this.currentProjectId) {
      await this.saveToCloud(this.currentProjectId);
    } else {
      // No cloud project loaded — export locally
      await this.exportLocal();
    }
  }

  /**
   * Save layout to an existing cloud project
   */
  async saveToCloud(projectId) {
    try {
      const layout = JSON.parse(this.serialize());
      await apiPut(`/projects/${projectId}`, {
        name: this.currentProjectName,
        layout
      });
      console.log('[FileManager] Saved to cloud:', projectId);
    } catch (err) {
      console.error('[FileManager] Cloud save failed:', err);
      alert('Failed to save: ' + err.message);
    }
  }

  /**
   * Open project browser (called by Sidebar "Open" button)
   * The ProjectBrowser handles the rest.
   */
  open() {
    if (this._projectBrowser) {
      this._projectBrowser.show();
    } else {
      // Fallback: local import if ProjectBrowser not set
      this.importLocal();
    }
  }

  /**
   * Set the ProjectBrowser reference
   */
  setProjectBrowser(browser) {
    this._projectBrowser = browser;
  }

  // --- Local File Methods (backward compatible) ---

  /**
   * Export layout to local .json file
   */
  async exportLocal() {
    const json = this.serialize();

    // Try File System Access API first (Chrome/Edge)
    if (window.showSaveFilePicker) {
      try {
        const suggestedName = this.currentProjectName
          ? `${this.currentProjectName.replace(/[^a-z0-9]/gi, '-')}.json`
          : 'warehouse-layout.json';
        const handle = await window.showSaveFilePicker({
          suggestedName,
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
        if (err.name === 'AbortError') return;
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
   * Import layout from local .json file
   */
  async importLocal() {
    // Clear cloud project state when importing locally
    this.currentProjectId = null;
    this.currentProjectName = null;

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
        if (err.name === 'AbortError') return;
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
