/**
 * TrackingEngine — the central orchestrator for hybrid AR tracking.
 *
 * Responsibilities:
 *  • Registers MindAR anchors and intercepts onTargetFound/onTargetLost.
 *  • Copies the live marker pose into a scene-managed group that we control
 *    (so we can keep it visible even when MindAR hides its own group).
 *  • Delegates to AnchorManager for pose persistence during marker loss.
 *  • Delegates to SensorFusion for orientation-based prediction.
 *  • Drives the TrackingStateMachine and exposes state-change events.
 *
 * Note: MindAR's internal One Euro Filter (filterBeta:1000) already provides
 * optimal pose stability. No secondary filtering is applied here.
 *
 * The caller places AR content into `engine.innerGroup`.
 * The caller must call `engine.tick()` from the Three.js animation loop.
 */

import * as THREE                                   from 'three';
import { CapabilityDetector, CapabilityTier }       from './CapabilityDetector.js';
import { TrackingState, TrackingStateMachine }      from './StateMachine.js';
import { SensorFusion }                             from './SensorFusion.js';
import { AnchorManager }                            from './AnchorManager.js';

export { TrackingState };           // re-export for convenience

// Frames of stable detection required before transitioning ACQUIRING → LOCKED
const ACQUIRE_FRAMES = 6;

// Timing thresholds for automatic state progression
const PREDICT_TO_RELOC_MS  = 2500;
const RELOC_TO_DEGRADED_MS = 8000;
const DEGRADED_RESET_MS    = 3500;

// Scratch objects — reused every frame to avoid GC pressure
const _rawPos   = new THREE.Vector3();
const _rawQuat  = new THREE.Quaternion();
const _rawScale = new THREE.Vector3();

export class TrackingEngine {
  // Public scene groups — attach AR content to innerGroup
  managedGroup = new THREE.Group();
  innerGroup   = new THREE.Group(); // rotation-correction child

  // Internals
  #sm            = new TrackingStateMachine();
  #sensors       = new SensorFusion();
  #anchor        = new AnchorManager();
  #capabilities  = null;

  #scene         = null;
  #mindARAnchors = [];
  #activeAnchor  = null;
  #acquireFrames = 0;

  #stateListeners = [];

  // ── Construction ─────────────────────────────────────────────────────────

