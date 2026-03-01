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
    this.rotation = 0; // degrees, increments of 45
  }

  /**
   * Get axis-aligned bounding box that encloses the rotated forklift
   */
  getBounds() {
    if (this.rotation === 0) {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    // Compute rotated corners around center, then find AABB
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = this.width / 2;
    const hh = this.height / 2;

    // Four corners relative to center
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      const rx = cx + c.x * cos - c.y * sin;
      const ry = cy + c.x * sin + c.y * cos;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Hit test accounting for rotation
   */
  containsPoint(worldX, worldY) {
    if (this.rotation === 0) {
      return super.containsPoint(worldX, worldY);
    }
    // Transform point into forklift's local (unrotated) space
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const rad = -this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = worldX - cx;
    const dy = worldY - cy;
    const localX = dx * cos - dy * sin + cx;
    const localY = dx * sin + dy * cos + cy;
    return super.containsPoint(localX, localY);
  }

  /**
   * Draw forklift element with rotation
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

    // Apply rotation around center
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    if (this.rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(this.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
    }

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

    // Draw blocked element outline (outside rotation transform)
    if (this.isBlocked && this.blockedElement) {
      ctx.save();
      const bounds = this.blockedElement.getBounds();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 4 / viewport.scale;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();
    }
  }

  toJSON() {
    return { ...super.toJSON(), rotation: this.rotation };
  }
}
