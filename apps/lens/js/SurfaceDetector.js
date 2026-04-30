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
 *     frame; the result snaps to the nearest real surface and drives a reticle.
 *     On placement, an `XRAnchor` (if supported) is created for SLAM-persistent
 *     world tracking so content stays locked in place as the device moves.
 *
 * Integration:
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
  #refSpace  = null;   // Three.js reference space — set after setSession()
  #hitSource = null;

  #reticle     = null;
  #reticleHit  = false;

  #planes       = new Map();   // XRPlane → THREE.Mesh
  #worldAnchor  = null;        // XRAnchor for SLAM-persistent placement
  #fallbackPos  = null;        // { position, quaternion } when anchors unavailable

  #pendingPlace = false;
  #hasAnchors   = false;
  #hasPlanes    = false;

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

    // enabledFeatures is a FrozenArray<DOMString> in Chrome 94+, not a Set.
    // Wrap in Set so .has() works regardless of browser version.
    const enabled    = new Set(Array.from(this.#session.enabledFeatures ?? []));
    this.#hasAnchors = enabled.has('anchors');
    this.#hasPlanes  = enabled.has('plane-detection');
    console.log(
      `[Surface] Session started — hit-test:true anchors:${this.#hasAnchors} planes:${this.#hasPlanes}`,
    );

    // Hand the XR session to Three.js.
    // Three.js internally requests 'local-floor' (its default) as part of setSession().
    this.#renderer.xr.enabled = true;
    await this.#renderer.xr.setSession(this.#session);

    // Use the SAME reference space Three.js is rendering in.
    // Critically, this ensures hit-test poses and plane poses are in the same
    // coordinate system that Three.js uses for the camera — objects will appear
    // exactly where the real surface is.
    this.#refSpace = this.#renderer.xr.getReferenceSpace();
    if (!this.#refSpace) {
      throw new Error('Three.js XR reference space unavailable after setSession');
    }

    // Hit-test source: ray cast from the viewer (camera centre, forward direction)
    const viewerSpace = await this.#session.requestReferenceSpace('viewer');
    this.#hitSource   = await this.#session.requestHitTestSource({ space: viewerSpace });
    console.log('[Surface] Hit-test source created ✓');

    this.#session.addEventListener('end', () => this.#cleanup());
    this.dispatchEvent(new Event('started'));
  }

  /**
   * Advance the detector by one XR frame.
   * Call from inside renderer.setAnimationLoop((time, frame) => …).
   */
  tick(frame) {
    if (!frame || !this.#refSpace) return;

    try {
      this.#updateReticle(frame);
      this.#updatePlanes(frame);
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
   * The actual placement executes in the next tick() so it has a valid XRFrame.
   */
  requestPlacement() {
    if (this.#reticleHit && !this.isPlaced) this.#pendingPlace = true;
  }

  /** Remove the placed anchor and restore the reticle. */
  resetPlacement() {
    if (this.#worldAnchor) {
      try { this.#worldAnchor.delete(); } catch { /* */ }
      this.#worldAnchor = null;
    }
    this.#fallbackPos        = null;
    this.placedGroup.visible = false;
    if (this.#reticle) this.#reticle.visible = false;
    this.dispatchEvent(new Event('reset'));
  }

  async stop() {
    try { this.#hitSource?.cancel(); }  catch { /* */ }
    try { await this.#session?.end(); } catch { /* */ }
  }

  // ── Hit-test reticle ───────────────────────────────────────────────────────

  #updateReticle(frame) {
    if (!this.#hitSource || !this.#reticle) return;

    const hits = frame.getHitTestResults(this.#hitSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(this.#refSpace);
      if (pose) {
        this.#reticle.visible = !this.isPlaced;
        // Directly drive the local matrix from the hit-test pose.
        // matrixAutoUpdate = false so Three.js won't overwrite this with
        // position/quaternion/scale — we own the matrix.
        this.#reticle.matrix.fromArray(pose.transform.matrix);
        this.#reticle.matrixWorldNeedsUpdate = true;

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

    // Remove stale planes
    for (const [plane, mesh] of this.#planes) {
      if (!detected.has(plane)) {
        this.#scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.#planes.delete(plane);
      }
    }

    // Add / update detected planes
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

    // Immediately anchor placed group at the hit point
    this.placedGroup.matrixAutoUpdate = true;
    this.placedGroup.position.copy(pos);
    this.placedGroup.quaternion.copy(quat);
    this.placedGroup.visible = this.placedGroup.children.length > 0;
    if (this.#reticle) this.#reticle.visible = false;

    // Try to create an XRAnchor so content is SLAM-tracked in world space
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
          this.#fallbackPos = { position: pos.clone(), quaternion: quat.clone() };
        });
    } else {
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
    // Drive placed group from the world anchor each frame — keeps content
    // locked to the real-world point even as the device moves.
    this.placedGroup.matrixAutoUpdate = false;
    this.placedGroup.matrix.fromArray(pose.transform.matrix);
    this.placedGroup.matrixWorldNeedsUpdate = true;
    if (this.placedGroup.children.length > 0) this.placedGroup.visible = true;
  }

  // ── Reticle geometry ───────────────────────────────────────────────────────

  #buildReticle() {
    const group = new THREE.Group();

    // RingGeometry is in the XY plane (faces +Z).
    // rotateX(-PI/2) rotates it so it faces +Y — lying flat on horizontal surfaces
    // when the hit-test pose has Y pointing up along the surface normal.
    const ringGeo = new THREE.RingGeometry(RETICLE_RADIUS * 0.72, RETICLE_RADIUS, 36)
      .rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    // Centre dot — also needs the same -90° rotation to lie flat
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
