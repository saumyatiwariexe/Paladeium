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
  const { dishes, activeDishId, setActiveDish } = useApp();
  const activeDishIndex = dishes.findIndex(d => d.id === activeDishId);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smoothly transition group position based on active index
      const targetX = -activeDishIndex * 3;
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      {dishes.map((dish, idx) => (
        <group key={dish.id} position={[idx * 3, 0, 0]}>
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            {dish.model ? (
              <Suspense fallback={<mesh><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="gray" wireframe /></mesh>}>
                <Model url={dish.model} scale={dish.modelScale} />
              </Suspense>
            ) : (
              <mesh>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="red" />
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
    <div className="absolute inset-0 z-10">
      <Canvas shadows camera={{ position: [0, 1.5, 4], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-mapSize={2048} castShadow />
        
        <PresentationControls
          global
          config={{ mass: 2, tension: 500 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 4, Math.PI / 4]}
          azimuth={[-Math.PI / 4, Math.PI / 4]}
        >
          <CarouselContent />
        </PresentationControls>

        <ContactShadows position={[0, -1.4, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        <Environment preset="city" />
      </Canvas>

      {/* Swipe Overlay (Invisible) */}
      <div className="absolute inset-0 z-20 flex justify-between items-center px-4 pointer-events-none">
        <button 
          onClick={() => {
            const nextIdx = Math.max(0, activeDishIndex - 1);
            setActiveDish(dishes[nextIdx].id);
          }}
          className="w-16 h-full pointer-events-auto active:bg-white/5 transition-colors"
        />
        <button 
          onClick={() => {
            const nextIdx = Math.min(dishes.length - 1, activeDishIndex + 1);
            setActiveDish(dishes[nextIdx].id);
          }}
          className="w-16 h-full pointer-events-auto active:bg-white/5 transition-colors"
        />
      </div>
    </div>
  );
}
