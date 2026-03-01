/**
 * Wall - Structural wall element
 *
 * Default: 48x480 (1ft x 10ft)
 * Color: Dark gray (#555555)
 * Purpose: Layout structural boundaries
 */
import { Element } from './Element.js';

export class Wall extends Element {
  constructor(x = 0, y = 0, width = 48, height = 480) {
    super(x, y, width, height, 'wall');
  }

  /**
   * Draw wall element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Wall colors (dark gray, darker when selected)
    ctx.fillStyle = this.selected ? '#3a3a3a' : '#555555';
    ctx.strokeStyle = this.selected ? '#1a1a1a' : '#333333';
    ctx.lineWidth = 2 / viewport.scale;

    // Draw solid rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.restore();
  }
}
