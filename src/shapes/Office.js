/**
 * Office - Office/obstacle element
 *
 * Default: 480x480 (10ft x 10ft)
 * Color: Tan/beige (#c4a882)
 * Purpose: Office space, obstacles, non-storage areas
 */
import { Element } from './Element.js';

export class Office extends Element {
  constructor(x = 0, y = 0, width = 480, height = 480) {
    super(x, y, width, height, 'office');
  }

  /**
   * Draw office element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Office colors (tan/beige)
    ctx.fillStyle = this.selected ? '#a68860' : '#c4a882';
    ctx.strokeStyle = this.selected ? '#6b5333' : '#8b7355';
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw "Office" label centered
    ctx.fillStyle = '#000000';
    ctx.font = `${14 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Office',
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }
}
