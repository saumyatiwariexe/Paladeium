/**
 * TrackingConfidence — history-smoothed confidence score for an already-placed
 * AR object, with automatic freeze logic to suppress jittery updates.
 *
 * Call update() every tick after placement.  It returns true when the object
 * should be updated (not frozen), false when it should be held in place.
 *
 * Score components per frame:
 *   - Base:  1.0 if hit-test found, 0.0 if miss
 *   - Delta: subtract up to 0.5 proportional to pose delta / DELTA_MAX
 *
 * The smoothed score is the mean over the last HISTORY_LEN frames.
 * If score stays below LOW_THRESHOLD for FREEZE_FRAMES consecutive frames,
 * isFrozen becomes true and remains true until score recovers.
 */

const HISTORY_LEN    = 20;
const LOW_THRESHOLD  = 0.35;
const FREEZE_FRAMES  = 8;
const DELTA_MAX      = 0.05;  // metres — delta at/above this = full penalty

export class TrackingConfidence {
  static LOW_THRESHOLD = LOW_THRESHOLD;
  static FREEZE_FRAMES = FREEZE_FRAMES;

  #history    = [];
  #score      = 1;
  #frozenFor  = 0;
  #wasFrozen  = false;

  /**
   * @param {boolean} hitFound         — did hit-test return a result this frame?
   * @param {number}  poseDeltaMetres  — distance between last two smoothed poses
   * @returns {boolean} true = object may update, false = object is frozen
   */
  update(hitFound, poseDeltaMetres) {
    let raw = hitFound ? 1.0 : 0.0;
    if (hitFound) {
      const deltaPenalty = Math.min(poseDeltaMetres / DELTA_MAX, 1) * 0.5;
      raw = Math.max(0, raw - deltaPenalty);
    }

    this.#history.push(raw);
    if (this.#history.length > HISTORY_LEN) this.#history.shift();

    this.#score = this.#history.reduce((a, b) => a + b, 0) / this.#history.length;

    if (this.#score < LOW_THRESHOLD) {
      this.#frozenFor++;
    } else {
      this.#frozenFor = 0;
    }

    return !this.isFrozen;
  }

  get score()    { return this.#score; }
  get isFrozen() { return this.#frozenFor >= FREEZE_FRAMES; }

  reset() {
    this.#history   = [];
    this.#score     = 1;
    this.#frozenFor = 0;
    this.#wasFrozen = false;
  }
}
