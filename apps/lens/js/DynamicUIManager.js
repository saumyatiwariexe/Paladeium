import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { State, setState } from './StateManager.js';

export class DynamicUIManager {
  constructor({ onViewInTable, onAddToCart, paymentEnabled }) {
    this.onViewInTable  = onViewInTable;
    this.onAddToCart    = onAddToCart;
    this.paymentEnabled = paymentEnabled;

    this.loader      = new GLTFLoader();
    this.scene       = new THREE.Scene();
    this.camera      = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer    = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    this.clock       = new THREE.Clock();
    this.model       = null;
    this.placeholder = null;
    this.modelCache  = new Map();
    this.autoRotate  = true;
    this.isDragging  = false;
    this.dragStartX  = 0;
    this.animFrame   = null;

    this._setupRenderer();
    this._setupLighting();
    this._setupCamera();
  }

  _setupRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    const container = document.getElementById('dynamic-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(this.renderer.domElement);
      container.style.display = 'block';
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupCamera() {
    this.camera.position.set(0, 0.5, 4.2);
    this.camera.lookAt(0, 0, 0);
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 10, 7.5);
    this.scene.add(sun);

    const blueLight = new THREE.PointLight(0x007AFF, 0.5);
    blueLight.position.set(-5, 2, -3);
    this.scene.add(blueLight);
  }

  async start() {
    const ui = document.getElementById('dynamic-ui');
    if (ui) ui.classList.add('active');

    this._setupGestures();
    this._setupUIEvents();
    this._buildMenuPanel();
    this._animate();

    const items = State.menuItems;
    if (items.length > 0) {
      await this._loadDish(0);
    }
  }

  async _loadDish(index) {
    const items = State.menuItems;
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    setState({ currentDishIndex: index, activeDishId: item.id });

    this._clearScene3D();
    this._showModelLoading(true);

    if (item.model) {
      try {
        // Try to fix CORS if possible by using no-cache or specific headers if we had control
        // But here we just try to load. 
        let gltf = this.modelCache.get(item.model);
        if (!gltf) {
          gltf = await new Promise((resolve, reject) => {
            this.loader.load(item.model, resolve, undefined, (error) => {
              console.error(`[Dynamic] Failed to load model: ${item.model}`, error);
              reject(error);
            });
          });
          this.modelCache.set(item.model, gltf);
        }

        const m = gltf.scene.clone();
        const scale = item.modelScale ?? 1.0;

        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fit = (2.0 / maxDim) * scale;
        m.scale.setScalar(fit);
        m.userData.canonicalScale = fit;

        const center = box.getCenter(new THREE.Vector3());
        m.position.set(-center.x * fit, -center.y * fit, -center.z * fit);

        this.model = m;
        this.scene.add(m);
        this.autoRotate = true;
      } catch (e) {
        this._showEmojiPlaceholder(item.emoji || '🍽');
      }
    } else {
      this._showEmojiPlaceholder(item.emoji || '🍽');
    }

    this._showModelLoading(false);
    this._updateUI(index);
    this._preloadAdjacent(index);
  }

  _clearScene3D() {
    if (this.model) this.scene.remove(this.model);
    if (this.placeholder) this.scene.remove(this.placeholder);
    this.model = null;
    this.placeholder = null;
  }

  _showEmojiPlaceholder(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.font = '320px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 2.2, 1);
    this.placeholder = sprite;
    this.scene.add(sprite);
    this.autoRotate = false;
  }

