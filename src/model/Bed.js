/**
 * Bed.js — the adjustable bed.
 *
 * The bed is a row of independent sections. Each section has a `lift`
 * (how far its top surface is raised above the lowest position) and a
 * `targetLift` that the lift eases toward, which is what makes dragging feel
 * springy rather than instantaneous.
 *
 * This class is pure model: it holds geometry and state, and knows how to
 * answer "how high is the surface at this x?". It never touches the canvas.
 */

import { BED } from '../config.js';
import { clamp } from '../core/math2d.js';

export class Bed {
  constructor(sectionCount = BED.sectionCount) {
    /**
     * Cushion firmness in 0..1, where 1 is a rigid board. Read by the cat's
     * contact solver, not used for geometry.
     */
    this.firmness = 0.5;
    this.setSectionCount(sectionCount, { keepShape: false });
  }

  /** Total horizontal span of the bed in world units. */
  get span() {
    return BED.right - BED.left;
  }

  /** Width of one section's slot, including the gap to its neighbour. */
  get slotWidth() {
    return this.span / this.sections.length;
  }

  /**
   * Rebuilds the section list. When `keepShape` is true the existing contour
   * is resampled into the new resolution, so changing the section count does
   * not destroy the shape the user has sculpted.
   */
  setSectionCount(count, { keepShape = true } = {}) {
    const previous = keepShape && this.sections ? this.sections.slice() : null;
    const next = [];

    for (let i = 0; i < count; i++) {
      const lift = previous
        ? sampleLifts(previous, count === 1 ? 0.5 : i / (count - 1))
        : BED.initialLift;
      next.push({ index: i, lift, targetLift: lift });
    }

    this.sections = next;
  }

  /** Left/right/centre x of a section's top surface, accounting for the gap. */
  bounds(index) {
    const slot = this.slotWidth;
    const left = BED.left + index * slot + BED.gap / 2;
    const right = left + slot - BED.gap;
    return { left, right, center: (left + right) / 2, width: right - left };
  }

  /** World y of a section's top surface. Smaller y is higher on screen. */
  surfaceY(index) {
    return BED.baseSurfaceY - this.sections[index].lift;
  }

  /**
   * Index of the section containing `x`, or -1 when x is off the bed.
   * Points inside the gap between two sections snap to the nearer one, so
   * dragging never falls into a dead zone.
   */
  indexAt(x) {
    if (x < BED.left || x > BED.right) return -1;
    const raw = Math.floor((x - BED.left) / this.slotWidth);
    return clamp(raw, 0, this.sections.length - 1);
  }

  /**
   * Height of the top surface at `x`, or `null` where there is no bed.
   *
   * This is the geometric surface. How far the cat actually sinks below it is
   * not decided here — it emerges from the contact compliance in Cat.js, which
   * `firmness` controls.
   */
  surfaceAt(x) {
    const index = this.indexAt(x);
    return index < 0 ? null : this.surfaceY(index);
  }

  /** Sets a section's target lift, clamped to the legal range. */
  setTargetLift(index, lift) {
    const section = this.sections[index];
    if (!section) return;
    section.targetLift = clamp(lift, BED.minLift, BED.maxLift);
  }

  /** Sets target lift from a desired surface y, which is how dragging works. */
  setTargetSurfaceY(index, y) {
    this.setTargetLift(index, BED.baseSurfaceY - y);
  }

  /** Adds to a section's target lift. Positive raises the section. */
  nudge(index, delta) {
    const section = this.sections[index];
    if (!section) return;
    this.setTargetLift(index, section.targetLift + delta);
  }

  /**
   * Applies a whole contour at once, e.g. from a preset or from Auto-fit.
   * `lifts` may be any length — it is resampled to the current section count.
   */
  applyContour(lifts, { immediate = false } = {}) {
    if (lifts.length === 0) return;
    const source = lifts.map((lift) => ({ lift }));
    const count = this.sections.length;

    this.sections.forEach((section, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      section.targetLift = clamp(sampleLifts(source, t), BED.minLift, BED.maxLift);
      if (immediate) section.lift = section.targetLift;
    });
  }

  /** Current contour as a plain array of lifts. Handy for presets and tests. */
  toContour() {
    return this.sections.map((s) => s.lift);
  }

  /** Eases every section toward its target. Call once per frame. */
  update() {
    for (const section of this.sections) {
      const delta = section.targetLift - section.lift;
      if (Math.abs(delta) < 0.05) {
        section.lift = section.targetLift;
      } else {
        section.lift += delta * BED.followSpeed;
      }
    }
  }

}

/**
 * Reads a lift value out of an existing section list at normalised position
 * `t`, interpolating between neighbours. Used when the section count changes.
 */
function sampleLifts(sections, t) {
  if (sections.length === 0) return BED.initialLift;
  if (sections.length === 1) return sections[0].lift;

  const pos = t * (sections.length - 1);
  const i = Math.floor(pos);
  if (i >= sections.length - 1) return sections[sections.length - 1].lift;
  const frac = pos - i;
  return sections[i].lift * (1 - frac) + sections[i + 1].lift * frac;
}
