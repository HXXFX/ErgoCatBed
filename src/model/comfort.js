/**
 * comfort.js — scores how well the current bed shape suits the cat.
 *
 * The score is deliberately made of three separate, individually meaningful
 * components rather than one opaque number, so that when the score is bad you
 * can see *why* it is bad and which sections to move.
 *
 *   support   Is the body actually being held up, or is it bridging gaps?
 *   posture   Is the spine near its relaxed curve, or forced into a bend?
 *   pressure  Is the weight spread out, or concentrated on a few hard spots?
 *
 * A flat bed usually scores well on support and pressure but poorly on
 * posture; an over-sculpted bed does the opposite. The interesting shapes are
 * the ones that satisfy all three.
 */

import { COMFORT } from '../config.js';
import { clamp, mean } from '../core/math2d.js';

/**
 * @param {import('./Cat.js').Cat} cat
 * @param {import('./Bed.js').Bed} bed
 */
export function evaluateComfort(cat, bed) {
  const support = scoreSupport(cat, bed);
  const posture = scorePosture(cat);
  const pressure = scorePressure(cat, bed);

  const w = COMFORT.weights;
  const total = clamp(
    support.value * w.support + posture.value * w.posture + pressure.value * w.pressure,
    0, 1,
  );

  return {
    total: Math.round(total * 100),
    support: Math.round(support.value * 100),
    posture: Math.round(posture.value * 100),
    pressure: Math.round(pressure.value * 100),
    /** Spine indices carrying unusually high load — the spots to fix first. */
    hotspots: pressure.hotspots,
    /** Spine indices that are unsupported despite sitting over the bed. */
    gaps: support.gaps,
    verdict: describe(total),
  };
}

/**
 * Fraction of the body that rests on something. Only nodes actually above the
 * bed are counted, so a cat whose nose hangs past the end of the bed is not
 * punished for the part of it that never had a chance of being supported.
 */
function scoreSupport(cat, bed) {
  let eligible = 0;
  let supported = 0;
  const gaps = [];

  cat.spine.forEach((node, i) => {
    const surface = bed.surfaceAt(node.x);
    if (surface === null) return;
    eligible++;

    const distanceToSurface = surface - (node.y + node.r);
    if (distanceToSurface <= COMFORT.contactTolerance) {
      supported++;
    } else {
      gaps.push(i);
    }
  });

  return { value: eligible === 0 ? 0 : supported / eligible, gaps };
}

/**
 * How close each joint is to the angle the cat's spine prefers. Averaged as
 * absolute error in radians, then mapped through COMFORT.postureTolerance so
 * the result is a 0..1 score.
 */
function scorePosture(cat) {
  const turns = cat.measureTurns();
  const errors = [];

  for (let i = 1; i < cat.spine.length - 1; i++) {
    errors.push(Math.abs(turns[i] - cat.restTurn[i]));
  }

  const averageError = mean(errors);
  return {
    value: clamp(1 - averageError / COMFORT.postureTolerance, 0, 1),
    averageError,
  };
}

/**
 * Evenness of the load along the body, as peak load over average load.
 *
 * The average is taken across every node lying over the bed, not just the ones
 * touching it, because a node that has been left hovering is precisely a node
 * whose share of the cat is being carried by somewhere else. Perfectly shared
 * weight gives a ratio of 1; one spot taking everything drives it up.
 *
 * A ratio is used rather than a spread so the measure is scale-free: a heavier
 * cat is not automatically less comfortable, only an unevenly carried one is.
 */
function scorePressure(cat, bed) {
  const loads = [];
  const indices = [];

  cat.spine.forEach((node, i) => {
    if (bed.surfaceAt(node.x) === null) return;
    loads.push(node.smoothLoad);
    indices.push(i);
  });

  if (loads.length < 3) return { value: 0, hotspots: [] };

  // Light spatial smoothing: neighbouring nodes share load through the spine,
  // so single-node spikes are solver noise rather than real pressure points.
  const smoothed = smoothNeighbours(loads);
  const average = mean(smoothed);

  // No load at all means the cat is not on the bed, which is not comfortable.
  if (average <= 1e-4) return { value: 0, hotspots: [] };

  const peak = Math.max(...smoothed);
  const concentration = peak / average;

  const hotspotThreshold = average * 1.8;
  const hotspots = indices.filter((_, k) => smoothed[k] > hotspotThreshold);

  return {
    value: clamp(1 - (concentration - 1) / COMFORT.pressureTolerance, 0, 1),
    hotspots,
  };
}

/** Three-tap moving average, with the ends held. */
function smoothNeighbours(values) {
  return values.map((value, i) => {
    const prev = values[i - 1] ?? value;
    const next = values[i + 1] ?? value;
    return (prev + value * 2 + next) / 4;
  });
}

/** Short human-readable label for a 0..1 score. */
function describe(total) {
  if (total >= 0.9) return 'Purring';
  if (total >= 0.78) return 'Very comfy';
  if (total >= 0.62) return 'Comfy';
  if (total >= 0.45) return 'Tolerable';
  if (total >= 0.28) return 'Restless';
  return 'Cat has left';
}
