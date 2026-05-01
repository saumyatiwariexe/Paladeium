import { State, setState } from './StateManager.js';

export class GestureController {
  constructor(domElement, callbacks) {
    this.domElement = domElement;
    this.callbacks = callbacks; // { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDrag, onScale }
    
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.isDragging = false;
    this.lastPinchDist = null;
    this.startTime = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
    this.domElement.addEventListener('click', this.onClick.bind(this));
  }

  onTouchStart(e) {
    if (e.touches.length === 1) {
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.lastX = this.startX;
      this.lastY = this.startY;
      this.startTime = performance.now();
      this.isDragging = true;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDist = Math.hypot(dx, dy);
      this.isDragging = false; // pinch not drag
    }
  }

  onTouchMove(e) {
    if (this.isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.lastX;
      const dy = e.touches[0].clientY - this.lastY;
      
      if (this.callbacks.onDrag) {
        this.callbacks.onDrag(dx, dy);
      }
      
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
    
    if (e.touches.length === 2 && this.lastPinchDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scaleFactor = dist / this.lastPinchDist;
      
      if (this.callbacks.onScale) {
        this.callbacks.onScale(scaleFactor);
      }
      
      this.lastPinchDist = dist;
    }
  }

  onTouchEnd(e) {
    if (e.changedTouches.length === 1 && this.isDragging) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - this.startX;
      const diffY = endY - this.startY;
      const duration = performance.now() - this.startTime;

      // Quick swipe threshold
      if (duration < 400) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          // Horizontal swipe
          if (Math.abs(diffX) > 40) {
            if (diffX > 0 && this.callbacks.onSwipeRight) this.callbacks.onSwipeRight();
            else if (diffX < 0 && this.callbacks.onSwipeLeft) this.callbacks.onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (Math.abs(diffY) > 40) {
            if (diffY < 0 && this.callbacks.onSwipeUp) this.callbacks.onSwipeUp();
            else if (diffY > 0 && this.callbacks.onSwipeDown) this.callbacks.onSwipeDown();
          }
        }
      } else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
        // Long tap or tap, handled in click mostly, but we can emit onTap here too
        // if (this.callbacks.onTap) this.callbacks.onTap();
      }
    }
    
    this.isDragging = false;
    this.lastPinchDist = null;
  }

  onClick(e) {
    if (this.callbacks.onTap) this.callbacks.onTap(e);
  }
}
