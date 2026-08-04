/**
 * CatView.js — draws the cat by bending its artwork along the spine.
 *
 * Nothing about the cat's appearance is generated here. The drawing is the SVG
 * the cat was authored as (see CatArt.js); this file only warps it.
 *
 * The warp is the standard bend-along-a-curve: the artwork is cut into thin
 * vertical strips, and each strip is placed at the point of the spine its
 * horizontal position corresponds to, rotated to the spine's heading there. A
 * strip's own contents keep their offset from the spine, so the belly follows
 * the bed and the back arches over it. Strips are drawn slightly wider than
 * their spacing so the wedge-shaped gaps that open on the outside of a bend are
 * covered.
 *
 * Horizontal position maps to distance along the spine, and the spine cannot
 * stretch, so strips neither pile up nor pull apart as the cat bends.
 */

import { SKETCH } from '../config.js';
import { traceOpenSpline } from '../core/path.js';

/** Width of one strip, in SVG units. Smaller is smoother and slower. */
const STRIP_WIDTH = 1.2;

/** Extra width added to each side of a strip to hide the seams, SVG units. */
const STRIP_OVERLAP = 0.6;

export class CatView {
  /** @param {import('../model/Cat.js').Cat} cat */
  constructor(cat) {
    this.cat = cat;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{showSpine?: boolean}} [options]
   */
  draw(ctx, { showSpine = false } = {}) {
    const art = this.cat.design.artData;
    if (art) this._drawArt(ctx, art);
    if (showSpine) this._drawSpine(ctx);
  }

  _drawArt(ctx, art) {
    const worldPerUnit = this.cat.worldPerArtUnit;
    const pixelsPerUnit = art.pixelsPerUnit;
    const imageHeightUnits = art.canvas.height / pixelsPerUnit;
    const bodyUnits = art.bodyX1 - art.bodyX0;

    const spanUnits = art.maxX - art.minX;
    const count = Math.max(1, Math.ceil(spanUnits / STRIP_WIDTH));

    for (let i = 0; i < count; i++) {
      const left = art.minX + (spanUnits * i) / count;
      const right = art.minX + (spanUnits * (i + 1)) / count;
      const middle = (left + right) / 2;

      const frame = this._frameAt((middle - art.bodyX0) / bodyUnits);

      const sourceLeft = left - STRIP_OVERLAP;
      const sourceWidth = right - left + STRIP_OVERLAP * 2;

      ctx.save();
      ctx.translate(frame.x, frame.y);
      ctx.rotate(frame.angle);
      ctx.scale(worldPerUnit, worldPerUnit);
      ctx.drawImage(
        art.canvas,
        (sourceLeft - art.originX) * pixelsPerUnit, 0,
        sourceWidth * pixelsPerUnit, art.canvas.height,
        sourceLeft - middle, art.originY - art.spineY,
        sourceWidth, imageHeightUnits,
      );
      ctx.restore();
    }
  }

  /**
   * Position and heading of the spine at normalised body position `t`.
   *
   * Values outside 0..1 are extrapolated straight ahead from the end node,
   * which is what carries whiskers past the nose and a tail past the rump.
   */
  _frameAt(t) {
    const spine = this.cat.spine;
    const last = spine.length - 1;
    const position = t * last;

    if (position <= 0) return this._extrapolate(0, position);
    if (position >= last) return this._extrapolate(last, position - last);

    const i = Math.floor(position);
    const f = position - i;
    const a = spine[i];
    const b = spine[i + 1];

    // Heading has to be interpolated, not snapped to the nearest node: two
    // neighbouring strips that round to different nodes would be drawn at
    // different angles and split apart, leaving a hairline gap through the
    // artwork.
    const from = this._headingAt(i);
    let delta = this._headingAt(i + 1) - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      angle: from + delta * f,
    };
  }

  /** Continues in a straight line from an end node, `steps` node-widths out. */
  _extrapolate(index, steps) {
    const node = this.cat.spine[index];
    const angle = this._headingAt(index);
    const distance = steps * this.cat.segmentLength;
    return {
      x: node.x + Math.cos(angle) * distance,
      y: node.y + Math.sin(angle) * distance,
      angle,
    };
  }

  /** Heading of the spine at node `i`, from its neighbours. */
  _headingAt(i) {
    const spine = this.cat.spine;
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    return Math.atan2(next.y - prev.y, next.x - prev.x);
  }

  /** Debug view: the raw spine and which nodes are touching the bed. */
  _drawSpine(ctx) {
    const points = this.cat.spine.map((n) => ({ x: n.x, y: n.y }));

    ctx.beginPath();
    traceOpenSpline(ctx, points);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const node of this.cat.spine) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = node.contact ? SKETCH.ink : 'rgba(0,0,0,0.25)';
      ctx.fill();
    }
  }
}
