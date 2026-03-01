/**
 * Pallet - Individual pallet element
 *
 * Default: 48x40 (standard US pallet 48"x40")
 * Color: Wood/tan (#d4a056)
 * Purpose: Floor-placed pallets, capacity calculation
 */
import { Element } from './Element.js';

export class Pallet extends Element {
  // Global ceiling height in inches (set by CapacityDisplay, 0 = no limit)
  static ceilingHeight = 0;
  // Global default pallet height in inches (set by Sidebar default size editor)
  static defaultPalletHeight = 48;

  constructor(x = 0, y = 0, width = 48, height = 40, palletHeight = 48) {
    super(x, y, width, height, 'pallet');
    this.palletHeight = palletHeight; // height in inches (48" = 4ft)
    this.quantity = 1;
  }

  /**
   * Check if this pallet stack exceeds the ceiling height
   */
  exceedsCeiling() {
    if (Pallet.ceilingHeight <= 0) return false;
    return (this.quantity * this.palletHeight) > Pallet.ceilingHeight;
  }

  /**
   * Get fill color based on quantity (low=cool/light, high=warm/dark)
   */
  getColor() {
    const q = this.quantity;
    if (q <= 1) return { fill: '#a8d8a8', stroke: '#6aaa6a', selectedFill: '#8cc08c', selectedStroke: '#4e8e4e' }; // green - light
    if (q <= 2) return { fill: '#c8d8a0', stroke: '#96aa60', selectedFill: '#b0c088', selectedStroke: '#7e9248' }; // yellow-green
    if (q <= 3) return { fill: '#d4c878', stroke: '#aa9a40', selectedFill: '#bcb060', selectedStroke: '#928228' }; // gold
    if (q <= 4) return { fill: '#d4a056', stroke: '#9c7430', selectedFill: '#b4803e', selectedStroke: '#7c5418' }; // tan/wood
    if (q <= 5) return { fill: '#d48c4a', stroke: '#a06020', selectedFill: '#b47030', selectedStroke: '#804810' }; // orange
    return              { fill: '#c86040', stroke: '#903818', selectedFill: '#a84828', selectedStroke: '#782810' }; // red-brown - heavy
  }

  /**
   * Draw pallet element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Pallet colors by quantity (green=low, red-brown=high)
    const colors = this.getColor();
    ctx.fillStyle = this.selected ? colors.selectedFill : colors.fill;
    ctx.strokeStyle = this.selected ? colors.selectedStroke : colors.stroke;
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Ceiling height warning: red dashed border + triangle icon
    const overCeiling = this.exceedsCeiling();
    if (overCeiling) {
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 3 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 3 / viewport.scale]);
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      ctx.setLineDash([]);
    }

    // Draw label centered
    ctx.fillStyle = overCeiling ? '#cc0000' : '#000000';
    ctx.font = `${overCeiling ? 'bold ' : ''}${14 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `P${this.quantity}`,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    // Warning icon (small triangle) in top-right corner
    if (overCeiling) {
      const iconSize = 10 / viewport.scale;
      const ix = this.x + this.width - iconSize - 2 / viewport.scale;
      const iy = this.y + 2 / viewport.scale;
      ctx.fillStyle = '#cc0000';
      ctx.beginPath();
      ctx.moveTo(ix + iconSize / 2, iy);
      ctx.lineTo(ix + iconSize, iy + iconSize);
      ctx.lineTo(ix, iy + iconSize);
      ctx.closePath();
      ctx.fill();
      // Exclamation mark
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${7 / viewport.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ix + iconSize / 2, iy + iconSize * 0.65);
    }

    ctx.restore();
  }

  /**
   * Serialize pallet with height property
   */
  toJSON() {
    return {
      ...super.toJSON(),
      palletHeight: this.palletHeight,
      quantity: this.quantity
    };
  }
}
