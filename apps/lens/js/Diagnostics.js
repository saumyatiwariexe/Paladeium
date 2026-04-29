/**
 * Diagnostics — lightweight dev-mode HUD overlay.
 *
 * Enabled only when the URL contains `?dev` (or `&dev`).
 * Counts FPS even in production for internal use; renders UI only when enabled.
 *
 * Usage:
 *   const diag = new Diagnostics();
 *   // each frame:
 *   diag.tick({ state, confidence, tier, markerVisible, modelLoaded });
 */

export class Diagnostics {
  #enabled;
  #el     = null;

  // FPS tracking
  #frameCount = 0;
  #windowStart = performance.now();
  #fps = 0;

  /**
   * @param {boolean} [enabled] Override — defaults to presence of ?dev in URL.
   */
  constructor(enabled) {
    this.#enabled = enabled ?? new URLSearchParams(location.search).has('dev');
    if (this.#enabled) this.#buildPanel();
  }

  get fps() { return this.#fps; }

  /**
   * Call once per animation frame.
   * @param {{ state: string, confidence: number|null, tier: number|null,
   *            markerVisible: boolean, modelLoaded: boolean }} data
   */
  tick(data) {
    this.#countFrame();
    if (this.#enabled && this.#el) this.#render(data);
  }

  // ── private ──────────────────────────────────────────────────────────────

  #countFrame() {
    this.#frameCount++;
    const now = performance.now();
    if (now - this.#windowStart >= 1000) {
      this.#fps        = this.#frameCount;
      this.#frameCount = 0;
      this.#windowStart = now;
    }
  }

  #render({ state, confidence, tier, markerVisible, modelLoaded }) {
    const conf  = confidence != null ? (confidence * 100).toFixed(0) + '%' : '—';
    const tierLabel = tier != null
      ? ['', 'WebXR', 'Hybrid', 'Marker', 'Viewer'][tier] ?? tier
      : '—';

    this.#el.textContent = [
      `FPS      ${this.#fps}`,
      `State    ${state ?? '—'}`,
      `Conf     ${conf}`,
      `Tier     ${tierLabel}`,
      `Marker   ${markerVisible ? '● visible' : '○ hidden'}`,
      `Model    ${modelLoaded   ? '● loaded'  : '○ none'}`,
    ].join('\n');
  }

  #buildPanel() {
    const el = document.createElement('div');
    el.id = 'ar-diagnostics';
    el.style.cssText = [
      'position:fixed',
      'top:60px',
      'right:10px',
      'z-index:9999',
      'background:rgba(0,0,0,0.72)',
      'color:#39ff80',
      "font:11px/1.7 'Courier New',monospace",
      'padding:8px 12px',
      'border-radius:8px',
      'border:1px solid rgba(57,255,128,0.25)',
      'pointer-events:none',
      'white-space:pre',
      'min-width:170px',
      'letter-spacing:0.02em',
    ].join(';');
    document.body.appendChild(el);
    this.#el = el;
  }
}
