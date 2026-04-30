/**
 * SurfaceDetector — WebXR surface detection engine with multi-layer fallback.
 *
 * Detection pipeline (priority order, first success wins each frame):
 *
 *   Layer 1 — Multi-ray hit-test
 *     Five XRHitTestSources (center + 4 angled downward).  Positions are
 *     component-wise median-averaged then pushed through a Kalman PoseBuffer.
 *
 *   Layer 2 — Depth Sensing API  (`depth-sensing` optional feature)
 *     Samples XRCPUDepthInformation at 5 viewport points, takes median depth,
 *     then unprojects it to world space along the camera-forward ray.  Gives a
 *     real surface position even when hit-test returns nothing (e.g. featureless
 *     floors, glass, low-texture environments).
 *
 *   Layer 3 — Floor projection fallback
 *     Intersects the camera-forward ray with Y = 0 (the physical floor plane in
 *     `local-floor` reference space).  Always produces a result as long as the
 *     camera is tilted slightly downward.  Used as a last resort so users can
 *     always place content even if ARCore/ARKit is still initialising.
 *
 * Stability architecture:
 *   PoseBuffer        Kalman filter (Q=0.005, R=0.02) + 8 cm outlier rejection
 *   PlaneValidator    Confidence gate — real placement needs score ≥ 0.55
 *   AnchorSimulator   Soft re-alignment (lerp + Y-lock + 15 cm cap)
 *   TrackingConfidence History-smoothed score; freezes object on low confidence
 *   DeviceProfiler    Low/mid/high tier — controls update rate & window size
 *
 * Reference space:
 *   Prefers `local-floor` (gravity-aligned, Y = 0 is the physical floor).
 *   Falls back automatically to `local` if the device doesn't support it.
 *
 * Integration:
 *   1. new SurfaceDetector(scene, camera, renderer)
 *   2. await surfaceDetector.start(domOverlayRoot?)
 *   3. surfaceDetector.tick(frame, time)  ← inside renderer.setAnimationLoop
 *   4. surfaceDetector.requestPlacement()  ← on user tap
 *   5. Attach AR content to surfaceDetector.placedGroup
 *
 * Events:
 *   'started'     — XR session active, scanning begins
 *   'warming'     — SLAM initialising { detail.progress 0–1 }
 *   'ready'       — SLAM has enough features; full-accuracy hit-test available
 *   'surface'     — reticle hit state changed { found, sourceMode }
 *   'placed'      — content placed { position, quaternion, sourceMode }
 *   'reset'       — placement cleared
 *   'frozen'      — tracking confidence low, object held in place
 *   'unfrozen'    — tracking confidence recovered
 *   'confidence'  — per-tick tracking score { score }
 *   'ended'       — XR session ended
 */

import * as THREE from 'three';
import { PoseBuffer }         from './PoseBuffer.js';
import { AnchorSimulator }    from './AnchorSimulator.js';
import { PlaneValidator }     from './PlaneValidator.js';
import { TrackingConfidence } from './TrackingConfidence.js';
import { DeviceProfiler }     from './DeviceProfiler.js';

// ── Constants ──────────────────────────────────────────────────────────────

const PLANE_OPACITY  = 0.18;
const RETICLE_RADIUS = 0.08;
const SHADOW_SIZE    = 0.55;
const PLANE_COLOR_H  = 0x4a9eff;
const PLANE_COLOR_V  = 0xff9a4a;

// Multi-ray hit-test offsets (viewer space, camera looks along -Z)
// Slight downward-forward bias to favour floor/table detection.
const RAY_OFFSETS = [
  { x:  0,     y:  0,     z: -1 },  // centre
  { x: -0.12,  y: -0.10,  z: -1 },  // down-left
  { x:  0.12,  y: -0.10,  z: -1 },  // down-right
  { x:  0,     y: -0.15,  z: -1 },  // straight down
  { x:  0,     y:  0.06,  z: -1 },  // slight up (tables / counters)
];

// Depth sensing viewport sample pattern (normalised 0–1)
const DEPTH_SAMPLES = [
  [0.50, 0.50],  // centre
  [0.40, 0.55], [0.60, 0.55],  // centre-left / right (below midline)
  [0.50, 0.65], [0.50, 0.40],  // below / above centre
];

