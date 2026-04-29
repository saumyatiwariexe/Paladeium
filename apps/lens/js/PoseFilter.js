/**
 * PoseFilter — One Euro Filter applied to 3D position and quaternion rotation.
 *
 * The One Euro Filter adapts its cutoff frequency to signal velocity:
 *   - slow movement → aggressive smoothing (removes jitter)
 *   - fast movement → light smoothing  (preserves responsiveness)
 *
 * References:
 *   Géry Casiez et al. "1€ Filter: A Simple Speed-based Low-pass Filter for
 *   Noisy Input in Interactive Systems", CHI 2012.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// One Euro Filter for a single scalar value
// ---------------------------------------------------------------------------
class ScalarOneEuro {
  #minCutoff;
  #beta;
  #dcutoff;
  #xPrev    = null;
  #dxPrev   = 0;
  #tPrev    = -1;

  /**
   * @param {number} minCutoff – minimum cutoff frequency (Hz). Lower = smoother.
   * @param {number} beta      – speed coefficient. Higher = faster response.
   * @param {number} dcutoff   – cutoff for the derivative filter (default 1 Hz).
   */
  constructor(minCutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
    this.#minCutoff = minCutoff;
    this.#beta      = beta;
    this.#dcutoff   = dcutoff;
  }

  /** Alpha for a simple low-pass with the given cutoff and time step. */
  #alpha(cutoff, dt) {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / Math.max(dt, 1e-6));
  }

  update(x, now) {
    if (this.#xPrev === null) {
      this.#xPrev  = x;
      this.#tPrev  = now;
      return x;
    }

    const dt = Math.max((now - this.#tPrev) * 0.001, 1e-6); // ms → s
    this.#tPrev = now;

    // Filtered derivative
    const dx    = (x - this.#xPrev) / dt;
    const ad    = this.#alpha(this.#dcutoff, dt);
    const dxHat = ad * dx + (1 - ad) * this.#dxPrev;

    // Adaptive cutoff based on signal speed
    const cutoff = this.#minCutoff + this.#beta * Math.abs(dxHat);
    const a      = this.#alpha(cutoff, dt);
    const xHat   = a * x + (1 - a) * this.#xPrev;

    this.#xPrev  = xHat;
    this.#dxPrev = dxHat;
    return xHat;
  }

  reset() {
    this.#xPrev  = null;
    this.#dxPrev = 0;
    this.#tPrev  = -1;
  }
}

// ---------------------------------------------------------------------------
// PoseFilter – wraps position (xyz) and quaternion (wxyz) filtering
// ---------------------------------------------------------------------------
export class PoseFilter {
  #px; #py; #pz;
  #qw; #qx; #qy; #qz;
  #prevQuat = null;

  // Reusable output objects – avoid per-frame allocations
  #outPos  = new THREE.Vector3();
  #outQuat = new THREE.Quaternion();

  /**
   * @param {object} opts
   * @param {number} opts.posMinCutoff – position smoothing frequency (default 0.5 Hz)
   * @param {number} opts.posBeta      – position speed coefficient   (default 0.005)
   * @param {number} opts.rotMinCutoff – rotation smoothing frequency (default 0.5 Hz)
   * @param {number} opts.rotBeta      – rotation speed coefficient   (default 0.003)
   */
  constructor({
    posMinCutoff = 5.0,
    posBeta      = 20.0,
    rotMinCutoff = 3.0,
    rotBeta      = 10.0,
  } = {}) {
    this.#px = new ScalarOneEuro(posMinCutoff, posBeta);
    this.#py = new ScalarOneEuro(posMinCutoff, posBeta);
    this.#pz = new ScalarOneEuro(posMinCutoff, posBeta);

    this.#qw = new ScalarOneEuro(rotMinCutoff, rotBeta);
    this.#qx = new ScalarOneEuro(rotMinCutoff, rotBeta);
    this.#qy = new ScalarOneEuro(rotMinCutoff, rotBeta);
    this.#qz = new ScalarOneEuro(rotMinCutoff, rotBeta);
  }

  /**
   * Feed a new raw pose sample and receive the filtered result.
   * The returned objects are the same references every call (no allocation).
   *
   * @param {THREE.Vector3}    rawPos
   * @param {THREE.Quaternion} rawQuat
   * @returns {{ position: THREE.Vector3, quaternion: THREE.Quaternion }}
   */
  update(rawPos, rawQuat) {
    const now = performance.now();

    // ── Position ──────────────────────────────────────────────────────────
    this.#outPos.set(
      this.#px.update(rawPos.x, now),
      this.#py.update(rawPos.y, now),
      this.#pz.update(rawPos.z, now),
    );

    // ── Quaternion ─────────────────────────────────────────────────────────
    // Ensure the incoming quaternion is on the same hemisphere as the previous
    // one to avoid the filter interpolating through the "long way round".
    let q = rawQuat;
    if (this.#prevQuat !== null && this.#prevQuat.dot(q) < 0) {
      // Clone before negating so we don't mutate the caller's object
      q = q.clone().negate();
    }
    this.#prevQuat = q.clone();

    const fw = this.#qw.update(q.w, now);
    const fx = this.#qx.update(q.x, now);
    const fy = this.#qy.update(q.y, now);
    const fz = this.#qz.update(q.z, now);

    const len = Math.sqrt(fw * fw + fx * fx + fy * fy + fz * fz) || 1;
    this.#outQuat.set(fx / len, fy / len, fz / len, fw / len);

    return { position: this.#outPos, quaternion: this.#outQuat };
  }

  /** Clear all filter state (call when tracking is lost for an extended period). */
  reset() {
    [this.#px, this.#py, this.#pz, this.#qw, this.#qx, this.#qy, this.#qz]
      .forEach(f => f.reset());
    this.#prevQuat = null;
  }
}
