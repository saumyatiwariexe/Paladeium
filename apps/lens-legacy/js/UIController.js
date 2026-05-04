import { State, setState, subscribe } from './StateManager.js';

export class UIController {
  constructor(onDishSelect) {
    this.onDishSelect = onDishSelect;
    this.bottomSheet = document.getElementById('menu-panel');
    this.dishGrid = document.getElementById('ar-dish-grid');
    this.infoCard = document.getElementById('info-card');
    this.loadingSpinner = document.getElementById('model-loading');

    this._prevIsMenuOpen   = null;
    this._prevActiveDishId = null;
    this._prevShowInfoCard = null;
    this._prevIsLoading    = null;
    this._activeCard       = null;

    this.bindEvents();
    subscribe(this.onStateChange.bind(this));
  }

  bindEvents() {
    const handle = document.getElementById('menu-handle-area');
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
    if (this.bottomSheet && state.isMenuOpen !== this._prevIsMenuOpen) {
      this._prevIsMenuOpen = state.isMenuOpen;
      if (state.isMenuOpen) {
        this.bottomSheet.classList.add('visible');
        this.bottomSheet.classList.remove('minimized');
      } else {
        this.bottomSheet.classList.add('minimized');
        this.bottomSheet.classList.remove('visible');
      }
    }

    if (this.dishGrid && state.menuItems.length > 0 && !this.gridRendered) {
      this.renderMenu(state.menuItems);
      this.gridRendered = true;
    }

    if (this.dishGrid && state.activeDishId !== this._prevActiveDishId) {
      this._prevActiveDishId = state.activeDishId;
      if (this._activeCard) this._activeCard.classList.remove('active');
      this._activeCard = state.activeDishId ? document.getElementById('dish-' + state.activeDishId) : null;
      if (this._activeCard) this._activeCard.classList.add('active');
    }

    if (this.infoCard && state.showInfoCard !== this._prevShowInfoCard) {
      this._prevShowInfoCard = state.showInfoCard;
      if (state.showInfoCard && state.menuItems.length > 0) {
        const dish = state.menuItems[state.currentDishIndex];
        if (dish) {
          const nameEl = this.infoCard.querySelector('.info-name') || document.getElementById('ar-item-name');
          const priceEl = this.infoCard.querySelector('.info-price') || document.getElementById('ar-item-price');
          const descEl = this.infoCard.querySelector('.info-desc') || document.getElementById('ar-item-desc');
          
          if (nameEl) nameEl.textContent = dish.name;
          if (priceEl) priceEl.textContent = dish.price;
          if (descEl) descEl.textContent = dish.desc;
          this.infoCard.classList.add('visible');
        }
      } else {
        this.infoCard.classList.remove('visible');
      }
    }

    if (this.loadingSpinner) {
      const isLoading = !!(state.activeDishId && !state.loadedDishes.has(state.activeDishId));
      if (isLoading !== this._prevIsLoading) {
        this._prevIsLoading = isLoading;
        this.loadingSpinner.classList[isLoading ? 'add' : 'remove']('visible');
      }
    }
  }

  renderMenu(items) {
    if (!this.dishGrid) return;
    this.dishGrid.innerHTML = items.map(dish => `
      <div class="dish-card ${dish.id === State.activeDishId ? 'active' : ''}" id="dish-${dish.id}" data-id="${dish.id}">
        <div class="dish-emoji">${dish.emoji || '🍽'}</div>
        <div class="dish-info-content">
          <div class="dish-name">${dish.name}</div>
          <div class="dish-desc">${dish.desc.slice(0, 45)}...</div>
        </div>
        <div class="dish-price-badge">
          <div class="dish-price">${dish.price}</div>
          <div class="dish-ar-badge">AR</div>
        </div>
      </div>
    `).join('');

    this.dishGrid.querySelectorAll('.dish-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        setState({ isMenuOpen: false });
        if (this.onDishSelect) this.onDishSelect(id);
      });
    });

    this._activeCard = State.activeDishId ? document.getElementById('dish-' + State.activeDishId) : null;
  }
}
