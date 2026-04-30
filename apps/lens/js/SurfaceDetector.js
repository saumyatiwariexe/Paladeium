/**
 * SurfaceDetector — WebXR surface detection engine.
 *
 * Implements three layers of spatial understanding:
 *
 *   SLAM (world tracking)
 *     Uses the `local-floor` reference space, which is backed by the device's
 *     Visual-Inertial Odometry (ARCore on Android / ARKit on iOS). The VIO system
 *     continuously maps the environment and tracks the headset pose within it,
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
 *     frame; the result snaps to the nearest real surface and drives a reticle.
 *     On placement, an `XRAnchor` (if supported) is created for SLAM-persistent
 *     world tracking so content stays exactly where the user placed it even as the
 *     device moves.
 *
 * Integration pattern:
 *   1. new SurfaceDetector(scene, camera, renderer)
 *   2. await surfaceDetector.start(domOverlayRoot?)
 *   3. surfaceDetector.tick(frame)  ← call inside renderer.setAnimationLoop
 *   4. surfaceDetector.requestPlacement()  ← call on user tap
 *   5. Attach AR content to surfaceDetector.placedGroup
 *   6. Listen to: 'started', 'surface', 'placed', 'reset', 'ended' events
 */

import * as THREE from 'three';

const PLANE_OPACITY  = 0.18;
const RETICLE_RADIUS = 0.08;
const PLANE_COLOR_H  = 0x4a9eff;   // horizontal planes
const PLANE_COLOR_V  = 0xff9a4a;   // vertical planes

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

  #planes      = new Map();    // XRPlane  → THREE.Mesh
  #worldAnchor = null;         // XRAnchor for SLAM-persistent placement
  #fallbackPos = null;         // pose when anchors not supported

  #pendingPlace  = false;
  #hasAnchors    = false;
  #hasPlanes     = false;

  constructor(scene, camera, renderer) {
    super();
    this.#scene    = scene;
    this.#camera   = camera;
    this.#renderer = renderer;

    this.placedGroup = new THREE.Group();
    this.placedGroup.visible = false;
    scene.add(this.placedGroup);

    this.#buildReticle();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get surfaceFound() { return this.#reticleHit; }
  get isPlaced()     { return !!(this.#worldAnchor || this.#fallbackPos); }
  get hasPlanes()    { return this.#hasPlanes; }

  /**
   * Request a WebXR immersive-ar session and begin surface detection.
   * Must be called from within a user-gesture handler.
   *
   * @param {Element|null} domOverlayRoot  HTML element for dom-overlay (shows UI on top of camera)
   */
  async start(domOverlayRoot = null) {
    if (!navigator.xr) throw new Error('WebXR not supported on this device');

    const optional = ['plane-detection', 'anchors', 'local-floor'];
    if (domOverlayRoot) optional.push('dom-overlay');

    const sessionInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: optional,
    };
    if (domOverlayRoot) sessionInit.domOverlay = { root: domOverlayRoot };

    this.#session = await navigator.xr.requestSession('immersive-ar', sessionInit);

    // Discover which optional features the browser granted
    const enabled     = this.#session.enabledFeatures ?? new Set();
    this.#hasAnchors  = enabled.has('anchors');
    this.#hasPlanes   = enabled.has('plane-detection');
    console.log(
      `[Surface] Session started — anchors:${this.#hasAnchors} planes:${this.#hasPlanes}`,
    );

    // Hand the XR session to Three.js
    this.#renderer.xr.enabled = true;
    await this.#renderer.xr.setSession(this.#session);

    // Prefer local-floor: gravity-aligned, SLAM-anchored reference frame
    try {
      this.#refSpace = await this.#session.requestReferenceSpace('local-floor');
    } catch {
      this.#refSpace = await this.#session.requestReferenceSpace('local');
    }

    // Hit-test source aimed at the viewer's centre (camera forward ray)
    const viewerSpace = await this.#session.requestReferenceSpace('viewer');
    this.#hitSource   = await this.#session.requestHitTestSource({ space: viewerSpace });

    this.#session.addEventListener('end', () => this.#cleanup());
    this.dispatchEvent(new Event('started'));
  }

  /**
   * Advance the detector by one XR frame.
   * Call this from inside renderer.setAnimationLoop((time, frame) => …).
   */
  tick(frame) {
    if (!frame || !this.#refSpace) return;

    this.#updateReticle(frame);
    this.#updatePlanes(frame);
    this.#updateAnchor(frame);

    // Execute a queued placement inside an XR frame so we have a valid frame ref
    if (this.#pendingPlace) {
      this.#pendingPlace = false;
      this.#executePlacement(frame);
    }
  }

  /**
   * Queue content placement at the current reticle hit point.
   * The actual placement runs in the next tick() call so it has a valid XRFrame.
   * No-op if no surface is currently detected.
   */
  requestPlacement() {
    if (this.#reticleHit && !this.isPlaced) this.#pendingPlace = true;
  }

  /** Remove the placed anchor and show the reticle again. */
  resetPlacement() {
    if (this.#worldAnchor) {
      try { this.#worldAnchor.delete(); } catch { /* ignore */ }
      this.#worldAnchor = null;
    }
    this.#fallbackPos        = null;
    this.placedGroup.visible = false;
    this.#reticle.visible    = false;
    this.dispatchEvent(new Event('reset'));
  }

  async stop() {
    try { this.#hitSource?.cancel(); }   catch { /* */ }
    try { await this.#session?.end(); }  catch { /* */ }
  }

  // ── Hit-test reticle ───────────────────────────────────────────────────────

  #updateReticle(frame) {
    if (!this.#hitSource) return;

    const hits = frame.getHitTestResults(this.#hitSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(this.#refSpace);
      if (pose) {
        // Only show reticle when not yet placed
        this.#reticle.visible = !this.isPlaced;
        this.#reticle.matrixAutoUpdate = false;
        this.#reticle.matrix.fromArray(pose.transform.matrix);

        if (!this.#reticleHit) {
          this.#reticleHit = true;
          this.dispatchEvent(Object.assign(new Event('surface'), { found: true }));
        }
        return;
      }
    }

    if (this.#reticleHit) {
      this.#reticleHit = false;
      if (!this.isPlaced) this.#reticle.visible = false;
      this.dispatchEvent(Object.assign(new Event('surface'), { found: false }));
    }
  }

  // ── Plane tracking ─────────────────────────────────────────────────────────

  #updatePlanes(frame) {
    if (!this.#hasPlanes) return;

    const detected = frame.detectedPlanes ?? new Set();

    // Remove planes that disappeared
    for (const [plane, mesh] of this.#planes) {
      if (!detected.has(plane)) {
        this.#scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.#planes.delete(plane);
      }
    }

    // Add and update current planes
    for (const plane of detected) {
      let mesh = this.#planes.get(plane);
      if (!mesh) {
        mesh = this.#makePlaneMesh(plane);
        this.#scene.add(mesh);
        this.#planes.set(plane, mesh);
      }

      // Update world pose
      const planePose = frame.getPose(plane.planeSpace, this.#refSpace);
      if (planePose) {
        mesh.matrixAutoUpdate = false;
        mesh.matrix.fromArray(planePose.transform.matrix);
      }

      // Rebuild geometry when the plane polygon is updated by the XR system
      if (plane.lastChangedTime !== mesh.userData.changedTime) {
        mesh.geometry.dispose();
        mesh.geometry = this.#buildPlaneGeometry(plane.polygon);
        mesh.userData.changedTime = plane.lastChangedTime;
      }
    }
  }

  #makePlaneMesh(plane) {
    const isHorizontal = plane.orientation === 'horizontal';
    const mat = new THREE.MeshBasicMaterial({
      color:       isHorizontal ? PLANE_COLOR_H : PLANE_COLOR_V,
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
    // Fan triangulation from first vertex
    const idx = [];
    for (let i = 1; i < polygon.length - 1; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // ── World anchoring (SLAM persistence) ────────────────────────────────────

  #executePlacement(frame) {
    const hits = frame.getHitTestResults(this.#hitSource);
    if (!hits.length) return;

    const pose = hits[0].getPose(this.#refSpace);
    if (!pose) return;

    const m    = pose.transform.matrix;
    const pos  = new THREE.Vector3(m[12], m[13], m[14]);
    const mat4 = new THREE.Matrix4().fromArray(m);
    const quat = new THREE.Quaternion().setFromRotationMatrix(mat4);

    // Immediately position placed group
    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.position.copy(pos);
    this.placedGroup.quaternion.copy(quat);
    this.placedGroup.visible = this.placedGroup.children.length > 0;
    this.#reticle.visible    = false;

    // Try creating an XRAnchor for SLAM-persistent world tracking
    if (this.#hasAnchors) {
      const xrPose = new XRRigidTransform(
        pose.transform.position,
        pose.transform.orientation,
      );
      frame.createAnchor(xrPose, this.#refSpace)
        .then(anchor => {
          this.#worldAnchor = anchor;
          console.log('[Surface] World anchor created — SLAM tracking active');
        })
        .catch(err => {
          console.warn('[Surface] Anchor creation failed, using pose fallback:', err);
          this.#fallbackPos = { position: pos.clone(), quaternion: quat.clone() };
        });
    } else {
      // Fallback: content stays at recorded pose in local space
      this.#fallbackPos = { position: pos.clone(), quaternion: quat.clone() };
    }

    this.dispatchEvent(
      Object.assign(new Event('placed'), { position: pos, quaternion: quat }),
    );
  }

  #updateAnchor(frame) {
    if (!this.#worldAnchor) return;
    const pose = frame.getPose(this.#worldAnchor.anchorSpace, this.#refSpace);
    if (!pose) return;
    // Drive placed group directly from world anchor — keeps content locked
    // to the real-world point even as the user moves around.
    this.placedGroup.matrixAutoUpdate = false;
    this.placedGroup.matrix.fromArray(pose.transform.matrix);
    if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
  }

  // ── Reticle geometry ───────────────────────────────────────────────────────

  #buildReticle() {
    const group = new THREE.Group();

    // Outer ring
    const ringGeo = new THREE.RingGeometry(RETICLE_RADIUS * 0.72, RETICLE_RADIUS, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide,
      transparent: true, opacity: 0.82, depthWrite: false,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    // Centre dot
    const dotGeo = new THREE.CircleGeometry(RETICLE_RADIUS * 0.14, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });
    group.add(new THREE.Mesh(dotGeo, dotMat));

    group.matrixAutoUpdate = false;
    group.visible          = false;

    this.#reticle = group;
    this.#scene.add(group);
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

    this.dispatchEvent(new Event('ended'));
  }
}
