/**
 * DeviceProfiler — classifies the device into a performance tier and exposes
 * tier-specific settings for surface detection quality/frequency trade-offs.
 */

const TIERS = {
  low:  { windowSize:  8, updateHz: 15 },
  mid:  { windowSize: 12, updateHz: 30 },
  high: { windowSize: 15, updateHz: 60 },
};

const DOWNGRADE_WINDOW  = 30;
const DOWNGRADE_MID_MS  = 50;
const DOWNGRADE_LOW_MS  = 80;

export class DeviceProfiler {
  #tier       = 'mid';
  #frameTimes = [];
  #downgraded = false;

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

    console.log(`[DeviceProfiler] tier:${this.#tier}  mem:${mem}GB  cores:${cores}  GL2:${hasGL2}`);
    return this.#tier;
  }

  settings() { return TIERS[this.#tier]; }
  get tier()  { return this.#tier; }

  recordFrame(ms) {
    if (this.#downgraded) return;

    this.#frameTimes.push(ms);
    if (this.#frameTimes.length > DOWNGRADE_WINDOW) this.#frameTimes.shift();
    if (this.#frameTimes.length < DOWNGRADE_WINDOW) return;

    const avg = this.#frameTimes.reduce((a, b) => a + b, 0) / DOWNGRADE_WINDOW;

    if (avg > DOWNGRADE_LOW_MS && this.#tier === 'mid') {
      this.#tier = 'low';
      this.#downgraded = true;
      console.warn('[DeviceProfiler] Runtime downgrade → low (avg', avg.toFixed(1), 'ms)');
    } else if (avg > DOWNGRADE_MID_MS && this.#tier === 'high') {
      this.#tier = 'mid';
      this.#downgraded = true;
      console.warn('[DeviceProfiler] Runtime downgrade → mid (avg', avg.toFixed(1), 'ms)');
    }
  }
}
