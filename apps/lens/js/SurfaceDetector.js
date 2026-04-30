/**
 * SurfaceDetector — WebXR surface detection engine.
 *
 * Implements three layers of spatial understanding:
 *
 *   SLAM (world tracking)
 *     Uses the `local-floor` reference space, backed by the device's
 *     Visual-Inertial Odometry (ARCore on Android / ARKit on iOS). The VIO system
 *     continuously maps the environment and tracks the device pose within it,
 *     giving stable 6DoF world positioning across frames.
 *
 *   Plane tracking
 *     Uses the WebXR `plane-detection` optional feature. The XR system detects
 *     horizontal (floor, table) and vertical (wall) planes and exposes them as
 *     XRPlane objects with polygon geometry. Planes are visualised as transparent
 *     blue (horizontal) or orange (vertical) meshes.
 *
 *   World tracking / hit-test
 *     Uses the WebXR `hit-test` required feature. A viewer-space ray is cast each
 *     frame; results are smoothed through a Kalman-filtered PoseBuffer before
 *     driving the reticle. On placement, an `XRAnchor` (if supported) is created
 *     for SLAM-persistent world tracking; the AnchorSimulator lerps the object
 *     toward the anchor pose each frame so it drifts smoothly rather than
 *     teleporting.
 *
 * Stability architecture:
 *   PoseBuffer        Kalman filter + outlier rejection on raw hit-test poses
 *   PlaneValidator    Confidence gate — placement blocked until score ≥ 0.55
 *   AnchorSimulator   Soft re-alignment with Y-lock and max-correction cap
 *   TrackingConfidence History-smoothed score; freezes object on low confidence
 *   DeviceProfiler    Low/mid/high tier; scales update rate & window size
 *
 * Integration:
 *   1. new SurfaceDetector(scene, camera, renderer)
 *   2. await surfaceDetector.start(domOverlayRoot?)
 *   3. surfaceDetector.tick(frame, time)  ← inside renderer.setAnimationLoop
 *   4. surfaceDetector.requestPlacement()  ← on user tap
 *   5. Attach AR content to surfaceDetector.placedGroup
 *   6. Events: 'started', 'surface', 'placed', 'reset', 'ended',
 *              'confidence' (detail.score), 'frozen', 'unfrozen'
 */

import * as THREE from 'three';
import { PoseBuffer }         from './PoseBuffer.js';
import { AnchorSimulator }    from './AnchorSimulator.js';
import { PlaneValidator }     from './PlaneValidator.js';
import { TrackingConfidence } from './TrackingConfidence.js';
import { DeviceProfiler }     from './DeviceProfiler.js';

const PLANE_OPACITY  = 0.18;
const RETICLE_RADIUS = 0.08;
const PLANE_COLOR_H  = 0x4a9eff;
const PLANE_COLOR_V  = 0xff9a4a;
const SHADOW_SIZE    = 0.55;       // metres, diameter of the soft shadow disc

// Reusable scratch objects — avoid per-frame allocations
const _mat4 = new THREE.Matrix4();
const _vec3 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _prevSmoothed = new THREE.Vector3();

export class SurfaceDetector extends EventTarget {
  /** Attach AR content here — automatically positioned on placement. */
  placedGroup = null;

  #scene    = null;
  #camera   = null;
  #renderer = null;

  #session   = null;
  #refSpace  = null;
  #hitSource = null;

  #reticle     = null;
  #reticleHit  = false;
  #shadowPlane = null;

  #planes      = new Map();
  #worldAnchor = null;

  #pendingPlace = false;
  #hasAnchors   = false;
  #hasPlanes    = false;

  // Stability modules
  #poseBuffer   = null;
  #anchorSim    = null;
  #planeVal     = null;
  #trackConf    = null;
  #deviceProf   = null;

  // Rate-limiting
  #lastTickTime = 0;

  // Freeze state tracking for events
  #wasFrozen = false;

