/**
 * bedShapes.js — ways of generating a whole bed contour at once.
 *
 * Two kinds live here:
 *   PRESETS  — hand-authored shapes, as functions of normalised position.
 *   autoFit  — solves for the contour that matches the cat's relaxed belly.
 *
 * Add a new preset by adding one entry to PRESETS; the control panel builds
 * its buttons from this object, so nothing else needs changing.
 */

import { BED } from '../config.js';
import { clamp, mean } from '../core/math2d.js';
import { evaluateComfort } from './comfort.js';

/**
 * Each preset receives `t` in 0..1 across the bed and returns a lift in world
 * units. Keep results inside BED.minLift..BED.maxLift.
 * @type {Record<string, {label: string, shape: (t: number) => number}>}
 */
export const PRESETS = {
  flat: {
    label: 'Flat',
    shape: () => BED.initialLift,
  },
  cradle: {
    label: 'Cradle',
    shape: (t) => 60 + 150 * Math.pow(Math.abs(t - 0.5) * 2, 1.6),
  },
  ramp: {
    label: 'Ramp',
    shape: (t) => 40 + 190 * (1 - t),
  },
  wave: {
    label: 'Wave',
    shape: (t) => 110 + 70 * Math.sin(t * Math.PI * 3),
  },
  headrest: {
    label: 'Headrest',
    shape: (t) => (t < 0.24 ? 190 - 40 * (t / 0.24) : 80),
  },
};

/**
 * Samples a preset into a lift array for a given section count.
 * @param {keyof typeof PRESETS} name
 * @param {number} sectionCount
 */
export function presetContour(name, sectionCount) {
  const preset = PRESETS[name] ?? PRESETS.flat;
  const lifts = [];
  for (let i = 0; i < sectionCount; i++) {
    const t = sectionCount === 1 ? 0.5 : i / (sectionCount - 1);
    lifts.push(clamp(preset.shape(t), BED.minLift, BED.maxLift));
  }
  return lifts;
}

/**
 * Solves for the bed contour that lets the cat lie in its relaxed pose.
 *
 * The cat's rest shape is a spine curve plus a belly profile, so its belly
 * traces a specific contour. If every bed section is set exactly to that
 * contour, no joint has to bend away from its rest angle and no single node
 * carries more than its share — which is the definition of a perfect score.
 *
 * Sections beyond the nose or rump have nothing resting on them, so they
 * simply continue the nearest end height.
 *
 * @param {import('./Cat.js').Cat} cat
 * @param {import('./Bed.js').Bed} bed
 * @param {{clearance?: number}} [options] clearance raises the whole contour,
 *   letting the cat sink in slightly instead of balancing exactly on top.
 * @returns {number[]} one lift per section
 */
export function autoFitContour(cat, bed, { clearance = 0 } = {}) {
  // Rest pose anchored at the cat's current nose position, vertically at 0 so
  // we can choose the absolute height afterwards.
  const rest = cat.restShape({ noseX: cat.spine[0].x, noseY: 0 });
  const belly = rest.map((p) => ({ x: p.x, y: p.y + p.r }));

  const relative = bed.sections.map((_, i) => sampleContourY(belly, bed.bounds(i).center));

  // Pick the vertical placement: the deepest part of the belly gets the
  // smallest lift, leaving the rest of the range available above it.
  const deepest = Math.max(...relative);
  const targetFloorLift = BED.minLift + 55;
  const constant = targetFloorLift + deepest;

  let lifts = relative.map((y) => constant - y + clearance);

  // If the contour is taller than the mechanism allows, compress it about its
  // midpoint rather than clipping, which would flatten the ends into a plateau.
  const min = Math.min(...lifts);
  const max = Math.max(...lifts);
  const range = max - min;
  const allowed = BED.maxLift - BED.minLift;
  if (range > allowed) {
    const mid = (min + max) / 2;
    const factor = allowed / range;
    lifts = lifts.map((l) => mid + (l - mid) * factor);
  }

  return lifts.map((l) => clamp(l, BED.minLift, BED.maxLift));
}

