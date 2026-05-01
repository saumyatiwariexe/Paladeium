import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // Optional if available
import { SurfaceDetector } from './SurfaceDetector.js';
import { State, setState } from './StateManager.js';
import { PreloadQueue } from './PreloadQueue.js';
import { DishManager } from './DishManager.js';
import { GestureController } from './GestureController.js';
import { UIController } from './UIController.js';

export class ARSessionManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;

    const container = document.getElementById('ar-container');
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.setupLighting();

    this.surfaceDetector = new SurfaceDetector(this.scene, this.camera, this.renderer);
    
    this.preloadQueue = new PreloadQueue();
    this.preloadQueue.init(new GLTFLoader());

    this.dishManager = new DishManager(this.preloadQueue, this.surfaceDetector.placedGroup);
    
    this.uiController = new UIController((id) => {
      const index = State.menuItems.findIndex(i => i.id === id);
      if (index !== -1) {
        this.dishManager.switchDish(index, 0);
      }
    });

    this.gestureController = new GestureController(this.renderer.domElement, {
      onSwipeLeft: () => {
        if (this.isTutorialVisible) return;
        if (State.menuItems.length === 0) return;
        const next = (State.currentDishIndex + 1) % State.menuItems.length;
        this.dishManager.switchDish(next, 1);
        this.uiController.showInfoCard();
      },
      onSwipeRight: () => {
        if (this.isTutorialVisible) return;
        if (State.menuItems.length === 0) return;
        const prev = (State.currentDishIndex - 1 + State.menuItems.length) % State.menuItems.length;
        this.dishManager.switchDish(prev, -1);
        this.uiController.showInfoCard();
      },
      onSwipeUp: () => {
        if (this.isTutorialVisible) return;
        setState({ isMenuOpen: true });
      },
      onSwipeDown: () => {
        setState({ isMenuOpen: false });
      },
      onTap: () => {
        if (!this.surfaceDetector.isPlaced) {
          this.surfaceDetector.requestPlacement();
        } else {
          this.uiController.showInfoCard();
        }
      },
      onDrag: (dx, _dy) => {
        if (this.dishManager.currentModel) {
          this.dishManager.currentModel.rotation.y += dx * 0.01;
        }
      },
      onScale: (scaleFactor) => {
        const model = this.dishManager.currentModel;
        if (model) {
          const canon = model.userData.canonicalScale ?? model.scale.x;
          const next  = model.scale.x * scaleFactor;
          model.scale.setScalar(Math.max(canon * 0.4, Math.min(canon * 4, next)));
        }
      }
    });

    this.bindEvents();
  }

  showTutorial() {
    this.isTutorialVisible = true;
    const tut = document.getElementById('tutorial-overlay');
    if (tut) tut.classList.add('visible');
    
    // Auto hide after 4 seconds
    setTimeout(() => {
      this.dismissTutorial();
    }, 4000);
  }

  dismissTutorial() {
    this.isTutorialVisible = false;
    localStorage.setItem('paladeium_tutorial_seen', 'true');
    const tut = document.getElementById('tutorial-overlay');
    if (tut) tut.classList.remove('visible');
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dlKey = new THREE.DirectionalLight(0xfff5e0, 2.2);
    dlKey.position.set(1, 3, 2);
    this.scene.add(dlKey);
    const dlFill = new THREE.DirectionalLight(0xd4a853, 0.8);
    dlFill.position.set(-2, 1, -1);
    this.scene.add(dlFill);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const statusText   = document.getElementById('status-text');
    const anchorStatus = document.getElementById('anchor-status');
    const tapHint      = document.getElementById('surface-tap-hint');
    const hintText     = document.getElementById('surface-hint-text');

    this.surfaceDetector.addEventListener('warming', e => {
      if (statusText) statusText.textContent = `Scanning… ${Math.round(e.progress * 100)}%`;
      if (tapHint) tapHint.classList.add('visible');
    });

    this.surfaceDetector.addEventListener('ready', () => {
      if (statusText) statusText.textContent = 'Placing…';
    });

    this.surfaceDetector.addEventListener('surface', e => {
      if (e.found && !this.surfaceDetector.isPlaced) {
        if (anchorStatus) anchorStatus.classList.add('found');
        if (tapHint) tapHint.classList.add('visible');
        if (hintText) hintText.textContent = 'Scanning surface…';
      }
    });

    this.surfaceDetector.addEventListener('placed', () => {
      setState({ anchorPlaced: true });
      if (tapHint) tapHint.classList.remove('visible');
      if (statusText) statusText.textContent = 'AR Active';
      if (anchorStatus) anchorStatus.classList.add('found');
      if (State.menuItems.length > 0) {
        this.dishManager.switchDish(0, 0);
      }
      if (!localStorage.getItem('paladeium_tutorial_seen')) {
        this.showTutorial();
      }
    });
  }

  async start() {
    this.renderer.setAnimationLoop((time, frame) => {
      if (this.surfaceDetector) this.surfaceDetector.tick(frame, time);

      // surface event fires only on transitions, so poll here for auto-placement
      if (!this.surfaceDetector.isPlaced && this.surfaceDetector.surfaceFound && State.menuItems.length > 0) {
        this.surfaceDetector.requestPlacement();
      }

      if (this.dishManager.currentModel?.userData.baseY !== undefined) {
        const t = performance.now() / 1000;
        this.dishManager.currentModel.position.y = this.dishManager.currentModel.userData.baseY + Math.sin(t * 1.2) * 0.006;
      }

      this.renderer.render(this.scene, this.camera);
    });

    await this.surfaceDetector.start(document.body);
  }
}