// SLAM warmup: require N consecutive valid hit-test results before 'ready'
const WARMUP_TARGET = 20;

// Fallback placement: allow tap after the reticle has been stable for this long
const DEPTH_PLACE_AFTER_MS       = 1500;
const PROJECTION_PLACE_AFTER_MS  = 3000;

// Reticle colours per source mode
const RETICLE_COLOR_HIT   = 0xffffff;
const RETICLE_COLOR_DEPTH = 0x88ddff;
const RETICLE_COLOR_PROJ  = 0xffcc55;

// Scratch objects — avoid per-frame allocations
const _mat4 = new THREE.Matrix4();
const _vec3 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _fwd  = new THREE.Vector3();
const _prev = new THREE.Vector3();

// ── SurfaceDetector ────────────────────────────────────────────────────────

export class SurfaceDetector extends EventTarget {
  /** Attach AR content here — positioned automatically on placement. */
  placedGroup = null;

  #scene    = null;
  #camera   = null;
  #renderer = null;

  #session      = null;
  #refSpace     = null;
  #refSpaceType = 'local-floor';
  #hitSources   = [];   // one per RAY_OFFSETS entry
  #hasDepth     = false;
  #hasAnchors   = false;
  #hasPlanes    = false;

  #reticle     = null;
  #shadowPlane = null;
  #reticleHit  = false;
  #sourceMode  = null;           // 'hit-test' | 'depth' | 'projection' | null
  #reticleOnAt = 0;              // timestamp when reticle last became visible

  #planes      = new Map();
  #worldAnchor = null;

  #pendingPlace = false;

  // SLAM warmup
  #warmupHits = 0;
  #slamReady  = false;

  // Stability modules
  #poseBuffer = null;
  #anchorSim  = null;
  #planeVal   = null;
  #trackConf  = null;
  #deviceProf = null;

  // Rate-limiting
  #lastTickTime = 0;

  // Freeze event de-dup
  #wasFrozen = false;

