/**
 * CapabilityDetector — probes the browser/device and assigns a tracking tier.
 *
 * Tier 1 – WebXR immersive-ar  (ARCore / ARKit via browser)
 * Tier 2 – Marker + device-orientation sensor fusion
 * Tier 3 – Marker tracking only (no orientation sensors)
 * Tier 4 – No camera → 3D-viewer fallback
 */

export const CapabilityTier = Object.freeze({
  WEBXR:  1,
  HYBRID: 2,
  MARKER: 3,
  VIEWER: 4,
});

export class CapabilityDetector {
  static async detect() {
    const hasCamera = !!(navigator.mediaDevices?.getUserMedia);
    const hasWebXR  = 'xr' in navigator;

    let hasImmersiveAR = false;
    if (hasWebXR) {
      try { hasImmersiveAR = await navigator.xr.isSessionSupported('immersive-ar'); }
      catch { /* unsupported */ }
    }

    const hasDeviceOrientation = typeof DeviceOrientationEvent !== 'undefined';
    const hasDeviceMotion      = typeof DeviceMotionEvent      !== 'undefined';
    const hasSensors           = hasDeviceOrientation && hasDeviceMotion;

    const ua       = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    const isIOS    = /iPhone|iPad|iPod/i.test(ua);

    // iOS 13+ requires an explicit permission request for orientation events.
    const needsOrientationPermission =
      isIOS && typeof DeviceOrientationEvent.requestPermission === 'function';

    let tier;
    if (!hasCamera)        tier = CapabilityTier.VIEWER;
    else if (hasImmersiveAR) tier = CapabilityTier.WEBXR;   // stub – tier 1 not yet wired
    else if (hasSensors)   tier = CapabilityTier.HYBRID;
    else                   tier = CapabilityTier.MARKER;

    return Object.freeze({
      tier,
      hasCamera,
      hasWebXR,
      hasImmersiveAR,
      hasDeviceOrientation,
      hasDeviceMotion,
      hasSensors,
      isMobile,
      isIOS,
      needsOrientationPermission,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }
}
