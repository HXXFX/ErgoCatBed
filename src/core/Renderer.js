/**
 * Renderer.js — owns the canvas, the device-pixel-ratio handling, and the
 * mapping between world coordinates (see config.WORLD) and screen pixels.
 *
 * Everything that draws receives a context that is already scaled and
 * translated, so views can work purely in world units and never think about
 * canvas size or retina displays.
 */

import { WORLD, SKETCH } from '../config.js';

export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /** Uniform world→screen scale factor, recomputed on resize. */
    this.scale = 1;
    /** Screen-space offset of the world origin, in CSS pixels. */
    this.offsetX = 0;
    this.offsetY = 0;

    this._observer = new ResizeObserver(() => this.resize());
    this._observer.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  /**
   * Recomputes the backing-store size and the letterbox transform so the
   * world box fits entirely inside the canvas without distortion.
   */
  resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const cssWidth = host.clientWidth;
    const cssHeight = host.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    this.dpr = dpr;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.scale = Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
    this.offsetX = (cssWidth - WORLD.width * this.scale) / 2;
    this.offsetY = (cssHeight - WORLD.height * this.scale) / 2;
  }

  /** Clears the frame and applies the world transform. Call once per frame. */
  begin() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = SKETCH.paper;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    return ctx;
  }

  /** Converts a pointer event's client coordinates into world coordinates. */
  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  destroy() {
    this._observer.disconnect();
  }
}
