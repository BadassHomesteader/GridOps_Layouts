/**
 * PolylineWall - Freeform polyline wall element
 *
 * Defined by an array of points rather than a bounding rectangle.
 * Rendered as a thick stroked path with round joints.
 * Color: Dark gray (#555555) matching Wall
 * Purpose: Irregular walls, angled boundaries, non-rectangular layouts
 */
import { Element } from './Element.js';

export class PolylineWall extends Element {
  constructor(points = []) {
    // Initialize with dummy bounds — updateBounds() sets real values
    super(0, 0, 0, 0, 'polylineWall');
    this.points = points.map(p => ({ x: p.x, y: p.y }));
    this.thickness = 12; // 3 inches at 4px/inch
    this.editing = false; // point-edit mode active
    this.selectedPointIndex = -1; // which point is selected in edit mode
    this.updateBounds();
  }

  /**
   * Recompute x, y, width, height from points (bounding box)
   */
  updateBounds() {
    if (this.points.length === 0) {
      this.x = 0;
      this.y = 0;
      this.width = 0;
      this.height = 0;
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const pad = this.thickness / 2;
    this.x = minX - pad;
    this.y = minY - pad;
    this.width = (maxX - minX) + this.thickness;
    this.height = (maxY - minY) + this.thickness;
  }

  /**
   * Move all points by delta
   */
  move(dx, dy) {
    for (const p of this.points) {
      p.x += dx;
      p.y += dy;
    }
    this.updateBounds();
  }

  /**
   * Compute total polyline length in world pixels
   */
  getTotalLength() {
    let len = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      len += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return len;
  }

  /**
   * Distance from point (px, py) to line segment (ax,ay)-(bx,by)
   */
  pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * Hit test: point within thickness/2 + tolerance of any segment
   */
  containsPoint(worldX, worldY) {
    const hitRadius = this.thickness / 2 + 8; // 8px tolerance for easy clicking
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      if (this.pointToSegmentDist(worldX, worldY, a.x, a.y, b.x, b.y) < hitRadius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find point handle at world position (for edit mode)
   * Returns index or -1
   */
  getPointAtWorld(worldX, worldY, handleRadius) {
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      if (Math.hypot(worldX - p.x, worldY - p.y) < handleRadius) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find which segment a world point is closest to
   * Returns segment index (0 = first segment) or -1
   */
  getClosestSegment(worldX, worldY) {
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const dist = this.pointToSegmentDist(worldX, worldY, a.x, a.y, b.x, b.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  /**
   * Insert a point after segment index
   */
  insertPoint(segmentIndex, point) {
    this.points.splice(segmentIndex + 1, 0, { x: point.x, y: point.y });
    this.updateBounds();
  }

  /**
   * Remove point at index (min 2 points enforced)
   */
  removePoint(index) {
    if (this.points.length <= 2) return false;
    this.points.splice(index, 1);
    this.updateBounds();
    return true;
  }

  /**
   * Scale points proportionally when setSize is called
   */
  setSize(newWidth, newHeight) {
    if (this.points.length < 2) return;
    const bounds = this.getBounds();
    const oldW = bounds.width - this.thickness;
    const oldH = bounds.height - this.thickness;
    if (oldW <= 0 || oldH <= 0) return;

    const targetW = newWidth - this.thickness;
    const targetH = newHeight - this.thickness;
    const scaleX = targetW / oldW;
    const scaleY = targetH / oldH;

    // Find current min point (anchor)
    let minX = Infinity, minY = Infinity;
    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }

    for (const p of this.points) {
      p.x = minX + (p.x - minX) * scaleX;
      p.y = minY + (p.y - minY) * scaleY;
    }
    this.updateBounds();
  }

  /**
   * Draw polyline wall
   */
  draw(ctx, viewport, deltaTime) {
    if (this.points.length < 2) return;

    ctx.save();

    // Wall stroke (thickness is in world pixels, context is already transformed)
    ctx.strokeStyle = this.selected ? '#3a3a3a' : '#555555';
    ctx.lineWidth = this.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();

    // Thinner outline for definition
    ctx.strokeStyle = this.selected ? '#1a1a1a' : '#333333';
    ctx.lineWidth = this.thickness + 2;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // Edit mode: draw point handles
    if (this.editing) {
      const handleSize = 8 / viewport.scale;
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        const isActive = i === this.selectedPointIndex;
        ctx.fillStyle = isActive ? '#ff3333' : '#ffdd00';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5 / viewport.scale;
        ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
      }

      // Draw midpoint indicators on segments (for inserting points)
      ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
      const midSize = 6 / viewport.scale;
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, midSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Check if forklift AABB collides with any segment
   */
  collidesWithAABB(aabbX, aabbY, aabbW, aabbH) {
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      if (this.segmentIntersectsAABB(a.x, a.y, b.x, b.y, aabbX, aabbY, aabbW, aabbH, this.thickness / 2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Test if a thick line segment intersects an AABB
   * Expands the AABB by segment radius and tests line-vs-expanded-rect
   */
  segmentIntersectsAABB(ax, ay, bx, by, rx, ry, rw, rh, radius) {
    // Expand rect by radius
    const ex = rx - radius;
    const ey = ry - radius;
    const ew = rw + radius * 2;
    const eh = rh + radius * 2;

    // Check if either endpoint is inside expanded rect
    if (ax >= ex && ax <= ex + ew && ay >= ey && ay <= ey + eh) return true;
    if (bx >= ex && bx <= ex + ew && by >= ey && by <= ey + eh) return true;

    // Check segment against 4 edges of expanded rect
    if (this.segmentsIntersect(ax, ay, bx, by, ex, ey, ex + ew, ey)) return true;
    if (this.segmentsIntersect(ax, ay, bx, by, ex, ey + eh, ex + ew, ey + eh)) return true;
    if (this.segmentsIntersect(ax, ay, bx, by, ex, ey, ex, ey + eh)) return true;
    if (this.segmentsIntersect(ax, ay, bx, by, ex + ew, ey, ex + ew, ey + eh)) return true;

    return false;
  }

  /**
   * Test if two line segments intersect
   */
  segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = this.cross(cx, cy, dx, dy, ax, ay);
    const d2 = this.cross(cx, cy, dx, dy, bx, by);
    const d3 = this.cross(ax, ay, bx, by, cx, cy);
    const d4 = this.cross(ax, ay, bx, by, dx, dy);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    // Collinear cases
    if (d1 === 0 && this.onSegment(cx, cy, dx, dy, ax, ay)) return true;
    if (d2 === 0 && this.onSegment(cx, cy, dx, dy, bx, by)) return true;
    if (d3 === 0 && this.onSegment(ax, ay, bx, by, cx, cy)) return true;
    if (d4 === 0 && this.onSegment(ax, ay, bx, by, dx, dy)) return true;

    return false;
  }

  cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  onSegment(ax, ay, bx, by, px, py) {
    return Math.min(ax, bx) <= px && px <= Math.max(ax, bx) &&
           Math.min(ay, by) <= py && py <= Math.max(ay, by);
  }

  /**
   * Serialize polyline wall
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      points: this.points.map(p => ({ x: p.x, y: p.y })),
      thickness: this.thickness
    };
  }
}
