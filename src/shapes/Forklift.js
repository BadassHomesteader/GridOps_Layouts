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
    this.isBlocked = false;
    this.blockedElement = null;
  }

  /**
   * Draw forklift element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Forklift colors (yellow when free, red when blocked)
    const baseColor = '#e8c84a';
    const blockedColor = '#ff4444';

    ctx.fillStyle = this.isBlocked
      ? blockedColor
      : (this.selected ? '#c8a82a' : baseColor);
    ctx.strokeStyle = this.isBlocked
      ? '#cc0000'
      : (this.selected ? '#98790e' : '#b8992e');
    ctx.lineWidth = this.isBlocked ? 3 / viewport.scale : 2 / viewport.scale;

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

    // If blocked, draw red outline around the blocking element
    if (this.isBlocked && this.blockedElement) {
      const bounds = this.blockedElement.getBounds();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 4 / viewport.scale;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    ctx.restore();
  }
}
