/**
 * noodle.js — the angular one.
 *
 * How he looks is entirely `assets/cats/Noodle_SVG.svg`. The faceting, the wedge
 * head, the big ear, the raised haunch: all of it is in the drawing, and it stays
 * that way as the bed bends him, because the artwork itself is what gets bent.
 *
 * See cats/index.js for what each field means.
 * @type {import('./index.js').CatDesign}
 */
export const noodle = {
  id: 'noodle',
  name: 'Noodle',
  blurb: 'All angles — wedge head and a sharp raised haunch',

  art: {
    url: 'assets/cats/Noodle_SVG.svg',
    bodyX0: 22,
    bodyX1: 238,
    spineY: 96,
    maxBelly: 40,
  },

  body: {
    length: 900,

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
