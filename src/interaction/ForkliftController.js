/**
 * ForkliftController - Arrow-key forklift driving with collision detection
 *
 * Provides:
 * - Arrow key movement with delta-time smoothness
 * - AABB collision detection (stops at walls, offices, pallets)
 * - R key to rotate forklift 90 degrees
 * - Visual feedback (red when blocked, red outline on blocking element)
 * - Normalized diagonal movement (no speed boost)
 * - Separate X/Y collision testing (slide along obstacles)
 */
export class ForkliftController {
  constructor(elementManager, selectionManager) {
    this.elementManager = elementManager;
    this.selectionManager = selectionManager;
    this.forklift = null; // Only drives when a forklift is selected
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false
    };
    this.speed = 192; // pixels/sec = 4 feet/sec at 48px/ft
    this.active = false; // Only active when a forklift element exists
    this.setupKeyListeners();
  }

  /**
   * Setup window-level keyboard event listeners for arrow keys
   */
  setupKeyListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key in this.keys && !this.isTextInputActive(e.target)) {
        e.preventDefault(); // Prevent page scroll
        this.keys[e.key] = true;
      }
      // R key to rotate forklift (only when forklift is selected)
      if ((e.key === 'r' || e.key === 'R') && !this.isTextInputActive(e.target) && this.forklift) {
        this.rotateForklift();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key in this.keys) {
        this.keys[e.key] = false;
      }
    });
  }

  /**
   * Check if target is a text input element
   * Same logic as KeyboardInput.js
   */
  isTextInputActive(target) {
    if (!target) return false;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }

    // Check for contentEditable
    if (target.isContentEditable) {
      return true;
    }

    return false;
  }

  /**
   * Rotate forklift by 45-degree increments
   */
  rotateForklift() {
    if (!this.forklift) return;
    this.forklift.rotation = (this.forklift.rotation + 45) % 360;
  }

  /**
   * Update forklift position based on arrow key state
   * Called every frame from render loop
   * @param {number} deltaTime - milliseconds since last frame
   */
  update(deltaTime) {
    // Only drive when a forklift is selected
    const selected = this.selectionManager.getSelected();
    this.forklift = (selected && selected.type === 'forklift') ? selected : null;

    if (!this.forklift) {
      this.active = false;
      return;
    }

    this.active = true;

    // Calculate movement distance for this frame
    const deltaSeconds = deltaTime / 1000;
    const moveDistance = this.speed * deltaSeconds;

    // Calculate movement vector from key states
    let dx = 0;
    let dy = 0;

    if (this.keys.ArrowUp) dy -= moveDistance;
    if (this.keys.ArrowDown) dy += moveDistance;
    if (this.keys.ArrowLeft) dx -= moveDistance;
    if (this.keys.ArrowRight) dx += moveDistance;

    // Normalize diagonal movement (prevent sqrt(2) speed boost)
    if (dx !== 0 && dy !== 0) {
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / magnitude) * moveDistance;
      dy = (dy / magnitude) * moveDistance;
    }

    // If not moving, clear blocked state
    if (dx === 0 && dy === 0) {
      this.forklift.isBlocked = false;
      this.forklift.blockedElement = null;
      return;
    }

    // Try to move
    this.tryMove(dx, dy);
  }

  /**
   * Try to move forklift by dx, dy
   * Test X and Y separately to avoid sticky collisions (can slide along obstacles)
   * @param {number} dx - desired X movement
   * @param {number} dy - desired Y movement
   */
  tryMove(dx, dy) {
    // Test X movement
    const oldX = this.forklift.x;
    this.forklift.x += dx;
    const xCollision = this.checkCollision();
    if (xCollision) {
      this.forklift.x = oldX; // Revert X
    }

    // Test Y movement
    const oldY = this.forklift.y;
    this.forklift.y += dy;
    const yCollision = this.checkCollision();
    if (yCollision) {
      this.forklift.y = oldY; // Revert Y
    }

    // Set blocked state
    this.forklift.isBlocked = !!(xCollision || yCollision);
    this.forklift.blockedElement = xCollision || yCollision || null;
  }

  /**
   * Check for collision with other elements
   * Uses AABB (Axis-Aligned Bounding Box) collision detection
   * PerimeterWall: checks 4 wall segments individually so forklift can drive inside
   * @returns {Element|null} Colliding element or null
   */
  checkCollision() {
    const fb = this.forklift.getBounds();

    for (const element of this.elementManager.getAll()) {
      // Skip self
      if (element === this.forklift) continue;

      // Skip drive-through offices (visual zones only)
      if (element.type === 'office' && element.driveThrough) continue;

      // PerimeterWall: test against 4 wall segments, not outer AABB
      if (element.type === 'perimeterWall') {
        if (this.checkPerimeterCollision(fb, element)) {
          return element;
        }
        continue;
      }

      // All other elements: standard AABB collision
      const eb = element.getBounds();
      if (
        fb.x < eb.x + eb.width &&
        fb.x + fb.width > eb.x &&
        fb.y < eb.y + eb.height &&
        fb.y + fb.height > eb.y
      ) {
        return element; // Collision detected
      }
    }

    return null; // No collision
  }

  /**
   * Check collision against the 4 wall segments of a PerimeterWall
   * @returns {boolean} true if collision with any wall segment
   */
  checkPerimeterCollision(fb, perimeterWall) {
    const t = perimeterWall.wallThickness;
    const px = perimeterWall.x;
    const py = perimeterWall.y;
    const pw = perimeterWall.width;
    const ph = perimeterWall.height;

    // 4 wall segment AABBs: top, bottom, left, right
    const segments = [
      { x: px, y: py, width: pw, height: t },                         // top
      { x: px, y: py + ph - t, width: pw, height: t },                // bottom
      { x: px, y: py + t, width: t, height: ph - 2 * t },             // left
      { x: px + pw - t, y: py + t, width: t, height: ph - 2 * t }     // right
    ];

    for (const seg of segments) {
      if (
        fb.x < seg.x + seg.width &&
        fb.x + fb.width > seg.x &&
        fb.y < seg.y + seg.height &&
        fb.y + fb.height > seg.y
      ) {
        return true;
      }
    }

    return false;
  }
}
