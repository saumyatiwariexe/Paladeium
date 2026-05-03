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
    this.camera      = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer    = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.clock       = new THREE.Clock();
    this.model       = null;    // current 3D model (or null)
    this.placeholder = null;    // emoji sprite fallback
    this.modelCache  = new Map();
    this.autoRotate  = true;
    this.isDragging  = false;
    this.dragStartX  = 0;
    this.dragStartY  = 0;
    this.animFrame   = null;

    this._setupRenderer();
    this._setupLighting();
    this._setupCamera();
    this._setupParticles();
  }

  // ── Renderer ────────────────────────────────────────────────

  _setupRenderer() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    this.camera.position.set(0, 0.6, 3.8);
    this.camera.lookAt(0, 0, 0);
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const key = new THREE.DirectionalLight(0xfff5e4, 2.6);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd4a853, 0.7);
    fill.position.set(-3, 1, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, -2, -4);
    this.scene.add(rim);
  }

  _setupParticles() {
    const geo = new THREE.BufferGeometry();
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 22;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd4a853, size: 0.06,
      transparent: true, opacity: 0.3,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  // ── Public: start ────────────────────────────────────────────

  async start() {
    this._setupGestures();
    this._setupUIEvents();
    this._buildMenuPanel();   // populates bottom menu
    this._animate();

    const items = State.menuItems;
    if (items.length === 0) {
      document.getElementById('dynamic-empty')?.classList.add('visible');
      return;
    }

    await this._loadDish(0);
  }

  // ── Dish loading ─────────────────────────────────────────────

  async _loadDish(index) {
    const items = State.menuItems;
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    setState({ currentDishIndex: index, activeDishId: item.id });

    // Clear previous
    this._clearScene3D();
    this._showModelLoading(true);

    if (item.model) {
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

        const box    = new THREE.Box3().setFromObject(m);
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fit    = (1.6 / maxDim) * scale;
        m.scale.setScalar(fit);
        m.userData.canonicalScale = fit;

        const center = box.getCenter(new THREE.Vector3());
        m.position.set(
          -center.x * fit,
          -center.y * fit - 0.05,
          -center.z * fit
        );

        this.model = m;
        this.scene.add(m);
        this.autoRotate = true;

      } catch (e) {
        console.warn('[Dynamic] Model load failed:', e.message);
        this._showEmojiPlaceholder(item.emoji || '🍽');
      }
    } else {
      this._showEmojiPlaceholder(item.emoji || '🍽');
    }

    this._showModelLoading(false);
    this._updateInfoCard(index);
    this._updateDishNav(index);
    this._preloadAdjacent(index);
  }

  _clearScene3D() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }
    if (this.placeholder) {
      this.scene.remove(this.placeholder);
      this.placeholder = null;
    }
  }

  // Renders a large emoji onto a canvas texture and shows it as a floating sprite
  _showEmojiPlaceholder(emoji) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background circle
    ctx.fillStyle = 'rgba(212,168,83,0.12)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = `${size * 0.55}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 1.6, 1.6);
    sprite.position.set(0, 0.1, 0);

    this.placeholder = sprite;
    this.scene.add(sprite);
    this.autoRotate = false; // Sprites don't rotate 3-axis
  }

  _preloadAdjacent(index) {
    const items = State.menuItems;
    [-1, 1].forEach(d => {
      const i = index + d;
      if (i >= 0 && i < items.length) {
        const item = items[i];
        if (item.model && !this.modelCache.has(item.model)) {
          this.loader.load(item.model, gltf => this.modelCache.set(item.model, gltf));
        }
      }
    });
  }

  _showModelLoading(visible) {
    document.getElementById('dynamic-model-loading')?.classList.toggle('visible', visible);
  }

  // ── Info card + nav ──────────────────────────────────────────

  _updateInfoCard(index) {
    const item = State.menuItems[index];
    if (!item) return;

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set('dynamic-dish-emoji', item.emoji || '🍽');
    set('dynamic-dish-name',  item.name);
    set('dynamic-dish-price', item.price);
    set('dynamic-dish-desc',  item.desc);

    const cartBtn = document.getElementById('dynamic-add-cart-btn');
    if (cartBtn) cartBtn.style.display = this.paymentEnabled ? 'flex' : 'none';

    // Highlight the matching card in bottom menu
    document.querySelectorAll('.dyn-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === item.id);
    });
  }

  _updateDishNav(index) {
    const items = State.menuItems;

    const dots = document.getElementById('dynamic-dots');
    if (dots) {
      dots.innerHTML = '';
      // Only show dots when <= 8 items, otherwise hide to avoid clutter
      if (items.length <= 8) {
        items.forEach((_, i) => {
          const dot = document.createElement('div');
          dot.className = 'nav-dot' + (i === index ? ' active' : '');
          dot.addEventListener('click', () => this._loadDish(i));
          dots.appendChild(dot);
        });
      }
    }

    const prevBtn = document.getElementById('dynamic-prev-btn');
    const nextBtn = document.getElementById('dynamic-next-btn');
    if (prevBtn) prevBtn.style.opacity = index === 0 ? '0.2' : '1';
    if (nextBtn) nextBtn.style.opacity = index === items.length - 1 ? '0.2' : '1';
  }

  // ── Bottom menu panel ─────────────────────────────────────────

  _buildMenuPanel() {
    const allItems  = window._allMenuItems   || State.menuItems;
    const allCats   = window._menuCategories || [];
    const cats      = document.getElementById('dynamic-categories');
    const grid      = document.getElementById('dynamic-dish-grid');
    if (!cats || !grid) return;

    // Category pills
    cats.innerHTML = '<button class="cat-pill active" data-cat="all">All</button>';
    const usedCats = [...new Set(allItems.map(i => i.cat))];
    usedCats.forEach(cat => {
      const meta = allCats.find(c => c.name.toLowerCase() === cat);
      const btn  = document.createElement('button');
      btn.className    = 'cat-pill';
      btn.dataset.cat  = cat;
      btn.textContent  = (meta?.emoji ? meta.emoji + ' ' : '') + cat.charAt(0).toUpperCase() + cat.slice(1);
      cats.appendChild(btn);
    });

    cats.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        cats.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderGrid(btn.dataset.cat === 'all' ? allItems : allItems.filter(i => i.cat === btn.dataset.cat));
      });
    });

    this._renderGrid(allItems);

    // Start panel in minimized state (peek at bottom)
    const panel = document.getElementById('dynamic-menu-panel');
    if (panel) panel.classList.add('minimized');
  }

  _renderGrid(items) {
    const grid = document.getElementById('dynamic-dish-grid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className    = 'dish-card dyn-card';
      card.dataset.id   = item.id;
      card.innerHTML    = `
        <span class="dish-emoji">${item.emoji || '🍽'}</span>
        <div class="dish-name">${item.name}</div>
        <div class="dish-desc">${(item.desc || '').slice(0, 55)}</div>
        <div class="dish-price">${item.price}</div>
        ${item.hasAR ? '<div class="dish-ar-badge">3D</div>' : ''}
      `;
      card.addEventListener('click', () => {
        if (item.hasAR) {
          const arIndex = State.menuItems.findIndex(m => m.id === item.id);
          if (arIndex !== -1) {
            this._loadDish(arIndex);
            // Minimize menu after selection
            const panel = document.getElementById('dynamic-menu-panel');
            if (panel) { panel.classList.remove('open'); panel.classList.add('minimized'); }
          }
        }
      });
      grid.appendChild(card);
    });
  }

  // ── Gestures ────────────────────────────────────────────────

  _setupGestures() {
    const canvas = this.renderer.domElement;

    // ── Mouse ──
    canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.autoRotate = false;
      this.dragStartX = e.clientX;
    });
    canvas.addEventListener('mousemove', e => {
      if (!this.isDragging || !this.model) return;
      this.model.rotation.y += (e.clientX - this.dragStartX) * 0.013;
      this.dragStartX = e.clientX;
    });
    ['mouseup', 'mouseleave'].forEach(ev =>
      canvas.addEventListener(ev, () => { this.isDragging = false; })
    );

    // ── Touch ──
    let swipeStartX = 0, swipeStartY = 0, swipeMoved = false;

    canvas.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      swipeStartX  = e.touches[0].clientX;
      swipeStartY  = e.touches[0].clientY;
      swipeMoved   = false;
      this.dragStartX = swipeStartX;
      this.isDragging = true;
      this.autoRotate = false;
    }, { passive: true });

    canvas.addEventListener('touchmove', e => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - swipeStartX;
      const dy = e.touches[0].clientY - swipeStartY;

      // Vertical swipe → open menu (ignore horizontal drag)
      if (!swipeMoved && Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx)) {
        this.isDragging = false;
        swipeMoved = true;
        if (dy < -22) {
          const panel = document.getElementById('dynamic-menu-panel');
          if (panel) { panel.classList.add('open'); panel.classList.remove('minimized'); }
        }
        return;
      }

      if (!swipeMoved && this.model) {
        this.model.rotation.y += (e.touches[0].clientX - this.dragStartX) * 0.013;
        this.dragStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', e => {
      this.isDragging = false;
      if (swipeMoved) return;

      const dx = e.changedTouches[0].clientX - swipeStartX;
      if (Math.abs(dx) > 55) {
        const cur   = State.currentDishIndex;
        const items = State.menuItems;
        if (dx < -55 && cur < items.length - 1) this._loadDish(cur + 1);
        if (dx >  55 && cur > 0)                this._loadDish(cur - 1);
      }
    }, { passive: true });

    // Pinch to scale
    let pinchDist = null;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinchDist = null;
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !this.model) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchDist !== null) {
        const factor = d / pinchDist;
        const canon  = this.model.userData.canonicalScale ?? this.model.scale.x;
        const next   = THREE.MathUtils.clamp(this.model.scale.x * factor, canon * 0.35, canon * 4.5);
        this.model.scale.setScalar(next);
      }
      pinchDist = d;
    }, { passive: true });
  }

  // ── UI Events ─────────────────────────────────────────────────

  _setupUIEvents() {
    // Prev / Next
    document.getElementById('dynamic-prev-btn')?.addEventListener('click', () => {
      const cur = State.currentDishIndex;
      if (cur > 0) this._loadDish(cur - 1);
    });
    document.getElementById('dynamic-next-btn')?.addEventListener('click', () => {
      const cur   = State.currentDishIndex;
      const items = State.menuItems;
      if (cur < items.length - 1) this._loadDish(cur + 1);
    });

    // View in Table → launches AR
    document.getElementById('dynamic-view-ar-btn')?.addEventListener('click', () => {
      this.stop();
      if (this.onViewInTable) this.onViewInTable(State.currentDishIndex);
    });

    // Add to Cart
    document.getElementById('dynamic-add-cart-btn')?.addEventListener('click', () => {
      const item = State.menuItems[State.currentDishIndex];
      if (item && this.onAddToCart) this.onAddToCart(item);
    });

    // Menu handle toggle (expand / minimize)
    const panel       = document.getElementById('dynamic-menu-panel');
    const handleArea  = document.getElementById('dynamic-menu-handle-area');
    const menuBtn     = document.getElementById('dynamic-menu-btn');
    const closeBtn    = document.getElementById('dynamic-menu-close');

    const openMenu  = () => { panel?.classList.add('open');   panel?.classList.remove('minimized'); };
    const closeMenu = () => { panel?.classList.remove('open'); panel?.classList.add('minimized'); };

    handleArea?.addEventListener('click', () => {
      if (panel?.classList.contains('open')) closeMenu(); else openMenu();
    });
    menuBtn?.addEventListener('click', openMenu);
    closeBtn?.addEventListener('click', closeMenu);
  }

  // ── Render loop ──────────────────────────────────────────────

  _animate() {
    this.animFrame = requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    if (this.model && this.autoRotate && !this.isDragging) {
      this.model.rotation.y += delta * 0.55;
    }
    if (this.particles) {
      this.particles.rotation.y += delta * 0.018;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── Cleanup ──────────────────────────────────────────────────

  stop() {
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
    const container = document.getElementById('dynamic-container');
    if (container) container.style.display = 'none';
    const ui = document.getElementById('dynamic-ui');
    if (ui)        ui.style.display = 'none';
    const panel = document.getElementById('dynamic-menu-panel');
    if (panel)     panel.style.display = 'none';
  }
}
