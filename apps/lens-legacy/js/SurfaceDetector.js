/**
 * SurfaceDetector — WebXR surface detection + anchoring engine.
 *
 * ── Detection pipeline (Layer 1 → 3, first success wins) ──────────────────
 *
 *   Layer 1  Multi-ray hit-test
 *     Five XRHitTestSources (centre + 4 angled downward). Component-wise
 *     median position → Kalman-filtered PoseBuffer.
 *
 *   Layer 2  Depth Sensing API  (cpu-optimized, 5-point sample, median depth)
 *     Real depth even on textureless floors / glass.
 *
 *   Layer 3  Floor projection
 *     Camera-forward ray × Y=0 plane. Always produces a result while the
 *     camera is tilted downward — works even before SLAM initialises.
 *
 * ── Three-tier anchoring strategy ─────────────────────────────────────────
 *
 *   Tier A  Plane-relative (best stability)
 *     At placement the nearest XRPlane is found and the hit-point is
 *     expressed in that plane's local coordinate space.  Each frame the
 *     plane's current world pose is obtained and the local offset is
 *     re-projected back to world space.  The object moves WITH the plane —
 *     SLAM corrections to the world origin are invisible because both the
 *     surface and the content correct together.
 *
 *   Tier B  World anchor + freeze/convergence
 *     An XRAnchor is created at the placement point and retried up to
 *     ANCHOR_RETRY_MAX times.  After creation the object is frozen for
 *     FREEZE_MS to let the anchor stabilise.  Ongoing corrections are
 *     applied directly (no lerp) with a velocity gate; corrections larger
 *     than JUMP_M are animated over JUMP_MS (cubic ease-out).
 *
 *   Tier C  Hard freeze
 *     When neither a plane nor an anchor is available the object is locked
 *     at the exact placement position — no updates, zero drift.
 *
 * ── Placement accuracy fix ────────────────────────────────────────────────
 *     The reticle matrix is captured inside requestPlacement() so the
 *     object is placed exactly where the ring was showing when the user
 *     tapped, not at the hit-test result of the following animation frame.
 *
 * ── Events ────────────────────────────────────────────────────────────────
 *   'started'    — XR session active
 *   'warming'    — SLAM initialising  { progress 0–1 }
 *   'ready'      — SLAM ready (20 consecutive hits)
 *   'surface'    — reticle state changed  { found, sourceMode }
 *   'placed'     — content placed  { position, quaternion, sourceMode, tier }
 *   'reset'      — placement cleared
 *   'frozen'     — tracking confidence low, object held
 *   'unfrozen'   — tracking confidence recovered
 *   'confidence' — per-tick score  { score }
 *   'ended'      — XR session ended
 */

import * as THREE from 'three';
import { PoseBuffer }         from './PoseBuffer.js';
import { PlaneValidator }     from './PlaneValidator.js';
import { TrackingConfidence } from './TrackingConfidence.js';
import { DeviceProfiler }     from './DeviceProfiler.js';
import { AIDepthLayer }       from './AIDepthLayer.js';

// ── Tuning ─────────────────────────────────────────────────────────────────

const RETICLE_R   = 0.04;     // 4 cm — smaller, less intrusive indicator
const SHADOW_SIZE = 0.55;
const INDICATOR_COL = 0xD4A853; // gold — matches app theme

// Multi-ray offsets in viewer space (-Z = forward, Y = up)
const RAY_OFFSETS = [
  { x:  0,    y:  0,     z: -1 },   // centre
  { x: -0.12, y: -0.10,  z: -1 },   // down-left
  { x:  0.12, y: -0.10,  z: -1 },   // down-right
  { x:  0,    y: -0.15,  z: -1 },   // straight down
  { x:  0,    y:  0.06,  z: -1 },   // slight up (counters / tables)
];

// Depth sensing viewport sample pattern (normalised 0–1)
const DEPTH_UV = [
  [0.50, 0.50], [0.40, 0.55], [0.60, 0.55], [0.50, 0.65], [0.50, 0.40],
];

// SLAM warmup — lower target means faster first placement on good surfaces
const WARMUP_TARGET = 8;

// Pre-placement soak times (ms) — how long each source must be stable before auto-placing
const SOAK_HITTEST = 1000;  // hit-test time-based fallback (SLAM/confidence gates take priority)
const SOAK_DEPTH   =  600;  // depth-sensing soak
const SOAK_PROJ    = 1200;  // floor-projection soak

// Anchor / freeze
const FREEZE_MS       = 1800;
const ANCHOR_NOISE_M  = 0.001;
const JUMP_M          = 0.04;
const JUMP_MS         = 550;
const ANCHOR_RETRY_N  = 20;
const ANCHOR_RETRY_MS = 500;
const PLANE_SEARCH_R  = 0.50;

