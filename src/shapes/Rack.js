/**
 * Rack - Pallet storage rack with configurable capacity
 *
 * Default: 192x48 (4ft x 1ft)
 * Default capacity: 3 levels × 2 pallets/level = 6 pallets total
 * Color: Blue (#4a90d9)
 * Purpose: Primary pallet storage, capacity calculation
 */
import { Element } from './Element.js';

export class Rack extends Element {
  constructor(x = 0, y = 0, width = 192, height = 48, levels = 3, palletsPerLevel = 2) {
    super(x, y, width, height, 'rack');
    this.levels = levels;
    this.palletsPerLevel = palletsPerLevel;
  }

  /**
   * Computed: total pallet capacity
   */
  get totalCapacity() {
    return this.levels * this.palletsPerLevel;
  }

  /**
   * Draw rack element with capacity label
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Rack colors (blue)
    ctx.fillStyle = this.selected ? '#3670a9' : '#4a90d9';
    ctx.strokeStyle = this.selected ? '#1c3f6a' : '#2c5f8a';
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw capacity label centered
    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Rack ${this.levels}x${this.palletsPerLevel}=${this.totalCapacity}`,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Serialize rack with capacity properties
   */
  toJSON() {
    return {
      ...super.toJSON(),
      levels: this.levels,
      palletsPerLevel: this.palletsPerLevel
    };
  }
}
