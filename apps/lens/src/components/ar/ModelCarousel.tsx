"use client";

import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Float, PresentationControls } from '@react-three/drei';
import { useApp } from '@/lib/store';
import type { Dish } from '@/lib/types';
import * as THREE from 'three';

// ── Auto-scale: normalise any GLB to fit within TARGET world units ───────
const TARGET_SIZE = 1.8;

function AutoScaleModel({ url }: { url: string }) {
  const { scene: rawScene } = useGLTF(url);

  const { clonedScene, scale, offset } = useMemo(() => {
    // Clone to get an independent Three.js object per render instance.
    // useGLTF returns a shared singleton — two <primitive> elements sharing
    // the same object causes parent-conflict glitches during key-based remounts.
    const clonedScene = rawScene.clone(true);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0.001 ? TARGET_SIZE / maxDim : 1;
    return {
      clonedScene,
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -(center.y - size.y * 0.5) * s, -center.z * s),
    };
  }, [rawScene]);

  return (
    <group position={[offset.x, offset.y, offset.z]}>
      <primitive object={clonedScene} scale={scale} />
    </group>
  );
}

function FallbackSphere() {
  return (
    <mesh>
      <sphereGeometry args={[0.75, 32, 32]} />
      <meshStandardMaterial color="#E23744" roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

// ── Per-dish scene: scale 0→1 on mount via easing ────────────────────────
function DishScene({ dish }: { dish: Dish }) {
  const groupRef  = useRef<THREE.Group>(null);
  const progress  = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    progress.current = Math.min(1, progress.current + delta * 7); // ~140 ms
    // Ease-out cubic
    const t      = progress.current;
    const eased  = 1 - Math.pow(1 - t, 3);
    groupRef.current.scale.setScalar(eased);
  });

  return (
    <group ref={groupRef} scale={0}>
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.25}>
        {dish.model ? (
          <Suspense fallback={<FallbackSphere />}>
            <AutoScaleModel url={dish.model} />
          </Suspense>
        ) : (
          <FallbackSphere />
        )}
      </Float>
    </group>
  );
}

// ── Active dish wrapper — `key` on PresentationControls resets ────────────
// rotation state completely on every dish change, eliminating the glitch.
function ActiveDishViewer() {
  const { dishes, activeDishId } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);
  if (!activeDish) return null;

  return (
    <PresentationControls
      key={activeDish.id}
      global
      cursor={false}
      config={{ mass: 1, tension: 280 }}
      snap={{ mass: 3, tension: 1000 }}
      rotation={[0.12, 0, 0]}
      polar={[-0.3, 0.35]}
      azimuth={[-Math.PI, Math.PI]}
    >
      <DishScene key={`scene-${activeDish.id}`} dish={activeDish} />
    </PresentationControls>
  );
}

// ── Canvas shell ──────────────────────────────────────────────────────────
export function ModelCarousel() {
  return (
    <div className="w-full h-full" style={{ touchAction: 'none' }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 3.8], fov: 40 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={1.1} />
        <spotLight position={[5, 8, 5]} angle={0.22} penumbra={1} castShadow intensity={1.6} />
        <pointLight position={[-4, -2, -4]} intensity={0.35} />

        <ActiveDishViewer />

        <ContactShadows
          position={[0, -1.0, 0]}
          opacity={0.18}
          scale={6}
          blur={2.5}
          far={2.5}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