// Scratch
const _m4  = new THREE.Matrix4();
const _v3  = new THREE.Vector3();
const _q   = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _prv = new THREE.Vector3();   // previous smoothed pos for confidence delta

// ── Class ──────────────────────────────────────────────────────────────────

export class SurfaceDetector extends EventTarget {

  placedGroup = null;   // attach AR content here

  // Core
  #scene    = null;
  #camera   = null;
  #renderer = null;
  #session  = null;
  #refSpace = null;
  #refType  = 'local-floor';

  // Hit-test
  #hitSources = [];
  #hasDepth   = false;
  #hasAnchors = false;
  #hasPlanes  = false;

  // Reticle / indicator
  #reticle     = null;
  #reticleMat  = null;   // material reference for opacity animation
  #shadowPlane = null;
  #reticleHit  = false;
  #sourceMode  = null;
  #reticleOnAt = 0;
  #planeSeen   = false;  // any XRPlane detected last tick → allow immediate placement

  // Placement capture — matrix is saved at tap time for accuracy
  #pendingPlace       = false;
  #pendingPlaceMatrix = null;

  // Anchor state
  #placed          = false;
  #freezeUntil     = 0;        // ms — object immovable before this
  #lastPos         = new THREE.Vector3(Infinity, Infinity, Infinity);

  // Tier A — plane-relative
  #anchorPlane    = null;      // XRPlane
  #planeLocalOff  = new THREE.Vector3();

  // Tier B — world anchor
  #worldAnchor          = null;
  #savedXRTransform     = null;  // fallback when XRHitTestResult.createAnchor() unavailable
  #anchorRetries        = 0;
  #retryAt              = 0;
  #anchorSettleEnd      = 0;
  #surfaceAnchorPending = false; // true while XRHitTestResult.createAnchor() promise is in flight

  // Room capture (Meta Quest / devices that support initiateRoomCapture)
  #roomCaptureAttempted = false;
  #sessionStartMs       = 0;

  // Jump animation (shared by tiers A and B)
  #jumpActive  = false;
  #jumpFrom    = new THREE.Vector3();
  #jumpTo      = new THREE.Vector3();
  #jumpStartMs = 0;
  #jumpQuat    = null;  // anchor orientation to apply after jump completes

  // SLAM warmup
  #warmupHits = 0;
  #slamReady  = false;

  // Stability modules
  #poseBuffer = null;
  #planeVal   = null;
  #trackConf  = null;
  #devProf    = null;

  #lastTickMs = 0;
  #wasFrozen  = false;

  // AI depth layer — DepthAnything v2 via Web Worker
  #aiLayer = null;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(scene, camera, renderer) {
    super();
    this.#scene    = scene;
    this.#camera   = camera;
    this.#renderer = renderer;

    this.#devProf   = new DeviceProfiler();
    this.#poseBuffer = new PoseBuffer(15);
    this.#planeVal  = new PlaneValidator(this.#poseBuffer);
    this.#trackConf = new TrackingConfidence();

    this.placedGroup = new THREE.Group();
    this.placedGroup.visible = false;
    scene.add(this.placedGroup);