  _updateUI(index) {
    const item = State.menuItems[index];
    if (!item) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('dynamic-dish-emoji', item.emoji || '🍽');
    set('dynamic-dish-name', item.name);
    set('dynamic-dish-price', item.price);
    set('dynamic-dish-desc', item.desc);

    // Update dots
    const dots = document.getElementById('dynamic-dots');
    if (dots) {
      dots.innerHTML = '';
      State.menuItems.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = `nav-dot ${i === index ? 'active' : ''}`;
        d.onclick = () => this._loadDish(i);
        dots.appendChild(d);
      });
    }

    // Update grid active state
    document.querySelectorAll('.dyn-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === item.id);
    });
  }

  _buildMenuPanel() {
    const allItems = window._allMenuItems || State.menuItems;
    const cats = document.getElementById('dynamic-categories');
    const grid = document.getElementById('dynamic-dish-grid');
    if (!cats || !grid) return;

    // Categories
    cats.innerHTML = '<button class="cat-pill active" data-cat="all">All</button>';
    const uniqueCats = [...new Set(allItems.map(i => i.cat))];
    uniqueCats.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cat-pill';
      b.dataset.cat = c;
      b.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      b.onclick = () => {
        cats.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        b.classList.add('active');
        this._renderGrid(c === 'all' ? allItems : allItems.filter(i => i.cat === c));
      };
      cats.appendChild(b);
    });

    this._renderGrid(allItems);
  }

  _renderGrid(items) {
    const grid = document.getElementById('dynamic-dish-grid');
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'dish-card dyn-card';
      card.dataset.id = item.id;
      card.innerHTML = `
        <div class="dish-emoji">${item.emoji || '🍽'}</div>
        <div class="dish-info-content">
          <div class="dish-name">${item.name}</div>
          <div class="dish-desc">${item.desc.slice(0, 45)}...</div>
        </div>
        <div class="dish-price-badge">
          <div class="dish-price">${item.price}</div>
          ${item.hasAR ? '<div class="dish-ar-badge">3D</div>' : ''}
        </div>
      `;
      card.onclick = () => {
        const arIdx = State.menuItems.findIndex(m => m.id === item.id);
        if (arIdx !== -1) {
          this._loadDish(arIdx);
          document.getElementById('dynamic-menu-panel').classList.remove('open');
          document.getElementById('dynamic-menu-panel').classList.add('minimized');
        }
      };
      grid.appendChild(card);
    });
  }

  _setupGestures() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', e => { this.isDragging = true; this.dragStartX = e.clientX; this.autoRotate = false; });
    canvas.addEventListener('mousemove', e => {
      if (this.isDragging && this.model) {
        this.model.rotation.y += (e.clientX - this.dragStartX) * 0.01;
        this.dragStartX = e.clientX;
      }
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });

    // Touch
    let startX = 0;
    canvas.addEventListener('touchstart', e => { startX = e.touches[0].clientX; this.autoRotate = false; }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (this.model) {
        const dx = e.touches[0].clientX - startX;
        this.model.rotation.y += dx * 0.01;
        startX = e.touches[0].clientX;
      }
    }, { passive: true });
  }

  _setupUIEvents() {
    document.getElementById('dynamic-prev')?.addEventListener('click', () => {
      if (State.currentDishIndex > 0) this._loadDish(State.currentDishIndex - 1);
    });
    document.getElementById('dynamic-next')?.addEventListener('click', () => {
      if (State.currentDishIndex < State.menuItems.length - 1) this._loadDish(State.currentDishIndex + 1);
    });
    document.getElementById('dynamic-view-ar-btn')?.addEventListener('click', () => {
      this.stop();
      if (this.onViewInTable) this.onViewInTable(State.currentDishIndex);
    });

    const panel = document.getElementById('dynamic-menu-panel');
    document.getElementById('dynamic-menu-handle-area')?.addEventListener('click', () => {
      panel.classList.toggle('open');
      panel.classList.toggle('minimized');
    });
    document.getElementById('dynamic-menu-close')?.addEventListener('click', () => {
      panel.classList.remove('open');
      panel.classList.add('minimized');
    });
  }

  _showModelLoading(visible) {
    document.getElementById('model-loading')?.classList.toggle('visible', visible);
  }

  _preloadAdjacent(index) {
    const items = State.menuItems;
    [index - 1, index + 1].forEach(i => {
      if (i >= 0 && i < items.length && items[i].model) {
        if (!this.modelCache.has(items[i].model)) {
          this.loader.load(items[i].model, g => this.modelCache.set(items[i].model, g));
        }
      }
    });
  }

  _animate() {
    this.animFrame = requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    if (this.model && this.autoRotate && !this.isDragging) this.model.rotation.y += dt * 0.5;
    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const container = document.getElementById('dynamic-container');
    if (container) container.style.display = 'none';
    const ui = document.getElementById('dynamic-ui');
    if (ui) ui.classList.remove('active');
  }
}