/**
 * Solves for the most comfortable contour by actually trying it.
 *
 * `autoFitContour` matches the belly of a *relaxed, weightless* cat, which is a
 * good first guess but not the answer: a real cat sags between supports and
 * sinks into the cushion, so the contour it wants is not quite the contour it
 * traces in mid-air.
 *
 * So this runs the simulation. Each pass lets the cat settle, measures how far
 * every section is from just-touching its part of the belly, and moves the
 * section by that error. Sections a body is hanging above rise to meet it;
 * sections digging into it drop away. The fixed point is uniform light contact
 * along the whole cat — which is simultaneously full support, even pressure, and
 * an undeformed spine, i.e. all three comfort components at once.
 *
 * Finally it judges three candidates against the actual comfort score — the
 * contour it was handed, the analytic guess, and the refined result — and returns
 * the best. Even contact is a good proxy for comfort but not the same thing, so
 * for a cat that already suits a flat bed the search can otherwise wander
 * somewhere slightly worse. Comparing outcomes means pressing Auto-fit cannot
 * make things worse, and pressing it repeatedly settles instead of oscillating.
 *
 * The candidates are scored only after `judgeFrames` of settling. Scoring a cat
 * that is still moving reads whatever the bounce happens to look like at that
 * instant, which is how an inferior contour wins if you let it — the refinement
 * passes can use short settles because they measure local contact offsets, but
 * the final comparison cannot.
 *
 * The bed is left exactly as it was found; the winning contour is returned so the
 * caller can animate into it.
 *
 * @param {import('./Cat.js').Cat} cat
 * @param {import('./Bed.js').Bed} bed
 * @returns {number[]} one lift per section
 */
export function solveComfortContour(cat, bed, {
  passes = 16,
  settleFrames = 20,
  judgeFrames = 150,
  gain = 0.55,
  smoothing = 0.18,
} = {}) {
  const original = bed.toContour();
  const settle = (frames) => {
    for (let i = 0; i < frames; i++) cat.update(bed);
  };

  const analytic = autoFitContour(cat, bed);
  bed.applyContour(analytic, { immediate: true });

  // Drop the cat fresh before refining. Each pass measures contact against
  // whatever pose the cat is currently in, so starting from the crumpled shape
  // some other contour left it in biases the whole search — the same cat would
  // get a different answer depending on which preset it happened to be on when
  // Auto-fit was pressed.
  cat.reset();

  for (let pass = 0; pass < passes; pass++) {
    settle(settleFrames);

    // How far each node's belly sits below its section's surface. Positive
    // means it is pressing into the cushion, negative means it is hovering.
    const offsets = bed.sections.map(() => []);
    for (const node of cat.spine) {
      const index = bed.indexAt(node.x);
      if (index < 0) continue;
      offsets[index].push(node.y + node.r - bed.surfaceY(index));
    }

    // Aim for the average penetration among the nodes currently bearing
    // weight: that is the depth at which this cat floats on this cushion, so
    // equalising to it spreads the load without changing how deep it rests.
    const pressing = [];
    for (const list of offsets) {
      for (const offset of list) if (offset > 0) pressing.push(offset);
    }
    const target = pressing.length > 0 ? mean(pressing) : 0;

    bed.sections.forEach((section, index) => {
      const list = offsets[index];
      if (list.length === 0) return;
      const error = mean(list) - target;
      const lift = clamp(section.lift - error * gain, BED.minLift, BED.maxLift);
      section.lift = lift;
      section.targetLift = lift;
    });

    relaxContour(bed, smoothing);
  }

  const refined = bed.toContour();

  // Judge the three candidates properly, on a settled cat. Each one starts from
  // a fresh drop: where a stiff body comes to rest on a lumpy surface depends on
  // the pose it arrived in, so judging a candidate from the pose the previous one
  // left behind compares them on unequal terms.
  let best = original;
  let bestScore = -1;
  for (const candidate of [original, analytic, refined]) {
    bed.applyContour(candidate, { immediate: true });
    cat.reset();
    settle(judgeFrames);
    const score = evaluateComfort(cat, bed).total;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  bed.applyContour(original, { immediate: true });
  return best;
}

/**
 * Nudges each section toward the average of its neighbours.
 *
 * Chasing per-section contact error alone converges on a slightly jagged
 * contour, because each section is free to satisfy its own nodes at the expense
 * of the step it creates against its neighbour — and it is those steps the cat's
 * spine has to bend over. Smoothing between passes regularises the solution,
 * trading a little contact precision for a noticeably straighter spine.
 */
function relaxContour(bed, amount) {
  if (amount <= 0) return;
  const lifts = bed.sections.map((s) => s.lift);

  bed.sections.forEach((section, i) => {
    const prev = lifts[i - 1] ?? lifts[i];
    const next = lifts[i + 1] ?? lifts[i];
    const smoothed = (prev + next) / 2;
    const lift = clamp(
      lifts[i] + (smoothed - lifts[i]) * amount,
      BED.minLift,
      BED.maxLift,
    );
    section.lift = lift;
    section.targetLift = lift;
  });
}

/**
 * Linearly interpolates a contour's y at an arbitrary x, clamping to the end
 * values outside the contour's range. Assumes `points` is sorted by x.
 */
function sampleContourY(points, x) {
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;

  for (let i = 1; i < points.length; i++) {
    if (x <= points[i].x) {
      const a = points[i - 1];
      const b = points[i];
      const span = b.x - a.x || 1e-6;
      return a.y + ((x - a.x) / span) * (b.y - a.y);
    }
  }
  return last.y;
}
