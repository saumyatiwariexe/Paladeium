/**
 * StateMachine — deterministic tracking state with guarded transitions.
 *
 * State lifecycle:
 *
 *  SEARCHING ──► ACQUIRING ──► LOCKED ──► PREDICTED ──► RELOCALIZING
 *      ▲              │           │            │               │
 *      │              ▼           ▼            └──────────────►│
 *      └──────── DEGRADED ◄───────┘                            ▼
 *                     │                                   DEGRADED
 *                     ▼
 *                  FALLBACK
 */

export const TrackingState = Object.freeze({
  SEARCHING:    'searching',    // No marker seen
  ACQUIRING:    'acquiring',    // First detection, warming up
  LOCKED:       'locked',       // Stable, confident tracking
  PREDICTED:    'predicted',    // Marker lost, pose held from memory/sensors
  RELOCALIZING: 'relocalizing', // Actively searching after brief loss
  DEGRADED:     'degraded',     // Repeated failure, low confidence
  FALLBACK:     'fallback',     // No tracking possible at all
});

// Allowed forward/backward transitions
const VALID = {
  [TrackingState.SEARCHING]:    [TrackingState.ACQUIRING, TrackingState.FALLBACK],
  [TrackingState.ACQUIRING]:    [TrackingState.LOCKED,    TrackingState.SEARCHING],
  [TrackingState.LOCKED]:       [TrackingState.PREDICTED, TrackingState.SEARCHING],
  [TrackingState.PREDICTED]:    [TrackingState.LOCKED,    TrackingState.RELOCALIZING],
  [TrackingState.RELOCALIZING]: [TrackingState.LOCKED,    TrackingState.DEGRADED],
  [TrackingState.DEGRADED]:     [TrackingState.SEARCHING, TrackingState.FALLBACK],
  [TrackingState.FALLBACK]:     [TrackingState.SEARCHING],
};

export class TrackingStateMachine {
  #state          = TrackingState.SEARCHING;
  #enteredAt      = Date.now();
  #listeners      = [];
  #history        = [];           // last 20 transitions for diagnostics

  get state()       { return this.#state; }
  get timeInState() { return Date.now() - this.#enteredAt; }

  canTransition(to) {
    return VALID[this.#state]?.includes(to) ?? false;
  }

  /**
   * Attempt a guarded transition.
   * @returns {boolean} Whether the transition was accepted.
   */
  transition(to, reason = '') {
    if (!this.canTransition(to)) return false;
    this.#commit(to, reason);
    return true;
  }

  /**
   * Force a transition regardless of validity (e.g. hard reset).
   */
  force(to, reason = 'forced') {
    this.#commit(to, reason);
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  onChange(fn) {
    this.#listeners.push(fn);
    return () => { this.#listeners = this.#listeners.filter(l => l !== fn); };
  }

  get history() { return [...this.#history]; }

  // ── private ──────────────────────────────────────────────────────────────

  #commit(to, reason) {
    const from = this.#state;
    this.#state     = to;
    this.#enteredAt = Date.now();

    this.#history.push({ from, to, reason, ts: Date.now() });
    if (this.#history.length > 20) this.#history.shift();

    this.#listeners.forEach(fn => {
      try { fn(to, from, reason); } catch { /* listeners must not throw */ }
    });
  }
}
