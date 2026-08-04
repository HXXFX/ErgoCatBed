/**
 * mochi.js — the big one, with the tail hanging out.
 *
 * How she looks is entirely `assets/cats/Mochi_SVG.svg`.
 *
 * The one number worth explaining is `maxBelly`. Her tail hangs off the back and
 * drops to y≈197 in the drawing, far below the body's underside at y≈119.
 * Measured naively she would read as a cat two hundred units deep and try to
 * balance on her own tail; capping the measurement at 35 units below the spine
 * keeps the tail out of it. `bodyX1` stops the simulated body before the tail
 * for the same reason — past that point the artwork simply rides along with the
 * rump, which is what "hanging out" should do.
 *
 * See cats/index.js for what each field means.
 * @type {import('./index.js').CatDesign}
 */
export const mochi = {
  id: 'mochi',
  name: 'Mochi',
  blurb: 'Enormous — a dome of cat with a small head',

  art: {
    url: 'assets/cats/Mochi_SVG.svg',
    bodyX0: 48,
    bodyX1: 228,
    spineY: 95,
    maxBelly: 35,
  },

  body: {
    length: 880,

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
