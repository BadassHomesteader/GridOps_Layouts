/**
 * CoordinateConverter - Convert between screen, world, and grid spaces
 *
 * Coordinate spaces:
 * - Screen: canvas element coordinates (0,0 = top-left of canvas)
 * - World: viewport/camera space (affected by pan/zoom)
 * - Grid: logical grid cells (gridSize = world units per grid cell)
 *
 * Conversions:
 * - screenToWorld: account for viewport offset and scale
 * - worldToScreen: inverse of screenToWorld
 * - worldToGrid: divide by gridSize and round
 * - gridToWorld: multiply by gridSize
 * - screenToGrid: composite (screen → world → grid)
 */
export class CoordinateConverter {
  constructor(viewport) {
    this.viewport = viewport;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX, screenY) {
    const worldX = (screenX - this.viewport.offsetX) / this.viewport.scale;
    const worldY = (screenY - this.viewport.offsetY) / this.viewport.scale;
    return { x: worldX, y: worldY };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX, worldY) {
    const screenX = worldX * this.viewport.scale + this.viewport.offsetX;
    const screenY = worldY * this.viewport.scale + this.viewport.offsetY;
    return { x: screenX, y: screenY };
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  worldToGrid(worldX, worldY, gridSize) {
    return {
      x: Math.round(worldX / gridSize),
      y: Math.round(worldY / gridSize)
    };
  }

  /**
   * Convert grid coordinates to world coordinates
   */
  gridToWorld(gridX, gridY, gridSize) {
    return {
      x: gridX * gridSize,
      y: gridY * gridSize
    };
  }

  /**
   * Convert screen coordinates to grid coordinates
   * Composite: screen → world → grid
   */
  screenToGrid(screenX, screenY, gridSize) {
    const world = this.screenToWorld(screenX, screenY);
    return this.worldToGrid(world.x, world.y, gridSize);
  }
}
