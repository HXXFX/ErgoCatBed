/**
 * BedView.js — draws the bed.
 *
 * Each section is an inverted-U "staple": two legs and a rounded top, matching
 * the black-and-white draft style. The legs get a small deterministic length
 * variation so the row looks hand-drawn rather than machined.
 *
 * When sofa texture is added later, this is the only file that needs to change
 * — the model has no idea how it is drawn.
 */

import { BED, FLOOR_Y, SKETCH, WORLD } from '../config.js';
import { traceStaple } from '../core/path.js';
import { jitter } from '../core/math2d.js';

/** Traces a rounded rectangle. Used for the drag grip. */
function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export class BedView {
  /** @param {import('../model/Bed.js').Bed} bed */
  constructor(bed) {
    this.bed = bed;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{hoveredIndex: number, selectedIndex: number, showLabels: boolean}} state
   */
  draw(ctx, state) {
    this._drawFloor(ctx);

    this.bed.sections.forEach((section, index) => {
      const { left, right } = this.bed.bounds(index);
      const topY = this.bed.surfaceY(index);
      const legBottom = FLOOR_Y + jitter(index * 5.7) * 16;

      const isActive = index === state.hoveredIndex || index === state.selectedIndex;

      ctx.beginPath();
      traceStaple(ctx, left, right, topY, legBottom, BED.cornerRadius);

      // Fill so the staple reads as a solid object and hides the floor line.
      ctx.fillStyle = isActive ? '#f0f0f0' : SKETCH.paper;
      ctx.fill();

      ctx.strokeStyle = SKETCH.ink;
      ctx.lineWidth = isActive ? SKETCH.strokeWidth + 2 : SKETCH.strokeWidth;
      ctx.stroke();

      if (state.showLabels) this._drawLabel(ctx, index, topY);
    });
  }

  /** Ground line, drawn light so it sits behind everything. */
  _drawFloor(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(WORLD.width, FLOOR_Y);
    ctx.strokeStyle = SKETCH.guide;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /** Section number and its height in world units, for precise adjustment. */
  _drawLabel(ctx, index, topY) {
    const { center } = this.bed.bounds(index);
    const lift = Math.round(this.bed.sections[index].lift);

    ctx.save();
    ctx.fillStyle = SKETCH.ink;
    ctx.font = '500 22px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), center, FLOOR_Y + 46);
    ctx.font = '400 19px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(`${lift}`, center, topY + 44);
    ctx.restore();
  }

  /**
   * Re-draws just the top edge of every section, thinly, on top of the cat.
   *
   * The cat's fill is opaque, so without this the part of the contour actually
   * under the body — the only part that matters — is invisible. A light line
   * reads as the cushion seam and keeps the shape you sculpted legible.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  drawSurfaceSeam(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 3;

    this.bed.sections.forEach((section, index) => {
      const { left, right } = this.bed.bounds(index);
      const topY = this.bed.surfaceY(index);
      const inset = BED.cornerRadius * 0.6;
      ctx.beginPath();
      ctx.moveTo(left + inset, topY);
      ctx.lineTo(right - inset, topY);
      ctx.stroke();
    });

    ctx.restore();
  }

  /**
   * Drag affordances, drawn after the cat so they are never hidden by it.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{hoveredIndex:number, selectedIndex:number, isDragging:boolean}} state
   */
  drawHandles(ctx, state) {
    const indices = new Set();
    if (state.hoveredIndex >= 0) indices.add(state.hoveredIndex);
    if (state.selectedIndex >= 0) indices.add(state.selectedIndex);

    for (const index of indices) {
      const { center, width } = this.bed.bounds(index);
      const topY = this.bed.surfaceY(index);
      const isSelected = index === state.selectedIndex;

      // A grip straddling the section top. It has to be drawn over the cat to be
      // usable at all — the top of a loaded section is underneath the body — so
      // it is given a solid plate to read as an intentional control rather than
      // as a stray mark on the cat.
      const halfWidth = Math.min(width * 0.34, 26);
      const halfHeight = 19;
      ctx.beginPath();
      roundedRect(ctx, center - halfWidth, topY - halfHeight,
        halfWidth * 2, halfHeight * 2, 7);
      ctx.fillStyle = isSelected ? SKETCH.ink : SKETCH.paper;
      ctx.fill();
      ctx.strokeStyle = SKETCH.ink;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Up/down chevrons inside the grip, hinting at the drag axis.
      ctx.beginPath();
      ctx.moveTo(center - 8, topY - 4);
      ctx.lineTo(center, topY - 12);
      ctx.lineTo(center + 8, topY - 4);
      ctx.moveTo(center - 8, topY + 4);
      ctx.lineTo(center, topY + 12);
      ctx.lineTo(center + 8, topY + 4);
      ctx.strokeStyle = isSelected ? SKETCH.paper : SKETCH.ink;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }
}