  constructor(scene, camera, renderer) {
    super();
    this.#scene    = scene;
    this.#camera   = camera;
    this.#renderer = renderer;

    this.#deviceProf = new DeviceProfiler();
    this.#poseBuffer = new PoseBuffer(15);
    this.#anchorSim  = new AnchorSimulator(0.04);
    this.#planeVal   = new PlaneValidator(this.#poseBuffer);
    this.#trackConf  = new TrackingConfidence();

    this.placedGroup = new THREE.Group();
    this.placedGroup.visible = false;
    scene.add(this.placedGroup);

    this.#shadowPlane = this.#buildShadowPlane();
    this.#buildReticle();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get surfaceFound() { return this.#reticleHit; }
  get isPlaced()     { return this.#anchorSim.isActive; }
  get hasPlanes()    { return this.#hasPlanes; }
  get slamReady()    { return this.#slamReady; }
  get sourceMode()   { return this.#sourceMode; }
  get confidence()   { return this.#planeVal.confidence; }

  async start(domOverlayRoot = null) {
    if (!navigator.xr) throw new Error('WebXR not supported on this device');

    const tier     = this.#deviceProf.detect();
    const settings = this.#deviceProf.settings();
    this.#poseBuffer.setWindowSize(settings.windowSize);
    this.#anchorSim.lerpAlpha = settings.anchorLerp;

    // ── Reference space: prefer local-floor, fall back to local ──────────
    this.#refSpaceType = 'local-floor';
    try {
      // Quick probe — just check if the space is available before committing
      const testSession = this.#session; // will be null here; checked via feature flags
      // We'll detect via optional feature negotiation instead
    } catch { /* handled below */ }

    // ── Session features ──────────────────────────────────────────────────
    const optional = ['plane-detection', 'anchors', 'local-floor', 'depth-sensing'];
    if (domOverlayRoot) optional.push('dom-overlay');

    const sessionInit = {
      requiredFeatures : ['hit-test'],
      optionalFeatures : optional,
    };
    if (domOverlayRoot) sessionInit.domOverlay = { root: domOverlayRoot };

    // Depth sensing configuration (ignored if feature unavailable)
    sessionInit.depthSensing = {
      usagePreference       : ['cpu-optimized', 'gpu-optimized'],
      dataFormatPreference  : ['luminance-alpha', 'float32'],
    };

    this.#session = await navigator.xr.requestSession('immersive-ar', sessionInit);

    const enabled = new Set(Array.from(this.#session.enabledFeatures ?? []));
    this.#hasAnchors = enabled.has('anchors');
    this.#hasPlanes  = enabled.has('plane-detection');
    this.#hasDepth   = enabled.has('depth-sensing');

    // If local-floor not granted, fall back to local
    if (!enabled.has('local-floor')) {
      this.#refSpaceType = 'local';
      console.warn('[Surface] local-floor unavailable — using local reference space');
    }

    console.log(
      `[Surface] Session — tier:${tier} refSpace:${this.#refSpaceType} ` +
      `depth:${this.#hasDepth} anchors:${this.#hasAnchors} planes:${this.#hasPlanes}`,
    );

    // ── Three.js XR setup ────────────────────────────────────────────────
    this.#renderer.xr.enabled = true;
    this.#renderer.xr.setReferenceSpaceType(this.#refSpaceType);
    await this.#renderer.xr.setSession(this.#session);

    this.#refSpace = this.#renderer.xr.getReferenceSpace();
    if (!this.#refSpace) throw new Error('XR reference space unavailable after setSession');

    // ── Multi-ray hit-test sources ────────────────────────────────────────
    const viewerSpace = await this.#session.requestReferenceSpace('viewer');

    for (const offset of RAY_OFFSETS) {
      try {
        let ray;
        try {
          ray = new XRRay({ x: 0, y: 0, z: 0, w: 1 }, offset);
        } catch {
          ray = undefined; // XRRay not supported — browser uses default centre ray
        }
        const src = await this.#session.requestHitTestSource({
          space      : viewerSpace,
          offsetRay  : ray,
          entityTypes: ['plane', 'point', 'mesh'],
        });
        this.#hitSources.push(src);
      } catch (err) {
        console.warn('[Surface] Hit-test source creation failed for ray offset:', offset, err);
      }
    }

    if (this.#hitSources.length === 0) {
      throw new Error('No hit-test sources could be created');
    }
    console.log(`[Surface] ${this.#hitSources.length} hit-test source(s) created ✓`);

    this.#session.addEventListener('end', () => this.#cleanup());
    this.dispatchEvent(new Event('started'));
  }

  tick(frame, time = 0) {
    if (!frame || !this.#refSpace) return;

    const settings    = this.#deviceProf.settings();
    const minInterval = 1000 / settings.updateHz;
    const elapsed     = time - this.#lastTickTime;
    if (elapsed < minInterval) return;

    this.#deviceProf.recordFrame(elapsed);
    this.#lastTickTime = time;

    try {
      this.#updateReticle(frame, time);
      if (settings.showPlanes && this.#hasPlanes) this.#updatePlanes(frame);
      this.#updateAnchor(frame);

      if (this.#pendingPlace) {
        this.#pendingPlace = false;
        this.#executePlacement(frame);
      }
    } catch (err) {
      console.error('[Surface] tick error:', err);
    }
  }

  requestPlacement() {
    if (!this.#reticleHit || this.isPlaced) return;

    const mode = this.#sourceMode;

    if (mode === 'hit-test') {
      // Gate on PlaneValidator confidence for real hit-test results
      if (this.#slamReady && this.#planeVal.canPlace) {
        this.#pendingPlace = true;
        return;
      }
      // Allow after warmup even if PlaneValidator hasn't reached threshold
      // (partial confidence — SLAM initialised but scene still sparse)
      if (this.#slamReady) {
        this.#pendingPlace = true;
        return;
      }
      // Pre-warmup: still allow after enough scan time in hit-test mode
      if (Date.now() - this.#reticleOnAt > PROJECTION_PLACE_AFTER_MS) {
        this.#pendingPlace = true;
      }
      return;
    }

    // Depth / projection fallback — allow after soak time
    const soak = mode === 'depth' ? DEPTH_PLACE_AFTER_MS : PROJECTION_PLACE_AFTER_MS;
    if (Date.now() - this.#reticleOnAt > soak) {
      this.#pendingPlace = true;
    }
  }

  resetPlacement() {
    if (this.#worldAnchor) {
      try { this.#worldAnchor.delete(); } catch { /* */ }
      this.#worldAnchor = null;
    }
    this.#anchorSim.reset();
    this.#trackConf.reset();
    this.#poseBuffer.reset();
    this.#planeVal.reset();

    this.placedGroup.visible = false;
    if (this.#shadowPlane) this.#shadowPlane.visible = false;
    if (this.#reticle) this.#reticle.visible = false;
    this.#reticleHit = false;
    this.#wasFrozen  = false;
    this.#reticleOnAt = 0;

    this.dispatchEvent(new Event('reset'));
  }

  async stop() {
    for (const src of this.#hitSources) { try { src.cancel(); } catch { /* */ } }
    try { await this.#session?.end(); } catch { /* */ }
  }

  // ── Hit-test + fallback pipeline ───────────────────────────────────────────

  #updateReticle(frame, time) {
    if (!this.#reticle) return;

    // ── Layer 1: multi-ray hit-test ───────────────────────────────────────
    const { positions: hitPositions, primaryMatrix } = this.#collectMultiRayHits(frame);

    if (hitPositions.length > 0) {
      const median = this.#medianPosition(hitPositions);
      this.#poseBuffer.push(median);
      this.#planeVal.recordHit();
      this.#advanceWarmup();

      const smoothed = this.#poseBuffer.getSmoothed() ?? median;
      const matrix   = primaryMatrix ? new Float32Array(primaryMatrix) : null;

      this.#positionReticle(smoothed, matrix, RETICLE_COLOR_HIT);
      this.#setSourceMode('hit-test', time);

      if (this.isPlaced) this.#updatePostPlaceConfidence(true, smoothed);
      return;
    }

    // Hit-test miss — penalise warmup and validator
    this.#poseBuffer.push({ x: 0, y: 0, z: 0 }); // won't be used but keeps counts right
    this.#planeVal.recordMiss();
    this.#warmupHits = Math.max(0, this.#warmupHits - 1);

    // ── Layer 2: depth sensing ────────────────────────────────────────────
    if (this.#hasDepth) {
      const depthPos = this.#getDepthHit(frame);
      if (depthPos) {
        this.#positionReticle(depthPos, null, RETICLE_COLOR_DEPTH);
        this.#setSourceMode('depth', time);
        if (this.isPlaced) this.#updatePostPlaceConfidence(true, depthPos);
        return;
      }
    }

    // ── Layer 3: floor projection fallback ───────────────────────────────
    const projPos = this.#getFloorProjection(frame);
    if (projPos) {
      this.#positionReticle(projPos, null, RETICLE_COLOR_PROJ);
      this.#setSourceMode('projection', time);
      if (this.isPlaced) this.#updatePostPlaceConfidence(false, projPos);
      return;
    }

    // ── All layers failed — hide reticle ─────────────────────────────────
    if (this.#reticleHit) {
      this.#reticleHit = false;
      this.#sourceMode = null;
      if (!this.isPlaced) this.#reticle.visible = false;
      this.dispatchEvent(Object.assign(new Event('surface'), { found: false, sourceMode: null }));
    }
  }

  // Collect positions from every active hit-test source.
  // Returns: { positions: [{x,y,z}], primaryMatrix: Float32Array | null }
  #collectMultiRayHits(frame) {
    const positions   = [];
    let primaryMatrix = null;

    for (let i = 0; i < this.#hitSources.length; i++) {
      const hits = frame.getHitTestResults(this.#hitSources[i]);
      if (!hits.length) continue;
      const pose = hits[0].getPose(this.#refSpace);
      if (!pose) continue;
      const m = pose.transform.matrix;
      positions.push({ x: m[12], y: m[13], z: m[14] });
      if (i === 0) primaryMatrix = m; // save centre ray matrix for rotation
    }

    return { positions, primaryMatrix };
  }

  // Sample depth at multiple viewport points; return world position at median depth.
  #getDepthHit(frame) {
    try {
      const viewerPose = frame.getViewerPose(this.#refSpace);
      if (!viewerPose?.views?.length) return null;

      const view = viewerPose.views[0];
      const di   = frame.getDepthInformation?.(view);
      if (!di) return null;

      // Collect valid depth samples
      const depths = [];
      for (const [u, v] of DEPTH_SAMPLES) {
        try {
          const d = di.getDepthInMeters(u, v);
          if (d > 0.1 && d < 10) depths.push(d);
        } catch { /* out-of-range */ }
      }
      if (!depths.length) return null;

      depths.sort((a, b) => a - b);
      const medianDepth = depths[Math.floor(depths.length / 2)];

      // Unproject: camera position + camera-forward * depth
      _mat4.fromArray(view.transform.matrix);
      _vec3.set(
        view.transform.matrix[12],
        view.transform.matrix[13],
        view.transform.matrix[14],
      );
      _fwd.set(0, 0, -1).transformDirection(_mat4);
      return {
        x: _vec3.x + _fwd.x * medianDepth,
        y: _vec3.y + _fwd.y * medianDepth,
        z: _vec3.z + _fwd.z * medianDepth,
      };
    } catch (err) {
      console.warn('[Surface] Depth hit error:', err);
      return null;
    }
  }

  // Intersect camera-forward ray with the floor plane (Y = 0 in local-floor,
  // Y = –viewer.y in local space as a rough approximation).
  #getFloorProjection(frame) {
    try {
      const viewerPose = frame.getViewerPose(this.#refSpace);
      if (!viewerPose) return null;

      const t = viewerPose.transform;
      _mat4.fromArray(t.matrix);
      const ox = t.matrix[12], oy = t.matrix[13], oz = t.matrix[14];
      _fwd.set(0, 0, -1).transformDirection(_mat4);

      // For `local` space, treat viewer's starting Y as the floor
      const floorY = this.#refSpaceType === 'local-floor' ? 0 : -oy;

      // Ray–plane intersection: t = (floorY - oy) / fwd.y
      if (Math.abs(_fwd.y) < 0.01) return null; // ray nearly parallel to floor
      const tDist = (floorY - oy) / _fwd.y;
      if (tDist < 0.2 || tDist > 6) return null; // too close or too far

      return {
        x: ox + _fwd.x * tDist,
        y: floorY,
        z: oz + _fwd.z * tDist,
      };
    } catch {
      return null;
    }
  }

  // Apply a resolved position to the reticle mesh.
  #positionReticle(pos, primaryMatrix, colour) {
    if (this.isPlaced) {
      this.#reticle.visible = false;
      return;
    }

    this.#reticle.visible = true;

    if (primaryMatrix) {
      // Use hit-test pose rotation, override translation with smoothed position
      _mat4.fromArray(primaryMatrix);
      _mat4.elements[12] = pos.x;
      _mat4.elements[13] = pos.y;
      _mat4.elements[14] = pos.z;
    } else {
      // Flat Y-up reticle for fallback sources
      _mat4.makeTranslation(pos.x, pos.y, pos.z);
    }

    this.#reticle.matrix.copy(_mat4);
    this.#reticle.matrixWorldNeedsUpdate = true;

    // Tint reticle ring/dot to indicate source mode
    this.#reticle.traverse(child => {
      if (child.isMesh) child.material.color.setHex(colour);
    });
  }

  #setSourceMode(mode, time) {
    const wasHit = this.#reticleHit;
    const wasMode = this.#sourceMode;
    this.#reticleHit  = true;
    this.#sourceMode  = mode;

    if (!wasHit) this.#reticleOnAt = Date.now();

    if (!wasHit || wasMode !== mode) {
      this.dispatchEvent(Object.assign(new Event('surface'), { found: true, sourceMode: mode }));
    }
  }

  #advanceWarmup() {
    if (this.#slamReady) return;
    this.#warmupHits++;
    if (this.#warmupHits % 5 === 0) {
      this.dispatchEvent(
        Object.assign(new Event('warming'), { progress: this.#warmupHits / WARMUP_TARGET }),
      );
    }
    if (this.#warmupHits >= WARMUP_TARGET) {
      this.#slamReady = true;
      console.log('[Surface] SLAM ready ✓');
      this.dispatchEvent(new Event('ready'));
    }
  }

  #updatePostPlaceConfidence(hitFound, smoothedPos) {
    _vec3.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);
    const delta = _vec3.distanceTo(_prev);
    _prev.copy(_vec3);

    this.#trackConf.update(hitFound, delta);

    const frozen = this.#trackConf.isFrozen;
    if (frozen && !this.#wasFrozen) {
      this.#wasFrozen = true;
      this.dispatchEvent(new Event('frozen'));
    } else if (!frozen && this.#wasFrozen) {
      this.#wasFrozen = false;
      this.dispatchEvent(new Event('unfrozen'));
    }
    this.dispatchEvent(Object.assign(new Event('confidence'), { score: this.#trackConf.score }));
  }

  // ── Plane tracking ─────────────────────────────────────────────────────────

  #updatePlanes(frame) {
    const detected = frame.detectedPlanes ?? new Set();

    for (const [plane, mesh] of this.#planes) {
      if (!detected.has(plane)) {
        this.#scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.#planes.delete(plane);
      }
    }

    for (const plane of detected) {
      let mesh = this.#planes.get(plane);
      if (!mesh) {
        mesh = this.#makePlaneMesh(plane);
        this.#scene.add(mesh);
        this.#planes.set(plane, mesh);
      }
      const planePose = frame.getPose(plane.planeSpace, this.#refSpace);
      if (planePose) {
        mesh.matrix.fromArray(planePose.transform.matrix);
        mesh.matrixWorldNeedsUpdate = true;
      }
      if (plane.lastChangedTime !== mesh.userData.changedTime) {
        mesh.geometry.dispose();
        mesh.geometry = this.#buildPlaneGeometry(plane.polygon);
        mesh.userData.changedTime = plane.lastChangedTime;
      }
    }
  }

  #makePlaneMesh(plane) {
    const isH = plane.orientation === 'horizontal';
    const mat = new THREE.MeshBasicMaterial({
      color:       isH ? PLANE_COLOR_H : PLANE_COLOR_V,
      transparent: true,
      opacity:     PLANE_OPACITY,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(this.#buildPlaneGeometry(plane.polygon), mat);
    mesh.matrixAutoUpdate     = false;
    mesh.userData.changedTime = plane.lastChangedTime;
    return mesh;
  }

  #buildPlaneGeometry(polygon) {
    const verts = [];
    for (const v of polygon) verts.push(v.x, v.y, v.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const idx = [];
    for (let i = 1; i < polygon.length - 1; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // ── Placement ──────────────────────────────────────────────────────────────

  #executePlacement(frame) {
    // Prefer smoothed PoseBuffer position; fall back to current reticle matrix
    let pos, quat;
    const smoothed = this.#poseBuffer.getSmoothed();

    if (smoothed) {
      pos  = new THREE.Vector3(smoothed.x, smoothed.y, smoothed.z);
      quat = new THREE.Quaternion(); // identity — will be overridden from hit if available
    }

    // Try to get rotation from centre hit-test pose
    if (this.#hitSources.length > 0) {
      const hits = frame.getHitTestResults(this.#hitSources[0]);
      if (hits.length > 0) {
        const pose = hits[0].getPose(this.#refSpace);
        if (pose) {
          _mat4.fromArray(pose.transform.matrix);
          _quat.setFromRotationMatrix(_mat4);
          quat = _quat.clone();
          if (!smoothed) {
            const m = pose.transform.matrix;
            pos = new THREE.Vector3(m[12], m[13], m[14]);
          }
        }
      }
    }

    // Last resort: read current reticle matrix
    if (!pos) {
      const m = this.#reticle.matrix.elements;
      pos  = new THREE.Vector3(m[12], m[13], m[14]);
      quat = new THREE.Quaternion().setFromRotationMatrix(this.#reticle.matrix);
    }

    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.position.copy(pos);
    this.placedGroup.quaternion.copy(quat);
    this.placedGroup.visible = this.placedGroup.children.length > 0;
    if (this.#reticle) this.#reticle.visible = false;

    if (this.#shadowPlane) {
      this.#shadowPlane.position.set(pos.x, pos.y + 0.002, pos.z);
      this.#shadowPlane.visible = true;
    }

    _prev.copy(pos);
    this.#anchorSim.record(pos, quat);

    if (this.#hasAnchors && this.#hitSources.length > 0) {
      const hits = frame.getHitTestResults(this.#hitSources[0]);
      if (hits.length > 0) {
        const pose = hits[0].getPose(this.#refSpace);
        if (pose) {
          const xrPose = new XRRigidTransform(
            pose.transform.position,
            pose.transform.orientation,
          );
          frame.createAnchor(xrPose, this.#refSpace)
            .then(anchor => {
              this.#worldAnchor = anchor;
              console.log('[Surface] World anchor created ✓');
            })
            .catch(err => console.warn('[Surface] Anchor creation failed:', err));
        }
      }
    }

    this.dispatchEvent(Object.assign(new Event('placed'), {
      position  : pos,
      quaternion: quat.clone(),
      sourceMode: this.#sourceMode,
    }));
  }

  #updateAnchor(frame) {
    if (!this.#anchorSim.isActive) return;

    if (this.#worldAnchor) {
      const pose = frame.getPose(this.#worldAnchor.anchorSpace, this.#refSpace);
      if (pose) {
        const m = pose.transform.matrix;
        _mat4.fromArray(m);
        _vec3.set(m[12], m[13], m[14]);
        _quat.setFromRotationMatrix(_mat4);
        this.#anchorSim.updateTarget(_vec3, _quat);
      }
    }

    if (!this.#trackConf.isFrozen) {
      this.#anchorSim.apply(this.placedGroup);
      if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
      if (this.#shadowPlane?.visible) {
        this.#shadowPlane.position.x = this.placedGroup.position.x;
        this.#shadowPlane.position.z = this.placedGroup.position.z;
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /** Component-wise median of an array of {x,y,z} positions. */
  #medianPosition(pts) {
    const xs = pts.map(p => p.x).sort((a, b) => a - b);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const zs = pts.map(p => p.z).sort((a, b) => a - b);
    const m  = Math.floor(pts.length / 2);
    return { x: xs[m], y: ys[m], z: zs[m] };
  }

  // ── Reticle ────────────────────────────────────────────────────────────────

  #buildReticle() {
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(RETICLE_RADIUS * 0.72, RETICLE_RADIUS, 36)
      .rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: RETICLE_COLOR_HIT, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    const dotGeo = new THREE.CircleGeometry(RETICLE_RADIUS * 0.14, 16)
      .rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: RETICLE_COLOR_HIT, depthWrite: false,
    });
    group.add(new THREE.Mesh(dotGeo, dotMat));

    group.matrixAutoUpdate = false;
    group.visible          = false;

    this.#reticle = group;
    this.#scene.add(group);
  }

  // ── Shadow plane ───────────────────────────────────────────────────────────

  #buildShadowPlane() {
    const size   = 256;
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement('canvas'), { width: size, height: size });

    const ctx  = canvas.getContext('2d');
    const r    = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,    'rgba(0,0,0,0.38)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.14)');
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex  = new THREE.CanvasTexture(canvas);
    const geo  = new THREE.PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE).rotateX(-Math.PI / 2);
    const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.#scene.add(mesh);
    return mesh;
  }

  // ── Session cleanup ────────────────────────────────────────────────────────

  #cleanup() {
    for (const src of this.#hitSources) { try { src.cancel(); } catch { /* */ } }
    this.#hitSources = [];
    this.#session    = null;
    this.#refSpace   = null;

    for (const [, mesh] of this.#planes) {
      this.#scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.#planes.clear();

    if (this.#reticle) {
      this.#scene.remove(this.#reticle);
      this.#reticle = null;
    }
    if (this.#shadowPlane) {
      this.#shadowPlane.material.map?.dispose();
      this.#shadowPlane.geometry.dispose();
      this.#shadowPlane.material.dispose();
      this.#scene.remove(this.#shadowPlane);
      this.#shadowPlane = null;
    }

    this.dispatchEvent(new Event('ended'));
  }
}
