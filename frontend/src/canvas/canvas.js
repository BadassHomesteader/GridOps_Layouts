/**
 * CanvasSetup - DPI-aware canvas initialization and resize handling
 *
 * Ensures crisp rendering on Retina/HiDPI displays by:
 * - Reading devicePixelRatio
 * - Scaling backing store (canvas.width/height) by DPR
 * - Scaling context by DPR to compensate
 * - Maintaining CSS display size
 */
export class CanvasSetup {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = window.devicePixelRatio || 1;

    // Initial resize
    this.resize();

    // Auto-resize on window resize
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Resize canvas to match current display size
   * Sets backing store size (width/height * dpr) and re-applies DPI scaling
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();

    // Set backing store size (physical pixels)
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    // CRITICAL: Setting canvas width/height clears context state
    // Must re-apply DPI scaling after resize
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Get logical size in CSS pixels (not physical pixels)
   */
  getLogicalSize() {
    return {
      width: this.canvas.width / this.dpr,
      height: this.canvas.height / this.dpr
    };
  }

  /**
   * Cleanup: remove resize listener
   */
  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
  }
}
