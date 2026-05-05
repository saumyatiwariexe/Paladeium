"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useApp } from '@/lib/store';

const XR_MODEL_SIZE  = 0.15; // meters — for WebXR hit-test placement
const CAM_MODEL_SIZE = 0.65; // units  — for camera overlay view

function scaleMeshToFit(obj: THREE.Object3D, targetSize: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = maxDim > 0.001 ? targetSize / maxDim : 1;
  obj.scale.setScalar(s);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.set(-center.x * s, (-center.y + size.y * 0.5) * s, -center.z * s);
}

// ── WebXR surface mode ────────────────────────────────────────────────────────

function WebXREngine({ onFallback }: { onFallback: () => void }) {
  const { dishes, activeDishId } = useApp();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);

  const activeDish = dishes.find(d => d.id === activeDishId);

  useEffect(() => {
    if (!canvasRef.current || !activeDish) return;

    const canvas = canvasRef.current;
    const dish   = activeDish;
    let session: XRSession | null = null;
    let stopped = false;

    async function run() {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(1, 2, 1);
      scene.add(dir);

      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.045, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xe23744, side: THREE.DoubleSide }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      const modelGroup = new THREE.Group();
      modelGroup.visible = false;
      scene.add(modelGroup);

      if (dish.model) {
        try {
          const gltf = await new GLTFLoader().loadAsync(dish.model);
          scaleMeshToFit(gltf.scene, XR_MODEL_SIZE);
          modelGroup.add(gltf.scene);
        } catch {
          modelGroup.add(new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xe23744 }),
          ));
        }
      } else {
        modelGroup.add(new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 32, 32),
          new THREE.MeshStandardMaterial({ color: 0xe23744 }),
        ));
      }

      if (stopped) return;

      const sessionInit: XRSessionInit = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'anchors'],
      };
      if (overlayRef.current) {
        (sessionInit as Record<string, unknown>).domOverlay = { root: overlayRef.current };
      }

      session = await navigator.xr!.requestSession('immersive-ar', sessionInit);
      await renderer.xr.setSession(session);

      const viewerSpace = await session.requestReferenceSpace('viewer');
      const refSpace    = await session.requestReferenceSpace('local');
      const hitTestSource = await (session as unknown as {
        requestHitTestSource: (o: { space: XRReferenceSpace }) => Promise<XRHitTestSource>;
      }).requestHitTestSource({ space: viewerSpace });

      let isPlaced = false;

      session.addEventListener('select', () => {
        if (reticle.visible) {
          modelGroup.position.setFromMatrixPosition(reticle.matrix);
          const pos    = modelGroup.position.clone();
          const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
          modelGroup.rotation.y = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
          modelGroup.visible = true;
          isPlaced = true;
          setPlaced(true);
        }
      });

      renderer.setAnimationLoop((_t: number, frame?: XRFrame) => {
        if (!frame || !refSpace || stopped) return;
        const results = frame.getHitTestResults(hitTestSource);
        if (results.length > 0) {
          const pose = results[0].getPose(refSpace);
          if (pose) {
            reticle.visible = !isPlaced;
            reticle.matrix.fromArray(pose.transform.matrix);
          }
        } else {
          if (!isPlaced) reticle.visible = false;
        }
        renderer.render(scene, camera);
      });

      session.addEventListener('end', () => { renderer.setAnimationLoop(null); });
    }

    run().catch(err => {
      console.error('[AR] WebXR session failed, falling back to camera:', err);
      onFallback();
    });

    return () => {
      stopped = true;
      session?.end().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDish?.id, activeDish?.model]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-44 left-0 right-0 flex justify-center">
          <div className="bg-black/70 px-5 py-3 rounded-2xl">
            <p className="text-white font-black text-[13px]">
              {placed ? 'Tap again to reposition' : 'Point at a flat surface and tap to place'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Camera fallback — pure Three.js, no R3F ───────────────────────────────────
// Using direct imperative Three.js avoids the R3F frozen-canvas issue on mobile.

function CameraFallback() {
  const { dishes, activeDishId, setViewMode } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);

  const mountRef  = useRef<HTMLDivElement>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animId  = 0;
    let stream: MediaStream | null = null;
    let alive   = true;

    // ── Three.js renderer on transparent canvas ──────────────────────────
    const W = container.clientWidth  || window.innerWidth;
    const H = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0); // fully transparent background
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
    camera.position.set(0, 0.1, 2.8);

    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(2, 5, 3);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffeedd, 0.6);
    fill.position.set(-3, -1, -2);
    scene.add(fill);

    const modelGroup = new THREE.Group();
    modelGroup.scale.setScalar(0); // scale-in on load
    scene.add(modelGroup);

    // Load model
    const loader = new GLTFLoader();
    if (activeDish?.model) {
      loader.load(
        activeDish.model,
        gltf => {
          if (!alive) return;
          scaleMeshToFit(gltf.scene, CAM_MODEL_SIZE);
          modelGroup.add(gltf.scene);
        },
        undefined,
        () => {
          if (!alive) return;
          modelGroup.add(new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xe23744, roughness: 0.4, metalness: 0.1 }),
          ));
        },
      );
    } else {
      modelGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xe23744, roughness: 0.4, metalness: 0.1 }),
      ));
    }

    // ── Camera stream ─────────────────────────────────────────────────────
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .then(s => {
          if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
          stream = s;
          const video = document.createElement('video');
          video.srcObject = s;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          video.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
          // Insert video BEHIND the Three.js canvas
          container.insertBefore(video, container.firstChild);
        })
        .catch(() => { if (alive) setDenied(true); });
    } else {
      setDenied(true);
    }

    // ── Resize handler ────────────────────────────────────────────────────
    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────
    let t = 0;
    let scaleT = 0;

    function tick() {
      animId = requestAnimationFrame(tick);
      t      += 0.016;
      scaleT  = Math.min(1, scaleT + 0.04);

      // Ease-out scale-in
      modelGroup.scale.setScalar(1 - Math.pow(1 - scaleT, 3));
      // Gentle float + slow y-rotation
      modelGroup.position.y = Math.sin(t * 1.1) * 0.06;
      modelGroup.rotation.y = t * 0.45;

      renderer.render(scene, camera);
    }
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(animId);
      stream?.getTracks().forEach(t => t.stop());
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      // Clean up DOM nodes added imperatively
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDish?.id, activeDish?.model]);

  if (denied) {
    return (
      <div className="absolute inset-0 bg-[#1C1C1C] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-white text-[18px] font-black mb-2">Camera access denied</p>
        <p className="text-white/50 text-[13px] mb-6">Allow camera permission and try again.</p>
        <button
          onClick={() => setViewMode('preview')}
          className="px-8 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px]">
          Go Back
        </button>
      </div>
    );
  }

  return <div ref={mountRef} className="absolute inset-0" />;
}

// ── Public component: tries WebXR, falls back to camera overlay ───────────────

export function SurfaceAREngine() {
  const [mode, setMode] = useState<'checking' | 'webxr' | 'camera'>('checking');

  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' ||
      location.hostname  === 'localhost' ||
      location.hostname  === '127.0.0.1';

    if (!isSecure || !navigator.xr) { setMode('camera'); return; }

    navigator.xr.isSessionSupported('immersive-ar')
      .then(ok => setMode(ok ? 'webxr' : 'camera'))
      .catch(() => setMode('camera'));
  }, []);

  if (mode === 'checking') {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === 'webxr') {
    return <WebXREngine onFallback={() => setMode('camera')} />;
  }

  return <CameraFallback />;
}
