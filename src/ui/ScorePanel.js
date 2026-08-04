/**
 * ScorePanel.js — pushes comfort numbers into the sidebar.
 *
 * The simulation runs at 60fps but the numbers only need to update a few times
 * a second; anything faster is unreadable and thrashes layout. `throttleMs`
 * controls that.
 */

export class ScorePanel {
  constructor({ throttleMs = 120 } = {}) {
    this.elements = {
      total: document.getElementById('score-total'),
      verdict: document.getElementById('score-verdict'),
      bars: {
        support: document.getElementById('bar-support'),
        posture: document.getElementById('bar-posture'),
        pressure: document.getElementById('bar-pressure'),
      },
      values: {
        support: document.getElementById('val-support'),
        posture: document.getElementById('val-posture'),
        pressure: document.getElementById('val-pressure'),
      },
    };

    this.throttleMs = throttleMs;
    this._lastUpdate = 0;
  }

  /**
   * @param {ReturnType<import('../model/comfort.js').evaluateComfort>} comfort
   * @param {number} now Timestamp from the animation loop.
   */
  update(comfort, now) {
    if (now - this._lastUpdate < this.throttleMs) return;
    this._lastUpdate = now;

    this.elements.total.textContent = String(comfort.total);
    this.elements.verdict.textContent = comfort.verdict;

    for (const key of ['support', 'posture', 'pressure']) {
      this.elements.bars[key].style.width = `${comfort[key]}%`;
      this.elements.values[key].textContent = String(comfort[key]);
    }
  }
}
