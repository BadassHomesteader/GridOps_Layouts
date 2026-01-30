/**
 * PerimeterWall - Hollow rectangular perimeter wall element
 *
 * Default: 480x480 (10ft x 10ft) interior, 12px (3in) wall thickness
 * Color: Dark gray (#555555) - same as Wall
 * Purpose: Building/room perimeter boundaries
 * Renders as a hollow rectangle (outline only, no fill inside)
 */
import { Element } from './Element.js';

export class PerimeterWall extends Element {
  constructor(x = 0, y = 0, width = 480, height = 480) {
    super(x, y, width, height, 'perimeterWall');
    this.wallThickness = 12; // 3 inches at 4px/inch
    this.label = 'Perimeter';
  }

  /**
   * Draw perimeter wall as hollow rectangle
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    const color = this.selected ? '#3a3a3a' : '#555555';
    const strokeColor = this.selected ? '#1a1a1a' : '#333333';
    const t = this.wallThickness;

    ctx.fillStyle = color;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 / viewport.scale;

    // Draw four wall segments as filled rectangles
    // Top wall
    ctx.fillRect(this.x, this.y, this.width, t);
    // Bottom wall
    ctx.fillRect(this.x, this.y + this.height - t, this.width, t);
    // Left wall
    ctx.fillRect(this.x, this.y + t, t, this.height - 2 * t);
    // Right wall
    ctx.fillRect(this.x + this.width - t, this.y + t, t, this.height - 2 * t);

    // Outer stroke
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    // Inner stroke
    ctx.strokeRect(this.x + t, this.y + t, this.width - 2 * t, this.height - 2 * t);

    // Draw label centered
    ctx.fillStyle = '#888';
    ctx.font = `${12 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.label,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Hit test - only the wall thickness is solid, interior is empty
   */
  containsPoint(worldX, worldY) {
    // Must be inside outer bounds
    if (!super.containsPoint(worldX, worldY)) return false;

    const t = this.wallThickness;
    // Check if inside the hollow interior
    const inInterior = (
      worldX > this.x + t &&
      worldX < this.x + this.width - t &&
      worldY > this.y + t &&
      worldY < this.y + this.height - t
    );

    // Point is on the wall if inside outer but NOT in interior
    return !inInterior;
  }

  toJSON() {
    return { ...super.toJSON(), wallThickness: this.wallThickness, label: this.label };
  }
}
