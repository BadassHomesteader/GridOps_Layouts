/**
 * Grid - Configurable grid rendering with snap-to-grid
 *
 * Provides:
 * - Configurable resolution (1ft / 6in)
 * - Viewport culling (only draw visible lines)
 * - Snap-to-grid utilities
 * - Origin crosshair
 */
export class Grid {
  constructor() {
    this.gridSize = 48; // pixels per foot in world space
    this.resolution = '1ft'; // '1ft', '6in', or '1in'
    this.snapEnabled = true;
  }

  /**
   * Get current grid spacing based on resolution
   */
  getSpacing() {
    if (this.resolution === '1in') {
      return this.gridSize / 12; // 4px per inch
    }
    if (this.resolution === '6in') {
      return this.gridSize / 2; // two lines per foot
    }
    return this.gridSize; // one line per foot
  }

  /**
   * Draw grid (renderer callback signature)
   */
  draw(ctx, viewport, deltaTime) {
    // Get logical canvas size
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = ctx.canvas.width / dpr;
    const logicalHeight = ctx.canvas.height / dpr;

    // Get visible bounds for culling
    const bounds = viewport.getVisibleBounds(logicalWidth, logicalHeight);

    // Draw 1-inch sub-grid when resolution is '1in' and zoomed in enough
    if (this.resolution === '1in' && viewport.scale > 1.5) {
      const inchSpacing = this.gridSize / 12;
      this.drawGridLines(
        ctx,
        bounds,
        inchSpacing,
        'rgba(0, 0, 0, 0.04)',
        0.3 / viewport.scale,
        viewport
      );
    }

    // Draw 6-inch sub-grid when resolution is '6in' or '1in'
    if ((this.resolution === '6in' || this.resolution === '1in') && viewport.scale > 0.3) {
      const subSpacing = this.gridSize / 2;
      this.drawGridLines(
        ctx,
        bounds,
        subSpacing,
        'rgba(0, 0, 0, 0.08)',
        0.5 / viewport.scale,
        viewport
      );
    }

    // Draw major grid (1ft marks)
    this.drawGridLines(
      ctx,
      bounds,
      this.gridSize,
      'rgba(0, 0, 0, 0.15)',
      1 / viewport.scale,
      viewport
    );

    // Draw origin crosshair
    this.drawOriginCrosshair(ctx, bounds, viewport);
  }

  /**
   * Draw grid lines (batched for performance)
   */
  drawGridLines(ctx, bounds, spacing, color, lineWidth, viewport) {
    const { topLeft, bottomRight } = bounds;

    // Calculate start/end positions snapped to spacing intervals
    const startX = Math.floor(topLeft.x / spacing) * spacing;
    const endX = Math.ceil(bottomRight.x / spacing) * spacing;
    const startY = Math.floor(topLeft.y / spacing) * spacing;
    const endY = Math.ceil(bottomRight.y / spacing) * spacing;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    // Draw vertical lines
    for (let x = startX; x <= endX; x += spacing) {
      // Apply 0.5-pixel offset for crisp rendering
      const crispX = Math.round(x) + 0.5 / viewport.scale;
      ctx.moveTo(crispX, topLeft.y);
      ctx.lineTo(crispX, bottomRight.y);
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += spacing) {
      // Apply 0.5-pixel offset for crisp rendering
      const crispY = Math.round(y) + 0.5 / viewport.scale;
      ctx.moveTo(topLeft.x, crispY);
      ctx.lineTo(bottomRight.x, crispY);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw origin crosshair at (0, 0)
   */
  drawOriginCrosshair(ctx, bounds, viewport) {
    const { topLeft, bottomRight } = bounds;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2 / viewport.scale;
    ctx.beginPath();

    // Vertical line through origin
    const crispX = 0.5 / viewport.scale;
    ctx.moveTo(crispX, topLeft.y);
    ctx.lineTo(crispX, bottomRight.y);

    // Horizontal line through origin
    const crispY = 0.5 / viewport.scale;
    ctx.moveTo(topLeft.x, crispY);
    ctx.lineTo(bottomRight.x, crispY);

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Snap world coordinates to grid
   */
  snapToGrid(worldX, worldY) {
    const spacing = this.getSpacing();
    return {
      x: Math.round(worldX / spacing) * spacing,
      y: Math.round(worldY / spacing) * spacing
    };
  }

  /**
   * Set grid resolution
   */
  setResolution(resolution) {
    if (resolution !== '1ft' && resolution !== '6in' && resolution !== '1in') {
      console.error('Invalid resolution:', resolution);
      return;
    }
    this.resolution = resolution;
  }
}
