"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useApp } from '@/lib/store';

const MINDAR_CDN = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
const MODEL_SIZE = 0.12; // 12 cm — scaled to sit on a physical menu card

type LoadState = 'loading' | 'scanning' | 'found' | 'error';

// Types for MindAR (loaded from CDN, not a typed package)
interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  start: () => Promise<void>;
  stop: () => void;
  addAnchor: (idx: number) => { group: THREE.Group };
}
type MindARThreeCtor = new (opts: {
  container: HTMLElement;
  imageTargetSrc: string;
  uiLoading: string;
  uiScanning: string;
  uiError: string;
  filterMinCF?: number;
  filterBeta?: number;
}) => MindARThreeInstance;

function scaleMeshToFit(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = maxDim > 0.001 ? MODEL_SIZE / maxDim : 1;
  obj.scale.setScalar(s);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.set(-center.x * s, -center.y * s + (size.y * s) / 2, -center.z * s);
}

async function loadMindAR(): Promise<MindARThreeCtor> {
  const w = window as unknown as { MINDAR?: { IMAGE?: { MindARThree?: MindARThreeCtor } } };
  if (w.MINDAR?.IMAGE?.MindARThree) return w.MINDAR.IMAGE.MindARThree;

  await new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${MINDAR_CDN}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = MINDAR_CDN;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load MindAR from CDN'));
    document.head.appendChild(s);
  });

  const ctor = (window as unknown as { MINDAR?: { IMAGE?: { MindARThree?: MindARThreeCtor } } })
    .MINDAR?.IMAGE?.MindARThree;
  if (!ctor) throw new Error('MindAR loaded but MindARThree not found');
  return ctor;
}

export function MarkerAREngine({ targetsUrl }: { targetsUrl: string }) {
  const { dishes, activeDishId, setViewMode } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MindARThreeInstance | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const activeDish = dishes.find(d => d.id === activeDishId);

  useEffect(() => {
    if (!containerRef.current || !activeDish) return;

    let stopped = false;
    const container = containerRef.current;
    const dish = activeDish; // capture for async closure — activeDish may change

    async function run() {
      setLoadState('loading');

      let MindARThree: MindARThreeCtor;
      try {
        MindARThree = await loadMindAR();
      } catch (err) {
        if (!stopped) {
          setLoadState('error');
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load AR library');
        }
        return;
      }

      if (stopped) return;

      const engine = new MindARThree({
        container,
        imageTargetSrc: targetsUrl,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no',
        filterMinCF: 0.0001,
        filterBeta: 0.001,
      });
      engineRef.current = engine;

      const { renderer, scene, camera } = engine;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(1, 2, 1);
      scene.add(dir);

      const anchor = engine.addAnchor(0);

      // Load dish model
      if (dish.model) {
        try {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(dish.model);
          if (!stopped) {
            scaleMeshToFit(gltf.scene);
            anchor.group.add(gltf.scene);
          }
        } catch {
          if (!stopped) {
            const mesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.05, 32, 32),
              new THREE.MeshStandardMaterial({ color: 0xe23744 })
            );
            anchor.group.add(mesh);
          }
        }
      } else {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 32, 32),
          new THREE.MeshStandardMaterial({ color: 0xe23744 })
        );
        anchor.group.add(mesh);
      }

      if (stopped) return;

      setLoadState('scanning');

      // Track anchor visibility to update UI
      let lastVisible = false;
      renderer.setAnimationLoop(() => {
        const visible = anchor.group.visible;
        if (visible !== lastVisible) {
          lastVisible = visible;
          if (visible) setLoadState('found');
          else setLoadState('scanning');
        }
        renderer.render(scene, camera);
      });

      await engine.start();
    }

    run().catch(err => {
      if (!stopped) {
        setLoadState('error');
        setErrorMsg(err instanceof Error ? err.message : 'AR failed to start');
      }
    });

    return () => {
      stopped = true;
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [activeDish?.id, activeDish?.model, targetsUrl]);

  return (
    <div className="absolute inset-0">
      {/* MindAR renders into this div — it creates its own canvas + video */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Status overlay */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="w-12 h-12 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-black text-[15px]">Loading AR…</p>
        </div>
      )}

      {loadState === 'scanning' && (
        <div className="absolute bottom-44 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/70 px-5 py-3 rounded-2xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#E23744] border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-white font-black text-[13px]">Point camera at menu card</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 bg-[#1C1C1C] flex flex-col items-center justify-center p-8 text-center">
          <p className="text-white text-[18px] font-black mb-2">AR failed to load</p>
          <p className="text-white/50 text-[13px] mb-6">{errorMsg}</p>
          <button
            onClick={() => setViewMode('preview')}
            className="px-8 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px]"
          >
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}
