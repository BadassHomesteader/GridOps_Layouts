/**
 * Pallet - Individual pallet element
 *
 * Default: 48x40 (standard US pallet 48"x40")
 * Color: Wood/tan (#d4a056)
 * Purpose: Floor-placed pallets, capacity calculation
 */
import { Element } from './Element.js';

export class Pallet extends Element {
  constructor(x = 0, y = 0, width = 48, height = 40, palletHeight = 48) {
    super(x, y, width, height, 'pallet');
    this.palletHeight = palletHeight; // height in inches (48" = 4ft)
  }

  /**
   * Draw pallet element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Pallet colors (wood/tan)
    ctx.fillStyle = this.selected ? '#b4803e' : '#d4a056';
    ctx.strokeStyle = this.selected ? '#7c5418' : '#9c7430';
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw "P" label centered
    ctx.fillStyle = '#000000';
    ctx.font = `${14 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'P',
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Serialize pallet with height property
   */
  toJSON() {
    return {
      ...super.toJSON(),
      palletHeight: this.palletHeight
    };
  }
}
