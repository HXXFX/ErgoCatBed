/**
 * math2d.js — small 2D helpers shared by the model and the views.
 *
 * Points are plain `{ x, y }` objects. There is no Vector class on purpose:
 * the physics loop allocates nothing per frame, and plain objects keep that
 * easy to reason about.
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Maps v from [inLo, inHi] to [outLo, outHi], clamped to the output range. */
export function remap(v, inLo, inHi, outLo, outHi) {
  if (inHi === inLo) return outLo;
  return clamp(outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo),
    Math.min(outLo, outHi), Math.max(outLo, outHi));
}

/**
 * Samples a piecewise-linear curve defined as [[t, value], ...] with t
 * ascending in [0, 1]. Used for the cat's body and rest-curvature
 * profiles so they can be authored as a handful of readable control points.
 */
export function sampleProfile(profile, t) {
  if (t <= profile[0][0]) return profile[0][1];
  const last = profile[profile.length - 1];
  if (t >= last[0]) return last[1];

  for (let i = 1; i < profile.length; i++) {
    const [t1, v1] = profile[i];
    if (t <= t1) {
      const [t0, v0] = profile[i - 1];
      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return last[1];
}

/**
 * Signed angle from vector a to vector b, in (-PI, PI].
 * Positive means "turn clockwise on screen", since y points down.
 */
export function signedAngle(ax, ay, bx, by) {
  return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
}

/**
 * Cheap deterministic pseudo-random in [-1, 1] for a given integer seed.
 * Used for hand-drawn wobble that must not change between frames.
 */
export function jitter(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Mean of an array of numbers, or 0 for an empty array. */
export function mean(values) {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

