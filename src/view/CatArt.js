/**
 * CatArt.js — turns a cat's SVG drawing into something the app can bend.
 *
 * The cats are authored as SVGs (see assets/cats/). Nothing here redraws them:
 * the artwork is rasterised once at load and then warped along the spine at draw
 * time, so what you see on the bed is the drawing itself, bent.
 *
 * Two things have to be worked out from the file:
 *
 *  - **A transparent cutout.** The exports carry a full-canvas white rectangle
 *    behind the art. Painted over the bed that would white out the scene, so the
 *    background rectangle is dropped before rasterising, leaving the strokes on
 *    transparency. The body interior is then transparent too, which is wrong —
 *    a cat has to hide the bed behind it — so the interior is recovered by
 *    flood-filling from the border and painting white everywhere the flood could
 *    not reach.
 *
 *  - **Where the belly is.** The bottom of that same silhouette, column by
 *    column, is what the simulation collides against. Measuring it from the
 *    drawing rather than authoring it by hand is what keeps the drawn underside
 *    and the contact surface the same line — including the raised head, which in
 *    all three drawings sits clear of the ground on purpose.
 */

/** Rasterisation resolution, pixels per SVG user unit. */
const PIXELS_PER_UNIT = 5;

/** Alpha above which a pixel counts as ink when finding the silhouette. */
const INK_ALPHA = 40;

/**
 * Loads and prepares one cat's artwork.
 *
 * @param {import('../cats/index.js').ArtSpec} spec
 * @returns {Promise<{
 *   canvas: HTMLCanvasElement,
 *   pixelsPerUnit: number,
 *   originX: number, originY: number,
 *   minX: number, maxX: number,
 *   spineY: number, bodyX0: number, bodyX1: number,
 *   bellyAt: (t: number) => number,
 * }>}
 */
export async function loadCatArt(spec) {
  const source = await fetch(spec.url).then((r) => {
    if (!r.ok) throw new Error(`cat art ${spec.url}: ${r.status}`);
    return r.text();
  });

  const { svg, viewBox } = stripBackdrop(source);
  const raster = await rasterise(svg, viewBox);
  const mask = findSilhouette(raster);
  const art = compositeOnWhite(raster, mask);
  const cropped = crop(art, mask, viewBox);

  return {
    ...cropped,
    pixelsPerUnit: PIXELS_PER_UNIT,
    spineY: spec.spineY,
    bodyX0: spec.bodyX0,
    bodyX1: spec.bodyX1,
    bellyAt: makeBellyProfile(mask, spec),
  };
}

// ---------------------------------------------------------------------------
// SVG preparation
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Removes the opaque backdrop so the art rasterises onto transparency.
 *
 * The exports draw a full-canvas rectangle with every shape punched out of it as
 * a hole, which is how the white page is represented. Any path containing a
 * subpath that covers essentially the whole viewBox is that backdrop layer, and
 * every shape it carries is redrawn by later paths anyway.
 */
function stripBackdrop(source) {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;

  const viewBox = (root.getAttribute('viewBox') ?? '0 0 270 270')
    .split(/[\s,]+/).map(Number);
  const canvasArea = viewBox[2] * viewBox[3];

  // getBBox only reports for elements that are laid out, so measure subpaths in
  // a throwaway SVG attached to the document.
  const scratch = document.createElementNS(SVG_NS, 'svg');
  scratch.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  const probe = document.createElementNS(SVG_NS, 'path');
  scratch.appendChild(probe);
  document.body.appendChild(scratch);

  try {
    for (const path of [...doc.querySelectorAll('path')]) {
      const d = path.getAttribute('d') ?? '';
      // Subpaths always restart with an absolute moveto in these exports, so
      // splitting on M is safe.
      const isBackdrop = d.split(/(?=M)/).some((subpath) => {
        if (!subpath.trim()) return false;
        probe.setAttribute('d', subpath);
        const box = probe.getBBox();
        return box.width * box.height > canvasArea * 0.9;
      });
      if (isBackdrop) path.remove();
    }
  } finally {
    scratch.remove();
  }

  return { svg: new XMLSerializer().serializeToString(doc), viewBox };
}

/** Draws the SVG into an offscreen canvas at PIXELS_PER_UNIT. */
async function rasterise(svgText, viewBox) {
  const width = Math.round(viewBox[2] * PIXELS_PER_UNIT);
  const height = Math.round(viewBox[3] * PIXELS_PER_UNIT);

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not rasterise cat art'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return { canvas, ctx, width, height };
}

// ---------------------------------------------------------------------------
// Silhouette
// ---------------------------------------------------------------------------

/**
 * Flood-fills inward from the border over everything that is not ink. Whatever
 * the flood cannot reach is the cat: its strokes plus every region they enclose.
 *
 * @returns {{inside: Uint8Array, width: number, height: number}}
 */
