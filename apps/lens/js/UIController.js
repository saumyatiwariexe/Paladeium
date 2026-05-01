import { State, setState, subscribe } from './StateManager.js';

export class UIController {
  constructor(onDishSelect) {
    this.onDishSelect = onDishSelect;
    this.bottomSheet = document.getElementById('menu-panel');
    this.dishGrid = document.getElementById('dish-grid');
    this.infoCard = document.getElementById('info-card');
    this.loadingSpinner = document.getElementById('model-loading');

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
    
    // Bottom sheet drag handles
    let startY = 0;
    if (this.bottomSheet) {
      this.bottomSheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
      this.bottomSheet.addEventListener('touchend', e => {
        const delta = e.changedTouches[0].clientY - startY;
        if (delta > 50) setState({ isMenuOpen: false }); // Swiped down
        else if (delta < -50) setState({ isMenuOpen: true }); // Swiped up
      }, { passive: true });
    }
  }

  onStateChange(state) {
    // Menu visibility
    if (this.bottomSheet) {
      if (state.isMenuOpen) {
        this.bottomSheet.classList.add('visible');
        this.bottomSheet.classList.remove('minimized');
        setState({ showInfoCard: false });
      } else {
        this.bottomSheet.classList.add('minimized');
        this.bottomSheet.classList.remove('visible');
        // If an AR dish is active, show the info card again
        if (state.activeDishId) setState({ showInfoCard: true });
      }
    }

    // Dish grid rendering
    if (this.dishGrid && state.menuItems.length > 0 && !this.gridRendered) {
      this.renderMenu(state.menuItems);
      this.gridRendered = true;
    }

    // Update active dish in menu
    if (this.dishGrid) {
      this.dishGrid.querySelectorAll('.dish-card').forEach(c => c.classList.remove('active'));
      const activeCard = document.getElementById('dish-' + state.activeDishId);
      if (activeCard) activeCard.classList.add('active');
    }

    // Info card visibility
    if (this.infoCard) {
      if (state.showInfoCard && !state.isMenuOpen && state.menuItems.length > 0) {
        const dish = state.menuItems[state.currentDishIndex];
        if (dish) {
          this.infoCard.querySelector('.info-name').textContent = dish.name;
          this.infoCard.querySelector('.info-price').textContent = dish.price;
          this.infoCard.querySelector('.info-desc').textContent = dish.desc;
          this.infoCard.classList.add('visible');
        }
      } else {
        this.infoCard.classList.remove('visible');
      }
    }

    // Loading Spinner
    if (this.loadingSpinner) {
      if (state.activeDishId && !state.loadedDishes.has(state.activeDishId)) {
        // Active dish is not loaded yet
        this.loadingSpinner.classList.add('visible');
      } else {
        this.loadingSpinner.classList.remove('visible');
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
  }

  showInfoCard() {
    setState({ showInfoCard: true });
  }
}
