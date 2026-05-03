export const State = {
  currentDishIndex: 0,
  loadedDishes: new Map(),
  isMenuOpen: false,
  anchorPlaced: false,
  menuItems: [],       // AR-enabled items only (for 3D viewer)
  activeDishId: null,
  showInfoCard: false,
  restaurantSlug: null,
  uiType: 'ar',        // 'ar' | 'dynamic'
  paymentEnabled: false,
};

const listeners = [];

export function setState(updates) {
  let changed = false;
  for (const key in updates) {
    if (State[key] !== updates[key]) {
      State[key] = updates[key];
      changed = true;
    }
  }
  if (changed) {
    listeners.forEach(l => l(State));
  }
}

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}
