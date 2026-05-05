"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AROverlayUI } from './AROverlayUI';
import { ARCanvas } from './ARCanvas';
import { useApp } from '@/lib/store';

type CameraState = 'requesting' | 'active' | 'denied' | 'unsupported';

export function ARSessionContainer() {
  const { setViewMode } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<CameraState>('requesting');

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState('unsupported');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamState('active');
      })
      .catch(() => setCamState('denied'));

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Error screens
  if (camState === 'unsupported' || camState === 'denied') {
    return (
      <div className="fixed inset-0 z-50 bg-[#1C1C1C] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E23744]/10 flex items-center justify-center mb-5">
          <span className="text-3xl">📷</span>
        </div>
        <h2 className="text-white text-[20px] font-black mb-2">
          {camState === 'denied' ? 'Camera access denied' : 'Camera not available'}
        </h2>
        <p className="text-white/50 text-[13px] mb-8 leading-relaxed">
          {camState === 'denied'
            ? 'Allow camera permission in your browser settings and try again.'
            : 'Your browser does not support camera access.'}
        </p>
        <button
          onClick={() => setViewMode('preview')}
          className="px-8 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px] active:scale-95 transition-transform"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 3D model floating over camera */}
      {camState === 'active' && <ARCanvas />}

      {/* UI controls */}
      <AROverlayUI />

      {/* Requesting camera overlay */}
      {camState === 'requesting' && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-black text-[15px]">Starting camera…</p>
        </div>
      )}
    </div>
  );
}
