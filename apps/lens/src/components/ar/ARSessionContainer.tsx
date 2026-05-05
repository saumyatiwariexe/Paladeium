"use client";

import React from 'react';
import { AROverlayUI } from './AROverlayUI';
import { MarkerAREngine } from './MarkerAREngine';
import { SurfaceAREngine } from './SurfaceAREngine';
import { useApp } from '@/lib/store';

export function ARSessionContainer() {
  const { restaurant } = useApp();

  // Marker mode: restaurant has a compiled .mind targets file AND marker detection is on
  const isMarkerMode = restaurant?.markerDetectionEnabled !== false && !!restaurant?.targetsUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {isMarkerMode
        ? <MarkerAREngine targetsUrl={restaurant!.targetsUrl!} />
        : <SurfaceAREngine />
      }

      {/* UI overlay: dish info, add-to-cart, exit button */}
      <AROverlayUI />
    </div>
  );
}
