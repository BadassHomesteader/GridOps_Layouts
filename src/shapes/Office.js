/**
 * Office - Office/obstacle element
 *
 * Default: 480x480 (10ft x 10ft)
 * Color: Selectable from predefined palette
 * Purpose: Office space, obstacles, non-storage areas
 */
import { Element } from './Element.js';

export class Office extends Element {
  // Predefined color options
  static COLORS = [
    { name: 'Tan',    fill: '#c4a882', stroke: '#8b7355', selectedFill: '#a68860', selectedStroke: '#6b5333' },
    { name: 'Blue',   fill: '#82a8c4', stroke: '#55738b', selectedFill: '#6088a6', selectedStroke: '#33536b' },
    { name: 'Green',  fill: '#8bc4a0', stroke: '#5a8b6e', selectedFill: '#6aa680', selectedStroke: '#3a6b4e' },
    { name: 'Red',    fill: '#c4888a', stroke: '#8b5557', selectedFill: '#a66668', selectedStroke: '#6b3335' },
    { name: 'Purple', fill: '#a888c4', stroke: '#73558b', selectedFill: '#8866a6', selectedStroke: '#53336b' },
    { name: 'Gray',   fill: '#a0a0a0', stroke: '#707070', selectedFill: '#888888', selectedStroke: '#505050' },
  ];

  constructor(x = 0, y = 0, width = 480, height = 480) {
    super(x, y, width, height, 'office');
    this.label = 'Office';
    this.colorIndex = 0;
    this.driveThrough = false; // When true, forklift can pass through
  }

  /**
   * Draw office element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    const colors = Office.COLORS[this.colorIndex] || Office.COLORS[0];
    ctx.fillStyle = this.selected ? colors.selectedFill : colors.fill;
    ctx.strokeStyle = this.selected ? colors.selectedStroke : colors.stroke;
    ctx.lineWidth = 2 / viewport.scale;

    // Draw rectangle (dashed border for drive-through zones)
    if (this.driveThrough) {
      ctx.setLineDash([6 / viewport.scale, 4 / viewport.scale]);
    }
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw label centered
    ctx.fillStyle = '#000000';
    ctx.font = `${14 / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.label,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Serialize office with label and color
   */
  toJSON() {
    return {
      ...super.toJSON(),
      label: this.label,
      colorIndex: this.colorIndex,
      driveThrough: this.driveThrough
    };
  }
}
