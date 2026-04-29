/**
 * SensorFusion — wraps the DeviceOrientationEvent API to provide a rotation
 * delta quaternion since the last calibration point.
 *
 * Used by AnchorManager to predict where the AR object should be when the
 * physical marker is briefly not visible.  Falls back gracefully on devices
 * that lack orientation sensors or deny permission.
 */

import * as THREE from 'three';

// Scratch objects — avoids allocations in the hot path
const _euler = new THREE.Euler();
const _q0    = new THREE.Quaternion();
const _q1    = new THREE.Quaternion();

export class SensorFusion {
  #handler    = null;
  #available  = false;

  // Current absolute orientation angles (degrees)
  #alpha = null; #beta = null; #gamma = null;

  // Baseline snapshot taken at calibration time
  #a0 = null; #b0 = null; #g0 = null;

  // Cached baseline quaternion
  #baselineQuat = new THREE.Quaternion();

  get available() { return this.#available; }

  /**
   * Begin listening for orientation events.
   * Must be called from within a user-gesture handler on iOS 13+.
   * @returns {Promise<boolean>} Whether sensors are available and permitted.
   */
  async start() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;

    // iOS 13+ requires an explicit permission request
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      } catch { return false; }
    }

    this.#handler = (e) => {
      if (e.alpha == null) return;
      this.#alpha = e.alpha;
      this.#beta  = e.beta;
      this.#gamma = e.gamma;
      this.#available = true;
    };

    window.addEventListener('deviceorientation', this.#handler, { passive: true });
    return true;
  }

  /**
   * Record current orientation as the reference point.
   * Call this every time the marker is first detected / reacquired.
   */
  calibrate() {
    if (!this.#available) return;
    this.#a0 = this.#alpha;
    this.#b0 = this.#beta;
    this.#g0 = this.#gamma;
    this.#baselineQuat.copy(this.#toQuat(this.#a0, this.#b0, this.#g0));
  }

  /**
   * Returns a quaternion representing the device rotation delta since the last
   * calibration, or null if sensors are unavailable / not yet calibrated.
   *
   * Applying the inverse of this quaternion to the last-known marker position
   * approximates where the marker would appear after the camera has moved.
   */
  getDeltaQuaternion() {
    if (!this.#available || this.#a0 === null) return null;

    const current = this.#toQuat(this.#alpha, this.#beta, this.#gamma);

    // delta = baseline⁻¹ × current
    _q0.copy(this.#baselineQuat).invert();
    _q1.multiplyQuaternions(_q0, current);
    return _q1.clone(); // caller owns this
  }

  stop() {
    if (this.#handler) {
      window.removeEventListener('deviceorientation', this.#handler);
      this.#handler   = null;
      this.#available = false;
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  /**
   * Convert W3C DeviceOrientation Euler angles to a THREE.Quaternion.
   * Convention: ZXY, matching the W3C spec rotation order.
   */
  #toQuat(alpha, beta, gamma) {
    const DEG = Math.PI / 180;
    _euler.set(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
    return new THREE.Quaternion().setFromEuler(_euler);
  }
}
