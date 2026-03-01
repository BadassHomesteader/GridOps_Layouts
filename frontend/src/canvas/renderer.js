/**
 * Renderer - requestAnimationFrame render loop
 *
 * Manages the animation loop and drawing pipeline:
 * 1. Clear canvas
 * 2. Apply DPI scaling
 * 3. Apply viewport transform
 * 4. Call registered draw callbacks
 */
export class Renderer {
  constructor(canvasSetup, viewport) {
    this.canvasSetup = canvasSetup;
    this.viewport = viewport;
    this.drawCallbacks = [];
    this.running = false;
    this.lastTimestamp = 0;

    // Bind render to preserve 'this' context
    this.render = this.render.bind(this);
  }

  /**
   * Register a draw callback
   * Callback signature: (ctx, viewport, deltaTime) => void
   */
  addDrawCallback(callback) {
    this.drawCallbacks.push(callback);
  }

  /**
   * Start render loop
   */
  start() {
    this.running = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.render);
  }

  /**
   * Stop render loop
   */
  stop() {
    this.running = false;
  }

  /**
   * Render one frame
   */
  render(timestamp) {
    if (!this.running) return;

    // Calculate delta time (ms since last frame)
    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const { ctx, dpr } = this.canvasSetup;
    const { width, height } = this.canvasSetup.getLogicalSize();

    // Reset transform to identity
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Apply DPI scaling (CanvasSetup already scales context, but we reset it above)
    ctx.scale(dpr, dpr);

    // Clear canvas to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Apply viewport transform
    this.viewport.applyTransform(ctx);

    // Call registered draw callbacks
    for (const callback of this.drawCallbacks) {
      callback(ctx, this.viewport, deltaTime);
    }

    // Request next frame
    if (this.running) {
      requestAnimationFrame(this.render);
    }
  }
}