  constructor(scene) {
    this.#scene = scene;

    this.managedGroup.add(this.innerGroup);
    this.managedGroup.visible = false;
    scene.add(this.managedGroup);

    // Forward state changes to external listeners
    this.#sm.onChange((newState, oldState, reason) => {
      this.#stateListeners.forEach(fn => {
        try { fn(newState, oldState, reason); } catch { /* */ }
      });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get state()        { return this.#sm.state; }
  get capabilities() { return this.#capabilities; }

  /**
   * Detect device capabilities and start the sensor fusion layer.
   * Must be called from within a user-gesture handler (button tap) so that
   * iOS orientation permission can be requested.
   */
  async init() {
    this.#capabilities = await CapabilityDetector.detect();
    if (this.#capabilities.hasSensors) {
      await this.#sensors.start();
    }
    return this.#capabilities;
  }

  /**
   * Register a MindAR anchor with the engine.
   * The engine installs onTargetFound / onTargetLost callbacks.
   * Call for every anchor returned by mindarThree.addAnchor().
   */
  registerAnchor(mindARanchor) {
    this.#mindARAnchors.push(mindARanchor);

    mindARanchor.onTargetFound = () => this.#onFound(mindARanchor);
    mindARanchor.onTargetLost  = () => this.#onLost(mindARanchor);
  }

  /**
   * Advance the tracking engine by one frame.
   * Call this at the top of the Three.js animation loop, before render().
   *
   * @returns {{ markerVisible: boolean, confidence: number|null }}
   */
  tick() {
    this.#advanceStateMachine();
    return this.#updatePose();
  }

  /** Subscribe to tracking state changes. Returns an unsubscribe function. */
  onStateChange(fn) {
    this.#stateListeners.push(fn);
    return () => { this.#stateListeners = this.#stateListeners.filter(l => l !== fn); };
  }

  dispose() {
    this.#sensors.stop();
    this.#scene.remove(this.managedGroup);
  }

  // ── MindAR callbacks ──────────────────────────────────────────────────────

  #onFound(anchor) {
    const prev = this.#sm.state;
    this.#activeAnchor  = anchor;
    this.#acquireFrames = 0;

    // Re-entering from a loss state — go straight to LOCKED.
    if (prev === TrackingState.PREDICTED || prev === TrackingState.RELOCALIZING) {
      this.#sm.transition(TrackingState.LOCKED, 'reacquired');
    } else {
      this.#sm.force(TrackingState.ACQUIRING, 'target_found');
    }

    this.#sensors.calibrate();
  }

  #onLost(anchor) {
    if (this.#activeAnchor !== anchor) return;

    this.#anchor.recordLoss();
    this.#sm.transition(TrackingState.PREDICTED, 'target_lost');
  }

  // ── State machine progression ─────────────────────────────────────────────

  #advanceStateMachine() {
    const s  = this.#sm.state;
    const ms = this.#sm.timeInState;

    if (s === TrackingState.PREDICTED    && ms > PREDICT_TO_RELOC_MS)  {
      this.#sm.transition(TrackingState.RELOCALIZING, 'predict_timeout');
    }
    if (s === TrackingState.RELOCALIZING && ms > RELOC_TO_DEGRADED_MS) {
      this.#sm.transition(TrackingState.DEGRADED,     'reloc_timeout');
    }
    if (s === TrackingState.DEGRADED     && ms > DEGRADED_RESET_MS)    {
      this.#anchor.reset();
      this.#sm.transition(TrackingState.SEARCHING, 'degraded_reset');
    }
  }

  // ── Pose update ───────────────────────────────────────────────────────────

  #updatePose() {
    const anchor = this.#activeAnchor;
    const state  = this.#sm.state;

    if (!anchor) {
      this.managedGroup.visible = false;
      return { markerVisible: false, confidence: null };
    }

    const markerVisible = anchor.group.visible;

    if (markerVisible) {
      // ── Marker is currently detected ─────────────────────────────────────
      anchor.group.matrixWorld.decompose(_rawPos, _rawQuat, _rawScale);

      // Trust MindAR's native One Euro Filter output directly — no secondary pass
      this.managedGroup.position.copy(_rawPos);
      this.managedGroup.quaternion.copy(_rawQuat);
      this.managedGroup.scale.copy(_rawScale);

      this.#anchor.commit(_rawPos, _rawQuat);

      // Apply world-facing rotation correction to innerGroup
      this.innerGroup.rotation.x = Math.PI / 2;

      this.managedGroup.visible = this.innerGroup.children.length > 0;

      // ACQUIRING → LOCKED once we've accumulated enough stable frames
      if (state === TrackingState.ACQUIRING) {
        this.#acquireFrames++;
        if (this.#acquireFrames >= ACQUIRE_FRAMES) {
          this.#sm.transition(TrackingState.LOCKED, 'stable');
        }
      }

      return { markerVisible: true, confidence: 1.0 };
    }

    // ── Marker is not currently visible ──────────────────────────────────
    const isPredicting = state === TrackingState.PREDICTED ||
                         state === TrackingState.RELOCALIZING;

    if (!isPredicting || !this.#anchor.hasStablePose) {
      this.managedGroup.visible = false;
      return { markerVisible: false, confidence: 0 };
    }

    // Freeze at last-known pose — sensor delta correction caused drift
    const predicted = this.#anchor.getPredictedPose(null);

    if (!predicted) {
      this.managedGroup.visible = false;
      return { markerVisible: false, confidence: 0 };
    }

    this.managedGroup.position.copy(predicted.position);
    this.managedGroup.quaternion.copy(predicted.quaternion);
    this.managedGroup.visible = this.innerGroup.children.length > 0;

    return { markerVisible: false, confidence: predicted.confidence };
  }
}
