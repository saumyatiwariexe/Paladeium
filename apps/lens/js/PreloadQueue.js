import * as THREE from 'three';
import { State, setState } from './StateManager.js';

export class PreloadQueue {
  constructor() {
    this.queue = [];
    this.isLoading = false;
    this.gltfLoader = null;
    this.onLoadComplete = null;
  }

  init(gltfLoader) {
    this.gltfLoader = gltfLoader;
  }

  enqueue(dish, priority = 'low') {
    if (!dish || !dish.model) return;
    if (State.loadedDishes.has(dish.id)) return;
    
    const existing = this.queue.find(item => item.dish.id === dish.id);
    if (existing) {
      if (priority === 'high' && existing.priority === 'low') {
        existing.priority = 'high';
        this.queue.sort((a, b) => (a.priority === 'high' ? -1 : 1));
      }
      return;
    }

    this.queue.push({ dish, priority });
    this.queue.sort((a, b) => (a.priority === 'high' ? -1 : (b.priority === 'high' ? 1 : 0)));
    
    setState({ loadingQueue: this.queue.map(q => q.dish.id) });
    this.processQueue();
  }

  async processQueue() {
    if (this.isLoading || this.queue.length === 0 || !this.gltfLoader) return;
    
    this.isLoading = true;
    const { dish } = this.queue.shift();
    setState({ loadingQueue: this.queue.map(q => q.dish.id) });

    let url = /^https?:\/\//.test(dish.model) ? dish.model : './' + dish.model;
    if (State.restaurantSlug && dish.model && !dish.model.includes('/') && !/^https?:\/\//.test(dish.model)) {
      url = `./models/${State.restaurantSlug}/${dish.model}`;
    }

    try {
      const gltf = await this.loadModelAsync(url);
      const model = gltf.scene;
      
      // Scale to ~18cm
      const box = new THREE.Box3().setFromObject(model);
      const sz = new THREE.Vector3();
      box.getSize(sz);
      let scale = 0.18 / Math.max(sz.x, sz.y, sz.z);
      if (dish.modelScale) scale *= dish.modelScale;
      model.scale.setScalar(scale);
      model.userData.canonicalScale = scale;

      const centre = new THREE.Vector3();
      box.getCenter(centre);
      const baseY = -box.min.y * scale;
      model.userData.baseY = baseY;
      model.position.set(-centre.x * scale, baseY, -centre.z * scale);
      model.rotation.y = Math.PI; // Face camera

      const loaded = new Map(State.loadedDishes);
      loaded.set(dish.id, model);
      setState({ loadedDishes: loaded });
      
      if (this.onLoadComplete) this.onLoadComplete(dish.id, model);
    } catch (err) {
      console.error('[PreloadQueue] Failed to load', dish.model, err);
    }

    this.isLoading = false;
    this.processQueue();
  }

  loadModelAsync(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
  }
}
