"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useApp } from '@/lib/store';
import { ARCanvas } from './ARCanvas';

const MODEL_SIZE = 0.15;

function scaleMeshToFit(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = maxDim > 0.001 ? MODEL_SIZE / maxDim : 1;
  obj.scale.setScalar(s);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.set(-center.x * s, (-center.y + size.y * 0.5) * s, -center.z * s);
}

// ── WebXR surface mode ────────────────────────────────────────────────────────

function WebXREngine({ onFallback }: { onFallback: () => void }) {
  const { dishes, activeDishId } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);

  const activeDish = dishes.find(d => d.id === activeDishId);

  useEffect(() => {
    if (!canvasRef.current || !activeDish) return;

    const canvas = canvasRef.current;
    const dish = activeDish; // capture for async closure
    let session: XRSession | null = null;
    let stopped = false;

    async function run() {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(1, 2, 1);
      scene.add(dir);

      // Reticle ring shown on detected surface
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.045, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xe23744, side: THREE.DoubleSide }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      // Model group placed on tap
      const modelGroup = new THREE.Group();
      modelGroup.visible = false;
      scene.add(modelGroup);

      // Load dish model
      if (dish.model) {
        try {
          const gltf = await new GLTFLoader().loadAsync(dish.model);
          scaleMeshToFit(gltf.scene);
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
      const refSpace = await session.requestReferenceSpace('local');
      const hitTestSource = await (session as unknown as {
        requestHitTestSource: (o: { space: XRReferenceSpace }) => Promise<XRHitTestSource>;
      }).requestHitTestSource({ space: viewerSpace });

      let isPlaced = false;

      session.addEventListener('select', () => {
        if (reticle.visible) {
          modelGroup.position.setFromMatrixPosition(reticle.matrix);
          // Y-axis rotation to face the camera (XZ plane)
          const pos = modelGroup.position.clone();
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

      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
      });
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
        {!placed && (
          <div className="absolute bottom-44 left-0 right-0 flex justify-center">
            <div className="bg-black/70 px-5 py-3 rounded-2xl">
              <p className="text-white font-black text-[13px]">Tap surface to place dish</p>
            </div>
          </div>
        )}
        {placed && (
          <div className="absolute bottom-44 left-0 right-0 flex justify-center">
            <div className="bg-black/70 px-5 py-3 rounded-2xl">
              <p className="text-white font-black text-[13px]">Tap again to reposition</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Camera fallback (non-WebXR devices) ──────────────────────────────────────

function CameraFallback() {
  const { setViewMode } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setDenied(true); return; }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamReady(true);
      })
      .catch(() => setDenied(true));

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (denied) {
    return (
      <div className="absolute inset-0 bg-[#1C1C1C] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-white text-[18px] font-black mb-2">Camera access denied</p>
        <p className="text-white/50 text-[13px] mb-6">Allow camera permission and try again.</p>
        <button onClick={() => setViewMode('preview')} className="px-8 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px]">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      {camReady && <ARCanvas />}
      {!camReady && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

// ── Public component: tries WebXR, falls back to camera overlay ───────────────

export function SurfaceAREngine() {
  const [mode, setMode] = useState<'checking' | 'webxr' | 'camera'>('checking');

  useEffect(() => {
    // Require HTTPS for WebXR (localhost is allowed by browsers)
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
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
