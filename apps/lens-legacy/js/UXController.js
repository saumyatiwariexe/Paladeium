/**
 * UXController — translates tracking state changes into UI updates.
 *
 * Handles:
 *  • Status badge text + colour
 *  • Scan-overlay visibility
 *  • Menu-panel slide in / out
 *  • No-anchor prompt (shown when user taps dish without marker lock)
 *  • AR-hint tooltip (drag/pinch instructions)
 *  • Model-load failure text
 */

import { TrackingState } from './StateMachine.js';

export class UXController {
  #statusText;
  #anchorStatus;
  #scanOverlay;
  #menuPanel;
  #noAnchorMsg;
  #arHint;
  #hintTimer    = null;
  #noAnchorTimer = null;

  constructor() {
    this.#statusText   = document.getElementById('status-text');
    this.#anchorStatus = document.getElementById('anchor-status');
    this.#scanOverlay  = document.getElementById('scan-overlay');
    this.#menuPanel    = document.getElementById('menu-panel');
    this.#noAnchorMsg  = document.getElementById('no-anchor-msg');
    this.#arHint       = document.getElementById('ar-hint');
  }

  /**
   * Called by TrackingEngine whenever the state machine transitions.
   * @param {string} newState
   */
  onStateChange(newState) {
    switch (newState) {

      case TrackingState.SEARCHING:
        this.#setFound(false);
        this.#setStatus('Scanning…');
        break;

      case TrackingState.ACQUIRING:
        this.#setFound(false);
        this.#setStatus('Locking on…');
        break;

      case TrackingState.LOCKED:
        this.#setFound(true);
        this.#setStatus('Anchor locked');
        this.#scanOverlay.classList.add('hidden');
        this.#menuPanel.classList.add('visible');
        this.#menuPanel.classList.remove('minimized');
        break;

      case TrackingState.PREDICTED:
        // Keep "found" colour — model is still present in world
        this.#setFound(true);
        this.#setStatus('Tracking…');
        break;

      case TrackingState.RELOCALIZING:
        this.#setFound(false);
        this.#setStatus('Point at card');
        break;

      case TrackingState.DEGRADED:
        this.#setFound(false);
        this.#setStatus('Rescan card');
        break;

      case TrackingState.FALLBACK:
        this.#setFound(false);
        this.#setStatus('Preview mode');
        break;
    }
  }

  /** Show the "Drag to spin · pinch to scale" hint briefly. */
  showArHint() {
    clearTimeout(this.#hintTimer);
    this.#arHint?.classList.add('visible');
    this.#hintTimer = setTimeout(
      () => this.#arHint?.classList.remove('visible'),
      4000,
    );
  }

  /**
   * Show or hide the "Point at the menu card first" prompt.
   * Auto-dismisses after 3 seconds.
   */
  showNoAnchorPrompt(show) {
    clearTimeout(this.#noAnchorTimer);
    this.#noAnchorMsg?.classList.toggle('visible', show);
    if (show) {
      this.#noAnchorTimer = setTimeout(
        () => this.#noAnchorMsg?.classList.remove('visible'),
        3000,
      );
    }
  }

  /** Display a model-load error in the status badge. */
  setModelError() {
    this.#setStatus('Model failed to load');
  }

  // ── private ──────────────────────────────────────────────────────────────

  #setStatus(text) {
    if (this.#statusText) this.#statusText.textContent = text;
  }

  #setFound(found) {
    this.#anchorStatus?.classList.toggle('found', found);
  }
}
