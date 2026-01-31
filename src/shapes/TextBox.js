/**
 * TextBox - Transparent text label element
 *
 * Default: 10ft x 2ft (480x96 px)
 * Color: Transparent (no fill), text only
 * Purpose: Labeling layout areas, annotations
 */
import { Element } from './Element.js';

export class TextBox extends Element {
  constructor(x = 0, y = 0, width = 480, height = 96, text = 'Label') {
    super(x, y, width, height, 'textBox');
    this.text = text;
    this.fontSize = 24;           // Screen pixels (divided by viewport.scale when drawn)
    this.textColor = '#333333';
  }

  /**
   * Draw text box element
   */
  draw(ctx, viewport, deltaTime) {
    ctx.save();

    // Selection indicator: light dashed border
    if (this.selected) {
      ctx.strokeStyle = 'rgba(74, 144, 217, 0.5)';
      ctx.lineWidth = 1.5 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 4 / viewport.scale]);
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      ctx.setLineDash([]);
    }

    // Draw text centered
    ctx.fillStyle = this.textColor;
    ctx.font = `${this.fontSize / viewport.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.text,
      this.x + this.width / 2,
      this.y + this.height / 2
    );

    ctx.restore();
  }

  /**
   * Serialize text box
   */
  toJSON() {
    return {
      ...super.toJSON(),
      text: this.text,
      fontSize: this.fontSize,
      textColor: this.textColor
    };
  }
}
