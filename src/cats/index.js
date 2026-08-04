/**
 * cats/index.js — the cat registry.
 *
 * Each cat lives in its own file in this folder and exports one `CatDesign`.
 *
 * A cat's *appearance* is not described here at all: it is the SVG named in
 * `art.url`, drawn as authored and bent along the spine at render time (see
 * view/CatArt.js and view/CatView.js). Redraw the SVG and the cat changes; there
 * is nothing to keep in sync.
 *
 * What a design does carry is the handful of numbers tying that drawing to the
 * simulation — where the body starts and ends, where the spine runs through it —
 * plus how the cat prefers to hold itself.
 *
 * @typedef {Object} ArtSpec
 * @property {string} url Path to the SVG, served by the dev server.
 * @property {number} bodyX0
 *   SVG x of the nose: where the simulated spine begins.
 * @property {number} bodyX1
 *   SVG x of the rump: where it ends. Artwork outside `bodyX0..bodyX1` still
 *   draws — whiskers past the nose, a tail past the rump — carried along by the
 *   nearest end of the spine.
 * @property {number} spineY
 *   SVG y the spine runs along. Artwork rotates about this line as the cat
 *   bends, so put it roughly through the middle of the body; the exact value
 *   only shifts how deep the collision radius reads.
 * @property {number} maxBelly
 *   How far below `spineY`, in SVG units, still counts as belly when measuring
 *   what the cat rests on. Anything lower is ignored — without this a tail
 *   hanging off the back reads as an enormously deep body and the cat tries to
 *   balance on it.
 *
 * @typedef {Object} CatBody
 * @property {number} length
 *   Nose-to-rump length in world units. Sets how big the cat is on the bed; the
 *   artwork is scaled to match.
 * @property {[number, number][]} restCurve
 *   [t, turnAngle] pairs in radians per joint, t running 0 at the nose to 1 at
 *   the rump. Positive turns the spine downward (screen y grows down). These
 *   accumulate along the spine, so a mostly-positive profile gives a back that
 *   is convex upward. Overall tilt is normalised away by `restTilt`, so they can
 *   be edited freely without the cat ending up nose-down.
 *
 *   These cats lie flat in their drawings, so their curves are near zero: what
 *   shape the spine ends up in comes from following the bed.
 * @property {number} restTilt
 *   Angle of the nose→rump chord in the rest pose. 0 lies level, negative lifts
 *   the head.
 *
 * @typedef {Object} CatDesign
 * @property {string} id
 * @property {string} name Shown in the picker.
 * @property {string} blurb One line describing the shape, for the picker title.
 * @property {ArtSpec} art
 * @property {CatBody} body
 * @property {object} [artData] Filled in by `loadAllCatArt`; do not author.
 */

import { loadCatArt } from '../view/CatArt.js';
import { noodle } from './noodle.js';
import { gizmo } from './gizmo.js';
import { mochi } from './mochi.js';

/**
 * Every cat available in the picker, in display order.
 * @type {Record<string, CatDesign>}
 */
export const CAT_DESIGNS = {
  [gizmo.id]: gizmo,
  [noodle.id]: noodle,
  [mochi.id]: mochi,
};

/** Which cat the app starts with. */
export const DEFAULT_CAT_ID = gizmo.id;

/**
 * Looks up a design, falling back to the default rather than throwing so that a
 * stale id (from an old link or a renamed file) cannot break the app.
 * @param {string} id
 * @returns {CatDesign}
 */
export function getCatDesign(id) {
  return CAT_DESIGNS[id] ?? CAT_DESIGNS[DEFAULT_CAT_ID];
}

/**
 * Loads every cat's artwork and attaches it to its design. The app waits for
 * this before its first frame, because a cat's collision radius is measured off
 * its drawing and there is nothing sensible to simulate until it is known.
 */
export async function loadAllCatArt() {
  await Promise.all(Object.values(CAT_DESIGNS).map(async (design) => {
    design.artData = await loadCatArt(design.art);
  }));
}
