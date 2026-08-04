/**
 * OverlayView.js — diagnostic layers drawn on top of the scene.
 *
 * These are what turn the toy into a tool: they show where the cat's weight
 * lands, where the bed is failing to hold it up, and what contour the cat
 * actually wants. All three are optional and default to off.
 */

import { SKETCH, BED } from '../config.js';
import { traceOpenSpline } from '../core/path.js';
import { remap } from '../core/math2d.js';

export class OverlayView {
  /**
   * @param {import('../model/Cat.js').Cat} cat
   * @param {import('../model/Bed.js').Bed} bed
   */
  constructor(cat, bed) {
    this.cat = cat;
    this.bed = bed;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{
   *   showPressure: boolean,
   *   showTarget: boolean,
   *   comfort: ReturnType<import('../model/comfort.js').evaluateComfort>,
   * }} state
   */
  draw(ctx, state) {
    if (state.showTarget) this._drawTargetContour(ctx);
    if (state.showPressure) this._drawPressure(ctx, state.comfort);
  }

  /**
   * Contact pressure as concentric rings: bigger and darker means that node is
   * carrying more of the cat than its neighbours. Hotspots get a filled centre.
   */
  _drawPressure(ctx, comfort) {
    const peak = this.cat.peakLoad;
    if (peak <= 1e-4) return;

    const hotspots = new Set(comfort?.hotspots ?? []);

    this.cat.spine.forEach((node, i) => {
      if (!node.contact) return;

      const intensity = node.smoothLoad / peak;
      const radius = remap(intensity, 0, 1, 7, 30);
      const bellyY = node.y + node.r;

      ctx.beginPath();
      ctx.arc(node.x, bellyY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.10 + intensity * 0.35})`;
      ctx.fill();

      if (hotspots.has(i)) {
        ctx.beginPath();
        ctx.arc(node.x, bellyY, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = SKETCH.ink;
        ctx.fill();
      }
    });

    // Unsupported spans: short dashes hanging below the belly.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    for (const index of comfort?.gaps ?? []) {
      const node = this.cat.spine[index];
      const surface = this.bed.surfaceAt(node.x);
      if (surface === null) continue;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y + node.r);
      ctx.lineTo(node.x, surface);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /**
   * The belly contour of the cat's relaxed pose, positioned where Auto-fit
   * would place it. Dragging sections onto this line is the manual route to a
   * perfect posture score.
   */
  _drawTargetContour(ctx) {
    const rest = this.cat.restShape({ noseX: this.cat.spine[0].x, noseY: 0 });
    const belly = rest.map((p) => ({ x: p.x, y: p.y + p.r }));

    const deepest = Math.max(...belly.map((p) => p.y));
    // Same vertical placement rule as autoFitContour, so the ghost line and
    // the Auto-fit button always agree.
    const offset = BED.baseSurfaceY - (BED.minLift + 55) - deepest;

    const points = belly.map((p) => ({ x: p.x, y: p.y + offset }));

    ctx.save();
    ctx.beginPath();
    traceOpenSpline(ctx, points);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    ctx.stroke();
    ctx.restore();
  }
}