function findSilhouette({ ctx, width, height }) {
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const outside = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  while (stack.length > 0) {
    const index = stack.pop();
    if (outside[index] || pixels[index * 4 + 3] > INK_ALPHA) continue;
    outside[index] = 1;

    const x = index % width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (index >= width) stack.push(index - width);
    if (index < width * (height - 1)) stack.push(index + width);
  }

  const inside = new Uint8Array(width * height);
  for (let i = 0; i < inside.length; i++) inside[i] = outside[i] ? 0 : 1;
  return { inside, width, height };
}

/**
 * Paints the silhouette white and lays the artwork over it, so the cat is opaque
 * where it should be and transparent everywhere else. The white is hard-edged,
 * but the antialiased strokes sit on top of that edge and hide it.
 */
function compositeOnWhite(raster, { inside }) {
  const { width, height } = raster;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const fill = ctx.createImageData(width, height);
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    fill.data[i * 4] = 255;
    fill.data[i * 4 + 1] = 255;
    fill.data[i * 4 + 2] = 255;
    fill.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(fill, 0, 0);
  ctx.drawImage(raster.canvas, 0, 0);
  return canvas;
}

/** Trims the transparent margin so the warp does not push empty pixels around. */
function crop(canvas, { inside, width, height }, viewBox) {
  let minPx = width; let maxPx = -1; let minPy = height; let maxPy = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside[x + y * width]) continue;
      if (x < minPx) minPx = x;
      if (x > maxPx) maxPx = x;
      if (y < minPy) minPy = y;
      if (y > maxPy) maxPy = y;
    }
  }

  const pad = 2;
  minPx = Math.max(0, minPx - pad); minPy = Math.max(0, minPy - pad);
  maxPx = Math.min(width - 1, maxPx + pad); maxPy = Math.min(height - 1, maxPy + pad);

  const out = document.createElement('canvas');
  out.width = maxPx - minPx + 1;
  out.height = maxPy - minPy + 1;
  out.getContext('2d').drawImage(canvas, -minPx, -minPy);

  return {
    canvas: out,
    originX: viewBox[0] + minPx / PIXELS_PER_UNIT,
    originY: viewBox[1] + minPy / PIXELS_PER_UNIT,
    minX: viewBox[0] + minPx / PIXELS_PER_UNIT,
    maxX: viewBox[0] + (maxPx + 1) / PIXELS_PER_UNIT,
  };
}

// ---------------------------------------------------------------------------
// Belly profile
// ---------------------------------------------------------------------------

/**
 * Measures how far the silhouette's underside sits below the spine line, as a
 * function of position along the body, in SVG units.
 *
 * `maxBelly` clamps the measurement: a tail hanging off the back would otherwise
 * be read as an enormously deep body and the cat would try to rest on its tail.
 * The result is smoothed, because the collision radius is the one profile that
 * has to stay gentle — a step in it makes the spine kink to follow a flat bed.
 */
function makeBellyProfile({ inside, width, height }, spec) {
  const samples = 64;
  const values = [];

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const xUnits = spec.bodyX0 + (spec.bodyX1 - spec.bodyX0) * t;
    const px = Math.round((xUnits - 0) * PIXELS_PER_UNIT);
    const limit = Math.round((spec.spineY + spec.maxBelly) * PIXELS_PER_UNIT);

    let bottom = -1;
    const maxY = Math.min(height - 1, limit);
    for (let y = maxY; y >= 0; y--) {
      if (inside[Math.min(width - 1, Math.max(0, px)) + y * width]) { bottom = y; break; }
    }

    values.push(bottom < 0 ? spec.maxBelly * 0.5 : bottom / PIXELS_PER_UNIT - spec.spineY);
  }

  // Smoothed hard. A hand-drawn underside wobbles by a unit or two from stroke
  // to stroke, which is invisible in the drawing but is several world units of
  // collision radius — enough that the cat rests on a handful of bumps and the
  // pressure reading collapses. The head-versus-body difference that actually
  // matters survives this easily.
  for (let pass = 0; pass < 10; pass++) smooth(values);

  return (t) => {
    const pos = Math.min(1, Math.max(0, t)) * (samples - 1);
    const i = Math.floor(pos);
    if (i >= samples - 1) return values[samples - 1];
    return values[i] + (values[i + 1] - values[i]) * (pos - i);
  };
}

/** In-place three-tap smoothing with the ends held. */
function smooth(values) {
  const copy = values.slice();
  for (let i = 0; i < values.length; i++) {
    const prev = copy[i - 1] ?? copy[i];
    const next = copy[i + 1] ?? copy[i];
    values[i] = (prev + copy[i] * 2 + next) / 4;
  }
}
