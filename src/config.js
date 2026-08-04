/**
 * config.js — every tunable number in the app lives here.
 *
 * Nothing in this file depends on anything else, so it is safe to tweak
 * values while the app is running (just reload). If you find yourself
 * hard-coding a number elsewhere, it probably belongs here instead.
 */

/**
 * The app draws into a fixed "world" coordinate box and the renderer scales
 * that box to fit whatever size the canvas happens to be. That means all
 * geometry below can be written in stable, readable numbers.
 */
export const WORLD = {
  width: 1300,
  height: 950,
};

/** Ground line the bed legs stand on. */
export const FLOOR_Y = 900;

export const BED = {
  /** Horizontal extent of the bed. */
  left: 90,
  right: 1210,

  /** How many independently adjustable sections the bed is divided into. */
  sectionCount: 14,

  /** Empty space between neighbouring section tops, in world units. */
  gap: 12,

  /** Corner rounding of each section's inverted-U silhouette. */
  cornerRadius: 20,

  /** Surface height (y) of a section at lift = 0. Larger y = lower down. */
  baseSurfaceY: 640,

  /** A section's lift is clamped to this range, in world units. */
  minLift: 0,
  maxLift: 300,

  /** Lift every section starts at. */
  initialLift: 90,

  /**
   * How springy a section is when you drag it. 1 = snaps instantly,
   * lower = eases toward the target for a nicer feel.
   */
  followSpeed: 0.35,

  /** Keyboard nudge step for the selected section. */
  nudgeStep: 8,
};

/**
 * Settings shared by every cat.
 *
 * Anything that differs between cats — proportions, relaxed pose, ears, legs,
 * tail, face — is not here. Each cat owns those in its own file under
 * `src/cats/`, and `src/cats/index.js` documents the format.
 */
export const CAT = {
  /** Spine resolution. More nodes = smoother deformation, slightly slower. */
  nodeCount: 30,

  /** Vertical spawn height; the cat drops onto the bed from here. */
  spawnY: 330,

  /**
   * Size presets. Scales length and thickness together; the physics and
   * comfort scoring adapt automatically.
   */
  sizes: {
    small: { label: 'Kitten', scale: 0.72 },
    medium: { label: 'House cat', scale: 1.0 },
    large: { label: 'Chonk', scale: 1.22 },
  },
};

export const PHYSICS = {
  /** World units per second squared. */
  gravity: 2600,

  /** Fixed timestep. Decoupled from frame rate so behaviour is repeatable. */
  timeStep: 1 / 120,

  /** Physics substeps per rendered frame. */
  substeps: 2,

  /** Velocity retained each step. Lower = more sluggish, settles sooner. */
  damping: 0.90,

  /**
   * Relaxation passes per substep for the structural constraints (shape and
   * stretch). Shape matching converges in very few passes, so this is small.
   */
  iterations: 4,

  /**
   * Bending is modelled by *local shape matching* rather than per-joint angular
   * constraints. The spine is covered by overlapping windows; each window's
   * rest pose is rigidly fitted onto the window's current nodes, and every node
   * is pulled toward the average of the fits that cover it.
   *
   * Per-joint angular constraints were tried first and do not work here: on a
   * 30-node chain a Gauss-Seidel sweep propagates a correction about one node
   * per iteration, so the solver cannot keep up with contact disturbing the
   * spine every substep, and the ends buckle. Shape matching is global within
   * each window, so it converges immediately and cannot buckle.
   *
   * `clusterSize` is the real stiffness dial: it sets the length of spine that
   * stays locally rigid. Larger = plankier cat, smaller = more floppy detail.
   */
  clusterSize: 7,
  clusterStride: 2,

  /** How strongly nodes are pulled toward the matched rest shape, per pass. */
  shapeStiffness: 0.35,

  /**
   * Contact compliance. Unlike stretch and bend, contact is resolved *once* per
   * substep and only partially, which matters for two reasons:
   *
   *  - Solving contact inside the relaxation loop would let it out-vote the
   *    bend constraint on every pass. Where the two genuinely conflict, that
   *    fight leaks sideways motion into the spine and buckles it.
   *  - A partial push leaves a small residual penetration proportional to how
   *    hard that part of the body is pressing down. That penetration *is* the
   *    cushion compressing, and it is what the pressure map reads.
   *
   * Interpolated between these two ends by the bed's firmness setting.
   *
   * These are deliberately low. Equilibrium penetration is roughly
   * (terminal velocity per substep) / stiffness, so a stiff cushion settles at
   * well under a world unit — smaller than the steps between bed sections, which
   * left which-node-touches decided by solver noise and made the pressure map
   * meaningless. Soft values put penetration in the 5–30 unit range, comfortably
   * above that noise, so load varies smoothly along the body. It also looks
   * right: the cat nestles into the cushion instead of balancing on top of it.
   */
  contactStiffnessSoft: 0.06,
  contactStiffnessFirm: 0.45,

  /** How hard the spine resists stretching. Keep near 1. */
  stretchStiffness: 1.0,

  /** Smoothing applied to per-node contact load before it is displayed. */
  loadSmoothing: 0.12,
};

export const COMFORT = {
  /**
   * Weights for the three comfort components. They should sum to 1.
   * - support:  how much of the body is actually held up
   * - posture:  how close the spine is to its relaxed curve
   * - pressure: how evenly the cat's weight is spread across contacts
   */
  weights: { support: 0.3, posture: 0.42, pressure: 0.28 },

  /** Mean per-joint bend error (radians) that scores zero on posture. */
  postureTolerance: 0.09,

  /**
   * Peak-to-average load ratio that scores zero on pressure. A ratio of 1 is
   * perfectly shared weight, so this is "how many times its fair share the
   * worst spot may carry before the score bottoms out".
   *
   * Calibrated against what these cats can actually reach. They are drawn with
   * their heads held clear of the ground, and a cantilevered head levers its
   * weight onto the shoulder behind it, so concentration runs far higher than it
   * did for a cat lying evenly along its whole length. At 3.0 every bed scored
   * zero here and the number told you nothing; at 7.0 it separates a bed that
   * catches the head from one that does not.
   */
  pressureTolerance: 7.0,

  /** Nodes must be within this distance of the surface to count as supported. */
  contactTolerance: 6,
};

export const SKETCH = {
  /** Marker-pen line weight for the cat and bed outlines. */
  strokeWidth: 9,

  /** Thinner weight for interior detail lines (legs, face, belly crease). */
  detailWidth: 6,

  /**
   * Hand-drawn wobble applied to outlines, in world units. Deterministic per
   * vertex index, so it stays put instead of shimmering every frame.
   */
  wobble: 2.4,

  ink: '#000000',
  paper: '#ffffff',

  /** Overlay colours, kept greyscale to match the black-and-white draft. */
  guide: 'rgba(0, 0, 0, 0.18)',
  highlight: 'rgba(0, 0, 0, 0.08)',
};
