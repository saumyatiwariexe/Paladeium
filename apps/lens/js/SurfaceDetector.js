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

// ── Tuning ─────────────────────────────────────────────────────────────────

const PLANE_OPACITY = 0.18;
const RETICLE_R     = 0.08;
const SHADOW_SIZE   = 0.55;
const PLANE_COLOR_H = 0x4a9eff;
const PLANE_COLOR_V = 0xff9a4a;

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

// SLAM warmup
const WARMUP_TARGET = 20;

// Pre-placement soak times for fallback sources
const SOAK_DEPTH = 1500;   // ms
const SOAK_PROJ  = 3000;   // ms

// Anchor / freeze
const FREEZE_MS       = 1800;   // freeze after placement so anchor can stabilise
const ANCHOR_NOISE_M  = 0.001;  // 1 mm — skip imperceptibly small updates
const JUMP_M          = 0.04;   // 4 cm — animate instead of snap
const JUMP_MS         = 550;    // cubic-ease-out duration for large corrections
const ANCHOR_RETRY_N  = 20;     // max anchor creation attempts
const ANCHOR_RETRY_MS = 500;    // ms between retries
const PLANE_SEARCH_R  = 0.50;   // metres — search for nearest plane within this radius

// Reticle tint per source
const COL_HIT   = 0xffffff;
const COL_DEPTH = 0x88ddff;
const COL_PROJ  = 0xffcc55;

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

  // Reticle
  #reticle    = null;
  #shadowPlane = null;
  #reticleHit  = false;
  #sourceMode  = null;
  #reticleOnAt = 0;

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
  #worldAnchor      = null;
  #savedXRTransform = null;
  #anchorRetries    = 0;
  #retryAt          = 0;
  #anchorSettleEnd  = 0;

  // Jump animation (shared by tiers A and B)
  #jumpActive  = false;
  #jumpFrom    = new THREE.Vector3();
  #jumpTo      = new THREE.Vector3();
  #jumpStartMs = 0;
  #jumpQuat    = null;  // anchor orientation to apply after jump completes

  // Planes display
  #planes = new Map();

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
        if (withEntityTypes) opts.entityTypes = ['plane', 'point', 'mesh'];
        out.push(await this.#session.requestHitTestSource(opts));
      } catch { /* skip this offset */ }
    }
    return out;
  }

  tick(frame, time = 0) {
    if (!frame || !this.#refSpace) return;
    const s = this.#devProf.settings();
    const elapsed = time - this.#lastTickMs;
    if (elapsed < 1000 / s.updateHz) return;
    this.#devProf.recordFrame(elapsed);
    this.#lastTickMs = time;

    try {
      this.#updateReticle(frame, time);
      if (s.showPlanes && this.#hasPlanes) this.#updatePlanes(frame);
      this.#updateAnchor(frame);
      if (this.#pendingPlace) {
        this.#pendingPlace = false;
        this.#executePlacement(frame);
      }
    } catch (e) { console.error('[Surface] tick:', e); }
  }

  /**
   * Queue placement.  The reticle matrix is captured NOW so the object lands
   * exactly where the ring is displayed when the user taps.
   */
  requestPlacement() {
    if (!this.#reticleHit || this.#placed) return;

    const mode = this.#sourceMode;
    const ok = (mode === 'hit-test' && (this.#slamReady || this.#planeVal.canPlace)) ||
               (mode === 'hit-test' && Date.now() - this.#reticleOnAt > SOAK_PROJ) ||
               (mode === 'depth'    && Date.now() - this.#reticleOnAt > SOAK_DEPTH) ||
               (mode === 'projection' && Date.now() - this.#reticleOnAt > SOAK_PROJ);
    if (!ok) return;

    // Capture the reticle matrix at this exact moment
    this.#pendingPlaceMatrix = this.#reticle.matrix.clone();
    this.#pendingPlace = true;
  }

  resetPlacement() {
    if (this.#worldAnchor) {
      try { this.#worldAnchor.delete(); } catch { /* */ }
      this.#worldAnchor = null;
    }
    this.#placed      = false;
    this.#anchorPlane = null;
    this.#jumpActive  = false;
    this.#anchorRetries = 0;
    this.#retryAt       = 0;
    this.#lastPos.set(Infinity, Infinity, Infinity);
    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.visible = false;
    if (this.#shadowPlane) this.#shadowPlane.visible = false;
    if (this.#reticle)     this.#reticle.visible     = false;
    this.#reticleHit  = false;
    this.#wasFrozen   = false;
    this.#reticleOnAt = 0;
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
      this.#showReticle(sm, primaryMatrix, COL_HIT);
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
        this.#showReticle(dp, null, COL_DEPTH);
        this.#setMode('depth', time);
        if (this.#placed) this.#postPlaceConfidence(true, dp);
        return;
      }
    }

    // Layer 3: floor projection
    const fp = this.#floorProject(frame);
    if (fp) {
      this.#showReticle(fp, null, COL_PROJ);
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

  #showReticle(pos, primaryMatrix, _colour) {
    // Reticle is kept invisible; matrix is still updated so placement lands
    // exactly where the detection hit when the user's tap (or auto-place) fires.
    if (primaryMatrix) {
      _m4.fromArray(primaryMatrix);
      _m4.elements[12] = pos.x; _m4.elements[13] = pos.y; _m4.elements[14] = pos.z;
    } else {
      _m4.makeTranslation(pos.x, pos.y, pos.z);
    }
    this.#reticle.matrix.copy(_m4);
    this.#reticle.matrixWorldNeedsUpdate = true;
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
    if (++this.#warmupHits % 5 === 0)
      this.dispatchEvent(Object.assign(new Event('warming'), { progress: this.#warmupHits / WARMUP_TARGET }));
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
    this.dispatchEvent(Object.assign(new Event('confidence'), { score: this.#trackConf.score }));
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

    // ── Save XRRigidTransform for anchor / retry ────────────────────────
    // Get fresh hit-test pose for the XRRigidTransform (anchors need the raw pose)
    if (this.#hasAnchors && this.#hitSources.length) {
      const hits = frame.getHitTestResults(this.#hitSources[0]);
      if (hits.length) {
        const hp = hits[0].getPose(this.#refSpace);
        if (hp) {
          this.#savedXRTransform = new XRRigidTransform(
            hp.transform.position, hp.transform.orientation,
          );
        }
      }
      if (this.#savedXRTransform) {
        this.#retryAt = performance.now();  // attempt immediately
        this.#tryCreateAnchor(frame);
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

    // Retry anchor creation
    if (!this.#worldAnchor && this.#hasAnchors && this.#anchorRetries < ANCHOR_RETRY_N) {
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
    // World position = plane matrix × local offset
    const newPos = this.#planeLocalOff.clone().applyMatrix4(_m4);

    const delta = newPos.distanceTo(this.#lastPos);
    if (delta < ANCHOR_NOISE_M) {
      if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
      return;
    }

    if (delta > JUMP_M) {
      this.#startJump(newPos, null);
    } else {
      // Small correction — apply directly (plane tracking is inherently stable)
      this.placedGroup.matrixAutoUpdate = true;
      this.placedGroup.position.copy(newPos);
    }

    this.#lastPos.copy(newPos);
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
      const o = pose.transform.orientation;
      this.placedGroup.matrixAutoUpdate = true;
      this.placedGroup.position.set(p.x, p.y, p.z);
      this.placedGroup.quaternion.set(o.x, o.y, o.z, o.w);
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

  // ── Plane display ─────────────────────────────────────────────────────────

  #updatePlanes(frame) {
    const det = frame.detectedPlanes ?? new Set();
    for (const [plane, mesh] of this.#planes) {
      if (!det.has(plane)) {
        this.#scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
        this.#planes.delete(plane);
      }
    }
    for (const plane of det) {
      let mesh = this.#planes.get(plane);
      if (!mesh) { mesh = this.#makePlaneMesh(plane); this.#scene.add(mesh); this.#planes.set(plane, mesh); }
      const pp = frame.getPose(plane.planeSpace, this.#refSpace);
      if (pp) { mesh.matrix.fromArray(pp.transform.matrix); mesh.matrixWorldNeedsUpdate = true; }
      if (plane.lastChangedTime !== mesh.userData.ct) {
        mesh.geometry.dispose();
        mesh.geometry = this.#planeGeo(plane.polygon);
        mesh.userData.ct = plane.lastChangedTime;
      }
    }
  }

  #makePlaneMesh(plane) {
    const isH = plane.orientation === 'horizontal';
    const mat = new THREE.MeshBasicMaterial({
      color: isH ? PLANE_COLOR_H : PLANE_COLOR_V,
      transparent: true, opacity: PLANE_OPACITY,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.#planeGeo(plane.polygon), mat);
    mesh.matrixAutoUpdate = false; mesh.userData.ct = plane.lastChangedTime;
    return mesh;
  }

  #planeGeo(polygon) {
    const v = []; for (const p of polygon) v.push(p.x, p.y, p.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const idx = []; for (let i = 1; i < polygon.length - 1; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }

  // ── Reticle & shadow ──────────────────────────────────────────────────────

  #buildReticle() {
    const g = new THREE.Group();
    const rg = new THREE.RingGeometry(RETICLE_R * 0.72, RETICLE_R, 36).rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
      color: COL_HIT, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false,
    })));
    const dg = new THREE.CircleGeometry(RETICLE_R * 0.14, 16).rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: COL_HIT, depthWrite: false })));
    g.matrixAutoUpdate = false; g.visible = false;
    this.#reticle = g; this.#scene.add(g);
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
    for (const [, mesh] of this.#planes) {
      this.#scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
    }
    this.#planes.clear();
    if (this.#reticle) { this.#scene.remove(this.#reticle); this.#reticle = null; }
    if (this.#shadowPlane) {
      this.#shadowPlane.material.map?.dispose();
      this.#shadowPlane.geometry.dispose(); this.#shadowPlane.material.dispose();
      this.#scene.remove(this.#shadowPlane); this.#shadowPlane = null;
    }
    this.dispatchEvent(new Event('ended'));
  }
}
