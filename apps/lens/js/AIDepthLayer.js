/**
 * AIDepthLayer — manages the DepthAnything v2 Web Worker and the camera feed
 * used to feed it frames.  The worker runs monocular depth estimation to
 * identify the most planar region of the scene (likely floor / table-top)
 * and returns its normalised image UV.
 *
 * Usage:
 *   const ai = new AIDepthLayer();
 *   await ai.init();          // call BEFORE requestSession() — needs camera
 *   ...
 *   ai.tick();                // call every XR frame (self-throttled)
 *   const uv = ai.floorUV;   // { u, v } | null
 *   ai.dispose();
 */

export class AIDepthLayer {
  #worker      = null;
  #video       = null;
  #canvas      = null;
  #ctx         = null;
  #ready       = false;
  #busy        = false;
  #videoLive   = false;
  #floorUV     = null;  // latest { u, v } from worker
  #lastAt      = 0;     // ms — when #floorUV was last updated
  #inferAt     = 0;     // ms — when last inference was requested

  static RESULT_TTL     = 900;  // ms — discard stale AI results
  static INFER_INTERVAL = 400;  // ms — max rate to feed worker frames

  /**
   * Initialise the camera feed and start loading the AI model.
   * Must be called BEFORE navigator.xr.requestSession() so that getUserMedia
   * can acquire the rear camera before XR takes exclusive access.
   *
   * Resolves to true on success, false if camera or worker is unavailable
   * (the caller should treat failure as graceful degradation, not an error).
   */
  async init() {
    // ── Camera feed ────────────────────────────────────────────────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { max: 15 },
        },
        audio: false,
      });

      // Stop feeding frames if the XR session takes exclusive camera control
      stream.getTracks().forEach(t => t.addEventListener('ended', () => {
        this.#videoLive = false;
      }));

      this.#video = document.createElement('video');
      this.#video.srcObject = stream;
      this.#video.muted      = true;
      this.#video.playsInline = true;
      this.#video.setAttribute('playsinline', '');
      await this.#video.play();
      this.#videoLive = true;

      this.#canvas = new OffscreenCanvas(320, 240);
      this.#ctx    = this.#canvas.getContext('2d');

      console.log('[AIDepth] Camera feed ✓');
    } catch (e) {
      console.warn('[AIDepth] Camera unavailable — AI layer disabled:', e.message);
      return false;
    }

    // ── Web Worker ─────────────────────────────────────────────────────────
    try {
      this.#worker = new Worker(
        new URL('./DepthWorker.js', import.meta.url),
        { type: 'module' },
      );
      this.#worker.onmessage = ({ data }) => {
        switch (data.type) {
          case 'ready':
            this.#ready = true;
            console.log('[AIDepth] DepthAnything v2 ready ✓');
            break;
          case 'result':
            this.#busy = false;
            if (data.floorUV) {
              this.#floorUV = data.floorUV;
              this.#lastAt  = Date.now();
            }
            break;
          case 'error':
            console.warn('[AIDepth] Model error:', data.message);
            break;
        }
      };
      this.#worker.postMessage({ type: 'load' });
    } catch (e) {
      console.warn('[AIDepth] Worker unavailable:', e.message);
      return false;
    }

    return true;
  }

  /**
   * Call every XR animation frame.  Self-throttled to INFER_INTERVAL ms;
   * sends a camera frame to the worker when it is idle.
   * Synchronous — frame capture is a canvas draw; bitmap creation is async
   * and fire-and-forget.
   */
  tick() {
    if (!this.#ready || this.#busy || !this.#videoLive || !this.#video) return;
    const now = Date.now();
    if (now - this.#inferAt < AIDepthLayer.INFER_INTERVAL) return;
    if (this.#video.readyState < 2) return;

    this.#inferAt = now;
    this.#busy    = true;

    // Capture current video frame to OffscreenCanvas then create transferable bitmap
    createImageBitmap(this.#video, { resizeWidth: 320, resizeHeight: 240 })
      .then(bitmap => {
        this.#worker.postMessage({ type: 'infer', bitmap }, [bitmap]);
      })
      .catch(() => { this.#busy = false; });
  }

  /**
   * Most recent floor UV in normalised [0,1] image space, or null if the
   * result is stale (older than RESULT_TTL) or the model is not yet ready.
   */
  get floorUV() {
    if (!this.#floorUV) return null;
    if (Date.now() - this.#lastAt > AIDepthLayer.RESULT_TTL) return null;
    return this.#floorUV;
  }

  /** True once the model has loaded and at least one inference can run. */
  get isReady() { return this.#ready; }

  dispose() {
    this.#worker?.terminate();
    this.#video?.srcObject?.getTracks().forEach(t => t.stop());
    this.#worker    = null;
    this.#video     = null;
    this.#canvas    = null;
    this.#ctx       = null;
    this.#videoLive = false;
  }
}
