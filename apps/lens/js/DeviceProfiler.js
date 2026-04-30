/**
 * DeviceProfiler — classifies the device into a performance tier and exposes
 * tier-specific settings for surface detection quality/frequency trade-offs.
 *
 * Tier detection uses:
 *   navigator.deviceMemory      (GB, hint only — may be undefined)
 *   navigator.hardwareConcurrency
 *   WebGL2 availability
 *
 * Runtime downgrade: recordFrame() tracks the last 30 frame deltas; if the
 * rolling average exceeds the downgrade threshold the tier is lowered once.
 */

const TIERS = {
  low: {
    windowSize:  8,
    updateHz:   15,
    showPlanes: false,
    anchorLerp: 0.06,
    smoothAlpha: 0.12,
  },
  mid: {
    windowSize:  12,
    updateHz:   30,
    showPlanes: true,
    anchorLerp: 0.04,
    smoothAlpha: 0.08,
  },
  high: {
    windowSize:  15,
    updateHz:   60,
    showPlanes: true,
    anchorLerp: 0.03,
    smoothAlpha: 0.05,
  },
};

const DOWNGRADE_WINDOW = 30;        // frames
const DOWNGRADE_MID_MS  = 50;       // avg > 50 ms → downgrade high→mid
const DOWNGRADE_LOW_MS  = 80;       // avg > 80 ms → downgrade mid→low

export class DeviceProfiler {
  #tier       = 'mid';
  #frameTimes = [];
  #downgraded = false;

  /**
   * Classify the device tier.  Should be called once before the XR session
   * starts.  Returns the tier string ('low' | 'mid' | 'high').
   */
  detect() {
    const mem    = navigator.deviceMemory      ?? 4;
    const cores  = navigator.hardwareConcurrency ?? 4;
    const hasGL2 = !!document.createElement('canvas').getContext('webgl2');

    if (mem >= 6 && cores >= 6 && hasGL2) {
      this.#tier = 'high';
    } else if (mem <= 2 || cores <= 2 || !hasGL2) {
      this.#tier = 'low';
    } else {
      this.#tier = 'mid';
    }

    console.log(
      `[DeviceProfiler] tier:${this.#tier}  mem:${mem}GB  cores:${cores}  GL2:${hasGL2}`,
    );
    return this.#tier;
  }

  /** Returns the settings object for the current tier. */
  settings() { return TIERS[this.#tier]; }

  get tier() { return this.#tier; }

  /**
   * Record the elapsed time (ms) for the last frame.
   * May downgrade the tier if performance is consistently poor.
   */
  recordFrame(ms) {
    if (this.#downgraded) return;   // only allow one runtime downgrade

    this.#frameTimes.push(ms);
    if (this.#frameTimes.length > DOWNGRADE_WINDOW) this.#frameTimes.shift();
    if (this.#frameTimes.length < DOWNGRADE_WINDOW) return;

    const avg = this.#frameTimes.reduce((a, b) => a + b, 0) / DOWNGRADE_WINDOW;

    if (avg > DOWNGRADE_LOW_MS && this.#tier === 'mid') {
      this.#tier = 'low';
      this.#downgraded = true;
      console.warn('[DeviceProfiler] Runtime downgrade → low (avg frame', avg.toFixed(1), 'ms)');
    } else if (avg > DOWNGRADE_MID_MS && this.#tier === 'high') {
      this.#tier = 'mid';
      this.#downgraded = true;
      console.warn('[DeviceProfiler] Runtime downgrade → mid (avg frame', avg.toFixed(1), 'ms)');
    }
  }
}
