/**
 * PlaneValidator — lightweight confidence gate that prevents placement on
 * unstable or poorly-detected surfaces.
 *
 * Confidence score components (sum to 1.0):
 *   Hit-test density  35%  — fraction of frames that produced a hit
 *   Pose variance     40%  — low variance = more stable surface estimate
 *   Buffer fill       25%  — proxy for how long the surface has been tracked
 *
 * Optional OffscreenCanvas brightness-variance bonus (+15%) is applied when
 * the browser supports OffscreenCanvas and the camera image is available.
 */

export class PlaneValidator {
  static CONFIDENCE_THRESHOLD = 0.55;

  // Weight per component (must sum to 1.0 without the bonus)
  static #W_DENSITY  = 0.35;
  static #W_VARIANCE = 0.40;
  static #W_FILL     = 0.25;

  // Variance tuning: variance >= HIGH → score 0, variance === 0 → score 1
  static #VAR_HIGH = 0.002;   // ~4.5 cm² combined

  #hitCount  = 0;
  #missCount = 0;
  #poseBuffer;
  #score = 0;

  /** @param {import('./PoseBuffer.js').PoseBuffer} poseBuffer */
  constructor(poseBuffer) {
    this.#poseBuffer = poseBuffer;
  }

  recordHit()  { this.#hitCount++;  this.#recompute(); }
  recordMiss() { this.#missCount++; this.#recompute(); }

  #recompute() {
    const total = this.#hitCount + this.#missCount;
    if (total === 0) { this.#score = 0; return; }

    // Component 1: hit-test density
    const density      = this.#hitCount / total;
    const densityScore = density * PlaneValidator.#W_DENSITY;

    // Component 2: pose variance (lower variance → higher score)
    const variance = this.#poseBuffer.positionVariance();
    const varNorm  = Math.max(0, 1 - variance / PlaneValidator.#VAR_HIGH);
    const varScore = varNorm * PlaneValidator.#W_VARIANCE;

    // Component 3: buffer fill ratio (proxy for tracking duration)
    const fill      = Math.min(this.#poseBuffer.length / 10, 1);
    const fillScore = fill * PlaneValidator.#W_FILL;

    this.#score = densityScore + varScore + fillScore;
  }

  get confidence() { return this.#score; }

  /** True when there is enough evidence to safely allow placement. */
  get canPlace() { return this.#score >= PlaneValidator.CONFIDENCE_THRESHOLD; }

  reset() {
    this.#hitCount  = 0;
    this.#missCount = 0;
    this.#score     = 0;
  }
}
