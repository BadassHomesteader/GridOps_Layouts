/**
 * Viewport - Camera/viewport model with pan and zoom
 *
 * Manages viewport transform state (offset, scale) and provides:
 * - Pan (translate)
 * - Zoom toward cursor position
 * - Visible bounds calculation
 * - Transform application to canvas context
 */
export class Viewport {
  static MIN_SCALE = 0.1;
  static MAX_SCALE = 10;

  constructor() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }

  /**
   * Apply viewport transform to canvas context
   * Call this before drawing world-space content
   */
  applyTransform(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  /**
   * Pan viewport by screen-space delta
   */
  pan(deltaX, deltaY) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  /**
   * Zoom toward focus point (screen coordinates)
   * Standard zoom-toward-cursor pattern:
   * 1. Calculate world position of focus point before zoom
   * 2. Apply zoom factor to scale
   * 3. Recalculate offset to keep focus point at same screen position
   */
  zoom(zoomFactor, focusX, focusY) {
    // Calculate world position of focus point before zoom
    const worldX = (focusX - this.offsetX) / this.scale;
    const worldY = (focusY - this.offsetY) / this.scale;

    // Apply zoom
    this.scale *= zoomFactor;

    // Clamp scale
    this.scale = Math.max(Viewport.MIN_SCALE, Math.min(Viewport.MAX_SCALE, this.scale));

    // Recalculate offset to keep focus point at same screen position
    this.offsetX = focusX - worldX * this.scale;
    this.offsetY = focusY - worldY * this.scale;
  }

  /**
   * Get visible bounds in world coordinates
   * Used for culling (only draw what's visible)
   */
  getVisibleBounds(canvasWidth, canvasHeight) {
    const topLeftX = (0 - this.offsetX) / this.scale;
    const topLeftY = (0 - this.offsetY) / this.scale;
    const bottomRightX = (canvasWidth - this.offsetX) / this.scale;
    const bottomRightY = (canvasHeight - this.offsetY) / this.scale;

    return {
      topLeft: { x: topLeftX, y: topLeftY },
      bottomRight: { x: bottomRightX, y: bottomRightY }
    };
  }
}
