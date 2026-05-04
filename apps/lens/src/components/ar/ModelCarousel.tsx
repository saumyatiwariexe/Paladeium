"use client";

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Float, PresentationControls } from '@react-three/drei';
import { useApp } from '@/lib/store';
import * as THREE from 'three';

function Model({ url, scale = 1 }: { url: string; scale?: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={scale} />;
}

function CarouselContent() {
  const { dishes, activeDishId } = useApp();
  const activeDishIndex = dishes.findIndex(d => d.id === activeDishId);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const targetX = -activeDishIndex * 4;
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.12);
    }
  });

  return (
    <group ref={groupRef}>
      {dishes.map((dish, idx) => (
        <group key={dish.id} position={[idx * 4, 0, 0]}>
          <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
            {dish.model ? (
              <Suspense fallback={null}>
                <Model url={dish.model} scale={(dish.modelScale || 1) * 1.2} />
              </Suspense>
            ) : (
              <mesh>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial color="#E23744" />
              </mesh>
            )}
          </Float>
        </group>
      ))}
    </group>
  );
}

export function ModelCarousel() {
  return (
    <div className="w-full h-full" style={{ touchAction: 'none' }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 4.5], fov: 42 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.9} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow intensity={1.2} />
        <pointLight position={[-10, -10, -5]} intensity={0.3} />

        <PresentationControls
          global
          config={{ mass: 2, tension: 400 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0.2, 0, 0]}
          polar={[-0.25, 0.35]}
          azimuth={[-Math.PI / 2, Math.PI / 2]}
        >
          <CarouselContent />
        </PresentationControls>

        <ContactShadows position={[0, -1.4, 0]} opacity={0.25} scale={15} blur={3} far={5} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
