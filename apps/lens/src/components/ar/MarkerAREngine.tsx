"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useApp } from '@/lib/store';

const MINDAR_CDN = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
const MODEL_SIZE = 0.12;

type LoadState = 'loading' | 'scanning' | 'found' | 'error';

interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer;
  scene:    THREE.Scene;
  camera:   THREE.Camera;
  start:    () => Promise<void>;
  stop:     () => void;
  addAnchor: (idx: number) => { group: THREE.Group };
}
type MindARThreeCtor = new (opts: {
  container:       HTMLElement;
  imageTargetSrc:  string;
  uiLoading:       string;
  uiScanning:      string;
  uiError:         string;
  filterMinCF?:    number;
  filterBeta?:     number;
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

function makeFallbackSphere(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xe23744 }),
  );
}

async function loadMindAR(): Promise<MindARThreeCtor> {
  const w = window as unknown as { MINDAR?: { IMAGE?: { MindARThree?: MindARThreeCtor } } };
  if (w.MINDAR?.IMAGE?.MindARThree) return w.MINDAR.IMAGE.MindARThree;

  await new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${MINDAR_CDN}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = MINDAR_CDN;
    s.onload  = () => resolve();
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
  const activeDish = dishes.find(d => d.id === activeDishId);

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef    = useRef<MindARThreeInstance | null>(null);
  const anchorRef    = useRef<THREE.Group | null>(null);
  const loaderRef    = useRef<GLTFLoader>(new GLTFLoader());

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg,  setErrorMsg]  = useState('');

  // ── Engine lifecycle: start once per targetsUrl ───────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let stopped = false;
    const container = containerRef.current;

    async function startEngine() {
      setLoadState('loading');
      setErrorMsg('');

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
        uiLoading:  'no',
        uiScanning: 'no',
        uiError:    'no',
        filterMinCF: 0.0001,
        filterBeta:  0.001,
      });
      engineRef.current = engine;

      const { renderer, scene, camera } = engine;

      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(1, 2, 1);
      scene.add(dir);

      const anchor = engine.addAnchor(0);
      anchorRef.current = anchor.group;

      let lastVisible = false;
      renderer.setAnimationLoop(() => {
        const visible = anchor.group.visible;
        if (visible !== lastVisible) {
          lastVisible = visible;
          setLoadState(visible ? 'found' : 'scanning');
        }
        renderer.render(scene, camera);
      });

      try {
        await engine.start();
        if (!stopped) setLoadState('scanning');
      } catch (err) {
        if (!stopped) {
          setLoadState('error');
          setErrorMsg(err instanceof Error ? err.message : 'AR failed to start');
        }
      }
    }

    startEngine().catch(err => {
      if (!stopped) {
        setLoadState('error');
        setErrorMsg(err instanceof Error ? err.message : 'AR failed');
      }
    });

    return () => {
      stopped = true;
      engineRef.current?.stop();
      engineRef.current = null;
      anchorRef.current = null;
    };
  }, [targetsUrl]); // only recreate engine when the targets file changes

  // ── Model swap: runs whenever active dish changes (no engine restart) ─────
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    // Clear previous model
    while (anchor.children.length > 0) anchor.remove(anchor.children[0]);

    if (!activeDish) return;

    if (activeDish.model) {
      loaderRef.current.load(
        activeDish.model,
        gltf => {
          if (anchorRef.current !== anchor) return; // engine was replaced
          scaleMeshToFit(gltf.scene);
          anchor.add(gltf.scene);
        },
        undefined,
        () => { if (anchorRef.current === anchor) anchor.add(makeFallbackSphere()); },
      );
    } else {
      anchor.add(makeFallbackSphere());
    }
  }, [activeDish?.id, activeDish?.model]);

  return (
    <div className="absolute inset-0">
      {/* MindAR renders into this div — it creates its own camera + canvas */}
      <div ref={containerRef} className="absolute inset-0" />

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
            className="px-8 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px]">
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}
