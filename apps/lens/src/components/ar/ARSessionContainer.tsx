"use client";

import React, { useEffect, useState } from 'react';
import { AROverlayUI } from './AROverlayUI';
import { useApp } from '@/lib/store';

export function ARSessionContainer() {
  const { viewMode } = useApp();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (viewMode === 'ar') {
      const timer = setTimeout(() => setIsReady(true), 800);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [viewMode]);

  if (viewMode !== 'ar') return null;

  return (
    <>
      <AROverlayUI />
    </>
  );
}
