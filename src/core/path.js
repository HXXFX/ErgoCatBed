/**
 * path.js — turns point arrays into smooth canvas paths.
 *
 * The cat outline is generated as a dense polyline by the model. Stroking it
 * directly looks faceted, so these helpers convert it to Catmull-Rom splines
 * expressed as cubic Béziers, which is what gives the drawing its soft,
 * marker-pen feel.
 */

/**
 * Traces an open Catmull-Rom spline through `points`.
 * Does not begin or close the path — the caller controls that.
 */
export function traceOpenSpline(ctx, points, tension = 0.5) {
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    curveSegment(ctx, p0, p1, p2, p3, tension);
  }
}

/** One Catmull-Rom span p1→p2 emitted as a cubic Bézier. */
function curveSegment(ctx, p0, p1, p2, p3, tension) {
  const k = tension / 3;
  ctx.bezierCurveTo(
    p1.x + (p2.x - p0.x) * k,
    p1.y + (p2.y - p0.y) * k,
    p2.x - (p3.x - p1.x) * k,
    p2.y - (p3.y - p1.y) * k,
    p2.x,
    p2.y,
  );
}

/**
 * Traces an inverted-U (a "staple") — the silhouette of one bed section.
 * Starts at the bottom-left leg, rounds over the top, ends at the bottom-right.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} left Left edge x.
 * @param {number} right Right edge x.
 * @param {number} topY Y of the top surface.
 * @param {number} bottomY Y where the legs end.
 * @param {number} radius Corner rounding.
 */
export function traceStaple(ctx, left, right, topY, bottomY, radius) {
  const r = Math.min(radius, (right - left) / 2, Math.abs(bottomY - topY));
  ctx.moveTo(left, bottomY);
  ctx.lineTo(left, topY + r);
  ctx.quadraticCurveTo(left, topY, left + r, topY);
  ctx.lineTo(right - r, topY);
  ctx.quadraticCurveTo(right, topY, right, topY + r);
  ctx.lineTo(right, bottomY);
}
