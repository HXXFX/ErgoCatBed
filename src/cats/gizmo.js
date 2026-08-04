/**
 * gizmo.js — the tall-headed one, no tail in sight.
 *
 * How he looks is entirely `assets/cats/Gizmo_SVG.svg`. Redraw that file and he
 * changes; there is nothing here describing his shape.
 *
 * The numbers below only tie the drawing to the simulation. His whiskers reach
 * back past x=34, which is why the body starts there rather than at the leftmost
 * ink — otherwise the spine would begin at a whisker tip.
 *
 * See cats/index.js for what each field means.
 * @type {import('./index.js').CatDesign}
 */
export const gizmo = {
  id: 'gizmo',
  name: 'Gizmo',
  blurb: 'Tall head, stepped shoulder, no tail in sight',

  art: {
    url: 'assets/cats/Gizmo_SVG.svg',
    bodyX0: 34,
    bodyX1: 235,
    spineY: 95,
    maxBelly: 40,
  },

  body: {
    length: 900,

    // He lies flat in the drawing, so his preferred spine is near enough
    // straight; whatever curve he ends up with comes from following the bed.
    restCurve: [
      [0.00, 0.000],
      [0.15, -0.004],
      [0.35, 0.006],
      [0.60, 0.008],
      [0.85, 0.006],
      [1.00, 0.002],
    ],
    restTilt: -0.01,
  },
};
