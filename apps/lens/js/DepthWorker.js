/**
 * DepthWorker — Web Worker that runs DepthAnything v2 Small (quantised ONNX)
 * via Transformers.js.  Receives an ImageBitmap from the main thread, runs
 * monocular depth estimation, and replies with the normalised UV coordinates
 * of the most planar region detected in the bottom half of the frame.
 *
 * Messages IN:
 *   { type: 'load' }                         — init model (called once)
 *   { type: 'infer', bitmap: ImageBitmap }   — run depth estimation
 *
 * Messages OUT:
 *   { type: 'ready' }                        — model loaded successfully
 *   { type: 'error', message }               — model load failed
 *   { type: 'result', floorUV }              — { u, v } or null
 */

// Use the explicit ESM bundle — the bare package URL resolves to CJS on jsDelivr
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js';

// Use WASM backend; cache model in browser IndexedDB so subsequent loads are instant
env.useBrowserCache  = true;
env.allowLocalModels = false;

let estimator = null;

self.onmessage = async ({ data }) => {
  switch (data.type) {

    case 'load': {
      try {
        // depth-anything-v2-small q4 ≈ 18 MB — smallest practical depth model
        estimator = await pipeline(
          'depth-estimation',
          'onnx-community/depth-anything-v2-small',
          { device: 'wasm', dtype: 'q4' },
        );
        self.postMessage({ type: 'ready' });
      } catch (e) {
        self.postMessage({ type: 'error', message: String(e) });
      }
      break;
    }

    case 'infer': {
      if (!estimator || !data.bitmap) break;
      try {
        // Transformers.js v3 depth-estimation returns:
        //   depth           — RawImage (visual, Uint8ClampedArray) — NOT what we want
        //   predicted_depth — Tensor   (Float32Array, dims [1, H, W]) — raw depth values
        const { predicted_depth } = await estimator(data.bitmap);
        // dims: [batch=1, height, width]
        const h = predicted_depth.dims[1];
        const w = predicted_depth.dims[2];
        const floorUV = findFloorRegion(predicted_depth.data, w, h);
        self.postMessage({ type: 'result', floorUV });
      } catch (e) {
        console.warn('[DepthWorker] infer error:', e);
        self.postMessage({ type: 'result', floorUV: null });
      } finally {
        data.bitmap.close?.();
      }
      break;
    }
  }
};

/**
 * Scan the bottom 45% of the depth map in a 4×3 grid and return the
 * normalised centre UV of the cell with the lowest depth variance.
 *
 * Low variance in depth → flat surface → likely floor / table top.
 * Returns null when no cell is flat enough (variance threshold 0.008).
 */
function findFloorRegion(data, w, h) {
  const startY = Math.floor(h * 0.55);   // ignore sky / upper scene
  const COLS = 4, ROWS = 3;
  const MARGIN_X = 0.10;                 // ignore 10% edge on each side
  const VAR_MAX = 0.008;                 // cells with higher variance are discarded

  let bestU = 0.5, bestV = 0.80;
  let lowestVar = Infinity;
  let found = false;

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const usableW = w * (1 - 2 * MARGIN_X);
      const x0 = Math.floor(w * MARGIN_X + gx * usableW / COLS);
      const x1 = Math.floor(w * MARGIN_X + (gx + 1) * usableW / COLS);
      const y0 = startY + Math.floor(gy * (h - startY) / ROWS);
      const y1 = startY + Math.floor((gy + 1) * (h - startY) / ROWS);

      // Compute mean (subsample every 2 pixels for speed)
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) { sum += data[y * w + x]; count++; }
      if (!count) continue;
      const mean = sum / count;

      // Compute variance
      let varSum = 0;
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) {
          const d = data[y * w + x] - mean; varSum += d * d;
        }
      const variance = varSum / count;

      if (variance < lowestVar) {
        lowestVar = variance;
        bestU = (x0 + x1) * 0.5 / w;
        bestV = (y0 + y1) * 0.5 / h;
        found = true;
      }
    }
  }

  return (found && lowestVar < VAR_MAX) ? { u: bestU, v: bestV } : null;
}
