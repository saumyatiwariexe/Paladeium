/**
 * AnchorSimulator — soft re-alignment of a placed Three.js object toward
 * the latest anchor/hit-test pose, with Y-rotation lock and a maximum
 * correction radius to avoid large teleportations.
 *
 * Usage:
 *   sim.record(pos, quat)           — call immediately after placement
 *   sim.updateTarget(pos, quat)     — call each frame with new anchor pose
 *   sim.apply(object3D)             — lerp object toward target (call in tick)
 */

import * as THREE from 'three';

const MAX_CORRECTION = 0.15;  // metres — ignore anchor drifts larger than this
const _euler    = new THREE.Euler();
const _initEuler = new THREE.Euler();

export class AnchorSimulator {
  #targetPos  = null;
  #targetQuat = null;
  #initialPos = null;
  #initialQuat = null;
  #lerpAlpha  = 0.04;

  constructor(lerpAlpha = 0.04) {
    this.#lerpAlpha = lerpAlpha;
  }

  set lerpAlpha(v) { this.#lerpAlpha = v; }

  /** Call once at placement time. */
  record(position, quaternion) {
    this.#initialPos  = position.clone();
    this.#initialQuat = quaternion.clone();
    this.#targetPos   = position.clone();
    this.#targetQuat  = quaternion.clone();
  }

  /**
   * Update the lerp target from a fresh anchor/hit-test pose.
   * Ignores updates that move more than MAX_CORRECTION from initial placement
   * (protects against runaway SLAM drift mid-session).
   */
  updateTarget(position, quaternion) {
    if (!this.#initialPos) return;
    if (position.distanceTo(this.#initialPos) > MAX_CORRECTION) return;

    this.#targetPos.copy(position);

    // Y-rotation lock: accept new yaw but preserve original pitch/roll so
    // objects don't lean as the SLAM plane estimate refines.
    _euler.setFromQuaternion(quaternion, 'YXZ');
    _initEuler.setFromQuaternion(this.#initialQuat, 'YXZ');
    _euler.x = _initEuler.x;
    _euler.z = _initEuler.z;
    this.#targetQuat.setFromEuler(_euler);
  }

  /**
   * Lerp object3D toward the current target.
   * Assumes object3D.matrixAutoUpdate = true.
   */
  apply(object3D) {
    if (!this.#targetPos) return;
    object3D.position.lerp(this.#targetPos, this.#lerpAlpha);
    object3D.quaternion.slerp(this.#targetQuat, this.#lerpAlpha);
  }

  reset() {
    this.#targetPos   = null;
    this.#targetQuat  = null;
    this.#initialPos  = null;
    this.#initialQuat = null;
  }

  get isActive() { return this.#targetPos !== null; }
}
