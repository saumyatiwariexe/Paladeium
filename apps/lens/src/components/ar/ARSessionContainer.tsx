"use client";

import React, { useEffect, useState } from 'react';
import { ModelCarousel } from './ModelCarousel';
import { AROverlayUI } from './AROverlayUI';
import { useApp } from '@/lib/store';

export function ARSessionContainer() {
  const { viewMode } = useApp();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (viewMode === 'ar') {
      // Simulate camera feed initialization or WebXR start
      const timer = setTimeout(() => setIsReady(true), 800);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [viewMode]);

  if (viewMode !== 'ar') return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* 
         In a real AR scenario, this would be where the camera feed 
         from MindAR or WebXR is rendered. 
      */}
      <div className="absolute inset-0 opacity-40 bg-gradient-to-b from-gray-900 to-black" />
      
      {isReady ? (
        <>
          <ModelCarousel />
          <AROverlayUI />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold tracking-widest text-xs uppercase opacity-60">Initializing Lens…</p>
        </div>
      )}
    </div>
  );
}
