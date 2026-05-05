"use client";

import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import { useApp } from '@/lib/store';
import * as THREE from 'three';

const TARGET_SIZE = 1.6;

function ARModel({ url }: { url: string }) {
  const { scene: rawScene } = useGLTF(url);

  const { clonedScene, scale, offset } = useMemo(() => {
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
      <sphereGeometry args={[0.6, 32, 32]} />
      <meshStandardMaterial color="#E23744" roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

function ScaleIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    t.current = Math.min(1, t.current + delta * 5);
    ref.current.scale.setScalar(1 - Math.pow(1 - t.current, 3));
  });

  return <group ref={ref} scale={0}>{children}</group>;
}

export function ARCanvas() {
  const { dishes, activeDishId } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <pointLight position={[-3, -1, -3]} intensity={0.4} />

        {activeDish && (
          <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.2}>
            <ScaleIn key={activeDish.id}>
              {activeDish.model ? (
                <Suspense fallback={<FallbackSphere />}>
                  <ARModel url={activeDish.model} />
                </Suspense>
              ) : (
                <FallbackSphere />
              )}
            </ScaleIn>
          </Float>
        )}
      </Canvas>
    </div>
  );
}
