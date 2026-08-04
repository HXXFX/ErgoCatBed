/**
 * ControlPanel.js — wires the sidebar widgets in index.html to actions.
 *
 * This module owns no state of its own. It reads and writes the shared
 * `viewState` object and calls into `actions`, both supplied by main.js, which
 * keeps the flow of control in one direction and easy to follow.
 */

import { PRESETS } from '../model/bedShapes.js';
import { CAT_DESIGNS } from '../cats/index.js';

export class ControlPanel {
  /**
   * @param {object} options
   * @param {object} options.viewState Mutable display flags, owned by main.js.
   * @param {{
   *   applyPreset: (name: string) => void,
   *   autoFit: () => void,
   *   flatten: () => void,
   *   redropCat: () => void,
   *   setSectionCount: (count: number) => void,
   *   setFirmness: (value: number) => void,
   *   setCat: (id: string) => void,
   *   setCatSize: (key: string) => void,
   *   setStiffness: (value: number) => void,
   * }} options.actions
   * @param {string} options.initialCatId Which cat button starts pressed.
   */
  constructor({ viewState, actions, initialCatId }) {
    this.viewState = viewState;
    this.actions = actions;

    this._buildPresetButtons();
    this._buildCatButtons(initialCatId);
    this._wireButtons();
    this._wireSliders();
    this._wireToggles();
  }

  /** Preset buttons come from bedShapes.js so adding a preset is a one-liner. */
  _buildPresetButtons() {
    const host = document.getElementById('preset-buttons');
    for (const [name, preset] of Object.entries(PRESETS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = preset.label;
      button.dataset.preset = name;
      button.addEventListener('click', () => this.actions.applyPreset(name));
      host.appendChild(button);
    }
  }

  /**
   * One button per cat, built from the registry so adding a cat needs no changes
   * here. They behave as a radio group via `aria-pressed`, which the stylesheet
   * uses to show which cat is on the bed.
   */
  _buildCatButtons(initialCatId) {
    const host = document.getElementById('cat-buttons');
    this.catButtons = [];

    for (const design of Object.values(CAT_DESIGNS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = design.name;
      button.title = design.blurb;
      button.dataset.cat = design.id;
      button.setAttribute('aria-pressed', String(design.id === initialCatId));
      button.addEventListener('click', () => {
        this.actions.setCat(design.id);
        this._markActiveCat(design.id);
      });
      host.appendChild(button);
      this.catButtons.push(button);
    }
  }

  _markActiveCat(id) {
    for (const button of this.catButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.cat === id));
    }
  }

  _wireButtons() {
    document.getElementById('btn-autofit')
      .addEventListener('click', () => this.actions.autoFit());
    document.getElementById('btn-flatten')
      .addEventListener('click', () => this.actions.flatten());
    document.getElementById('btn-drop')
      .addEventListener('click', () => this.actions.redropCat());
  }

  _wireSliders() {
    bindRange('input-sections', 'out-sections', (value, output) => {
      output.textContent = String(value);
      this.actions.setSectionCount(value);
    });

    bindRange('input-firmness', 'out-firmness', (value, output) => {
      output.textContent = `${value}%`;
      this.actions.setFirmness(value / 100);
    });

    bindRange('input-stiffness', 'out-stiffness', (value, output) => {
      output.textContent = `${value}%`;
      this.actions.setStiffness(value / 100);
    });

    document.getElementById('input-size').addEventListener('change', (ev) => {
      this.actions.setCatSize(ev.target.value);
    });
  }

  /** Checkboxes write straight into viewState; the renderer reads it each frame. */
  _wireToggles() {
    const toggles = {
      'chk-pressure': 'showPressure',
      'chk-target': 'showTarget',
      'chk-spine': 'showSpine',
      'chk-labels': 'showLabels',
      'chk-brush': 'brush',
    };

    for (const [id, key] of Object.entries(toggles)) {
      const input = document.getElementById(id);
      input.checked = Boolean(this.viewState[key]);
      input.addEventListener('change', () => {
        this.viewState[key] = input.checked;
      });
    }
  }

}

/** Hooks up a range input to its <output> and a change handler. */
function bindRange(inputId, outputId, onInput) {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);
  const handler = () => onInput(Number(input.value), output);
  input.addEventListener('input', handler);
  handler();
}
