/**
 * main.js — application entry point.
 *
 * Responsibilities, and nothing else:
 *   - build the model (Bed, Cat), the views, and the UI
 *   - translate pointer and keyboard input into model changes
 *   - run the frame loop in a fixed order: simulate → score → draw
 *
 * Reading this file top to bottom should tell you where everything lives.
 */

import { BED, FLOOR_Y, PHYSICS } from './config.js';
import { Renderer } from './core/Renderer.js';
import { PointerInput } from './core/PointerInput.js';
import { clamp, lerp } from './core/math2d.js';
import { Bed } from './model/Bed.js';
import { Cat } from './model/Cat.js';
import { DEFAULT_CAT_ID, loadAllCatArt } from './cats/index.js';
import { evaluateComfort } from './model/comfort.js';
import { presetContour, solveComfortContour } from './model/bedShapes.js';
import { BedView } from './view/BedView.js';
import { CatView } from './view/CatView.js';
import { OverlayView } from './view/OverlayView.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { ScorePanel } from './ui/ScorePanel.js';

// --- model ------------------------------------------------------------------

// Every cat is drawn from its SVG, and its collision radius is measured off that
// same drawing, so there is nothing sensible to build until the art is in.
await loadAllCatArt();

const bed = new Bed();
const cat = new Cat(DEFAULT_CAT_ID, 'medium');

// --- rendering --------------------------------------------------------------

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
const renderer = new Renderer(canvas);
const bedView = new BedView(bed);
const catView = new CatView(cat);
const overlayView = new OverlayView(cat, bed);
const scorePanel = new ScorePanel();

/** Display-only flags, toggled from the sidebar. */
const viewState = {
  showPressure: false,
  showTarget: false,
  showSpine: false,
  showLabels: false,
  /** When true, dragging sculpts every section the pointer passes over. */
  brush: false,
};

/** Pointer/keyboard interaction state. */
const interaction = {
  hoveredIndex: -1,
  selectedIndex: -1,
  isDragging: false,
  /** Pointer-to-surface offset captured on press, so the section never jumps. */
  grabOffset: 0,
};

/** Latest comfort evaluation, recomputed every frame and used by the overlay. */
let comfort = evaluateComfort(cat, bed);

// --- actions ----------------------------------------------------------------

/**
 * Everything the UI and keyboard can do to the model. Keeping these in one
 * object means a shortcut and a button can never drift out of sync.
 */
const actions = {
  applyPreset(name) {
    bed.applyContour(presetContour(name, bed.sections.length));
  },

  autoFit() {
    // Runs the simulation internally, so the bed animates into a contour that
    // is already known to work rather than one that only looks plausible.
    bed.applyContour(solveComfortContour(cat, bed));
  },

  flatten() {
    bed.applyContour(bed.sections.map(() => BED.initialLift));
  },

  redropCat() {
    cat.reset();
  },

  setSectionCount(count) {
    if (count === bed.sections.length) return;
    bed.setSectionCount(count, { keepShape: true });
    interaction.selectedIndex = clamp(interaction.selectedIndex, -1, count - 1);
  },

  setFirmness(value) {
    bed.firmness = value;
  },

  setCat(id) {
    cat.setDesign(id);
  },

  setCatSize(key) {
    cat.setSize(key);
  },

  setStiffness(value) {
    // Maps the slider onto how hard the spine is pulled back toward its relaxed
    // shape each pass: low is a beanbag cat that drapes into every dip, high is
    // a plank cat that bridges across them.
    PHYSICS.shapeStiffness = lerp(0.05, 0.85, value);
  },
};

const controlPanel = new ControlPanel({
  viewState,
  actions,
  initialCatId: cat.designId,
});

// --- pointer interaction ----------------------------------------------------

/** A press anywhere in a section's vertical column grabs that section. */
function sectionAt(position) {
  if (!position) return -1;
  if (position.y > FLOOR_Y + 80) return -1;
  return bed.indexAt(position.x);
}

const pointer = new PointerInput(canvas, renderer, {
  onDown(position) {
    const index = sectionAt(position);
    if (index < 0) {
      interaction.selectedIndex = -1;
      return;
    }
    interaction.selectedIndex = index;
    interaction.isDragging = true;
    interaction.grabOffset = position.y - bed.surfaceY(index);
  },

  onMove(position, event) {
    if (!interaction.isDragging) return;

    const sculpting = viewState.brush || event.shiftKey;
    const index = sculpting ? sectionAt(position) : interaction.selectedIndex;
    if (index < 0) return;

    if (sculpting) interaction.selectedIndex = index;
    bed.setTargetSurfaceY(index, position.y - interaction.grabOffset);
  },

  onUp() {
    interaction.isDragging = false;
  },
});

// --- keyboard ---------------------------------------------------------------

window.addEventListener('keydown', (event) => {
  // Leave the sidebar's own inputs alone.
  if (event.target instanceof HTMLElement
      && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) {
    return;
  }

  const lastIndex = bed.sections.length - 1;
  const selected = interaction.selectedIndex;

  switch (event.key) {
    case 'ArrowLeft':
      interaction.selectedIndex = selected < 0 ? 0 : clamp(selected - 1, 0, lastIndex);
      break;
    case 'ArrowRight':
      interaction.selectedIndex = selected < 0 ? 0 : clamp(selected + 1, 0, lastIndex);
      break;
    case 'ArrowUp':
      if (selected >= 0) bed.nudge(selected, BED.nudgeStep);
      break;
    case 'ArrowDown':
      if (selected >= 0) bed.nudge(selected, -BED.nudgeStep);
      break;
    case 'f':
    case 'F':
      actions.flatten();
      break;
    case 'a':
    case 'A':
      actions.autoFit();
      break;
    case ' ':
      actions.redropCat();
      break;
    default:
      return;
  }

  event.preventDefault();
});

// --- frame loop -------------------------------------------------------------

function frame(now) {
  interaction.hoveredIndex = interaction.isDragging
    ? interaction.selectedIndex
    : sectionAt(pointer.position);

  canvas.style.cursor = interaction.hoveredIndex >= 0 ? 'ns-resize' : 'default';

  bed.update();
  cat.update(bed);
  comfort = evaluateComfort(cat, bed);
  scorePanel.update(comfort, now);

  const ctx = renderer.begin();
  bedView.draw(ctx, {
    hoveredIndex: interaction.hoveredIndex,
    selectedIndex: interaction.selectedIndex,
    showLabels: viewState.showLabels,
  });
  catView.draw(ctx, { showSpine: viewState.showSpine });
  bedView.drawSurfaceSeam(ctx);
  overlayView.draw(ctx, {
    showPressure: viewState.showPressure,
    showTarget: viewState.showTarget,
    comfort,
  });
  bedView.drawHandles(ctx, interaction);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Exposed for tinkering from the browser console; not used by the app itself.
Object.assign(window, { bed, cat, actions, viewState, controlPanel });
