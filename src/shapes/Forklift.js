/**
 * Forklift - Forklift vehicle element
 *
 * Default: 96x48 (2ft x 1ft)
 * Color: Yellow (#e8c84a)
 * Purpose: Aisle navigation testing, clearance verification
 */
import { Element } from './Element.js';

export class Forklift extends Element {
  constructor(x = 0, y = 0, width = 96, height = 48) {
    super(x, y, width, height, 'forklift');
  }

  /**
   * Draw forklift element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Forklift colors (yellow)
    ctx.fillStyle = this.selected ? '#c8a82a' : '#e8c84a';
    ctx.strokeStyle = this.selected ? '#98790e' : '#b8992e';
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw "FK" label centered
    ctx.fillStyle = '#000000';
    ctx.font = `${14 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'FK',
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }
}
