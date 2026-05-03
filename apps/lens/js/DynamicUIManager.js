import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { State, setState } from './StateManager.js';

export class DynamicUIManager {
  constructor({ onViewInTable, onAddToCart, paymentEnabled }) {
    this.onViewInTable  = onViewInTable;
    this.onAddToCart    = onAddToCart;
    this.paymentEnabled = paymentEnabled;

    this.loader    = new GLTFLoader();
    this.scene     = new THREE.Scene();
    this.camera    = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer  = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.clock     = new THREE.Clock();
    this.model     = null;
    this.modelCache = new Map();
    this.autoRotate = true;
    this.isDragging = false;
    this.lastX      = 0;
    this.touchStartY = 0;
    this.animFrame  = null;

    this._setupRenderer();
    this._setupLighting();
    this._setupCamera();
    this._setupBackground();
  }

  _setupRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    const container = document.getElementById('dynamic-container');
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupCamera() {
    this.camera.position.set(0, 0.5, 3.5);
    this.camera.lookAt(0, 0, 0);
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff5e4, 2.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd4a853, 0.6);
    fill.position.set(-3, 1, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -2, -4);
    this.scene.add(rim);
  }

  _setupBackground() {
    // Subtle particle field as background
    const geo = new THREE.BufferGeometry();
    const count = 180;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xd4a853, size: 0.05, transparent: true, opacity: 0.35 });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  async start() {
    const items = State.menuItems; // AR-enabled dishes only
    if (items.length === 0) {
      this._showEmptyState();
      return;
    }

    this._setupGestures();
    this._setupUIEvents();
    this._buildMenuPanel();
    this._animate();

    await this._loadDish(0);
    this._updateInfoCard(0);
    this._updateDishNav(0);
  }

  _showEmptyState() {
    const el = document.getElementById('dynamic-empty');
    if (el) el.classList.add('visible');
  }

  async _loadDish(index) {
    const items = State.menuItems;
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    this._showModelLoading(true);

    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    if (!item.model) {
      this._showModelLoading(false);
      this._showNoModel();
      setState({ currentDishIndex: index, activeDishId: item.id });
      this._updateInfoCard(index);
      this._updateDishNav(index);
      return;
    }

    try {
      let gltf = this.modelCache.get(item.model);
      if (!gltf) {
        gltf = await new Promise((resolve, reject) =>
          this.loader.load(item.model, resolve, undefined, reject)
        );
        this.modelCache.set(item.model, gltf);
      }

      const m = gltf.scene.clone();
      const scale = item.modelScale ?? 1.0;

      // Fit model to view
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fitScale = (1.4 / maxDim) * scale;
      m.scale.setScalar(fitScale);
      m.userData.canonicalScale = fitScale;

      // Center model
      const center = box.getCenter(new THREE.Vector3());
      m.position.sub(center.multiplyScalar(fitScale));
      m.position.y -= 0.05;

      this.model = m;
      this.scene.add(m);
      this.autoRotate = true;

    } catch (e) {
      console.warn('[Dynamic] Model load failed', e);
      this._showNoModel();
    }

    this._showModelLoading(false);
    setState({ currentDishIndex: index, activeDishId: item.id });
    this._updateInfoCard(index);
    this._updateDishNav(index);

    // Preload adjacent models
    this._preloadAdjacent(index);
  }

  _preloadAdjacent(index) {
    const items = State.menuItems;
    const preload = (i) => {
      if (i < 0 || i >= items.length) return;
      const item = items[i];
      if (item.model && !this.modelCache.has(item.model)) {
        this.loader.load(item.model, (gltf) => this.modelCache.set(item.model, gltf));
      }
    };
    preload(index + 1);
    preload(index - 1);
  }

  _showModelLoading(visible) {
    const el = document.getElementById('dynamic-model-loading');
    if (el) el.classList.toggle('visible', visible);
  }

  _showNoModel() {
    const el = document.getElementById('dynamic-no-model');
    if (el) { el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 2000); }
  }

  _updateInfoCard(index) {
    const items = State.menuItems;
    if (index < 0 || index >= items.length) return;
    const item = items[index];

    const name  = document.getElementById('dynamic-dish-name');
    const price = document.getElementById('dynamic-dish-price');
    const desc  = document.getElementById('dynamic-dish-desc');
    const emoji = document.getElementById('dynamic-dish-emoji');

    if (name)  name.textContent  = item.name;
    if (price) price.textContent = item.price;
    if (desc)  desc.textContent  = item.desc;
    if (emoji) emoji.textContent = item.emoji || '🍽';

    const cartBtn = document.getElementById('dynamic-add-cart-btn');
    if (cartBtn) cartBtn.style.display = this.paymentEnabled ? 'flex' : 'none';
  }

  _updateDishNav(index) {
    const items = State.menuItems;
    const total = items.length;

    const dots = document.getElementById('dynamic-dots');
    if (dots) {
      dots.innerHTML = '';
      items.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'nav-dot' + (i === index ? ' active' : '');
        dot.addEventListener('click', () => this._loadDish(i));
        dots.appendChild(dot);
      });
    }

    const prevBtn = document.getElementById('dynamic-prev-btn');
    const nextBtn = document.getElementById('dynamic-next-btn');
    if (prevBtn) prevBtn.style.opacity = index === 0 ? '0.25' : '1';
    if (nextBtn) nextBtn.style.opacity = index === total - 1 ? '0.25' : '1';
  }

  _buildMenuPanel() {
    // Menu shows ALL items (not just AR ones)
    const allItems = window._allMenuItems || State.menuItems;
    const categories = window._menuCategories || [];

    const grid = document.getElementById('dynamic-dish-grid');
    const cats = document.getElementById('dynamic-categories');
    if (!grid || !cats) return;

    // Build category pills
    cats.innerHTML = '<button class="cat-pill active" data-cat="all">All</button>';
    const usedCats = new Set(allItems.map(i => i.cat));
    usedCats.forEach(cat => {
      const catData = categories.find(c => c.name.toLowerCase() === cat);
      const btn = document.createElement('button');
      btn.className = 'cat-pill';
      btn.dataset.cat = cat;
      btn.textContent = (catData?.emoji ?? '') + ' ' + cat;
      cats.appendChild(btn);
    });

    cats.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        cats.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filterMenuGrid(btn.dataset.cat);
      });
    });

    this._renderMenuGrid(allItems);
  }

  _renderMenuGrid(items) {
    const grid = document.getElementById('dynamic-dish-grid');
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'dish-card';
      card.innerHTML = `
        <span class="dish-emoji">${item.emoji || '🍽'}</span>
        <div class="dish-name">${item.name}</div>
        <div class="dish-desc">${(item.desc || '').slice(0, 60)}</div>
        <div class="dish-price">${item.price}</div>
        ${item.hasAR ? '<div class="dish-ar-badge">AR</div>' : ''}
      `;
      card.addEventListener('click', () => {
        setState({ isMenuOpen: false });
        const menuEl = document.getElementById('dynamic-menu-panel');
        if (menuEl) menuEl.classList.remove('visible');

        if (item.hasAR) {
          const arIndex = State.menuItems.findIndex(m => m.id === item.id);
          if (arIndex !== -1) this._loadDish(arIndex);
        }
      });
      grid.appendChild(card);
    });
  }

  _filterMenuGrid(cat) {
    const allItems = window._allMenuItems || State.menuItems;
    const filtered = cat === 'all' ? allItems : allItems.filter(i => i.cat === cat);
    this._renderMenuGrid(filtered);
  }

  _setupGestures() {
    const canvas = this.renderer.domElement;

    // Drag to rotate
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.lastX = e.clientX;
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.model) return;
      const dx = e.clientX - this.lastX;
      this.model.rotation.y += dx * 0.012;
      this.lastX = e.clientX;
    });
    canvas.addEventListener('mouseup', () => { this.isDragging = false; });
    canvas.addEventListener('mouseleave', () => { this.isDragging = false; });

    // Touch drag to rotate
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.autoRotate = false;
        this.lastX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastX;
        const dy = e.touches[0].clientY - this.touchStartY;

        if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
          this.isDragging = false;
          if (dy < -40) {
            // Swipe up — open menu
            const menuEl = document.getElementById('dynamic-menu-panel');
            if (menuEl) menuEl.classList.add('visible');
            setState({ isMenuOpen: true });
          }
          return;
        }

        if (this.model) this.model.rotation.y += dx * 0.012;
        this.lastX = e.touches[0].clientX;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const dx = e.changedTouches[0].clientX - this.lastX;
      if (Math.abs(dx) > 60) {
        const items = State.menuItems;
        const cur   = State.currentDishIndex;
        if (dx < 0 && cur < items.length - 1) this._loadDish(cur + 1);
        if (dx > 0 && cur > 0)               this._loadDish(cur - 1);
      }
    });

    // Pinch to scale
    let lastPinchDist = null;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) lastPinchDist = null;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !this.model) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDist !== null) {
        const factor = d / lastPinchDist;
        const canon = this.model.userData.canonicalScale ?? this.model.scale.x;
        const next  = this.model.scale.x * factor;
        this.model.scale.setScalar(Math.max(canon * 0.4, Math.min(canon * 4, next)));
      }
      lastPinchDist = d;
    }, { passive: true });
  }

  _setupUIEvents() {
    // Prev/Next buttons
    document.getElementById('dynamic-prev-btn')?.addEventListener('click', () => {
      const cur = State.currentDishIndex;
      if (cur > 0) this._loadDish(cur - 1);
    });
    document.getElementById('dynamic-next-btn')?.addEventListener('click', () => {
      const cur   = State.currentDishIndex;
      const items = State.menuItems;
      if (cur < items.length - 1) this._loadDish(cur + 1);
    });

    // View in Table (AR) button
    document.getElementById('dynamic-view-ar-btn')?.addEventListener('click', () => {
      this.stop();
      if (this.onViewInTable) this.onViewInTable(State.currentDishIndex);
    });

    // Add to Cart button
    document.getElementById('dynamic-add-cart-btn')?.addEventListener('click', () => {
      const items = State.menuItems;
      const item  = items[State.currentDishIndex];
      if (item && this.onAddToCart) this.onAddToCart(item);
    });

    // Menu panel open/close
    const menuToggle = document.getElementById('dynamic-menu-toggle');
    const menuPanel  = document.getElementById('dynamic-menu-panel');
    menuToggle?.addEventListener('click', () => {
      const open = menuPanel?.classList.toggle('visible');
      setState({ isMenuOpen: !!open });
    });
    document.getElementById('dynamic-menu-close')?.addEventListener('click', () => {
      menuPanel?.classList.remove('visible');
      setState({ isMenuOpen: false });
    });
  }

  _animate() {
    this.animFrame = requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    if (this.model && this.autoRotate && !this.isDragging) {
      this.model.rotation.y += delta * 0.55;
    }

    if (this.particles) {
      this.particles.rotation.y += delta * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    const container = document.getElementById('dynamic-container');
    if (container) container.style.display = 'none';

    const ui = document.getElementById('dynamic-ui');
    if (ui) ui.style.display = 'none';
  }
}
