/**
 * PoseBuffer — rolling window of hit-test poses with per-axis Kalman filtering
 * and outlier rejection.
 *
 * Kalman filter (single-state per axis):
 *   Predict:  error_pred = error + Q
 *   Update:   K = error_pred / (error_pred + R)
 *             estimate += K * (measurement - estimate)
 *             error = (1 - K) * error_pred
 *
 * Outlier rejection: a pose is discarded when any axis differs from the current
 * Kalman estimate by more than OUTLIER_THRESHOLD (8 cm), but only once the
 * buffer has at least MIN_REJECT_SAMPLES samples so cold-start poses aren't lost.
 */

const Q = 0.005;              // process noise  — higher = trusts measurements more
const R = 0.02;               // measurement noise — higher = trusts predictions more
const MIN_REJECT_SAMPLES = 4; // don't reject until buffer has this many samples

export class PoseBuffer {
  static OUTLIER_THRESHOLD = 0.08; // metres

  #size;
  #poses = [];

  // Per-axis Kalman state
  #est = [0, 0, 0];
  #err = [1, 1, 1];
  #bootstrapped = false;

  constructor(windowSize = 15) {
    this.#size = windowSize;
  }

  /**
   * Push a new position sample.  Returns true if accepted, false if rejected.
   * @param {{ x: number, y: number, z: number }} position
   */
  push(position) {
    if (!this.#bootstrapped) {
      this.#est = [position.x, position.y, position.z];
      this.#err = [1, 1, 1];
      this.#bootstrapped = true;
    } else {
      // Outlier gate
      if (this.#poses.length >= MIN_REJECT_SAMPLES) {
        const t = PoseBuffer.OUTLIER_THRESHOLD;
        if (
          Math.abs(position.x - this.#est[0]) > t ||
          Math.abs(position.y - this.#est[1]) > t ||
          Math.abs(position.z - this.#est[2]) > t
        ) {
          return false;
        }
      }
      // Kalman update per axis
      this.#est[0] = this.#kalman(0, position.x);
      this.#est[1] = this.#kalman(1, position.y);
      this.#est[2] = this.#kalman(2, position.z);
    }

    this.#poses.push({ x: position.x, y: position.y, z: position.z });
    if (this.#poses.length > this.#size) this.#poses.shift();
    return true;
  }

  #kalman(axis, measurement) {
    const errPred = this.#err[axis] + Q;
    const K       = errPred / (errPred + R);
    this.#est[axis] += K * (measurement - this.#est[axis]);
    this.#err[axis]  = (1 - K) * errPred;
    return this.#est[axis];
  }

  /** Returns Kalman-smoothed position, or null if empty. */
  getSmoothed() {
    if (!this.#bootstrapped) return null;
    return { x: this.#est[0], y: this.#est[1], z: this.#est[2] };
  }

  /** Mean squared distance of raw samples from smoothed estimate. */
  positionVariance() {
    if (this.#poses.length < 2) return 0;
    const [ex, ey, ez] = this.#est;
    let v = 0;
    for (const p of this.#poses) {
      const dx = p.x - ex, dy = p.y - ey, dz = p.z - ez;
      v += dx * dx + dy * dy + dz * dz;
    }
    return v / this.#poses.length;
  }

  get length() { return this.#poses.length; }

  setWindowSize(n) {
    this.#size = n;
    while (this.#poses.length > this.#size) this.#poses.shift();
  }

  reset() {
    this.#poses       = [];
    this.#est         = [0, 0, 0];
    this.#err         = [1, 1, 1];
    this.#bootstrapped = false;
  }
}
