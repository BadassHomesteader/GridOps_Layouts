/**
 * PrintManager - Generate printable PDF layout report
 *
 * Provides:
 * - Property address header
 * - Layout drawing with element dimensions
 * - Capacity summary with min/max stacking counts
 * - Uses browser print dialog (window.print) for PDF output
 */
import { UnitManager } from './UnitManager.js';

export class PrintManager {
  constructor(elementManager, capacityManager, canvasSetup, viewport, grid) {
    this.elementManager = elementManager;
    this.capacityManager = capacityManager;
    this.canvasSetup = canvasSetup;
    this.viewport = viewport;
    this.grid = grid;
  }

  /**
   * Generate and open print view
   */
  print() {
    const address = this.capacityManager.propertyAddress || 'No address specified';
    const elements = this.elementManager.getAll();
    const pallets = elements.filter(el => el.type === 'pallet');

    // Calculate capacity summary
    const totalPallets = pallets.reduce((sum, p) => sum + p.quantity, 0);
    const quantities = pallets.map(p => p.quantity);
    const minStack = quantities.length > 0 ? Math.min(...quantities) : 0;
    const maxStack = quantities.length > 0 ? Math.max(...quantities) : 0;

    // Calculate world bounds of all elements for the drawing
    const bounds = this.getWorldBounds(elements);

    // Create an offscreen canvas to render the layout
    const layoutDataUrl = this.renderLayoutImage(elements, bounds);

    // Build element dimension table
    const dimensionRows = this.buildDimensionTable(elements);

    // Build pallet breakdown
    const palletBreakdown = this.buildPalletBreakdown(pallets);

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the layout.');
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>GridOps Layout - ${address}</title>
  <style>
    @page { margin: 0.75in; size: landscape; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #333;
      font-size: 11pt;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 10pt;
      color: #666;
    }
    .layout-image {
      text-align: center;
      margin-bottom: 16px;
    }
    .layout-image img {
      max-width: 100%;
      max-height: 450px;
      border: 1px solid #ccc;
    }
    .summary-grid {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }
    .summary-box {
      flex: 1;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px;
    }
    .summary-box h3 {
      font-size: 11pt;
      font-weight: 600;
      margin-bottom: 8px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 10pt;
    }
    .stat-value { font-weight: 600; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 4px 8px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .footer {
      margin-top: 16px;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(address)}</h1>
    <div class="subtitle">Warehouse Layout Report &mdash; Generated ${new Date().toLocaleDateString()}</div>
  </div>

  <div class="layout-image">
    <img src="${layoutDataUrl}" alt="Layout Drawing">
  </div>

  <div class="summary-grid">
    <div class="summary-box">
      <h3>Capacity Summary</h3>
      <div class="stat-row"><span>Total Pallet Positions:</span><span class="stat-value">${pallets.length}</span></div>
      <div class="stat-row"><span>Total Pallets (stacked):</span><span class="stat-value">${totalPallets}</span></div>
      <div class="stat-row"><span>Min Stack Count:</span><span class="stat-value">${minStack}</span></div>
      <div class="stat-row"><span>Max Stack Count:</span><span class="stat-value">${maxStack}</span></div>
      <div class="stat-row"><span>Pallet Size:</span><span class="stat-value">${this.formatDimension(this.capacityManager.getPalletWidth())} x ${this.formatDimension(this.capacityManager.getPalletHeight())}</span></div>
      <div class="stat-row"><span>Ceiling Height:</span><span class="stat-value">${this.capacityManager.ceilingHeight > 0 ? this.formatDimension(this.capacityManager.ceilingHeight) : 'Not set'}</span></div>
    </div>

    <div class="summary-box">
      <h3>Element Count</h3>
      ${this.buildElementCountHtml(elements)}
    </div>

    <div class="summary-box">
      <h3>Pallet Breakdown</h3>
      ${palletBreakdown}
    </div>
  </div>

  <div class="summary-box" style="margin-bottom: 16px;">
    <h3>Element Dimensions</h3>
    <table>
      <thead>
        <tr><th>Type</th><th>Count</th><th>Width</th><th>Height</th><th>Details</th></tr>
      </thead>
      <tbody>
        ${dimensionRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    GridOps Layouts &mdash; ${this.escapeHtml(address)}
  </div>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  /**
   * Calculate world bounds encompassing all elements
   */
  getWorldBounds(elements) {
    if (elements.length === 0) {
      return { minX: 0, minY: 0, maxX: 480, maxY: 480 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const b = el.getBounds();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    // Add padding
    const pad = 48; // 1 foot
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  /**
   * Render all elements to an offscreen canvas and return data URL
   */
  renderLayoutImage(elements, bounds) {
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;

    // Target image size (landscape-friendly)
    const maxW = 1200;
    const maxH = 600;
    const scale = Math.min(maxW / worldW, maxH / worldH);

    const canvasW = Math.ceil(worldW * scale);
    const canvasH = Math.ceil(worldH * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const ctx = offscreen.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Apply transform: translate so bounds.minX/minY is at origin, then scale
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-bounds.minX, -bounds.minY);

    // Draw grid (light)
    this.drawPrintGrid(ctx, bounds, scale);

    // Create a fake viewport for element drawing
    const fakeViewport = { scale, offsetX: 0, offsetY: 0 };

    // Draw elements
    for (const el of elements) {
      el.draw(ctx, fakeViewport, 0);
    }

    // Draw dimension labels on each element
    this.drawDimensionLabels(ctx, elements, scale);

    ctx.restore();

    return offscreen.toDataURL('image/png');
  }

  /**
   * Draw a light grid for print context
   */
  drawPrintGrid(ctx, bounds, scale) {
    const spacing = 48; // 1 foot
    const startX = Math.floor(bounds.minX / spacing) * spacing;
    const endX = Math.ceil(bounds.maxX / spacing) * spacing;
    const startY = Math.floor(bounds.minY / spacing) * spacing;
    const endY = Math.ceil(bounds.maxY / spacing) * spacing;

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5 / scale;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += spacing) {
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.maxY);
    }
    for (let y = startY; y <= endY; y += spacing) {
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.maxX, y);
    }
    ctx.stroke();
  }

  /**
   * Draw dimension labels (width x height) on each element
   */
  drawDimensionLabels(ctx, elements, scale) {
    ctx.fillStyle = '#333';
    ctx.font = `${10 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const el of elements) {
      const b = el.getBounds();
      const widthIn = Math.round(b.width / 4);
      const heightIn = Math.round(b.height / 4);

      // Format: show in feet'inches" if >= 12 inches
      const wLabel = this.formatDimension(widthIn);
      const hLabel = this.formatDimension(heightIn);

      const label = `${wLabel} x ${hLabel}`;
      const cx = b.x + b.width / 2;
      const top = b.y - 2 / scale;

      ctx.fillText(label, cx, top);
    }
  }

  /**
   * Format dimension in inches to feet'inches" display
   */
  formatDimension(inches) {
    return UnitManager.formatValue(inches) + ' ' + UnitManager.getLabel();
  }

  /**
   * Build HTML for element dimension table (grouped by type + size + details)
   */
  buildDimensionTable(elements) {
    const typeLabels = {
      wall: 'Wall',
      office: 'Office',
      pallet: 'Pallet',
      perimeterWall: 'Perimeter Wall',
      forklift: 'Forklift',
      polylineWall: 'Polyline Wall',
      textBox: 'Text Box'
    };

    // Group elements by type + size + detail key
    const groups = {};
    for (const el of elements) {
      const b = el.getBounds();
      const widthIn = Math.round(b.width / 4);
      const heightIn = Math.round(b.height / 4);

      let detail = '';
      if (el.type === 'pallet') detail = `Qty: ${el.quantity}`;
      if (el.type === 'perimeterWall') detail = el.label || '';
      if (el.type === 'office') detail = el.label || 'Office';
      if (el.type === 'forklift') detail = `Rot: ${el.rotation || 0}\u00B0`;
      if (el.type === 'polylineWall') {
        const lengthIn = Math.round(el.getTotalLength() / 4);
        detail = `Length: ${this.formatDimension(lengthIn)}, ${el.points.length} pts`;
      }
      if (el.type === 'textBox') detail = `"${el.text}"`;

      const key = `${el.type}|${widthIn}|${heightIn}|${detail}`;
      if (!groups[key]) {
        groups[key] = { type: el.type, widthIn, heightIn, detail, count: 0 };
      }
      groups[key].count++;
    }

    // Sort by type then size
    const typeOrder = ['perimeterWall', 'wall', 'polylineWall', 'office', 'pallet', 'forklift', 'textBox'];
    const sorted = Object.values(groups).sort((a, b) => {
      const ta = typeOrder.indexOf(a.type);
      const tb = typeOrder.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      return (b.widthIn * b.heightIn) - (a.widthIn * a.heightIn);
    });

    return sorted.map(g => {
      const wLabel = this.formatDimension(g.widthIn);
      const hLabel = this.formatDimension(g.heightIn);
      const label = typeLabels[g.type] || g.type;
      return `<tr><td>${label}</td><td>${g.count}</td><td>${wLabel}</td><td>${hLabel}</td><td>${g.detail}</td></tr>`;
    }).join('\n');
  }

  /**
   * Build HTML for element type counts
   */
  buildElementCountHtml(elements) {
    const counts = {};
    for (const el of elements) {
      counts[el.type] = (counts[el.type] || 0) + 1;
    }

    const typeLabels = {
      wall: 'Walls',
      office: 'Offices',
      pallet: 'Pallet Positions',
      perimeterWall: 'Perimeter Walls',
      forklift: 'Forklifts',
      polylineWall: 'Polyline Walls',
      textBox: 'Text Boxes'
    };

    return Object.entries(counts)
      .map(([type, count]) => `<div class="stat-row"><span>${typeLabels[type] || type}:</span><span class="stat-value">${count}</span></div>`)
      .join('\n');
  }

  /**
   * Build HTML for pallet stack breakdown
   */
  buildPalletBreakdown(pallets) {
    if (pallets.length === 0) {
      return '<div class="stat-row"><span>No pallets placed</span></div>';
    }

    // Group by quantity
    const groups = {};
    for (const p of pallets) {
      groups[p.quantity] = (groups[p.quantity] || 0) + 1;
    }

    return Object.entries(groups)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([qty, count]) => `<div class="stat-row"><span>${count} position(s) at ${qty} high:</span><span class="stat-value">${count * Number(qty)} pallets</span></div>`)
      .join('\n');
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