  constructor(scene, camera, renderer) {
    super();
    this.#scene    = scene;
    this.#camera   = camera;
    this.#renderer = renderer;

    // Stability modules — window size adjusted after detect() in start()
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

  get surfaceFound()  { return this.#reticleHit; }
  get isPlaced()      { return this.#anchorSim.isActive; }
  get hasPlanes()     { return this.#hasPlanes; }
  get confidence()    { return this.#planeVal.confidence; }
  get canPlace()      { return this.#planeVal.canPlace; }

  /**
   * Request a WebXR immersive-ar session and begin surface detection.
   * Must be called from within a user-gesture handler.
   */
  async start(domOverlayRoot = null) {
    if (!navigator.xr) throw new Error('WebXR not supported on this device');

    // Profile device before session — affects buffer sizes passed to modules
    const tier     = this.#deviceProf.detect();
    const settings = this.#deviceProf.settings();
    this.#poseBuffer.setWindowSize(settings.windowSize);
    this.#anchorSim.lerpAlpha = settings.anchorLerp;

    const optional = ['plane-detection', 'anchors', 'local-floor'];
    if (domOverlayRoot) optional.push('dom-overlay');

    const sessionInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: optional,
    };
    if (domOverlayRoot) sessionInit.domOverlay = { root: domOverlayRoot };

    this.#session = await navigator.xr.requestSession('immersive-ar', sessionInit);

    // enabledFeatures is a FrozenArray<DOMString> in Chrome 94+, not a Set.
    const enabled    = new Set(Array.from(this.#session.enabledFeatures ?? []));
    this.#hasAnchors = enabled.has('anchors');
    this.#hasPlanes  = enabled.has('plane-detection');
    console.log(
      `[Surface] Session started — tier:${tier} hit-test:true ` +
      `anchors:${this.#hasAnchors} planes:${this.#hasPlanes}`,
    );

    this.#renderer.xr.enabled = true;
    await this.#renderer.xr.setSession(this.#session);

    // Use the exact reference space Three.js renders in — ensures hit-test
    // poses and plane poses share the same coordinate system as the camera.
    this.#refSpace = this.#renderer.xr.getReferenceSpace();
    if (!this.#refSpace) {
      throw new Error('Three.js XR reference space unavailable after setSession');
    }

    const viewerSpace = await this.#session.requestReferenceSpace('viewer');
    this.#hitSource   = await this.#session.requestHitTestSource({ space: viewerSpace });
    console.log('[Surface] Hit-test source created ✓');

    this.#session.addEventListener('end', () => this.#cleanup());
    this.dispatchEvent(new Event('started'));
  }

  /**
   * Advance the detector by one XR frame.
   * Call inside renderer.setAnimationLoop((time, frame) => …).
   *
   * @param {XRFrame}  frame
   * @param {number}   time   DOMHighResTimeStamp from the animation loop
   */
  tick(frame, time = 0) {
    if (!frame || !this.#refSpace) return;

    const settings    = this.#deviceProf.settings();
    const minInterval = 1000 / settings.updateHz;
    const elapsed     = time - this.#lastTickTime;
    if (elapsed < minInterval) return;

    this.#deviceProf.recordFrame(elapsed);
    this.#lastTickTime = time;

    try {
      this.#updateReticle(frame, settings);
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

  /**
   * Queue content placement at the current reticle hit point.
   * Blocked until PlaneValidator confidence is sufficient.
   */
  requestPlacement() {
    if (this.#reticleHit && !this.isPlaced && this.#planeVal.canPlace) {
      this.#pendingPlace = true;
    }
  }

  /** Remove placed anchor and restore the reticle. */
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

    this.#wasFrozen = false;
    this.dispatchEvent(new Event('reset'));
  }

  async stop() {
    try { this.#hitSource?.cancel(); }  catch { /* */ }
    try { await this.#session?.end(); } catch { /* */ }
  }

  // ── Hit-test reticle ───────────────────────────────────────────────────────

  #updateReticle(frame, settings) {
    if (!this.#hitSource || !this.#reticle) return;

    const hits = frame.getHitTestResults(this.#hitSource);
    let hitFound = false;

    if (hits.length > 0) {
      const pose = hits[0].getPose(this.#refSpace);
      if (pose) {
        hitFound = true;
        const m   = pose.transform.matrix;
        const raw = { x: m[12], y: m[13], z: m[14] };

        this.#poseBuffer.push(raw);
        this.#planeVal.recordHit();

        const smoothed = this.#poseBuffer.getSmoothed();
        if (smoothed && !this.isPlaced) {
          this.#reticle.visible = true;
          // Rebuild the matrix from the hit-test rotation + smoothed position
          _mat4.fromArray(m);
          _mat4.elements[12] = smoothed.x;
          _mat4.elements[13] = smoothed.y;
          _mat4.elements[14] = smoothed.z;
          this.#reticle.matrix.copy(_mat4);
          this.#reticle.matrixWorldNeedsUpdate = true;
        }

        if (!this.#reticleHit) {
          this.#reticleHit = true;
          this.dispatchEvent(Object.assign(new Event('surface'), { found: true }));
        }
      }
    }

    if (!hitFound) {
      this.#planeVal.recordMiss();
      if (this.#reticleHit) {
        this.#reticleHit = false;
        if (!this.isPlaced) this.#reticle.visible = false;
        this.dispatchEvent(Object.assign(new Event('surface'), { found: false }));
      }
    }

    // After placement: update tracking confidence and dispatch events
    if (this.isPlaced) {
      const smoothed = this.#poseBuffer.getSmoothed();
      let delta = 0;
      if (smoothed) {
        _vec3.set(smoothed.x, smoothed.y, smoothed.z);
        delta = _vec3.distanceTo(_prevSmoothed);
        _prevSmoothed.copy(_vec3);
      }
      this.#trackConf.update(hitFound, delta);

      const nowFrozen = this.#trackConf.isFrozen;
      if (nowFrozen && !this.#wasFrozen) {
        this.#wasFrozen = true;
        this.dispatchEvent(new Event('frozen'));
      } else if (!nowFrozen && this.#wasFrozen) {
        this.#wasFrozen = false;
        this.dispatchEvent(new Event('unfrozen'));
      }
      this.dispatchEvent(
        Object.assign(new Event('confidence'), { score: this.#trackConf.score }),
      );
    }
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

  // ── World anchoring (SLAM persistence + soft re-alignment) ─────────────────

  #executePlacement(frame) {
    const hits = frame.getHitTestResults(this.#hitSource);
    if (!hits.length) return;

    const pose = hits[0].getPose(this.#refSpace);
    if (!pose) return;

    // Use Kalman-smoothed position if available, fall back to raw
    const smoothed = this.#poseBuffer.getSmoothed();
    const m        = pose.transform.matrix;
    _mat4.fromArray(m);
    _quat.setFromRotationMatrix(_mat4);

    const pos = smoothed
      ? new THREE.Vector3(smoothed.x, smoothed.y, smoothed.z)
      : new THREE.Vector3(m[12], m[13], m[14]);

    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.position.copy(pos);
    this.placedGroup.quaternion.copy(_quat);
    this.placedGroup.visible = this.placedGroup.children.length > 0;
    if (this.#reticle) this.#reticle.visible = false;

    // Position shadow plane at placement point (just above floor to avoid z-fighting)
    if (this.#shadowPlane) {
      this.#shadowPlane.position.set(pos.x, pos.y + 0.002, pos.z);
      this.#shadowPlane.visible = true;
    }

    // Record initial pose in AnchorSimulator so lerp has a starting point
    this.#anchorSim.record(pos, _quat);
    _prevSmoothed.copy(pos);

    if (this.#hasAnchors) {
      const xrPose = new XRRigidTransform(
        pose.transform.position,
        pose.transform.orientation,
      );
      frame.createAnchor(xrPose, this.#refSpace)
        .then(anchor => {
          this.#worldAnchor = anchor;
          console.log('[Surface] World anchor created — SLAM tracking active ✓');
        })
        .catch(err => {
          console.warn('[Surface] Anchor creation failed, using pose fallback:', err);
        });
    }

    this.dispatchEvent(
      Object.assign(new Event('placed'), { position: pos, quaternion: _quat.clone() }),
    );
  }

  #updateAnchor(frame) {
    if (!this.#anchorSim.isActive) return;

    // If we have a real XRAnchor, feed the latest world pose to AnchorSimulator
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

    // Only lerp when tracking confidence is acceptable
    if (!this.#trackConf.isFrozen) {
      this.#anchorSim.apply(this.placedGroup);
      if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;

      // Shadow plane tracks object in XZ, stays at floor Y
      if (this.#shadowPlane && this.#shadowPlane.visible) {
        this.#shadowPlane.position.x = this.placedGroup.position.x;
        this.#shadowPlane.position.z = this.placedGroup.position.z;
      }
    }
  }

  // ── Reticle geometry ───────────────────────────────────────────────────────

  #buildReticle() {
    const group = new THREE.Group();

    // RingGeometry is in the XY plane (faces +Z).
    // rotateX(-PI/2) rotates it so it faces +Y — lying flat on horizontal
    // surfaces where the hit-test pose has Y pointing up (surface normal).
    const ringGeo = new THREE.RingGeometry(RETICLE_RADIUS * 0.72, RETICLE_RADIUS, 36)
      .rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    const dotGeo = new THREE.CircleGeometry(RETICLE_RADIUS * 0.14, 16)
      .rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, depthWrite: false,
    });
    group.add(new THREE.Mesh(dotGeo, dotMat));

    group.matrixAutoUpdate = false;
    group.visible          = false;

    this.#reticle = group;
    this.#scene.add(group);
  }

  // ── Shadow plane ───────────────────────────────────────────────────────────

  #buildShadowPlane() {
    const tex = this.#buildShadowTexture();
    // PlaneGeometry faces +Z; rotateX(-PI/2) makes it face +Y (lies flat)
    const geo = new THREE.PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE)
      .rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      opacity:     1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.#scene.add(mesh);
    return mesh;
  }

  #buildShadowTexture() {
    const size = 256;
    const OffCanvas = window.OffscreenCanvas;
    const canvas = OffCanvas ? new OffCanvas(size, size) : Object.assign(
      document.createElement('canvas'), { width: size, height: size },
    );
    const ctx = canvas.getContext('2d');
    const r   = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,    'rgba(0,0,0,0.38)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.14)');
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  // ── Session cleanup ────────────────────────────────────────────────────────

  #cleanup() {
    this.#hitSource = null;
    this.#session   = null;
    this.#refSpace  = null;

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