    this.#shadowPlane = this.#buildShadow();
    this.#buildReticle();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get surfaceFound() { return this.#reticleHit; }
  get isPlaced()     { return this.#placed; }
  get hasPlanes()    { return this.#hasPlanes; }
  get slamReady()    { return this.#slamReady; }
  get sourceMode()   { return this.#sourceMode; }
  get confidence()   { return this.#planeVal.confidence; }

  async start(domOverlayRoot = null) {
    if (!navigator.xr) throw new Error('WebXR not supported');

    // Init AI layer BEFORE requestSession — getUserMedia must claim camera
    // before the XR session takes exclusive access.  Failure is non-fatal.
    this.#aiLayer = new AIDepthLayer();
    await this.#aiLayer.init().catch(() => {});

    this.#devProf.detect();
    this.#poseBuffer.setWindowSize(this.#devProf.settings().windowSize);

    const optional = ['plane-detection', 'anchors', 'local-floor', 'depth-sensing'];
    if (domOverlayRoot) optional.push('dom-overlay');

    // ── Request session — try with depthSensing first, fall back without ──
    const baseInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: optional,
    };
    if (domOverlayRoot) baseInit.domOverlay = { root: domOverlayRoot };

    try {
      this.#session = await navigator.xr.requestSession('immersive-ar', {
        ...baseInit,
        depthSensing: {
          usagePreference:      ['cpu-optimized', 'gpu-optimized'],
          dataFormatPreference: ['luminance-alpha', 'float32'],
        },
      });
    } catch {
      console.warn('[Surface] Session with depthSensing failed — retrying without');
      this.#session = await navigator.xr.requestSession('immersive-ar', baseInit);
    }

    const enabled    = new Set(Array.from(this.#session.enabledFeatures ?? []));
    this.#hasAnchors = enabled.has('anchors');
    this.#hasPlanes  = enabled.has('plane-detection');
    this.#hasDepth   = enabled.has('depth-sensing');
    this.#refType    = enabled.has('local-floor') ? 'local-floor' : 'local';

    console.log(`[Surface] tier:${this.#devProf.tier} ref:${this.#refType} depth:${this.#hasDepth} anchors:${this.#hasAnchors} planes:${this.#hasPlanes}`);

    this.#renderer.xr.enabled = true;
    this.#renderer.xr.setReferenceSpaceType(this.#refType);
    await this.#renderer.xr.setSession(this.#session);

    this.#refSpace = this.#renderer.xr.getReferenceSpace();
    if (!this.#refSpace) throw new Error('XR reference space unavailable after setSession');

    const viewerSpace = await this.#session.requestReferenceSpace('viewer');
    this.#hitSources  = await this.#createHitSources(viewerSpace);
    console.log(`[Surface] ${this.#hitSources.length} hit-test source(s) ✓`);

    this.#session.addEventListener('end', () => this.#cleanup());
    this.#sessionStartMs = performance.now();
    this.dispatchEvent(new Event('started'));
  }

  /**
   * Create hit-test sources with progressive fallback so we always end up
   * with at least one working source regardless of browser capability:
   *
   *   Pass 1 — 5 offset rays  + entityTypes  (best coverage)
   *   Pass 2 — 5 offset rays  without entityTypes  (wider compat)
   *   Pass 3 — 1 centre ray   without anything     (guaranteed fallback)
   */
  async #createHitSources(viewerSpace) {
    // Pass 1: multi-ray + entityTypes
    const sources = await this.#tryRays(viewerSpace, true);
    if (sources.length) return sources;

    // Pass 2: multi-ray without entityTypes
    console.warn('[Surface] entityTypes not supported — trying plain offset rays');
    const sources2 = await this.#tryRays(viewerSpace, false);
    if (sources2.length) return sources2;

    // Pass 3: single centre ray, no options at all
    console.warn('[Surface] Offset rays failed — falling back to single centre ray');
    const src = await this.#session.requestHitTestSource({ space: viewerSpace });
    return [src];
  }

  async #tryRays(viewerSpace, withEntityTypes) {
    const out = [];
    for (const off of RAY_OFFSETS) {
      try {
        let ray;
        try { ray = new XRRay({ x: 0, y: 0, z: 0, w: 1 }, off); } catch { ray = undefined; }
        const opts = { space: viewerSpace, offsetRay: ray };
        if (withEntityTypes) opts.entityTypes = ['plane', 'point'];
        out.push(await this.#session.requestHitTestSource(opts));
      } catch { /* skip this offset */ }
    }
    return out;
  }

  tick(frame, time = 0) {
    if (!frame || !this.#refSpace) return;

    // Feed camera frames to AI worker every ~400ms (self-throttled, non-blocking)
    this.#aiLayer?.tick();

    const s = this.#devProf.settings();
    const elapsed = time - this.#lastTickMs;
    if (elapsed < 1000 / s.updateHz) return;
    this.#devProf.recordFrame(elapsed);
    this.#lastTickMs = time;

    try {
      // Track whether any XR planes are visible — enables instant placement when plane found
      if (this.#hasPlanes) {
        const det = frame.detectedPlanes ?? new Set();
        this.#planeSeen = det.size > 0;

        // initiateRoomCapture: kick the device's room-scan if no planes appear within 2.5s
        // (supported on Meta Quest; silently ignored on other devices)
        if (!this.#placed && !this.#roomCaptureAttempted && !this.#planeSeen &&
            performance.now() - this.#sessionStartMs > 2500) {
          this.#roomCaptureAttempted = true;
          if (typeof this.#session.initiateRoomCapture === 'function') {
            this.#session.initiateRoomCapture().catch(() => {});
            console.log('[Surface] initiateRoomCapture triggered');
          }
        }
      }

      this.#updateReticle(frame, time);
      this.#updateAnchor(frame);

      if (this.#pendingPlace) {
        this.#pendingPlace = false;
        this.#executePlacement(frame);
      }

      // Pulse the placement indicator during scanning
      if (!this.#placed && this.#reticle?.visible && this.#reticleMat) {
        const ready = this.#slamReady || this.#planeVal.canPlace || this.#planeSeen;
        this.#reticleMat.opacity = ready
          ? 0.92
          : 0.45 + 0.45 * Math.sin(time * 0.006);
      }
    } catch (e) { console.error('[Surface] tick:', e); }
  }

  /**
   * Queue placement.  The reticle matrix is captured NOW so the object lands
   * exactly where the ring is displayed when the user taps.
   */
  requestPlacement() {
    if (!this.#reticleHit || this.#placed) return;

    const mode    = this.#sourceMode;
    const elapsed = Date.now() - this.#reticleOnAt;

    // Placement gates (first matching condition wins):
    //   Hit-test: SLAM ready, confidence high, plane visible, or 1s time fallback
    //   Depth:    600ms soak
    //   Projection: 1.2s soak (least accurate — needs more time)
    const ok =
      (mode === 'hit-test' && (this.#slamReady || this.#planeVal.canPlace || this.#planeSeen || elapsed > SOAK_HITTEST)) ||
      (mode === 'depth'    && elapsed > SOAK_DEPTH) ||
      (mode === 'ai-depth' && this.#aiLayer?.isReady && elapsed > 700) ||
      (mode === 'projection' && elapsed > SOAK_PROJ);
    if (!ok) return;

    this.#pendingPlaceMatrix = this.#reticle.matrix.clone();
    this.#pendingPlace = true;
  }

  resetPlacement() {
    if (this.#worldAnchor) {
      try { this.#worldAnchor.delete(); } catch { /* */ }
      this.#worldAnchor = null;
    }
    this.#placed               = false;
    this.#anchorPlane          = null;
    this.#jumpActive           = false;
    this.#anchorRetries        = 0;
    this.#retryAt              = 0;
    this.#savedXRTransform     = null;
    this.#surfaceAnchorPending = false;
    this.#lastPos.set(Infinity, Infinity, Infinity);
    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.visible = false;
    if (this.#shadowPlane) this.#shadowPlane.visible = false;
    if (this.#reticle)     this.#reticle.visible     = false;
    this.#reticleHit  = false;
    this.#wasFrozen   = false;
    this.#reticleOnAt = 0;
    this.#roomCaptureAttempted = false;
    this.#trackConf.reset();
    this.#poseBuffer.reset();
    this.#planeVal.reset();
    this.dispatchEvent(new Event('reset'));
  }

  async stop() {
    for (const s of this.#hitSources) { try { s.cancel(); } catch { /* */ } }
    try { await this.#session?.end(); } catch { /* */ }
  }

  // ── Detection pipeline ────────────────────────────────────────────────────

  #updateReticle(frame, time) {
    if (!this.#reticle) return;

    // Layer 1: multi-ray hit-test
    const { positions, primaryMatrix } = this.#collectHits(frame);
    if (positions.length > 0) {
      const med = this.#median(positions);
      this.#poseBuffer.push(med);
      this.#planeVal.recordHit();
      this.#advanceWarmup();
      const sm = this.#poseBuffer.getSmoothed() ?? med;
      this.#showReticle(sm, primaryMatrix);
      this.#setMode('hit-test', time);
      if (this.#placed) this.#postPlaceConfidence(true, sm);
      return;
    }

    this.#planeVal.recordMiss();
    this.#warmupHits = Math.max(0, this.#warmupHits - 1);

    // Layer 2: depth sensing
    if (this.#hasDepth) {
      const dp = this.#depthHit(frame);
      if (dp) {
        this.#showReticle(dp, null);
        this.#setMode('depth', time);
        if (this.#placed) this.#postPlaceConfidence(true, dp);
        return;
      }
    }

    // Layer 2.5: AI-guided surface detection (DepthAnything v2)
    // Identifies the most planar image region, converts to world position via
    // projection matrix inversion.  Better than floor projection on tables /
    // counters and on textureless floors where hit-test fails.
    const ap = this.#aiDepthHit(frame);
    if (ap) {
      this.#showReticle(ap, null);
      this.#setMode('ai-depth', time);
      if (this.#placed) this.#postPlaceConfidence(true, ap);
      return;
    }

    // Layer 3: floor projection
    const fp = this.#floorProject(frame);
    if (fp) {
      this.#showReticle(fp, null);
      this.#setMode('projection', time);
      if (this.#placed) this.#postPlaceConfidence(false, fp);
      return;
    }

    // All failed
    if (this.#reticleHit) {
      this.#reticleHit = false;
      this.#sourceMode = null;
      if (!this.#placed) this.#reticle.visible = false;
      this.dispatchEvent(Object.assign(new Event('surface'), { found: false, sourceMode: null }));
    }
  }

  #collectHits(frame) {
    const positions = []; let primaryMatrix = null;
    for (let i = 0; i < this.#hitSources.length; i++) {
      const hits = frame.getHitTestResults(this.#hitSources[i]);
      if (!hits.length) continue;
      const pose = hits[0].getPose(this.#refSpace);
      if (!pose) continue;
      const m = pose.transform.matrix;
      positions.push({ x: m[12], y: m[13], z: m[14] });
      if (i === 0) primaryMatrix = m;
    }
    return { positions, primaryMatrix };
  }

  #depthHit(frame) {
    try {
      const vp = frame.getViewerPose(this.#refSpace);
      if (!vp?.views?.length) return null;
      const view = vp.views[0];
      const di = frame.getDepthInformation?.(view);
      if (!di) return null;
      const depths = [];
      for (const [u, v] of DEPTH_UV) {
        try { const d = di.getDepthInMeters(u, v); if (d > 0.1 && d < 10) depths.push(d); } catch { /* */ }
      }
      if (!depths.length) return null;
      depths.sort((a, b) => a - b);
      const d = depths[Math.floor(depths.length / 2)];
      _m4.fromArray(view.transform.matrix);
      _v3.set(view.transform.matrix[12], view.transform.matrix[13], view.transform.matrix[14]);
      _fwd.set(0, 0, -1).transformDirection(_m4);
      return { x: _v3.x + _fwd.x * d, y: _v3.y + _fwd.y * d, z: _v3.z + _fwd.z * d };
    } catch { return null; }
  }

  #floorProject(frame) {
    try {
      const vp = frame.getViewerPose(this.#refSpace);
      if (!vp) return null;
      const t = vp.transform;
      _m4.fromArray(t.matrix);
      const ox = t.matrix[12], oy = t.matrix[13], oz = t.matrix[14];
      _fwd.set(0, 0, -1).transformDirection(_m4);
      const floorY = this.#refType === 'local-floor' ? 0 : -oy;
      if (Math.abs(_fwd.y) < 0.01) return null;
      const td = (floorY - oy) / _fwd.y;
      if (td < 0.2 || td > 6) return null;
      return { x: ox + _fwd.x * td, y: floorY, z: oz + _fwd.z * td };
    } catch { return null; }
  }

  /**
   * Layer 2.5 — AI-guided surface hit.
   *
   * DepthAnything v2 identifies the flattest image region (floor / table).
   * We unproject that UV through the XR view's projection matrix to get a
   * world-space ray direction, then intersect it with the floor plane
   * (Y = 0 for local-floor, or Y = camera_height - 1.4 for local).
   *
   * Unlike #floorProject which always shoots down the camera forward axis,
   * this shoots toward the actual detected surface — far more accurate on
   * tables, counters, and textureless floors.
   */
  #aiDepthHit(frame) {
    const uv = this.#aiLayer?.floorUV;
    if (!uv) return null;
    try {
      const vp = frame.getViewerPose(this.#refSpace);
      if (!vp?.views?.length) return null;
      const view = vp.views[0];

      // Convert image UV to NDC (flip Y: image top = NDC bottom)
      const ndcX =  uv.u * 2 - 1;
      const ndcY = -(uv.v * 2 - 1);

      // Unproject NDC → view-space direction via inverse projection matrix
      _m4.fromArray(view.projectionMatrix).invert();
      // Use z=0 in clip space; applyMatrix4 handles perspective divide
      _v3.set(ndcX, ndcY, 0.0).applyMatrix4(_m4);
      _v3.normalize();

      // Rotate view-space direction into world space (no translation)
      _m4.fromArray(view.transform.matrix);
      _fwd.copy(_v3).transformDirection(_m4);

      // Camera world position
      const cx = view.transform.matrix[12];
      const cy = view.transform.matrix[13];
      const cz = view.transform.matrix[14];

      // Floor plane Y: 0 for local-floor, estimated for plain local
      const floorY = this.#refType === 'local-floor' ? 0 : (cy - 1.4);

      // Ray must point downward to hit floor
      if (_fwd.y >= -0.01) return null;

      const td = (floorY - cy) / _fwd.y;
      if (td < 0.15 || td > 5.5) return null;

      return { x: cx + _fwd.x * td, y: floorY, z: cz + _fwd.z * td };
    } catch { return null; }
  }

  #showReticle(pos, primaryMatrix) {
    if (primaryMatrix) {
      _m4.fromArray(primaryMatrix);
      _m4.elements[12] = pos.x; _m4.elements[13] = pos.y; _m4.elements[14] = pos.z;
    } else {
      _m4.makeTranslation(pos.x, pos.y, pos.z);
    }
    this.#reticle.matrix.copy(_m4);
    this.#reticle.matrixWorldNeedsUpdate = true;
    if (!this.#placed) this.#reticle.visible = true;
  }

  #setMode(mode, time) {
    const wasHit = this.#reticleHit, wasMd = this.#sourceMode;
    this.#reticleHit = true;
    this.#sourceMode = mode;
    if (!wasHit) this.#reticleOnAt = Date.now();
    if (!wasHit || wasMd !== mode)
      this.dispatchEvent(Object.assign(new Event('surface'), { found: true, sourceMode: mode }));
  }

  #advanceWarmup() {
    if (this.#slamReady) return;
    if (++this.#warmupHits % 2 === 0)
      this.dispatchEvent(Object.assign(new Event('warming'), { progress: Math.min(this.#warmupHits / WARMUP_TARGET, 0.95) }));
    if (this.#warmupHits >= WARMUP_TARGET) {
      this.#slamReady = true;
      console.log('[Surface] SLAM ready ✓');
      this.dispatchEvent(new Event('ready'));
    }
  }

  #postPlaceConfidence(hitFound, pos) {
    _v3.set(pos.x, pos.y, pos.z);
    const delta = _v3.distanceTo(_prv);
    _prv.copy(_v3);
    this.#trackConf.update(hitFound, delta);
    const frozen = this.#trackConf.isFrozen;
    if (frozen && !this.#wasFrozen) { this.#wasFrozen = true; this.dispatchEvent(new Event('frozen')); }
    else if (!frozen && this.#wasFrozen) { this.#wasFrozen = false; this.dispatchEvent(new Event('unfrozen')); }
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  #executePlacement(frame) {
    // Use the captured reticle matrix — not a new hit-test query.
    // This guarantees the object appears exactly where the ring was showing.
    const m = this.#pendingPlaceMatrix ?? this.#reticle.matrix;
    const pos = new THREE.Vector3(m.elements[12], m.elements[13], m.elements[14]);
    _m4.copy(m);
    _q.setFromRotationMatrix(_m4);

    // ── Try to find a nearby XRPlane (Tier A) ──────────────────────────
    if (this.#hasPlanes) {
      const detected = frame.detectedPlanes ?? new Set();
      let bestPlane = null, bestDist = PLANE_SEARCH_R;
      for (const plane of detected) {
        const pp = frame.getPose(plane.planeSpace, this.#refSpace);
        if (!pp) continue;
        const pm = pp.transform.matrix;
        _v3.set(pm[12], pm[13], pm[14]);
        const d = _v3.distanceTo(pos);
        if (d < bestDist) { bestDist = d; bestPlane = plane; }
      }
      if (bestPlane) {
        const pp = frame.getPose(bestPlane.planeSpace, this.#refSpace);
        if (pp) {
          // Express hit-pos in plane local space
          _m4.fromArray(pp.transform.matrix);
          const invPlane = _m4.clone().invert();
          this.#planeLocalOff.copy(pos).applyMatrix4(invPlane);
          this.#anchorPlane = bestPlane;
          console.log('[Surface] Plane-relative anchoring ✓ dist:', bestDist.toFixed(3), 'm');
        }
      }
    }

    // ── Place the group ─────────────────────────────────────────────────
    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.position.copy(pos);
    this.placedGroup.quaternion.copy(_q);
    this.placedGroup.visible = this.placedGroup.children.length > 0;
    if (this.#reticle) this.#reticle.visible = false;
    if (this.#shadowPlane) {
      this.#shadowPlane.position.set(pos.x, pos.y + 0.002, pos.z);
      this.#shadowPlane.visible = true;
    }

    this.#placed     = true;
    this.#freezeUntil = performance.now() + FREEZE_MS;
    this.#lastPos.copy(pos);
    _prv.copy(pos);

    // ── Create anchor for long-term stability ──────────────────────────
    if (this.#hasAnchors && this.#hitSources.length) {
      const hits = frame.getHitTestResults(this.#hitSources[0]);
      if (hits.length) {
        const hitResult = hits[0];

        // Preferred path (W3C spec / ARCore): surface-attached anchor created
        // directly from the XRHitTestResult — attaches to the real-world surface
        // so SLAM corrections move the anchor WITH the surface.
        if (typeof hitResult.createAnchor === 'function') {
          this.#surfaceAnchorPending = true;
          hitResult.createAnchor()
            .then(anchor => {
              this.#surfaceAnchorPending = false;
              this.#worldAnchor    = anchor;
              this.#anchorSettleEnd = performance.now() + 250;
              this.#lastPos.copy(this.placedGroup.position);
              console.log('[Surface] Surface-attached anchor ✓ (XRHitTestResult)');
            })
            .catch(err => {
              this.#surfaceAnchorPending = false;
              console.warn('[Surface] Surface anchor failed — falling back to world anchor:', err);
              // Fallback: free-floating world anchor via XRRigidTransform
              const hp = hitResult.getPose(this.#refSpace);
              if (hp) {
                this.#savedXRTransform = new XRRigidTransform(hp.transform.position, hp.transform.orientation);
                this.#retryAt = performance.now();
              }
            });

        } else {
          // Fallback for older browsers: world anchor via XRRigidTransform
          const hp = hitResult.getPose(this.#refSpace);
          if (hp) {
            this.#savedXRTransform = new XRRigidTransform(hp.transform.position, hp.transform.orientation);
            this.#retryAt = performance.now();
            this.#tryCreateAnchor(frame);
          }
        }
      }
    }

    const tier = this.#anchorPlane ? 'A-plane' : (this.#hasAnchors ? 'B-anchor' : 'C-freeze');
    console.log(`[Surface] Placed — tier:${tier}`);
    this.dispatchEvent(Object.assign(new Event('placed'), {
      position: pos.clone(), quaternion: _q.clone(),
      sourceMode: this.#sourceMode, tier,
    }));
  }

  // ── Anchor update — drives placedGroup each frame after freeze ─────────

  #updateAnchor(frame) {
    if (!this.#placed) return;

    // During freeze period: object is immovable — let anchor stabilise
    if (performance.now() < this.#freezeUntil) return;

    // Retry fallback world-anchor creation (only if surface-attached anchor didn't resolve yet)
    if (!this.#worldAnchor && !this.#surfaceAnchorPending && this.#savedXRTransform &&
        this.#hasAnchors && this.#anchorRetries < ANCHOR_RETRY_N) {
      if (performance.now() >= this.#retryAt) {
        this.#retryAt = performance.now() + ANCHOR_RETRY_MS;
        this.#tryCreateAnchor(frame);
      }
    }

    // Advance jump animation (shared across tiers)
    if (this.#jumpActive) this.#tickJump();

    // ── Tier A: plane-relative ───────────────────────────────────────────
    if (this.#anchorPlane) {
      this.#updateFromPlane(frame);
      return;
    }

    // ── Tier B: world anchor ─────────────────────────────────────────────
    if (this.#worldAnchor) {
      this.#updateFromAnchor(frame);
      return;
    }

    // ── Tier C: frozen — object stays exactly at placement position ──────
    if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
  }

  // Tier A — re-project plane-local offset through current plane world pose.
  // If the plane moves with SLAM corrections, the object moves with it.
  #updateFromPlane(frame) {
    if (this.#jumpActive) return; // wait for jump to finish

    const detected = frame.detectedPlanes ?? new Set();
    if (!detected.has(this.#anchorPlane)) {
      // Plane temporarily lost — fall through to anchor if available
      if (this.#worldAnchor) this.#updateFromAnchor(frame);
      return;
    }

    const pp = frame.getPose(this.#anchorPlane.planeSpace, this.#refSpace);
    if (!pp) return;

    _m4.fromArray(pp.transform.matrix);
    // World position = plane matrix × local offset (reuse scratch _v3 — no allocation)
    _v3.copy(this.#planeLocalOff).applyMatrix4(_m4);

    const delta = _v3.distanceTo(this.#lastPos);
    if (delta < ANCHOR_NOISE_M) {
      if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
      return;
    }

    if (delta > JUMP_M) {
      this.#startJump(_v3, null);
    } else {
      // Lerp small corrections to avoid micro-jitter from SLAM plane refinements
      this.placedGroup.matrixAutoUpdate = true;
      this.placedGroup.position.lerp(_v3, delta > 0.015 ? 0.6 : 0.25);
    }

    this.#lastPos.copy(_v3);
    if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
    this.#syncShadow();
  }

  // Tier B — drive from XRAnchor position/orientation (no raw matrix write).
  #updateFromAnchor(frame) {
    if (this.#jumpActive) return;
    if (performance.now() < this.#anchorSettleEnd) return;

    const pose = frame.getPose(this.#worldAnchor.anchorSpace, this.#refSpace);
    if (!pose) return;

    const p = pose.transform.position;
    _v3.set(p.x, p.y, p.z);
    const delta = _v3.distanceTo(this.#lastPos);

    if (delta < ANCHOR_NOISE_M) {
      if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
      return;
    }

    this.#lastPos.copy(_v3);

    if (delta > JUMP_M) {
      this.#startJump(_v3, pose.transform.orientation);
    } else {
      this.placedGroup.matrixAutoUpdate = true;
      // Lerp small corrections to smooth XR anchor noise; snap larger SLAM refinements
      this.placedGroup.position.lerp(_v3, delta > 0.015 ? 0.6 : 0.25);
      if (delta > 0.015) {
        const o = pose.transform.orientation;
        this.placedGroup.quaternion.set(o.x, o.y, o.z, o.w);
      }
    }

    if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
    this.#syncShadow();
  }

  // ── Jump animation helpers ─────────────────────────────────────────────

  #startJump(targetPos, orientation) {
    this.#jumpFrom.copy(this.placedGroup.position);
    this.#jumpTo.copy(targetPos);
    this.#jumpQuat    = orientation ?? null;
    this.#jumpStartMs = performance.now();
    this.#jumpActive  = true;
    this.placedGroup.matrixAutoUpdate = true;
  }

  #tickJump() {
    const t    = Math.min((performance.now() - this.#jumpStartMs) / JUMP_MS, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    this.placedGroup.position.lerpVectors(this.#jumpFrom, this.#jumpTo, ease);
    if (t >= 1) {
      this.#jumpActive = false;
      if (this.#jumpQuat) {
        const o = this.#jumpQuat;
        this.placedGroup.quaternion.set(o.x, o.y, o.z, o.w);
        this.#jumpQuat = null;
      }
    }
  }

  #syncShadow() {
    if (!this.#shadowPlane?.visible) return;
    this.#shadowPlane.position.x = this.placedGroup.position.x;
    this.#shadowPlane.position.z = this.placedGroup.position.z;
  }

  // ── Anchor creation ───────────────────────────────────────────────────────

  #tryCreateAnchor(frame) {
    if (!this.#savedXRTransform || !this.#refSpace) return;
    this.#anchorRetries++;
    frame.createAnchor(this.#savedXRTransform, this.#refSpace)
      .then(anchor => {
        this.#worldAnchor    = anchor;
        this.#anchorSettleEnd = performance.now() + 250;
        // Seed lastPos from current placement to avoid phantom delta on first drive
        if (this.placedGroup.matrixAutoUpdate) {
          this.#lastPos.copy(this.placedGroup.position);
        } else {
          const e = this.placedGroup.matrix.elements;
          this.#lastPos.set(e[12], e[13], e[14]);
        }
        console.log(`[Surface] Anchor ✓ (attempt ${this.#anchorRetries})`);
      })
      .catch(err => console.warn(`[Surface] Anchor attempt ${this.#anchorRetries}/${ANCHOR_RETRY_N}:`, err));
  }

  // ── Reticle & shadow ──────────────────────────────────────────────────────

  #buildReticle() {
    // Gold placement indicator: ring + centre dot, themed to match the app
    const g = new THREE.Group();

    this.#reticleMat = new THREE.MeshBasicMaterial({
      color: INDICATOR_COL, side: THREE.DoubleSide,
      transparent: true, opacity: 0.8, depthWrite: false,
    });
    const ring = new THREE.RingGeometry(RETICLE_R * 0.72, RETICLE_R, 32).rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(ring, this.#reticleMat));

    const dot = new THREE.CircleGeometry(RETICLE_R * 0.12, 12).rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: INDICATOR_COL, transparent: true, opacity: 0.9, depthWrite: false })));

    g.matrixAutoUpdate = false;
    g.visible = false;
    this.#reticle = g;
    this.#scene.add(g);
  }

  #buildShadow() {
    const sz = 256;
    const cv = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(sz, sz)
      : Object.assign(document.createElement('canvas'), { width: sz, height: sz });
    const ctx = cv.getContext('2d'), r = sz / 2;
    const gr = ctx.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0,    'rgba(0,0,0,0.38)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.14)');
    gr.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, sz, sz);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }),
    );
    mesh.visible = false; this.#scene.add(mesh); return mesh;
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  #median(pts) {
    const xs = pts.map(p => p.x).sort((a, b) => a - b);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const zs = pts.map(p => p.z).sort((a, b) => a - b);
    const m = Math.floor(pts.length / 2);
    return { x: xs[m], y: ys[m], z: zs[m] };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  #cleanup() {
    for (const s of this.#hitSources) { try { s.cancel(); } catch { /* */ } }
    this.#hitSources = [];
    if (this.#worldAnchor) { try { this.#worldAnchor.delete(); } catch { /* */ } this.#worldAnchor = null; }
    this.#session = null; this.#refSpace = null;
    this.#placed = false; this.#jumpActive = false;
    this.placedGroup.matrixAutoUpdate = true;
    if (this.#reticle) { this.#scene.remove(this.#reticle); this.#reticle = null; this.#reticleMat = null; }
    if (this.#shadowPlane) {
      this.#shadowPlane.material.map?.dispose();
      this.#shadowPlane.geometry.dispose(); this.#shadowPlane.material.dispose();
      this.#scene.remove(this.#shadowPlane); this.#shadowPlane = null;
    }
    this.#aiLayer?.dispose();
    this.#aiLayer = null;
    this.dispatchEvent(new Event('ended'));
  }
}
