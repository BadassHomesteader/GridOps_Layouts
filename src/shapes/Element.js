/**
 * Element - Base class for all warehouse layout elements
 *
 * Provides:
 * - Position, size, and ID tracking
 * - Selection state
 * - Hit testing (containsPoint)
 * - Default rendering with scale-invariant styling
 * - Serialization (toJSON)
 */
export class Element {
  constructor(x, y, width, height, type) {
    this.x = x; // world coordinates (pixels, 48px = 1 foot)
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.selected = false;
    this.id = crypto.randomUUID();
  }

  /**
   * Point-in-rectangle hit test
   * @param {number} worldX - world x coordinate
   * @param {number} worldY - world y coordinate
   * @returns {boolean} true if point is inside element bounds
   */
  containsPoint(worldX, worldY) {
    return (
      worldX >= this.x &&
      worldX <= this.x + this.width &&
      worldY >= this.y &&
      worldY <= this.y + this.height
    );
  }

  /**
   * Get element bounds
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Draw element (base implementation)
   * Override in subclasses for custom rendering
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Fill color based on selection state
    ctx.fillStyle = this.selected ? '#6b9bd1' : '#999999';
    ctx.strokeStyle = this.selected ? '#3a5f8a' : '#666666';
    ctx.lineWidth = 2 / viewport.scale; // scale-invariant line width

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw type label centered in element
    ctx.fillStyle = '#000000';
    ctx.font = `${12 / viewport.scale}px sans-serif`; // scale-invariant font
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.type,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Serialize element to JSON
   * Override in subclasses to include type-specific properties
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}
