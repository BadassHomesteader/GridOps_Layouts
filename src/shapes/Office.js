/**
 * Office - Office/obstacle element
 *
 * Default: 480x480 (10ft x 10ft)
 * Color: Selectable from Excel-style theme palette
 * Purpose: Office space, obstacles, non-storage areas
 */
import { Element } from './Element.js';

// --- Color palette generation (Excel-style theme colors) ---
function parseHex(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function tintColor(hex, factor) {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

function shadeColor(hex, factor) {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

function colorEntry(name, hex) {
  return {
    name,
    fill: hex,
    stroke: shadeColor(hex, 0.3),
    selectedFill: shadeColor(hex, 0.15),
    selectedStroke: shadeColor(hex, 0.45)
  };
}

function buildPalette() {
  const bases = [
    { name: 'White',  hex: '#ffffff' },
    { name: 'Black',  hex: '#333333' },
    { name: 'Silver', hex: '#e7e6e6' },
    { name: 'Navy',   hex: '#44546a' },
    { name: 'Blue',   hex: '#4472c4' },
    { name: 'Orange', hex: '#ed7d31' },
    { name: 'Gray',   hex: '#a5a5a5' },
    { name: 'Gold',   hex: '#ffc000' },
    { name: 'Sky',    hex: '#5b9bd5' },
    { name: 'Green',  hex: '#70ad47' },
  ];

  // Row 0: base, Rows 1-3: lighter tints, Rows 4-5: darker shades
  const rows = [
    { suffix: '',           tint: 0,    shade: 0    },
    { suffix: ' Lighter',   tint: 0.8,  shade: 0    },
    { suffix: ' Light',     tint: 0.6,  shade: 0    },
    { suffix: ' Medium',    tint: 0.4,  shade: 0    },
    { suffix: ' Dark',      tint: 0,    shade: 0.25 },
    { suffix: ' Darker',    tint: 0,    shade: 0.5  },
  ];

  const colors = [];
  for (const row of rows) {
    for (const base of bases) {
      let hex = base.hex;
      if (row.tint > 0) hex = tintColor(hex, row.tint);
      else if (row.shade > 0) hex = shadeColor(hex, row.shade);
      colors.push(colorEntry(base.name + row.suffix, hex));
    }
  }
  return colors;
}

export class Office extends Element {
  static GRID_COLS = 10;
  static COLORS = buildPalette();

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
