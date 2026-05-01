import { State, setState, subscribe } from './StateManager.js';

export class UIController {
  constructor(onDishSelect) {
    this.onDishSelect = onDishSelect;
    this.bottomSheet = document.getElementById('menu-panel');
    this.dishGrid = document.getElementById('dish-grid');
    this.infoCard = document.getElementById('info-card');
    this.loadingSpinner = document.getElementById('model-loading');

    // Prev-value tracking — each section only runs when its slice of state changed.
    this._prevIsMenuOpen   = null;
    this._prevActiveDishId = null;
    this._prevShowInfoCard = null;
    this._prevIsLoading    = null;
    this._activeCard       = null;  // cached DOM reference for the highlighted dish card

    this.bindEvents();
    subscribe(this.onStateChange.bind(this));
  }

  bindEvents() {
    const handle = document.getElementById('menu-toggle');
    if (handle) {
      handle.addEventListener('click', () => {
        setState({ isMenuOpen: !State.isMenuOpen });
      });
    }

    let startY = 0;
    if (this.bottomSheet) {
      this.bottomSheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
      this.bottomSheet.addEventListener('touchend', e => {
        const delta = e.changedTouches[0].clientY - startY;
        if (delta > 50) setState({ isMenuOpen: false });
        else if (delta < -50) setState({ isMenuOpen: true });
      }, { passive: true });
    }
  }

  onStateChange(state) {
    // ── Section 1: menu sheet — guard on isMenuOpen ───────────────────────
    if (this.bottomSheet && state.isMenuOpen !== this._prevIsMenuOpen) {
      this._prevIsMenuOpen = state.isMenuOpen;
      if (state.isMenuOpen) {
        this.bottomSheet.classList.add('visible');
        this.bottomSheet.classList.remove('minimized');
        setState({ showInfoCard: false });
      } else {
        this.bottomSheet.classList.add('minimized');
        this.bottomSheet.classList.remove('visible');
        if (state.activeDishId) setState({ showInfoCard: true });
      }
    }

    // ── Section 2: dish grid — render once ───────────────────────────────
    if (this.dishGrid && state.menuItems.length > 0 && !this.gridRendered) {
      this.renderMenu(state.menuItems);
      this.gridRendered = true;
    }

    // ── Section 3: active dish highlight — guard on activeDishId ─────────
    if (this.dishGrid && state.activeDishId !== this._prevActiveDishId) {
      this._prevActiveDishId = state.activeDishId;
      if (this._activeCard) this._activeCard.classList.remove('active');
      this._activeCard = state.activeDishId
        ? document.getElementById('dish-' + state.activeDishId)
        : null;
      if (this._activeCard) this._activeCard.classList.add('active');
    }

    // ── Section 4: info card — guard on showInfoCard ──────────────────────
    if (this.infoCard && state.showInfoCard !== this._prevShowInfoCard) {
      this._prevShowInfoCard = state.showInfoCard;
      if (state.showInfoCard && !state.isMenuOpen && state.menuItems.length > 0) {
        const dish = state.menuItems[state.currentDishIndex];
        if (dish) {
          this.infoCard.querySelector('.info-name').textContent  = dish.name;
          this.infoCard.querySelector('.info-price').textContent = dish.price;
          this.infoCard.querySelector('.info-desc').textContent  = dish.desc;
          this.infoCard.classList.add('visible');
        }
      } else {
        this.infoCard.classList.remove('visible');
      }
    }

    // ── Section 5: loading spinner — guard on loading state ──────────────
    if (this.loadingSpinner) {
      const isLoading = !!(state.activeDishId && !state.loadedDishes.has(state.activeDishId));
      if (isLoading !== this._prevIsLoading) {
        this._prevIsLoading = isLoading;
        this.loadingSpinner.classList[isLoading ? 'add' : 'remove']('visible');
      }
    }
  }

  renderMenu(items) {
    this.dishGrid.innerHTML = items.map(dish => `
      <div class="dish-card ${dish.id === State.activeDishId ? 'active' : ''}"
           id="dish-${dish.id}"
           data-id="${dish.id}">
        ${dish.hasAR ? '<span class="dish-ar-badge">AR</span>' : ''}
        <span class="dish-emoji">${dish.emoji}</span>
        <div class="dish-name">${dish.name}</div>
        <div class="dish-desc">${dish.desc}</div>
        <div class="dish-price">${dish.price}</div>
      </div>
    `).join('');

    this.dishGrid.querySelectorAll('.dish-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        setState({ isMenuOpen: false, showInfoCard: false });
        if (this.onDishSelect) this.onDishSelect(id);
      });
    });

    // Seed the cached active card reference after the grid is built
    this._activeCard = State.activeDishId
      ? document.getElementById('dish-' + State.activeDishId)
      : null;
  }

  showInfoCard() {
    setState({ showInfoCard: true });
  }
}
