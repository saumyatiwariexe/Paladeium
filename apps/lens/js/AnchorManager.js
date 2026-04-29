/**
 * AnchorManager — stores the last stable pose and produces predictions while
 * the physical marker is not visible.
 *
 * Confidence decays linearly from 1 → 0 over [HOLD_MS … FADE_MS].
 * When confidence reaches 0, hasStablePose becomes false and the model hides.
 */

import * as THREE from 'three';

const HOLD_MS = 200;   // brief hold before fade begins
const FADE_MS = 900;   // fully hidden 900 ms after marker loss

// Scratch objects for prediction path
const _invDelta = new THREE.Quaternion();
const _predPos  = new THREE.Vector3();
const _predQuat = new THREE.Quaternion();

export class AnchorManager {
  #pos       = new THREE.Vector3();
  #quat      = new THREE.Quaternion();
  #lostAt    = null;
  #hasStable = false;

  get hasStablePose() { return this.#hasStable; }

  /**
   * Record a freshly-filtered marker pose as the stable reference.
   * Clears the loss timer.
   */
  commit(position, quaternion) {
    this.#pos.copy(position);
    this.#quat.copy(quaternion);
    this.#lostAt    = null;
    this.#hasStable = true;
  }

  /** Mark the moment the marker was lost. */
  recordLoss() {
    if (this.#lostAt === null) this.#lostAt = Date.now();
  }

  /**
   * Retrieve the best available pose estimate.
   *
   * @param {THREE.Quaternion|null} orientationDelta
   *   Optional rotation delta from SensorFusion.  When provided the last-known
   *   camera-space position is rotated by the inverse of this delta to
   *   approximate where the marker now appears in the frame.
   *
   * @returns {{ position: THREE.Vector3, quaternion: THREE.Quaternion, confidence: number } | null}
   *   Returns null when no stable pose exists or confidence has expired.
   *   The returned vectors are temporary — clone them if you need to keep them.
   */
  getPredictedPose(orientationDelta = null) {
    if (!this.#hasStable) return null;

    const age = this.#lostAt === null ? 0 : Date.now() - this.#lostAt;

    let confidence;
    if (age <= HOLD_MS) {
      confidence = 1.0;
    } else if (age >= FADE_MS) {
      confidence = 0.0;
    } else {
      confidence = 1.0 - (age - HOLD_MS) / (FADE_MS - HOLD_MS);
    }

    if (confidence <= 0) {
      this.#hasStable = false;
      return null;
    }

    // Start from last-known pose
    _predPos.copy(this.#pos);
    _predQuat.copy(this.#quat);

    // Apply sensor-predicted rotation when confidence is still high
    if (orientationDelta && confidence > 0.4) {
      // The camera rotated by `orientationDelta` since baseline.
      // From the camera's frame of reference, objects appear to rotate by the
      // inverse — approximate where the marker now appears.
      _invDelta.copy(orientationDelta).invert();
      _predPos.applyQuaternion(_invDelta);
      _predQuat.premultiply(_invDelta);
    }

    return { position: _predPos, quaternion: _predQuat, confidence };
  }

  reset() {
    this.#hasStable = false;
    this.#lostAt    = null;
  }
}
