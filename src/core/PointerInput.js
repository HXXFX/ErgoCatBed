/**
 * PointerInput.js — normalises mouse/touch/pen into world-space callbacks.
 *
 * Deliberately dumb: it knows nothing about beds or cats. It reports where
 * the pointer is in world units and whether it is pressed; the controller in
 * main.js decides what that means.
 */

export class PointerInput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Renderer.js').Renderer} renderer
   * @param {{
   *   onDown?: (pos: {x:number,y:number}, ev: PointerEvent) => void,
   *   onMove?: (pos: {x:number,y:number}, ev: PointerEvent) => void,
   *   onUp?:   (pos: {x:number,y:number}, ev: PointerEvent) => void,
   *   onLeave?: () => void,
   * }} handlers
   */
  constructor(canvas, renderer, handlers = {}) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.handlers = handlers;

    /** Latest pointer position in world units, or null if it has left. */
    this.position = null;
    /** True while a drag is in progress. */
    this.isDown = false;

    this._bound = {
      down: this._onDown.bind(this),
      move: this._onMove.bind(this),
      up: this._onUp.bind(this),
      leave: this._onLeave.bind(this),
    };

    canvas.addEventListener('pointerdown', this._bound.down);
    canvas.addEventListener('pointermove', this._bound.move);
    window.addEventListener('pointerup', this._bound.up);
    window.addEventListener('pointercancel', this._bound.up);
    canvas.addEventListener('pointerleave', this._bound.leave);

    // Stops touch drags from scrolling the page while sculpting the bed.
    canvas.style.touchAction = 'none';
  }

  _onDown(ev) {
    // Capture keeps the drag alive when the pointer leaves the canvas, but it
    // throws for a pointer id the browser does not recognise. Losing capture is
    // survivable; losing the whole drag is not.
    try {
      this.canvas.setPointerCapture?.(ev.pointerId);
    } catch {
      /* not capturable — the window-level pointerup still ends the drag */
    }

    this.isDown = true;
    this.position = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.handlers.onDown?.(this.position, ev);
  }

  _onMove(ev) {
    this.position = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.handlers.onMove?.(this.position, ev);
  }

  _onUp(ev) {
    if (!this.isDown) return;
    this.isDown = false;
    this.position = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.handlers.onUp?.(this.position, ev);
  }

  _onLeave() {
    if (this.isDown) return;
    this.position = null;
    this.handlers.onLeave?.();
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._bound.down);
    this.canvas.removeEventListener('pointermove', this._bound.move);
    window.removeEventListener('pointerup', this._bound.up);
    window.removeEventListener('pointercancel', this._bound.up);
    this.canvas.removeEventListener('pointerleave', this._bound.leave);
  }
}
