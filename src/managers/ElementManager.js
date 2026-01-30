/**
 * ElementManager - Element storage, hit testing, and batch rendering
 *
 * Provides:
 * - Array-based element storage
 * - Add/remove operations
 * - Hit testing with z-order (reverse iteration for top-first)
 * - Batch rendering with z-order (forward iteration for bottom-first)
 * - Collection access
 */
export class ElementManager {
  constructor() {
    this.elements = [];
    this.observers = [];
  }

  /**
   * Subscribe to element changes
   * @param {Function} callback - callback to invoke on changes (event, element)
   */
  subscribe(callback) {
    this.observers.push(callback);
  }

  /**
   * Notify all observers of element change
   * @param {string} event - event type ('add', 'remove', 'clear')
   * @param {Element|null} element - affected element (null for 'clear')
   */
  notify(event, element) {
    for (const observer of this.observers) {
      observer(event, element);
    }
  }

  /**
   * Add element to collection
   * @param {Element} element - element to add
   */
  add(element) {
    this.elements.push(element);
    this.notify('add', element);
  }

  /**
   * Remove element from collection
   * @param {Element} element - element to remove
   */
  remove(element) {
    const index = this.elements.indexOf(element);
    if (index !== -1) {
      this.elements.splice(index, 1);
      this.notify('remove', element);
    }
  }

  /**
   * Get element at world position (top-most element)
   * Iterates in REVERSE order to return visually top-most element
   * @param {number} worldX - world x coordinate
   * @param {number} worldY - world y coordinate
   * @returns {Element|null} - top-most element at position, or null
   */
  getElementAtPoint(worldX, worldY) {
    let perimeterHit = null;
    // Iterate backward (last element = top z-order)
    // Deprioritize perimeter walls so elements inside them are selected first
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];
      if (element.containsPoint(worldX, worldY)) {
        if (element.type === 'perimeterWall') {
          perimeterHit = perimeterHit || element;
          continue;
        }
        return element;
      }
    }
    return perimeterHit;
  }

  /**
   * Draw all elements in z-order
   * Iterates FORWARD to render bottom-first (correct z-order)
   * @param {CanvasRenderingContext2D} ctx - canvas context
   * @param {Viewport} viewport - viewport for transforms
   * @param {number} deltaTime - time since last frame
   */
  drawAll(ctx, viewport, deltaTime) {
    // Iterate forward (first element = bottom z-order)
    for (const element of this.elements) {
      element.draw(ctx, viewport, deltaTime);
    }
  }

  /**
   * Get all elements (read-only access)
   * @returns {Array<Element>} - array of all elements
   */
  getAll() {
    return this.elements;
  }

  /**
   * Clear all elements
   */
  clear() {
    this.elements = [];
    this.notify('clear', null);
  }
}
