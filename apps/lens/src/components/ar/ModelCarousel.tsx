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

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetX = -activeDishIndex * 4; // Wider spacing
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      {dishes.map((dish, idx) => (
        <group key={dish.id} position={[idx * 4, 0, 0]}>
          <Float speed={2} rotationIntensity={0.4} floatIntensity={0.4}>
            {dish.model ? (
              <Suspense fallback={null}>
                <Model url={dish.model} scale={dish.modelScale * 1.2} />
              </Suspense>
            ) : (
              <mesh>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial color="#FF4B3A" />
              </mesh>
            )}
          </Float>
        </group>
      ))}
    </group>
  );
}

export function ModelCarousel() {
  const { dishes, activeDishId, setActiveDish } = useApp();
  const activeDishIndex = dishes.findIndex(d => d.id === activeDishId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-auto">
      <Canvas shadows camera={{ position: [0, 0.5, 4.5], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
        
        {/* Presentation controls for rotation */}
        <PresentationControls
          global
          config={{ mass: 2, tension: 500 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0.3, 0, 0]}
          polar={[-0.2, 0.4]}
          azimuth={[-Math.PI / 2, Math.PI / 2]}
        >
          <CarouselContent />
        </PresentationControls>

        <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={15} blur={2.5} far={4} />
        <Environment preset="city" />
      </Canvas>

      {/* Swipe Detectors (Invisible left/right regions) */}
      <div className="absolute top-1/4 bottom-1/3 left-0 right-0 z-20 flex justify-between pointer-events-none">
        <button 
          onClick={() => {
            const nextIdx = Math.max(0, activeDishIndex - 1);
            setActiveDish(dishes[nextIdx].id);
          }}
          className="w-1/4 h-full pointer-events-auto cursor-w-resize"
          aria-label="Previous Dish"
        />
        <button 
          onClick={() => {
            const nextIdx = Math.min(dishes.length - 1, activeDishIndex + 1);
            setActiveDish(dishes[nextIdx].id);
          }}
          className="w-1/4 h-full pointer-events-auto cursor-e-resize"
          aria-label="Next Dish"
        />
      </div>
    </div>
  );
}
